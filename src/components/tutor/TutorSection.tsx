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
} from 'lucide-react';
import type {
  StudyMaterial,
  TutorMessage,
  TutorMode,
  SourceCitation,
  TutorPreferences,
} from '../../types';
import { TutorPreferencesPanel } from './TutorPreferencesPanel';
import { getTutorPreferencesSummary } from '../../lib/tutorInstructions';

interface TutorSectionProps {
  materials: StudyMaterial[];
  messages: TutorMessage[];
  preferences: TutorPreferences;
  onSavePreferences: (newPreferences: TutorPreferences) => void;
  onSendMessage: (question: string, materialId?: string, mode?: TutorMode) => Promise<void>;
  onOpenCitation: (citation: SourceCitation) => void;
  onClearHistory: () => void;
  isLoading: boolean;
  activeMaterialFilter?: string;
  onMaterialFilterChange: (materialId: string | undefined) => void;
  initialQuestionPrompt?: string;
  onNavigateToMaterials?: () => void;
}

export const TutorSection: React.FC<TutorSectionProps> = ({
  materials,
  messages,
  preferences,
  onSavePreferences,
  onSendMessage,
  onOpenCitation,
  onClearHistory,
  isLoading,
  activeMaterialFilter,
  onMaterialFilterChange,
  initialQuestionPrompt,
  onNavigateToMaterials,
}) => {
  const [inputText, setInputText] = useState(initialQuestionPrompt || '');
  const [preferencesPanelOpen, setPreferencesPanelOpen] = useState(false);
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

  const currentMaterial = materials.find((m) => m.id === activeMaterialFilter);

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
                {materials.length > 0 ? 'Source-Grounded' : 'Study Strategy'}
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

        {/* Controls: Material Selector & Preferences Panel Toggle */}
        <div className="flex flex-wrap items-center gap-2">
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
                  [{m.courseCode}] {m.title.slice(0, 28)}...
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
              No course documents uploaded yet. Upload slides or PDFs to enable exact page citations.
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

      {/* Main Workspace (Flex row on desktop with collapsible right preferences panel) */}
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
                        : 'bg-[#0F172A] border border-slate-800 text-slate-200 shadow-sm'
                    }`}
                  >
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
                              <div className="text-[11px] text-indigo-400 font-mono mt-0.5">
                                Page / Slide {cite.pageOrSlideNumber} · {cite.sectionHeading}
                              </div>
                              <p className="text-[11px] text-slate-400 line-clamp-2 mt-1 italic">
                                "{cite.excerpt}"
                              </p>
                            </button>
                          ))}
                        </div>
                      </div>
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
                  <span>Processing inquiry and applying your personalized preferences...</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Question Input Bar */}
          <form onSubmit={handleSubmit} className="p-3 border-t border-slate-800/80 bg-[#0B0F19] shrink-0 space-y-2">
            <div className="relative bg-[#0F172A] border border-slate-800 rounded-xl focus-within:border-indigo-500 transition-colors p-2 flex items-end gap-2">
              <textarea
                ref={textareaRef}
                rows={2}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  currentMaterial
                    ? `Ask anything grounded in ${currentMaterial.title}... (Shift+Enter for newline)`
                    : materials.length > 0
                    ? `Ask a question grounded in your course materials... (Shift+Enter for newline)`
                    : `Ask a question or upload course documents to enable page citations...`
                }
                className="flex-1 bg-transparent border-0 resize-none text-xs sm:text-sm text-slate-100 placeholder-slate-400 focus:outline-none p-1.5"
              />

              <button
                type="submit"
                disabled={!inputText.trim() || isLoading}
                className="p-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:hover:bg-indigo-600 text-white transition-colors shrink-0 focus-visible:ring-2 focus-visible:ring-indigo-400"
                aria-label="Send inquiry"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
              <span className="flex items-center gap-1.5 truncate">
                <ShieldCheck className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                <span className="truncate">
                  {preferences.customInstructions
                    ? 'Preferences & custom instructions active · Non-negotiable grounding preserved'
                    : 'Preferences active · Non-negotiable grounding preserved'}
                </span>
              </span>
              <span className="font-mono shrink-0 pl-2">Press Enter</span>
            </div>
          </form>
        </div>

        {/* Desktop Collapsible Preferences Panel */}
        {preferencesPanelOpen && (
          <div className="hidden md:block shrink-0 animate-in slide-in-from-right duration-200">
            <TutorPreferencesPanel
              preferences={preferences}
              onSavePreferences={onSavePreferences}
              onClose={() => setPreferencesPanelOpen(false)}
            />
          </div>
        )}
      </div>

      {/* Mobile Drawer (Accessible bottom drawer for mobile screens) */}
      {preferencesPanelOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Tutor Preferences Drawer"
          className="md:hidden fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex flex-col justify-end"
          onClick={() => setPreferencesPanelOpen(false)}
        >
          <div
            className="bg-[#0F172A] rounded-t-2xl max-h-[85vh] flex flex-col border-t border-slate-800 shadow-2xl overflow-hidden animate-in slide-in-from-bottom duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <TutorPreferencesPanel
              preferences={preferences}
              onSavePreferences={onSavePreferences}
              onClose={() => setPreferencesPanelOpen(false)}
              isMobileDrawer={true}
            />
          </div>
        </div>
      )}
    </div>
  );
};
