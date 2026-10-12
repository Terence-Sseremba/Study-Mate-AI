import React, { useState, useEffect } from 'react';
import {
  Sliders,
  Check,
  RotateCcw,
  X,
  Sparkles,
  ShieldCheck,
  HelpCircle,
  Brain,
  MessageSquare,
  BookOpen,
  Info,
} from 'lucide-react';
import type {
  TutorPreferences,
  TeachingApproach,
  TutorDifficulty,
  InteractionStyle,
  ExplanationLength,
} from '../../types';
import { DEFAULT_TUTOR_PREFERENCES } from '../../lib/storage';

interface TutorPreferencesPanelProps {
  preferences: TutorPreferences;
  onSavePreferences: (newPreferences: TutorPreferences) => void;
  onClose?: () => void;
  isMobileDrawer?: boolean;
}

const MAX_CUSTOM_INSTRUCTIONS_LENGTH = 1000;

export const TutorPreferencesPanel: React.FC<TutorPreferencesPanelProps> = ({
  preferences,
  onSavePreferences,
  onClose,
  isMobileDrawer = false,
}) => {
  const [draft, setDraft] = useState<TutorPreferences>(preferences);
  const [showSavedFeedback, setShowSavedFeedback] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  useEffect(() => {
    setDraft(preferences);
    setHasUnsavedChanges(false);
  }, [preferences]);

  const handleUpdate = <K extends keyof TutorPreferences>(key: K, value: TutorPreferences[K]) => {
    setDraft((prev) => {
      const updated = { ...prev, [key]: value };
      setHasUnsavedChanges(true);
      return updated;
    });
    setShowSavedFeedback(false);
  };

  const handleSave = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    onSavePreferences(draft);
    setHasUnsavedChanges(false);
    setShowSavedFeedback(true);
    setTimeout(() => {
      setShowSavedFeedback(false);
    }, 2500);
  };

  const handleResetToDefaults = () => {
    setDraft(DEFAULT_TUTOR_PREFERENCES);
    setHasUnsavedChanges(true);
    setShowSavedFeedback(false);
  };

  const customLength = draft.customInstructions.length;
  const isOverLimit = customLength > MAX_CUSTOM_INSTRUCTIONS_LENGTH;

  return (
    <div
      className={`bg-[#0F172A] border-slate-800 flex flex-col h-full ${
        isMobileDrawer ? 'border-t' : 'border-l w-80 lg:w-96'
      }`}
    >
      {/* Panel Header */}
      <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-[#131B2E]">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-indigo-950/80 border border-indigo-800/50 text-indigo-400">
            <Sliders className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-xs sm:text-sm font-semibold text-slate-100 flex items-center gap-1.5">
              <span>Tutor Preferences</span>
              {hasUnsavedChanges && (
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" title="Unsaved changes" />
              )}
            </h2>
            <p className="text-[11px] text-slate-400">Personalize pedagogy & tone</p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
              title="Close preferences panel"
              aria-label="Close preferences"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Preferences Controls Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5 text-xs">
        {/* Saved Feedback Notification */}
        {showSavedFeedback && (
          <div className="p-2.5 rounded-lg bg-emerald-950/60 border border-emerald-800/80 text-emerald-300 flex items-center gap-2 animate-in fade-in duration-150">
            <Check className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="font-medium text-[11px]">
              Tutor preferences saved & applied to conversations!
            </span>
          </div>
        )}

        {/* 1. Teaching Approach */}
        <div className="space-y-2">
          <label className="font-semibold text-slate-200 flex items-center justify-between">
            <span>Teaching Approach</span>
            <span className="text-[10px] text-slate-400 font-normal">Method</span>
          </label>
          <div className="grid grid-cols-3 gap-1.5 bg-[#0B0F19] p-1 rounded-lg border border-slate-800">
            {(
              [
                { id: 'socratic', label: 'Socratic', desc: 'Asks guiding questions' },
                { id: 'step_by_step', label: 'Step-by-Step', desc: 'Structured phases' },
                { id: 'direct', label: 'Direct', desc: 'Straightforward' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => handleUpdate('teachingApproach', opt.id)}
                className={`py-1.5 px-2 rounded-md font-medium text-[11px] transition-all text-center ${
                  draft.teachingApproach === opt.id
                    ? 'bg-indigo-950 text-indigo-300 border border-indigo-700/80 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                }`}
                title={opt.desc}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-slate-400 leading-normal">
            {draft.teachingApproach === 'socratic' &&
              'The tutor guides you with targeted inquiries rather than handing over direct answers immediately.'}
            {draft.teachingApproach === 'step_by_step' &&
              'Deconstructs explanations into sequential, easy-to-follow conceptual stages.'}
            {draft.teachingApproach === 'direct' &&
              'Delivers clear, concise answers upfront with minimal conversational setup.'}
          </p>
        </div>

        {/* 2. Difficulty Level */}
        <div className="space-y-2">
          <label className="font-semibold text-slate-200 flex items-center justify-between">
            <span>Difficulty Level</span>
            <span className="text-[10px] text-slate-400 font-normal">Academic Depth</span>
          </label>
          <div className="grid grid-cols-3 gap-1.5 bg-[#0B0F19] p-1 rounded-lg border border-slate-800">
            {(
              [
                { id: 'beginner', label: 'Beginner', desc: 'Intuitive & introductory' },
                { id: 'intermediate', label: 'Intermediate', desc: 'Standard college-level' },
                { id: 'advanced', label: 'Advanced', desc: 'Rigorous & edge-case' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => handleUpdate('difficultyLevel', opt.id)}
                className={`py-1.5 px-2 rounded-md font-medium text-[11px] transition-all text-center ${
                  draft.difficultyLevel === opt.id
                    ? 'bg-indigo-950 text-indigo-300 border border-indigo-700/80 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                }`}
                title={opt.desc}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* 3. Interaction Style */}
        <div className="space-y-2">
          <label className="font-semibold text-slate-200 flex items-center justify-between">
            <span>Interaction Style</span>
            <span className="text-[10px] text-slate-400 font-normal">Tone</span>
          </label>
          <div className="grid grid-cols-3 gap-1.5 bg-[#0B0F19] p-1 rounded-lg border border-slate-800">
            {(
              [
                { id: 'gentle', label: 'Gentle', desc: 'Supportive & patient' },
                { id: 'balanced', label: 'Balanced', desc: 'Constructive partnership' },
                { id: 'rigorous', label: 'Rigorous', desc: 'Demanding & analytical' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => handleUpdate('interactionStyle', opt.id)}
                className={`py-1.5 px-2 rounded-md font-medium text-[11px] transition-all text-center ${
                  draft.interactionStyle === opt.id
                    ? 'bg-indigo-950 text-indigo-300 border border-indigo-700/80 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                }`}
                title={opt.desc}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* 4. Explanation Length */}
        <div className="space-y-2">
          <label className="font-semibold text-slate-200 flex items-center justify-between">
            <span>Explanation Length</span>
            <span className="text-[10px] text-slate-400 font-normal">Density</span>
          </label>
          <div className="grid grid-cols-2 gap-1.5 bg-[#0B0F19] p-1 rounded-lg border border-slate-800">
            {(
              [
                { id: 'concise', label: 'Concise (High-Yield)' },
                { id: 'detailed', label: 'Detailed (Deep Dive)' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => handleUpdate('explanationLength', opt.id)}
                className={`py-1.5 px-2 rounded-md font-medium text-[11px] transition-all text-center ${
                  draft.explanationLength === opt.id
                    ? 'bg-indigo-950 text-indigo-300 border border-indigo-700/80 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* 5. Knowledge Checks Toggle */}
        <div className="bg-[#0B0F19] border border-slate-800 rounded-lg p-3 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-slate-200">Knowledge Checks</span>
            <button
              type="button"
              role="switch"
              aria-checked={draft.enableKnowledgeChecks}
              onClick={() => handleUpdate('enableKnowledgeChecks', !draft.enableKnowledgeChecks)}
              className={`w-9 h-5 flex items-center rounded-full p-0.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                draft.enableKnowledgeChecks ? 'bg-indigo-600 justify-end' : 'bg-slate-800 justify-start'
              }`}
            >
              <div className="w-4 h-4 rounded-full bg-white shadow-sm" />
            </button>
          </div>
          <p className="text-[11px] text-slate-400 leading-normal">
            When enabled, the tutor occasionally poses a quick question at the end of answers to confirm your understanding.
          </p>
        </div>

        {/* 6. Custom Instructions Multiline Input */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label
              htmlFor="custom-tutor-instructions"
              className="font-semibold text-slate-200"
            >
              Custom instructions for your tutor
            </label>
            <span
              className={`text-[10px] font-mono ${
                isOverLimit ? 'text-rose-400 font-bold' : 'text-slate-400'
              }`}
            >
              {customLength}/{MAX_CUSTOM_INSTRUCTIONS_LENGTH}
            </span>
          </div>

          <p className="text-[11px] text-slate-400 leading-normal">
            Tell your tutor how you want to learn. For example, ask it to challenge your assumptions, give hints before answers, use analogies, or quiz you on difficult concepts.
          </p>

          <textarea
            id="custom-tutor-instructions"
            rows={4}
            value={draft.customInstructions}
            onChange={(e) => handleUpdate('customInstructions', e.target.value)}
            placeholder="e.g., Focus on intuitive analogies before mathematical formulas; quiz me after discussing key mechanisms; never give away final solutions immediately—offer progressive hints."
            className="w-full bg-[#0B0F19] border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 resize-none transition-colors"
          />
          {isOverLimit && (
            <p className="text-[11px] text-rose-400">
              Instructions exceed the 1,000 character maximum. Please shorten them.
            </p>
          )}
        </div>

        {/* Non-Negotiable Rules Notice */}
        <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800/80 space-y-1 text-[11px] text-slate-400">
          <div className="flex items-center gap-1.5 font-medium text-slate-300">
            <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
            <span>Non-Negotiable Tutoring Axioms</span>
          </div>
          <p className="leading-relaxed">
            Your preferences customize pedagogy, pace, and tone. However, the tutor always strictly grounds answers in course passages, cites genuine citations, and never fabricates sources.
          </p>
        </div>
      </div>

      {/* Panel Action Footer */}
      <div className="p-4 border-t border-slate-800 bg-[#131B2E] space-y-2">
        <button
          type="button"
          disabled={isOverLimit}
          onClick={() => handleSave()}
          className="w-full py-2 px-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:hover:bg-indigo-600 text-white rounded-lg text-xs font-semibold shadow-sm transition-all flex items-center justify-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
        >
          <Check className="w-3.5 h-3.5" />
          <span>Save preferences</span>
        </button>

        <div className="flex items-center justify-between pt-1 text-[11px]">
          <button
            type="button"
            onClick={handleResetToDefaults}
            className="text-slate-400 hover:text-slate-200 flex items-center gap-1 transition-colors"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset to defaults</span>
          </button>

          {hasUnsavedChanges ? (
            <span className="text-amber-400 text-[10px] font-mono">Unsaved changes</span>
          ) : (
            <span className="text-slate-400 text-[10px] font-mono">Preferences synced</span>
          )}
        </div>
      </div>
    </div>
  );
};
