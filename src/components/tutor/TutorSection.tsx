import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  BrainCircuit,
  BookOpen,
  RotateCcw,
  CheckCircle2,
  ExternalLink,
  ShieldCheck,
  AlertCircle,
  PlusCircle,
  Sliders,
  Sparkles,
  Copy,
  Check,
} from 'lucide-react';
import type {
  StudyMaterial,
  TutorMessage,
  SourceCitation,
  TutorPreferences,
  TutorInteractionMode,
} from '../../types';
import { TutorPreferencesPanel } from './TutorPreferencesPanel';
import { getTutorPreferencesSummary } from '../../lib/tutorInstructions';

interface TutorSectionProps {
  materials: StudyMaterial[];
  messages: TutorMessage[];
  preferences: TutorPreferences;
  onSavePreferences: (newPreferences: TutorPreferences) => void;
  onSendMessage: (question: string, materialId?: string) => Promise<void>;
  onRetryMessage?: (message: TutorMessage) => Promise<void>;
  onOpenCitation: (citation: SourceCitation) => void;
  onClearHistory: () => void;
  isLoading: boolean;
  activeMaterialFilter?: string;
  onMaterialFilterChange: (materialId: string | undefined) => void;
  interactionMode: TutorInteractionMode;
  onModeChange: (mode: TutorInteractionMode) => void;
  initialQuestionPrompt?: string;
  onNavigateToMaterials?: () => void;
}

export const TutorSection: React.FC<TutorSectionProps> = ({
  materials,
  messages,
  preferences,
  onSavePreferences,
  onSendMessage,
  onRetryMessage,
  onOpenCitation,
  onClearHistory,
  isLoading,
  activeMaterialFilter,
  onMaterialFilterChange,
  interactionMode,
  onModeChange,
  initialQuestionPrompt,
  onNavigateToMaterials,
}) => {
  const [inputText, setInputText] = useState(initialQuestionPrompt || '');
  const [preferencesPanelOpen, setPreferencesPanelOpen] = useState(false);
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (initialQuestionPrompt) {
      setInputText(initialQuestionPrompt);
      textareaRef.current?.focus();
    }
  }, [initialQuestionPrompt]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isLoading) return;
    const text = inputText.trim();
    setInputText('');
    await onSendMessage(text, activeMaterialFilter);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleSuggestedClick = (text: string, materialId?: string) => {
    if (materialId) onMaterialFilterChange(materialId);
    setInputText(text);
    textareaRef.current?.focus();
  };

  /**
   * Copy Response Button
   * Copies only the assistant answer text to clipboard with visual feedback
   */
  const handleCopyResponse = async (msg: TutorMessage) => {
    const textToCopy = msg.text;

    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(textToCopy);
      } else {
        // Fallback for iframe or restricted clipboard permissions
        const textarea = document.createElement('textarea');
        textarea.value = textToCopy;
        textarea.style.position = 'fixed';
        textarea.style.left = '-9999px';
        textarea.style.top = '-9999px';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }

      setCopiedMsgId(msg.id);
      setTimeout(() => {
        setCopiedMsgId(null);
      }, 2000);
    } catch (err) {
      console.warn('Clipboard write failed:', err);
    }
  };

  // Generate dynamic suggestions based on real uploaded materials, or study prompts if empty
  const dynamicSuggestions =
    materials.length > 0
      ? materials.flatMap((mat) => [
          {
            topic: mat.courseCode || 'Document',
            text: `Explain the key concepts and core definitions in ${mat.title}.`,
            materialId: mat.id,
          },
          ...(mat.chunks && mat.chunks[0]
            ? [
                {
                  topic: mat.courseCode || 'Document',
                  text: `What are the practical applications of ${mat.chunks[0].sectionHeading}?`,
                  materialId: mat.id,
                },
              ]
            : []),
        ]).slice(0, 4)
      : [
          {
            topic: 'Study Technique',
            text: 'What are the most effective active recall and spaced repetition strategies for exam prep?',
            materialId: undefined,
          },
          {
            topic: 'How It Works',
            text: 'How does StudyMate AI ground answers and citations in uploaded lecture slides?',
            materialId: undefined,
          },
          {
            topic: 'Exam Prep',
            text: 'How should I break down complex syllabus topics into high-yield revision blocks?',
            materialId: undefined,
          },
        ];

  const preferencesSummary = getTutorPreferencesSummary(preferences);

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col space-y-3">
      {/* Top Header & Grounding Configuration Bar */}
      <div className="bg-[#0F172A] border border-slate-800 rounded-xl p-3 sm:p-3.5 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-indigo-950/70 border border-indigo-800/40 text-indigo-400">
            <BrainCircuit className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold text-slate-100">StudyMate AI Tutor</h1>
              <span className="text-[11px] font-mono text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                {interactionMode === 'smart_tutor' ? 'Smart Router' : 'Strict Grounded'}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
              <span>{preferencesSummary}</span>
              {preferences.customInstructions && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="text-indigo-400 font-mono text-[11px]">Custom prompt active</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Controls: Mode Selector, Material Selector & Preferences Panel Toggle */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Part 1: Compact Tutor Mode Selector */}
          <div className="flex items-center bg-[#0B0F19] p-0.5 rounded-lg border border-slate-800 text-xs">
            <button
              type="button"
              onClick={() => onModeChange('smart_tutor')}
              className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1.5 ${
                interactionMode === 'smart_tutor'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Smart Tutor: Intelligently answers from uploaded materials when relevant, or provides general AI knowledge if unrelated."
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Smart Tutor</span>
            </button>
            <button
              type="button"
              onClick={() => onModeChange('grounded_study')}
              className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1.5 ${
                interactionMode === 'grounded_study'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Grounded Study: Answers strictly from uploaded materials only. Rejects out-of-scope inquiries."
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Grounded Study</span>
            </button>
          </div>

          {/* Material Constraint Filter (if materials exist) */}
          {materials.length > 0 && (
            <select
              value={activeMaterialFilter || ''}
              onChange={(e) => onMaterialFilterChange(e.target.value || undefined)}
              className="bg-[#0B0F19] border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus-visible:ring-2 focus-visible:ring-indigo-500"
            >
              <option value="">All Uploaded Materials ({materials.length})</option>
              {materials.map((m) => (
                <option key={m.id} value={m.id}>
                  [{m.courseCode}] {m.title.slice(0, 26)}...
                </option>
              ))}
            </select>
          )}

          {/* Toggle Tutor Preferences Panel */}
          <button
            type="button"
            onClick={() => setPreferencesPanelOpen(!preferencesPanelOpen)}
            className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-all flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
              preferencesPanelOpen
                ? 'bg-indigo-950 text-indigo-300 border-indigo-700/80 shadow-sm'
                : 'bg-[#0B0F19] text-slate-300 border-slate-800 hover:text-slate-100 hover:bg-slate-900'
            }`}
            title="Configure AI Tutor Preferences and Custom Instructions"
          >
            <Sliders className="w-3.5 h-3.5 text-indigo-400" />
            <span>Preferences</span>
            {preferences.customInstructions && (
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
            )}
          </button>

          <button
            onClick={onClearHistory}
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
            title="Reset conversation"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Notice Banner if zero materials uploaded */}
      {materials.length === 0 && (
        <div className="bg-slate-900/70 border border-slate-800 rounded-lg p-2.5 px-3 flex items-center justify-between gap-3 text-xs text-slate-300 shrink-0">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-indigo-400 shrink-0" />
            <span>
              No course documents uploaded yet. In Smart Tutor mode, answers use general educational knowledge.
            </span>
          </div>
          {onNavigateToMaterials && (
            <button
              onClick={onNavigateToMaterials}
              className="text-xs text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1 shrink-0"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Upload materials</span>
            </button>
          )}
        </div>
      )}

      {/* Main Workspace */}
      <div className="flex-1 flex overflow-hidden rounded-xl border border-slate-800/80 bg-[#0B0F19] relative">
        {/* Main Conversation Column */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Suggested Starter Questions Bar */}
          <div className="bg-[#0B0F19] border-b border-slate-800/80 p-2 flex items-center gap-2 overflow-x-auto shrink-0 text-xs">
            <span className="text-slate-400 font-mono text-[11px] whitespace-nowrap px-1">
              Suggested:
            </span>
            {dynamicSuggestions.map((q, idx) => (
              <button
                key={idx}
                onClick={() => handleSuggestedClick(q.text, q.materialId)}
                className="px-2.5 py-1 rounded-md bg-[#0F172A] hover:bg-slate-800 text-slate-300 border border-slate-800 text-[11px] whitespace-nowrap transition-colors flex items-center gap-1.5 shrink-0"
              >
                <span className="text-indigo-400 font-mono font-medium">{q.topic}</span>
                <span className="truncate max-w-xs">{q.text}</span>
              </button>
            ))}
          </div>

          {/* Message History Feed */}
          <div className="flex-1 overflow-y-auto space-y-4 p-4">
            {messages.map((msg) => {
              const isUser = msg.role === 'user';
              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} space-y-1.5`}
                >
                  {/* Message author line */}
                  <div className="flex items-center gap-2 text-[11px] text-slate-400 px-1">
                    <span>{isUser ? 'You' : 'StudyMate AI'}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono">
                      {new Date(msg.timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>

                    {/* Source label badge for assistant responses */}
                    {!isUser && !msg.errorState && msg.sourceLabel === 'Based on Your Study Materials' && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-950/80 text-emerald-300 border border-emerald-800/50 flex items-center gap-1">
                        <BookOpen className="w-3 h-3 text-emerald-400" />
                        Based on Your Study Materials
                      </span>
                    )}

                    {!isUser && !msg.errorState && (msg.sourceLabel === 'General Knowledge' || msg.sourceLabel === 'General AI Knowledge') && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-sky-950/80 text-sky-300 border border-sky-800/50 flex items-center gap-1">
                        <Sparkles className="w-3 h-3 text-sky-400" />
                        General Knowledge
                      </span>
                    )}

                    {!isUser && msg.modelUsed && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="text-indigo-400 font-mono text-[10px]">
                          {msg.modelUsed}
                        </span>
                      </>
                    )}
                  </div>

                  {/* Message Content Bubble */}
                  <div
                    className={`max-w-3xl rounded-xl p-4 text-xs sm:text-sm leading-relaxed ${
                      isUser
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : msg.errorState
                        ? 'bg-amber-950/30 border border-amber-800/60 text-amber-200 shadow-sm'
                        : 'bg-[#0F172A] border border-slate-800 text-slate-200 shadow-sm'
                    }`}
                  >
                    {/* Error / Temporary Busy State with Retry Action */}
                    {msg.errorState ? (
                      <div className="space-y-3">
                        <div className="flex items-start gap-2.5">
                          <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                          <div className="text-xs sm:text-sm text-amber-200 font-medium">
                            {msg.text}
                          </div>
                        </div>

                        {msg.canRetry && onRetryMessage && (
                          <div className="pt-2 border-t border-amber-900/40 flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => onRetryMessage(msg)}
                              className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-colors flex items-center gap-1.5 shadow-sm"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              <span>Retry Question</span>
                            </button>
                            {msg.failedQuestion && (
                              <button
                                type="button"
                                onClick={() => {
                                  setInputText(msg.failedQuestion || '');
                                  textareaRef.current?.focus();
                                }}
                                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors"
                              >
                                Edit Question
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    ) : (
                      <>
                        <div className="whitespace-pre-wrap font-sans space-y-2">
                          {msg.text}
                        </div>

                        {/* Grounded Source Citations Panel (if any) */}
                        {msg.citations && msg.citations.length > 0 && (
                          <div className="mt-3 pt-3 border-t border-slate-800/80 space-y-2">
                            <div className="flex items-center justify-between text-xs text-indigo-400 font-semibold">
                              <span className="flex items-center gap-1.5">
                                <BookOpen className="w-3.5 h-3.5" />
                                Grounded Source Citations ({msg.citations.length})
                              </span>
                              <span className="text-[11px] text-slate-400 font-normal">
                                Click citation to inspect source excerpt
                              </span>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {msg.citations.map((cite) => (
                                <button
                                  key={cite.id}
                                  type="button"
                                  onClick={() => onOpenCitation(cite)}
                                  className="text-left p-2.5 rounded-lg bg-[#0B0F19] hover:bg-slate-900 border border-slate-800 hover:border-indigo-600/50 transition-all group"
                                >
                                  <div className="flex items-center justify-between text-xs">
                                    <span className="font-semibold text-slate-200 group-hover:text-indigo-300 truncate">
                                      {cite.materialTitle}
                                    </span>
                                    <ExternalLink className="w-3 h-3 text-slate-400 group-hover:text-indigo-400 shrink-0 ml-1" />
                                  </div>
                                  <div className="text-[11px] text-indigo-400 font-mono mt-0.5 truncate">
                                    {cite.anchorLabel ||
                                      (cite.pageNumber
                                        ? `Page ${cite.pageNumber}`
                                        : cite.slideNumber
                                        ? `Slide ${cite.slideNumber}`
                                        : cite.pageOrSlideNumber
                                        ? `Page / Slide ${cite.pageOrSlideNumber}`
                                        : 'Passage')}{' '}
                                    · {cite.sectionHeading}
                                  </div>
                                  <p className="text-[11px] text-slate-400 line-clamp-2 mt-1 italic">
                                    "{cite.excerpt}"
                                  </p>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Part 4: Copy Response Button Footer */}
                        {!isUser && (
                          <div className="mt-3 pt-2.5 border-t border-slate-800/60 flex items-center justify-end">
                            <button
                              type="button"
                              onClick={() => handleCopyResponse(msg)}
                              className="flex items-center gap-1.5 text-[11px] text-slate-400 hover:text-indigo-300 px-2.5 py-1 rounded-md bg-[#0B0F19] hover:bg-slate-900 border border-slate-800 hover:border-slate-700 transition-colors"
                              title="Copy response text and citations to clipboard"
                            >
                              {copiedMsgId === msg.id ? (
                                <>
                                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                                  <span className="text-emerald-400 font-medium">Copied</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3.5 h-3.5" />
                                  <span>Copy Response</span>
                                </>
                              )}
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })}

            {isLoading && (
              <div className="flex flex-col items-start space-y-1.5">
                <div className="text-[11px] text-slate-400 px-1">StudyMate AI</div>
                <div className="bg-[#0F172A] border border-slate-800 rounded-xl p-4 flex items-center gap-3 text-xs text-slate-400">
                  <div className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin"></div>
                  <span>
                    {interactionMode === 'smart_tutor'
                      ? 'Analyzing query and evaluating relevance across study materials...'
                      : 'Searching course materials for verified citations...'}
                  </span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Message Input Box */}
          <div className="p-3 bg-[#0F172A] border-t border-slate-800">
            <form onSubmit={handleSubmit} className="relative flex items-end gap-2">
              <textarea
                ref={textareaRef}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  interactionMode === 'smart_tutor'
                    ? 'Ask any academic question (Smart Tutor routes to materials or general knowledge)...'
                    : 'Ask a question strictly grounded in your uploaded course materials...'
                }
                rows={2}
                disabled={isLoading}
                className="w-full bg-[#0B0F19] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={isLoading || !inputText.trim()}
                className="p-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white disabled:text-slate-500 rounded-xl transition-colors shrink-0 shadow-sm focus-visible:ring-2 focus-visible:ring-indigo-500"
                title="Send inquiry"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
            <div className="flex items-center justify-between mt-2 px-1 text-[11px] text-slate-500">
              <span>
                {interactionMode === 'smart_tutor'
                  ? 'Smart Mode: Verified citations when relevant; general AI explanations when out-of-scope.'
                  : 'Grounded Mode: Answers exclusively from uploaded documents; strictly refuses out-of-scope.'}
              </span>
              <span className="font-mono hidden sm:inline">Press Enter to send, Shift+Enter for newline</span>
            </div>
          </div>
        </div>

        {/* Collapsible Tutor Preferences Panel */}
        {preferencesPanelOpen && (
          <TutorPreferencesPanel
            preferences={preferences}
            onSavePreferences={onSavePreferences}
            onClose={() => setPreferencesPanelOpen(false)}
          />
        )}
      </div>
    </div>
  );
};
