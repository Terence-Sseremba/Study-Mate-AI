import type { Plugin, ViteDevServer } from 'vite';
import fs from 'fs';
import path from 'path';
import { GoogleGenAI } from '@google/genai';
import type { StudyMaterial, TutorPreferences, TutorInteractionMode } from '../types/index.ts';
import { buildEffectiveTutorInstructions } from '../lib/tutorInstructions.ts';
import {
  retrieveRelevantChunks,
  buildCitation,
  generateLocalGroundedAnswer,
} from '../lib/documentRetrieval.ts';
import { generateContentWithRetry } from './geminiResilience.ts';

/**
 * Retrieves the Gemini API key from process.env or directly from the .env file if needed.
 */
function getGeminiApiKey(): string | undefined {
  if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY') {
    return process.env.GEMINI_API_KEY;
  }
  try {
    const envPath = path.resolve(process.cwd(), '.env');
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf-8');
      const match = content.match(/^GEMINI_API_KEY\s*=\s*(.+)$/m);
      if (match && match[1]) {
        const val = match[1].trim().replace(/^['"]|['"]$/g, '');
        if (val && val !== 'MY_GEMINI_API_KEY') {
          process.env.GEMINI_API_KEY = val;
          return val;
        }
      }
    }
  } catch {
    // Ignore file read errors
  }
  return undefined;
}

/**
 * Vite Dev Server plugin providing server-side API endpoints for StudyMate AI.
 * Keeps API keys and sensitive operations strictly on the server-side.
 */
export function studyMateApiPlugin(): Plugin {
  return {
    name: 'studymate-api-routes',
    configureServer(server: ViteDevServer) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url?.split('?')[0];

        // 1. GET /api/status - Check backend status and Gemini API key availability
        if (url === '/api/status' && req.method === 'GET') {
          const apiKey = getGeminiApiKey();
          const hasApiKey = Boolean(apiKey);
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(
            JSON.stringify({
              status: 'ok',
              apiKeyConfigured: hasApiKey,
              model: 'gemini-3.8-flash',
              groundingEngine: 'Local-Semantic-Index + Relevance Gate',
              timestamp: new Date().toISOString(),
            })
          );
          return;
        }

        // 2. POST /api/tutor or /api/tutor/chat - Intelligent Tutor Routing, Relevance Validation & Resilient Answering
        if ((url === '/api/tutor' || url === '/api/tutor/chat') && req.method === 'POST') {
          let body = '';
          req.on('data', (chunk) => {
            body += chunk;
          });

          req.on('end', async () => {
            const sendJson = (statusCode: number, payload: any) => {
              res.statusCode = statusCode;
              res.setHeader('Content-Type', 'application/json; charset=utf-8');
              res.end(JSON.stringify(payload));
            };

            try {
              let data: any = {};
              try {
                data = JSON.parse(body || '{}');
              } catch {
                sendJson(400, { error: 'Invalid JSON request payload', route: 'error' });
                return;
              }

              const {
                question,
                materialId,
                materials = [],
                preferences,
                studentName,
                mode: rawMode,
                interactionMode,
                simulateError, // For controlled resilience testing
              } = data;

              const mode = rawMode || interactionMode || 'smart_tutor';

              if (!question || typeof question !== 'string' || !question.trim()) {
                sendJson(400, { error: 'Question is required', route: 'error' });
                return;
              }

              // Controlled error simulations for testing requirements
              if (simulateError === '503' || question === '__SIMULATE_503__') {
                sendJson(503, {
                  error: 'The AI service is temporarily unavailable.',
                  route: 'error',
                  isBusyError: true,
                  canRetry: true,
                  simulated: true,
                });
                return;
              }

              if (simulateError === 'timeout' || question === '__SIMULATE_TIMEOUT__') {
                sendJson(504, {
                  error: 'StudyMate is taking longer than expected. Please try again.',
                  route: 'error',
                  isTimeout: true,
                  canRetry: true,
                  simulated: true,
                });
                return;
              }

              if (simulateError === '429' || question === '__SIMULATE_429__') {
                sendJson(429, {
                  error: 'AI usage limit reached. Please try again when service is available.',
                  route: 'error',
                  isRateLimit: true,
                  canRetry: true,
                  simulated: true,
                });
                return;
              }

              if (simulateError === 'html' || question === '__SIMULATE_HTML__') {
                res.statusCode = 504;
                res.setHeader('Content-Type', 'text/html; charset=utf-8');
                res.end('<!doctype html><html><head><title>504 Gateway Timeout</title></head><body><h1>504 Gateway Timeout</h1></body></html>');
                return;
              }

              const tutorMode: TutorInteractionMode =
                mode === 'grounded_study' ? 'grounded_study' : 'smart_tutor';
              const userMaterials: StudyMaterial[] = Array.isArray(materials) ? materials : [];
              const apiKey = getGeminiApiKey();
              const hasApiKey = Boolean(apiKey);

              // Build effective system instructions using our dedicated module
              const effectiveSystemPrompt = preferences
                ? buildEffectiveTutorInstructions(preferences as TutorPreferences, {
                    studentName,
                  })
                : 'You are StudyMate AI, a personalized, source-grounded academic tutor.';

              // =========================================================================
              // RELEVANCE & INTENT ROUTER
              // Evaluates whether uploaded materials genuinely contain information
              // relevant enough to answer the user's specific question.
              // =========================================================================
              const retrieval = retrieveRelevantChunks(userMaterials, question, {
                materialIdFilter: materialId || undefined,
                maxResults: 3,
                sufficiencyThreshold: 0.45,
              });

              const isMaterialsRelevant = retrieval.isSufficient && retrieval.matches.length > 0;

              // =========================================================================
              // ROUTE 1: GROUNDED STUDY MODE (STRICT SCOPE)
              // =========================================================================
              if (tutorMode === 'grounded_study') {
                if (!isMaterialsRelevant) {
                  const refusalMessage =
                    "I couldn't find enough information in your uploaded study materials to answer that question. You can upload relevant materials or switch to Smart Tutor for general explanations.";

                  sendJson(200, {
                    route: 'insufficient',
                    answer: refusalMessage,
                    citations: [],
                    grounded: false,
                    isGroundingVerified: false,
                    sourceLabel: undefined,
                    isUnsupportedInMaterials: true,
                    model: 'StudyMate Grounded Scope',
                    apiKeyConfigured: hasApiKey,
                  });
                  return;
                }

                const citations = retrieval.matches.map((m) =>
                  buildCitation(m.chunk, m.score, m.matchedKeywords)
                );

                if (hasApiKey) {
                  const excerptsBlock = retrieval.matches
                    .map((m, idx) => {
                      const c = m.chunk;
                      const anchor =
                        c.anchorLabel ||
                        (c.pageNumber
                          ? `Page ${c.pageNumber}`
                          : c.slideNumber
                          ? `Slide ${c.slideNumber}`
                          : c.sectionHeading);
                      return `[PASSAGE ${idx + 1} | Source: "${c.materialTitle}" (${c.filename || c.materialTitle}) | Location: ${anchor} | Section: ${c.sectionHeading}]\n${c.extractedText}`;
                    })
                    .join('\n\n---\n\n');

                  const groundingInstruction = `${effectiveSystemPrompt}

### VERIFIED GROUNDING SOURCE PASSAGES (REFERENCE DATA):
The following excerpts are authentic passages retrieved from the student's uploaded course documents:

${excerptsBlock}

### CRITICAL GROUNDING AND INTEGRITY DIRECTIVES:
1. Verify that the excerpts above genuinely address the student's question: "${question}".
2. If the excerpts do not contain enough substantive information to answer the question, output ONLY: ROUTE_UNSUPPORTED
3. If they are relevant, explain the answer naturally and clearly using ONLY the verified facts and definitions from the source passages above. Do NOT merely copy or dump the raw text passage verbatim—synthesize a coherent, well-structured explanation for the student.
4. Maintain clean, professional formatting with clear headings, bold key concepts, and formatted bullet points or numbered steps where appropriate.
5. Explicitly reference the document title and source anchor (e.g. Page X, Slide Y, or Section).
6. Adhere to the student's pedagogical preferences (approach, difficulty, style, length, knowledge check).`;

                  const ai = new GoogleGenAI({ apiKey: apiKey! });
                  const callResult = await generateContentWithRetry(ai, {
                    model: 'gemini-3.8-flash',
                    contents: question,
                    config: {
                      systemInstruction: groundingInstruction,
                    },
                    maxRetries: 2,
                    baseDelayMs: 1000,
                  });

                  if (callResult.success && callResult.data) {
                    const text = callResult.data.text?.trim() || '';

                    if (text === 'ROUTE_UNSUPPORTED' || text.startsWith('ROUTE_UNSUPPORTED') || text.includes('ROUTE_UNSUPPORTED')) {
                      sendJson(200, {
                        route: 'insufficient',
                        answer: "I couldn't find enough information in your uploaded study materials to answer that question. You can upload relevant material or switch to Smart Tutor for a general explanation.",
                        text: "I couldn't find enough information in your uploaded study materials to answer that question. You can upload relevant material or switch to Smart Tutor for a general explanation.",
                        citations: [],
                        grounded: false,
                        isGroundingVerified: false,
                        sourceLabel: undefined,
                        model: 'StudyMate Grounded Scope',
                        apiKeyConfigured: true,
                      });
                      return;
                    }

                    sendJson(200, {
                      route: 'grounded',
                      answer: text || 'No response generated.',
                      text: text || 'No response generated.',
                      citations,
                      grounded: true,
                      isGroundingVerified: true,
                      sourceLabel: 'Based on Your Study Materials',
                      model: 'gemini-3.8-flash (Source-Grounded)',
                      apiKeyConfigured: true,
                    });
                    return;
                  }

                  // If Gemini request failed, return clean error response
                  sendJson(callResult.statusCode || 503, {
                    error: callResult.userFacingMessage || 'The AI service is temporarily unavailable.',
                    route: 'error',
                    isBusyError: callResult.isBusyError,
                    isTimeout: callResult.isTimeout,
                    isRateLimit: callResult.isRateLimit,
                    canRetry: true,
                  });
                  return;
                }

                // Local synthesis fallback with genuine citations
                const localResult = generateLocalGroundedAnswer(
                  question,
                  retrieval.matches,
                  preferences as TutorPreferences,
                  { interactionMode: 'grounded_study' }
                );

                sendJson(200, {
                  route: 'grounded',
                  answer: localResult.answer,
                  text: localResult.answer,
                  citations,
                  grounded: true,
                  isGroundingVerified: true,
                  sourceLabel: 'Based on Your Study Materials',
                  model: 'StudyMate Grounded Engine',
                  apiKeyConfigured: false,
                });
                return;
              }

              // =========================================================================
              // ROUTE 2: SMART TUTOR MODE (HYBRID RELEVANCE-AWARE)
              // =========================================================================

              // Case 2A: Uploaded materials genuinely contain information relevant to the question
              if (isMaterialsRelevant) {
                const citations = retrieval.matches.map((m) =>
                  buildCitation(m.chunk, m.score, m.matchedKeywords)
                );

                if (hasApiKey) {
                  const excerptsBlock = retrieval.matches
                    .map((m, idx) => {
                      const c = m.chunk;
                      const anchor =
                        c.anchorLabel ||
                        (c.pageNumber
                          ? `Page ${c.pageNumber}`
                          : c.slideNumber
                          ? `Slide ${c.slideNumber}`
                          : c.sectionHeading);
                      return `[PASSAGE ${idx + 1} | Source: "${c.materialTitle}" (${c.filename || c.materialTitle}) | Location: ${anchor} | Section: ${c.sectionHeading}]\n${c.extractedText}`;
                    })
                    .join('\n\n---\n\n');

                  const groundingInstruction = `${effectiveSystemPrompt}

### VERIFIED GROUNDING SOURCE PASSAGES (REFERENCE DATA):
The following excerpts are authentic passages retrieved from the student's uploaded course documents:

${excerptsBlock}

### CRITICAL GROUNDING AND INTEGRITY DIRECTIVES:
1. Verify that the excerpts above genuinely address the student's question: "${question}".
2. If the excerpts do NOT contain substantive information relevant to "${question}" (for example, if the question is from a different academic subject), output ONLY: ROUTE_UNSUPPORTED
3. If they are relevant, ground your answer strictly in the verified facts and definitions in the source passages above.
4. Explicitly reference the document title and source anchor (e.g. Page X, Slide Y, or Section).
5. Adhere to the student's pedagogical preferences (approach, difficulty, style, length, knowledge check).`;

                  const ai = new GoogleGenAI({ apiKey: apiKey! });
                  const callResult = await generateContentWithRetry(ai, {
                    model: 'gemini-3.8-flash',
                    contents: question,
                    config: {
                      systemInstruction: groundingInstruction,
                    },
                    maxRetries: 2,
                    baseDelayMs: 1000,
                  });

                  if (callResult.success && callResult.data) {
                    const text = callResult.data.text?.trim() || '';

                    if (text !== 'ROUTE_UNSUPPORTED' && !text.startsWith('ROUTE_UNSUPPORTED')) {
                      sendJson(200, {
                        route: 'grounded',
                        answer: text || 'No response generated.',
                        text: text || 'No response generated.',
                        citations,
                        grounded: true,
                        isGroundingVerified: true,
                        sourceLabel: 'Based on Your Study Materials',
                        model: 'gemini-3.8-flash (Source-Grounded)',
                        apiKeyConfigured: true,
                      });
                      return;
                    }
                    // Model identified passages were not relevant -> fall through to general knowledge
                  } else if (!callResult.success) {
                    sendJson(callResult.statusCode || 503, {
                      error: callResult.userFacingMessage || 'The AI service is temporarily unavailable.',
                      route: 'error',
                      isBusyError: callResult.isBusyError,
                      isTimeout: callResult.isTimeout,
                      isRateLimit: callResult.isRateLimit,
                      canRetry: true,
                    });
                    return;
                  }
                } else {
                  // No API key: Local synthesis with genuine citations
                  const localResult = generateLocalGroundedAnswer(
                    question,
                    retrieval.matches,
                    preferences as TutorPreferences,
                    { interactionMode: 'smart_tutor' }
                  );

                  sendJson(200, {
                    route: 'grounded',
                    answer: localResult.answer,
                    text: localResult.answer,
                    citations,
                    grounded: true,
                    isGroundingVerified: true,
                    sourceLabel: 'Based on Your Study Materials',
                    model: 'StudyMate Grounded Engine',
                    apiKeyConfigured: false,
                  });
                  return;
                }
              }

              // Case 2B: Uploaded materials do NOT contain sufficiently relevant information.
              // Route to GENERAL KNOWLEDGE:
              // Answer using general academic knowledge without mentioning unrelated uploaded files or tax concepts.
              if (hasApiKey) {
                const generalKnowledgePrompt = `${effectiveSystemPrompt}

ROUTING INSTRUCTION (SMART TUTOR GENERAL KNOWLEDGE):
The student's question ("${question}") is not addressed by their currently uploaded study materials.
You must answer the student's question directly, helpfully, and accurately using general academic knowledge.

STRICT INTEGRITY DIRECTIVES:
1. Do NOT mention, reference, or cite any uploaded files or unrelated course topics (for example, if the user uploaded taxation notes, DO NOT mention taxation, business income, or customs).
2. Answer purely the subject matter of the question using standard academic principles.
3. Adhere to the student's pedagogical preferences (approach, difficulty, style, length, knowledge check).
4. Do NOT fabricate citations or claim this came from course files.`;

                const ai = new GoogleGenAI({ apiKey: apiKey! });
                const callResult = await generateContentWithRetry(ai, {
                  model: 'gemini-3.8-flash',
                  contents: question,
                  config: {
                    systemInstruction: generalKnowledgePrompt,
                  },
                  maxRetries: 2,
                  baseDelayMs: 1000,
                });

                if (callResult.success && callResult.data) {
                  sendJson(200, {
                    route: 'general',
                    answer: callResult.data.text || 'No response generated.',
                    text: callResult.data.text || 'No response generated.',
                    citations: [],
                    grounded: false,
                    isGroundingVerified: false,
                    sourceLabel: 'General Knowledge',
                    model: 'gemini-3.8-flash (General Knowledge)',
                    apiKeyConfigured: true,
                  });
                  return;
                }

                // If Gemini request failed
                sendJson(callResult.statusCode || 503, {
                  error: callResult.userFacingMessage || 'The AI service is temporarily unavailable.',
                  route: 'error',
                  isBusyError: callResult.isBusyError,
                  isTimeout: callResult.isTimeout,
                  isRateLimit: callResult.isRateLimit,
                  canRetry: true,
                });
                return;
              }

              // Local fallback for Smart Tutor when no API key is available
              const localResult = generateLocalGroundedAnswer(
                question,
                [],
                preferences as TutorPreferences,
                { interactionMode: 'smart_tutor' }
              );

              sendJson(200, {
                route: 'general',
                answer: localResult.answer,
                text: localResult.answer,
                citations: [],
                grounded: false,
                isGroundingVerified: false,
                sourceLabel: 'General Knowledge',
                model: 'StudyMate Educational Engine',
                apiKeyConfigured: false,
              });
            } catch (err: any) {
              console.error('Unhandled error in /api/tutor:', err);
              sendJson(500, {
                error: 'The AI service is temporarily unavailable.',
                route: 'error',
                canRetry: true,
              });
            }
          });
          return;
        }

        next();
      });
    },
  };
}
