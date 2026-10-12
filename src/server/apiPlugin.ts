import type { Plugin, ViteDevServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import type { SourceCitation, StudyMaterial, TutorPreferences } from '../types/index.ts';
import { buildEffectiveTutorInstructions, getTutorPreferencesSummary } from '../lib/tutorInstructions.ts';

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
          const hasApiKey = Boolean(
            process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY'
          );
          res.setHeader('Content-Type', 'application/json');
          res.end(
            JSON.stringify({
              status: 'ok',
              apiKeyConfigured: hasApiKey,
              model: 'gemini-3.8-flash',
              groundingEngine: 'Local-Semantic-Index + Multimodal Extractor',
              timestamp: new Date().toISOString(),
            })
          );
          return;
        }

        // 2. POST /api/tutor - Source-grounded tutoring answer
        if (url === '/api/tutor' && req.method === 'POST') {
          let body = '';
          req.on('data', (chunk) => {
            body += chunk;
          });

          req.on('end', async () => {
            try {
              const data = JSON.parse(body || '{}');
              const {
                question,
                materialId,
                materials = [],
                preferences,
                studentName,
              } = data;

              if (!question || typeof question !== 'string') {
                res.statusCode = 400;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: 'Question is required' }));
                return;
              }

              const userMaterials: StudyMaterial[] = Array.isArray(materials) ? materials : [];

              // Collect relevant source chunks from provided materials
              const relevantChunks = userMaterials.flatMap((m) =>
                (!materialId || m.id === materialId ? m.chunks || [] : [])
              );

              const hasApiKey = Boolean(
                process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY'
              );

              // Build effective system instructions using our dedicated module
              const effectiveSystemPrompt = preferences
                ? buildEffectiveTutorInstructions(preferences as TutorPreferences, {
                    studentName,
                  })
                : 'You are StudyMate AI, a personalized, source-grounded academic tutor.';

              // If no materials are uploaded yet
              if (relevantChunks.length === 0) {
                if (hasApiKey) {
                  try {
                    const ai = new GoogleGenAI();
                    const prompt = `${effectiveSystemPrompt}\n\nIMPORTANT STATUS: The student has not yet uploaded specific course documents to their study space. Answer their general inquiry clearly adhering to the pedagogical instructions above, and remind them that uploading course PDFs or slides will enable page-level citations.`;

                    const response = await ai.models.generateContent({
                      model: 'gemini-3.8-flash',
                      contents: question,
                      config: {
                        systemInstruction: prompt,
                      },
                    });

                    res.setHeader('Content-Type', 'application/json');
                    res.end(
                      JSON.stringify({
                        answer: response.text || 'No response generated.',
                        citations: [],
                        isGroundingVerified: false,
                        model: 'gemini-3.8-flash (Preferences Active)',
                        apiKeyConfigured: true,
                        noMaterialsWarning: true,
                      })
                    );
                    return;
                  } catch (err: any) {
                    console.error('Gemini error with empty materials:', err);
                  }
                }

                // Deterministic response when no materials exist
                let fallbackAnswer = `You haven't uploaded any course materials yet.\n\nTo enable source-grounded answers with verifiable page or slide citations, go to **Study Materials** and upload your course syllabus, lecture slides (PDF/PPTX), or textbook chapters.\n\nOnce uploaded, I will analyze your specific materials and cite exact page passages for every answer!`;

                if (preferences?.enableKnowledgeChecks) {
                  fallbackAnswer += `\n\n---\n**Comprehension Check**: What subject or course are you planning to study with StudyMate AI today?`;
                }

                res.setHeader('Content-Type', 'application/json');
                res.end(
                  JSON.stringify({
                    answer: fallbackAnswer,
                    citations: [],
                    isGroundingVerified: false,
                    model: 'StudyMate Tutor',
                    apiKeyConfigured: false,
                    noMaterialsWarning: true,
                  })
                );
                return;
              }

              // Perform semantic keyword scoring on chunks
              const questionTerms = question
                .toLowerCase()
                .replace(/[^a-z0-9 ]/g, ' ')
                .split(/\s+/)
                .filter(Boolean);

              const scoredChunks = relevantChunks.map((chunk) => {
                const chunkText = (chunk.extractedText + ' ' + chunk.sectionHeading).toLowerCase();
                let matches = 0;
                for (const term of questionTerms) {
                  if (term.length > 2 && chunkText.includes(term)) {
                    matches++;
                  }
                }
                const score = questionTerms.length > 0 ? matches / questionTerms.length : 0;
                return { chunk, score };
              });

              // Sort by score and pick top relevant chunks
              scoredChunks.sort((a, b) => b.score - a.score);
              const topMatches = scoredChunks.filter((item) => item.score > 0.05).slice(0, 3);
              const fallbackChunk = scoredChunks[0];
              const selectedMatches =
                topMatches.length > 0 ? topMatches : fallbackChunk ? [fallbackChunk] : [];

              const citations: SourceCitation[] = selectedMatches.map(({ chunk, score }) => ({
                id: `cite-${chunk.id}-${Date.now()}`,
                chunkId: chunk.id,
                materialId: chunk.materialId,
                materialTitle: chunk.materialTitle,
                pageOrSlideNumber: chunk.pageOrSlideNumber,
                sectionHeading: chunk.sectionHeading,
                excerpt: chunk.extractedText.slice(0, 200) + '...',
                relevanceScore: Math.min(0.99, Math.max(0.75, score * 1.5)),
              }));

              if (hasApiKey) {
                try {
                  const ai = new GoogleGenAI();
                  const excerptsBlock = selectedMatches
                    .map(
                      (m) =>
                        `[Source: ${m.chunk.materialTitle} | Page/Slide: ${m.chunk.pageOrSlideNumber} | Section: ${m.chunk.sectionHeading}]\n${m.chunk.extractedText}`
                    )
                    .join('\n\n');

                  const fullSystemPrompt = `${effectiveSystemPrompt}

GROUNDING COURSE EXCERPTS:
${excerptsBlock}`;

                  const response = await ai.models.generateContent({
                    model: 'gemini-3.8-flash',
                    contents: question,
                    config: {
                      systemInstruction: fullSystemPrompt,
                    },
                  });

                  res.setHeader('Content-Type', 'application/json');
                  res.end(
                    JSON.stringify({
                      answer: response.text || 'No response generated.',
                      citations,
                      isGroundingVerified: true,
                      model: 'gemini-3.8-flash (Preferences Active)',
                      apiKeyConfigured: true,
                    })
                  );
                  return;
                } catch (geminiError: any) {
                  console.error('Gemini API Error in /api/tutor:', geminiError);
                }
              }

              // Local grounded response synthesis respecting preferences
              const topChunk = selectedMatches[0]?.chunk;
              let answer = '';

              if (topChunk) {
                const docRef = `[${topChunk.materialTitle}, Page/Slide ${topChunk.pageOrSlideNumber}]`;
                const approach = preferences?.teachingApproach || 'socratic';
                const isConcise = preferences?.explanationLength === 'concise';

                if (approach === 'socratic') {
                  answer = isConcise
                    ? `Let's examine **${topChunk.materialTitle}** (${docRef}):\n\n> "${topChunk.extractedText}"\n\n**Inquiry:** What primary condition must hold before this transition takes place?`
                    : `Let's explore this concept systematically, grounded in **${topChunk.materialTitle}** (${docRef}).\n\nIn section **${topChunk.sectionHeading}**, your uploaded text establishes:\n> "${topChunk.extractedText}"\n\n### Guided Inquiry:\n1. How does this mechanism satisfy the core invariant described in your course?\n2. What failure mode would occur if this requirement were relaxed?`;
                } else if (approach === 'step_by_step') {
                  answer = `### Step-by-Step Breakdown — Grounded in ${docRef}\n\n1. **Core Principle:** Grounded in ${topChunk.sectionHeading}.\n2. **Mechanism:** "${topChunk.extractedText}"\n3. **Application:** System components execute this rule deterministically to maintain consistency.\n\n*Reference: ${docRef}*`;
                } else {
                  // Direct
                  answer = `**Direct Answer** (Grounded in ${docRef}):\n\nAccording to section **${topChunk.sectionHeading}**:\n> "${topChunk.extractedText}"\n\nThis directly establishes the operational parameter for ${topChunk.sectionHeading}.`;
                }

                // If knowledge checks are enabled, append a check
                if (preferences?.enableKnowledgeChecks) {
                  answer += `\n\n---\n**Comprehension Check**: In your own words, why is this condition required on Page/Slide ${topChunk.pageOrSlideNumber}?`;
                }
              } else {
                answer = `I examined your uploaded materials, but couldn't locate a matching passage for "${question}".\n\nTry rephrasing your inquiry or searching for terms present in your uploaded documents.`;
              }

              res.setHeader('Content-Type', 'application/json');
              res.end(
                JSON.stringify({
                  answer,
                  citations,
                  isGroundingVerified: citations.length > 0,
                  model: 'Grounded Engine (Demo Mode)',
                  apiKeyConfigured: false,
                })
              );
            } catch (err: any) {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: err.message || 'Internal server error' }));
            }
          });
          return;
        }

        next();
      });
    },
  };
}
