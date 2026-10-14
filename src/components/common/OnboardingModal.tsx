import React, { useState, useEffect, useRef } from 'react';

interface OnboardingModalProps {
  isOpen: boolean;
  initialName?: string;
  isFirstVisit: boolean;
  onSaveName: (name: string) => void;
  onClose?: () => void;
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({
  isOpen,
  initialName = '',
  isFirstVisit,
  onSaveName,
  onClose,
}) => {
  const [name, setName] = useState(initialName);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setName(initialName);
    setError(null);
  }, [initialName, isOpen]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Please enter a valid preferred name to continue.');
      inputRef.current?.focus();
      return;
    }
    setError(null);
    onSaveName(trimmed);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-on-background/40 backdrop-blur animate-in fade-in duration-150"
    >
      <div
        className="bg-surface-container-lowest border border-outline-variant/40 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden relative animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Accent Bar */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-secondary to-primary"></div>

        {/* Close button only available if NOT first visit */}
        {!isFirstVisit && onClose && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 text-outline hover:text-on-surface hover:bg-surface-container rounded-lg transition-colors cursor-pointer"
            aria-label="Close dialog"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        )}

        <div className="p-6 sm:p-8 space-y-6">
          {/* Header Icon & Title */}
          <div className="text-center space-y-3">
            <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary mx-auto flex items-center justify-center shadow-xs">
              <span className="material-symbols-outlined text-2xl">school</span>
            </div>
            <div>
              <h2
                id="onboarding-title"
                className="text-lg sm:text-xl font-bold text-on-surface tracking-tight"
              >
                What should StudyMate AI call you?
              </h2>
              <p className="text-xs sm:text-sm text-outline mt-1 max-w-sm mx-auto">
                {isFirstVisit
                  ? 'Your preferred name personalizes your study space, tutor interactions, and progress tracking.'
                  : 'Update how StudyMate AI addresses you across your study space.'}
              </p>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label
                htmlFor="preferred-name-input"
                className="block text-xs font-semibold text-on-surface uppercase tracking-wider"
              >
                Your Preferred Name
              </label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-2.5 text-outline text-lg">
                  person
                </span>
                <input
                  ref={inputRef}
                  id="preferred-name-input"
                  type="text"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (error) setError(null);
                  }}
                  placeholder="e.g. Alex Chen, Maya, Marcus"
                  maxLength={50}
                  className={`w-full bg-surface-container-low border rounded-xl pl-10 pr-4 py-2.5 text-sm text-on-surface placeholder-outline focus:outline-none transition-colors ${
                    error
                      ? 'border-error focus:border-error focus:ring-1 focus:ring-error'
                      : 'border-outline-variant/40 focus:border-primary focus:ring-1 focus:ring-primary/30'
                  }`}
                />
              </div>
              {error && <p className="text-xs text-error font-medium">{error}</p>}
            </div>

            <div className="pt-2 flex items-center gap-3">
              {!isFirstVisit && onClose && (
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-2 px-4 rounded-xl border border-outline-variant/40 hover:bg-surface-container text-xs font-semibold text-on-surface transition-colors cursor-pointer"
                >
                  Cancel
                </button>
              )}
              <button
                type="submit"
                className="flex-1 py-2.5 px-4 bg-primary hover:bg-primary-container text-on-primary rounded-xl text-xs font-semibold shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>{isFirstVisit ? 'Enter Learning Space' : 'Save Name'}</span>
                <span className="material-symbols-outlined text-sm">arrow_forward</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
