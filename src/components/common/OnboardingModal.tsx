import React, { useState, useEffect, useRef } from 'react';
import { BookMarked, User, ArrowRight, X, Sparkles } from 'lucide-react';

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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
    >
      <div
        className="bg-[#0F172A] border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Subtle accent glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-1 bg-gradient-to-r from-transparent via-indigo-500 to-transparent"></div>

        {/* Close button only available if NOT first visit */}
        {!isFirstVisit && onClose && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        )}

        <div className="p-6 sm:p-8 space-y-6">
          {/* Header Icon & Title */}
          <div className="text-center space-y-3">
            <div className="w-12 h-12 rounded-xl bg-indigo-950/80 border border-indigo-800/50 text-indigo-400 mx-auto flex items-center justify-center shadow-inner">
              <BookMarked className="w-6 h-6" />
            </div>
            <div>
              <h2
                id="onboarding-title"
                className="text-lg sm:text-xl font-bold text-slate-100 tracking-tight"
              >
                What should StudyMate AI call you?
              </h2>
              <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-sm mx-auto">
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
                className="block text-xs font-semibold text-slate-300"
              >
                Preferred Name
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="preferred-name-input"
                  ref={inputRef}
                  type="text"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (error) setError(null);
                  }}
                  placeholder="Enter your preferred name"
                  maxLength={50}
                  className="w-full bg-[#0B0F19] border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-100 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                  aria-invalid={!!error}
                  aria-describedby={error ? 'name-error-msg' : undefined}
                />
              </div>
              {error && (
                <p id="name-error-msg" className="text-xs text-rose-400 pt-0.5">
                  {error}
                </p>
              )}
            </div>

            <button
              type="submit"
              className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs sm:text-sm font-semibold shadow-sm transition-all flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
            >
              <span>{isFirstVisit ? 'Enter my study space' : 'Save changes'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Subtext info */}
          <div className="text-center text-[11px] text-slate-400 flex items-center justify-center gap-1.5 pt-1">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            <span>Saved locally in your browser storage</span>
          </div>
        </div>
      </div>
    </div>
  );
};
