import React, { useState, useEffect } from 'react';
import type {
  TutorPreferences,
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
      className={`bg-surface-container-lowest flex flex-col h-full ${
        isMobileDrawer ? 'border-t border-outline-variant/30' : 'w-full'
      }`}
    >
      {/* Panel Header */}
      <div className="p-4 border-b border-outline-variant/30 flex items-center justify-between bg-surface-container-low">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-primary/10 text-primary shadow-xs">
            <span className="material-symbols-outlined text-lg">tune</span>
          </div>
          <div>
            <h2 className="text-xs sm:text-sm font-semibold text-on-surface flex items-center gap-1.5 font-headline-sm">
              <span>Tutor Preferences &amp; Persona</span>
              {hasUnsavedChanges && (
                <span className="w-1.5 h-1.5 rounded-full bg-tertiary" title="Unsaved changes" />
              )}
            </h2>
            <p className="text-[11px] text-outline font-label-sm">Personalize pedagogy, pacing, and tone</p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 text-outline hover:text-on-surface hover:bg-surface-container rounded-lg transition-colors cursor-pointer"
              title="Close preferences panel"
              aria-label="Close preferences"
            >
              <span className="material-symbols-outlined text-lg">close</span>
            </button>
          )}
        </div>
      </div>

      {/* Preferences Controls Scroll Area */}
      <div className="flex-1 overflow-y-auto p-5 space-y-5 text-xs bg-background">
        {/* Saved Feedback Notification */}
        {showSavedFeedback && (
          <div className="p-2.5 rounded-lg bg-secondary-container/40 border border-secondary/30 text-secondary flex items-center gap-2 animate-in fade-in duration-150 font-medium">
            <span className="material-symbols-outlined text-base">check_circle</span>
            <span className="text-[11px]">
              Tutor preferences saved &amp; applied to live conversations!
            </span>
          </div>
        )}

        {/* 1. Teaching Approach */}
        <div className="space-y-2">
          <label className="font-semibold text-on-surface flex items-center justify-between">
            <span>Teaching Approach</span>
            <span className="text-[10px] text-outline font-normal font-mono">Pedagogy</span>
          </label>
          <div className="grid grid-cols-3 gap-1.5 bg-surface-container-low p-1 rounded-xl border border-outline-variant/30">
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
                className={`py-1.5 px-2 rounded-lg font-medium text-[11px] transition-all text-center cursor-pointer ${
                  draft.teachingApproach === opt.id
                    ? 'bg-surface-container-lowest text-primary shadow-xs font-semibold'
                    : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container'
                }`}
                title={opt.desc}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-outline leading-relaxed">
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
          <label className="font-semibold text-on-surface flex items-center justify-between">
            <span>Difficulty Level</span>
            <span className="text-[10px] text-outline font-normal font-mono">Academic Depth</span>
          </label>
          <div className="grid grid-cols-3 gap-1.5 bg-surface-container-low p-1 rounded-xl border border-outline-variant/30">
            {(
              [
                { id: 'beginner', label: 'Foundational', desc: 'Intuitive & introductory' },
                { id: 'intermediate', label: 'Intermediate', desc: 'Standard college-level' },
                { id: 'advanced', label: 'Advanced', desc: 'Rigorous & edge-case' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => handleUpdate('difficultyLevel', opt.id)}
                className={`py-1.5 px-2 rounded-lg font-medium text-[11px] transition-all text-center cursor-pointer ${
                  draft.difficultyLevel === opt.id
                    ? 'bg-surface-container-lowest text-primary shadow-xs font-semibold'
                    : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container'
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
          <label className="font-semibold text-on-surface flex items-center justify-between">
            <span>Interaction Tone</span>
            <span className="text-[10px] text-outline font-normal font-mono">Vibe</span>
          </label>
          <div className="grid grid-cols-3 gap-1.5 bg-surface-container-low p-1 rounded-xl border border-outline-variant/30">
            {(
              [
                { id: 'gentle', label: 'Gentle', desc: 'Supportive & encouraging' },
                { id: 'balanced', label: 'Balanced', desc: 'Focused study partner' },
                { id: 'rigorous', label: 'Rigorous', desc: 'Direct & exacting critique' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => handleUpdate('interactionStyle', opt.id)}
                className={`py-1.5 px-2 rounded-lg font-medium text-[11px] transition-all text-center cursor-pointer ${
                  draft.interactionStyle === opt.id
                    ? 'bg-surface-container-lowest text-primary shadow-xs font-semibold'
                    : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container'
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
          <label className="font-semibold text-on-surface flex items-center justify-between">
            <span>Response Length</span>
            <span className="text-[10px] text-outline font-normal font-mono">Verbosity</span>
          </label>
          <div className="grid grid-cols-2 gap-1.5 bg-surface-container-low p-1 rounded-xl border border-outline-variant/30">
            {(
              [
                { id: 'concise', label: 'Concise (High-Yield)', desc: 'Bullet points & summaries' },
                { id: 'detailed', label: 'Comprehensive', desc: 'Thorough derivations' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => handleUpdate('explanationLength', opt.id)}
                className={`py-1.5 px-2 rounded-lg font-medium text-[11px] transition-all text-center cursor-pointer ${
                  draft.explanationLength === opt.id
                    ? 'bg-surface-container-lowest text-primary shadow-xs font-semibold'
                    : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container'
                }`}
                title={opt.desc}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* 5. Knowledge Checks Toggle */}
        <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-3.5 space-y-1.5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-on-surface">Interactive Knowledge Checks</span>
            <button
              type="button"
              role="switch"
              aria-checked={draft.enableKnowledgeChecks}
              onClick={() => handleUpdate('enableKnowledgeChecks', !draft.enableKnowledgeChecks)}
              className={`w-9 h-5 flex items-center rounded-full p-0.5 transition-colors cursor-pointer ${
                draft.enableKnowledgeChecks ? 'bg-primary justify-end' : 'bg-outline-variant/50 justify-start'
              }`}
            >
              <div className="w-4 h-4 rounded-full bg-white shadow-sm" />
            </button>
          </div>
          <p className="text-[11px] text-outline leading-relaxed">
            When enabled, the tutor occasionally poses a quick conceptual quiz at the end of explanations to confirm retention.
          </p>
        </div>

        {/* 6. Custom Instructions Multiline Input */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label
              htmlFor="custom-tutor-instructions"
              className="font-semibold text-on-surface"
            >
              Custom instructions for your tutor
            </label>
            <span
              className={`text-[10px] font-mono ${
                isOverLimit ? 'text-error font-bold' : 'text-outline'
              }`}
            >
              {customLength}/{MAX_CUSTOM_INSTRUCTIONS_LENGTH}
            </span>
          </div>

          <textarea
            id="custom-tutor-instructions"
            rows={3}
            value={draft.customInstructions}
            onChange={(e) => handleUpdate('customInstructions', e.target.value)}
            placeholder="e.g., Focus on intuitive analogies before formulas; quiz me on edge cases; offer progressive hints before full solutions."
            className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl p-3 text-xs text-on-surface placeholder-outline focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 resize-none transition-colors leading-relaxed"
          />
          {isOverLimit && (
            <p className="text-[11px] text-error">
              Instructions exceed the 1,000 character maximum. Please shorten them.
            </p>
          )}
        </div>

        {/* Non-Negotiable Rules Notice */}
        <div className="p-3 rounded-xl bg-surface-container-low border border-outline-variant/20 space-y-1 text-[11px] text-outline">
          <div className="flex items-center gap-1.5 font-medium text-on-surface">
            <span className="material-symbols-outlined text-sm text-secondary">verified_user</span>
            <span>Academic Grounding Axiom</span>
          </div>
          <p className="leading-relaxed">
            Preferences personalize tone and structure. However, StudyMate AI always strictly grounds answers in course passages and never fabricates citations.
          </p>
        </div>
      </div>

      {/* Panel Action Footer */}
      <div className="p-4 border-t border-outline-variant/30 bg-surface-container-low space-y-2">
        <button
          type="button"
          disabled={isOverLimit}
          onClick={() => handleSave()}
          className="w-full py-2.5 px-4 bg-primary hover:bg-primary-container disabled:opacity-40 text-on-primary rounded-xl text-xs font-semibold shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <span className="material-symbols-outlined text-base">check</span>
          <span>Save Preferences</span>
        </button>

        <div className="flex items-center justify-between pt-1 text-[11px] text-outline">
          <button
            type="button"
            onClick={handleResetToDefaults}
            className="hover:text-on-surface flex items-center gap-1 transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-xs">restart_alt</span>
            <span>Reset to defaults</span>
          </button>

          {hasUnsavedChanges ? (
            <span className="text-tertiary text-[10px] font-mono">Unsaved changes</span>
          ) : (
            <span className="text-secondary text-[10px] font-mono">Preferences synced</span>
          )}
        </div>
      </div>
    </div>
  );
};
