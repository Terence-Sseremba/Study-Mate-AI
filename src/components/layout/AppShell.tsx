import React, { useState } from 'react';
import type { StudentProfile, TutorInteractionMode } from '../../types';

export type SectionType = 'workspace' | 'tutor' | 'materials' | 'assessments' | 'progress' | 'dashboard';

interface AppShellProps {
  currentSection: SectionType;
  onNavigate: (section: SectionType) => void;
  student: StudentProfile;
  materialsCount: number;
  completedAssessmentsCount: number;
  apiStatus: {
    apiKeyConfigured: boolean;
    model: string;
    groundingEngine: string;
  } | null;
  onEditProfile: () => void;
  interactionMode: TutorInteractionMode;
  onModeChange: (mode: TutorInteractionMode) => void;
  onNewSession?: () => void;
  onResetSession?: () => void;
  onExportNotes?: () => void;
  onOpenTune?: () => void;
  activeCourse?: string;
  onSelectCourse?: (course: string) => void;
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({
  currentSection,
  onNavigate,
  student,
  materialsCount,
  completedAssessmentsCount,
  apiStatus,
  onEditProfile,
  interactionMode,
  onModeChange,
  onNewSession,
  onResetSession,
  onExportNotes,
  onOpenTune,
  activeCourse = 'Academic Workspace',
  onSelectCourse,
  children,
}) => {
  const [courseDropdownOpen, setCourseDropdownOpen] = useState(false);
  const [helpModalOpen, setHelpModalOpen] = useState(false);

  const coursesList =
    student.enrolledCourses && student.enrolledCourses.length > 0
      ? student.enrolledCourses.map((c) => `${c.code}: ${c.name}`)
      : ['Academic Workspace', 'General Studies'];

  const displayName = student.name || 'Student';
  const displayInitials = (student.name ? student.name.slice(0, 2) : 'ST').toUpperCase();

  return (
    <div className="min-h-screen bg-background font-body-md text-on-surface antialiased overflow-hidden flex flex-col">
      {/* ======================================================== */}
      {/* NOTEBOOKLM-STYLE UNIFIED COMPACT HEADER                  */}
      {/* ======================================================== */}
      <header className="fixed top-0 left-0 right-0 z-50 h-[52px] bg-white border-b border-neutral-200/80 flex items-center justify-between px-3 sm:px-4 shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
        {/* Brand & Course / Unit Context */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <button
            onClick={() => onNavigate('workspace')}
            className="flex items-center gap-2 text-left group focus-visible:outline-none cursor-pointer flex-shrink-0"
            title="Return to Workspace"
          >
            <div className="w-7 h-7 rounded-lg bg-neutral-900 text-white flex items-center justify-center shadow-xs">
              <span className="material-symbols-outlined text-base">auto_awesome</span>
            </div>
            <span className="font-semibold text-neutral-900 text-sm tracking-tight hidden sm:inline">
              StudyMate AI
            </span>
          </button>

          <div className="h-4 w-[1px] bg-neutral-200 hidden sm:block"></div>

          {/* Course Selection Dropdown */}
          <div className="relative">
            <button
              onClick={() => setCourseDropdownOpen(!courseDropdownOpen)}
              className="flex items-center gap-1.5 bg-neutral-100/80 hover:bg-neutral-200/70 px-2.5 py-1 rounded-lg border border-neutral-200/60 text-neutral-800 transition-colors cursor-pointer text-xs font-medium"
              type="button"
            >
              <span className="material-symbols-outlined text-neutral-600 text-sm">book_2</span>
              <span className="truncate max-w-[150px] sm:max-w-[200px]">
                {activeCourse}
              </span>
              <span className="material-symbols-outlined text-neutral-500 text-xs">expand_more</span>
            </button>

            {courseDropdownOpen && (
              <div className="absolute left-0 mt-1.5 w-64 bg-white rounded-xl shadow-xl border border-neutral-200 py-1.5 z-50 animate-in fade-in duration-100">
                <div className="px-3 py-1 text-[11px] font-semibold uppercase text-neutral-400">
                  Select Course / Workspace
                </div>
                {coursesList.map((course) => (
                  <button
                    key={course}
                    className={`w-full text-left px-3 py-1.5 text-xs flex items-center justify-between hover:bg-neutral-100 transition-colors ${
                      activeCourse === course ? 'font-semibold text-neutral-900 bg-neutral-100' : 'text-neutral-700'
                    }`}
                    onClick={() => {
                      if (onSelectCourse) onSelectCourse(course);
                      setCourseDropdownOpen(false);
                    }}
                  >
                    <span>{course}</span>
                    {activeCourse === course && (
                      <span className="material-symbols-outlined text-xs text-neutral-900">check</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Workspace Status Breadcrumb */}
          <div className="hidden lg:flex items-center gap-1.5">
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-neutral-100 text-neutral-600 font-medium text-[11px] border border-neutral-200/60">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
              {student.currentSprint || 'Academic Workspace'}
            </span>
            {materialsCount > 0 && (
              <>
                <span className="text-neutral-300">/</span>
                <span className="text-xs text-neutral-600 truncate max-w-xs font-normal">
                  {materialsCount} source{materialsCount === 1 ? '' : 's'}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Central Mode Switcher & Navigation Tabs */}
        <div className="hidden md:flex items-center bg-neutral-100 p-0.5 rounded-lg border border-neutral-200/70 text-xs">
          <button
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-all cursor-pointer font-medium ${
              currentSection === 'workspace' && interactionMode === 'smart_tutor'
                ? 'bg-white text-neutral-900 shadow-xs font-semibold'
                : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-200/50'
            }`}
            type="button"
            onClick={() => {
              onNavigate('workspace');
              onModeChange('smart_tutor');
            }}
          >
            <span className="material-symbols-outlined text-sm text-neutral-700">psychology</span>
            <span>Smart Tutor</span>
          </button>
          <button
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-all cursor-pointer font-medium ${
              currentSection === 'workspace' && interactionMode === 'grounded_study'
                ? 'bg-white text-neutral-900 shadow-xs font-semibold'
                : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-200/50'
            }`}
            type="button"
            onClick={() => {
              onNavigate('workspace');
              onModeChange('grounded_study');
            }}
          >
            <span className="material-symbols-outlined text-sm text-emerald-700">menu_book</span>
            <span>Grounded Study</span>
          </button>
        </div>

        {/* Right Actions (NotebookLM Clean Actions) */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Export Notes */}
          {onExportNotes && (
            <button
              className="hidden lg:flex items-center gap-1 px-2.5 py-1 rounded-lg bg-neutral-100 hover:bg-neutral-200/70 text-neutral-700 transition-colors cursor-pointer text-xs font-medium border border-neutral-200/60"
              title="Export synthesized study notes"
              type="button"
              onClick={onExportNotes}
            >
              <span className="material-symbols-outlined text-sm">download</span>
              <span>Export</span>
            </button>
          )}

          {/* Reset Session */}
          {onResetSession && (
            <button
              className="hidden xl:flex items-center gap-1 px-2 py-1 rounded-lg text-neutral-500 hover:text-neutral-800 hover:bg-neutral-100 transition-colors cursor-pointer text-xs"
              title="Reset conversation"
              type="button"
              onClick={onResetSession}
            >
              <span className="material-symbols-outlined text-sm">restart_alt</span>
            </button>
          )}

          {/* Tune Tutor */}
          {onOpenTune && (
            <button
              aria-label="Tutor parameters"
              className="p-1.5 rounded-lg text-neutral-500 hover:text-neutral-800 hover:bg-neutral-100 transition-colors cursor-pointer"
              type="button"
              onClick={onOpenTune}
              title="Tune Tutor Persona & Settings"
            >
              <span className="material-symbols-outlined text-base">tune</span>
            </button>
          )}

          {/* New Session Button */}
          <button
            className="flex items-center gap-1.5 bg-neutral-900 text-white hover:bg-neutral-800 px-3 py-1.5 rounded-full text-xs font-medium transition-colors shadow-xs cursor-pointer"
            type="button"
            onClick={() => {
              if (onNewSession) onNewSession();
              onNavigate('workspace');
            }}
          >
            <span className="material-symbols-outlined text-sm">add</span>
            <span>New Chat</span>
            <kbd className="hidden xl:inline-block ml-0.5 px-1 py-0.2 bg-white/20 rounded text-[9px]">
              ⌘K
            </kbd>
          </button>

          {/* Help Modal Trigger */}
          <button
            aria-label="Help & Shortcuts"
            className="p-1.5 rounded-lg text-neutral-500 hover:text-neutral-800 hover:bg-neutral-100 transition-colors cursor-pointer"
            type="button"
            onClick={() => setHelpModalOpen(true)}
          >
            <span className="material-symbols-outlined text-lg">help_outline</span>
          </button>

          {/* User Profile Avatar */}
          <button
            className="p-0.5 rounded-full ring-1 ring-neutral-200 hover:ring-neutral-400 transition-all cursor-pointer flex items-center justify-center bg-neutral-800 text-white w-7 h-7 font-medium text-[11px] shadow-xs ml-0.5"
            type="button"
            onClick={onEditProfile}
            title={`Logged in as ${displayName}. Click to edit name.`}
          >
            {displayInitials}
          </button>
        </div>
      </header>

      {/* ======================================================== */}
      {/* MAIN SCREEN CONTAINER (COMPACT PADDING FOR 52PX NAVBAR)  */}
      {/* ======================================================== */}
      <main className="w-full pt-[52px] h-screen bg-[#F8F9FA] flex flex-col overflow-hidden">
        {/* Content Body */}
        <div className="flex-1 overflow-hidden relative">{children}</div>
      </main>

      {/* Quick Help / Shortcuts Modal */}
      {helpModalOpen && (
        <div className="fixed inset-0 z-50 bg-on-background/40 backdrop-blur flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest max-w-md w-full rounded-2xl shadow-2xl border border-outline-variant/40 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-xl">help_center</span>
                <h3 className="font-headline-sm font-semibold text-on-surface">
                  StudyMate AI Quick Guide
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setHelpModalOpen(false)}
                className="p-1 rounded-lg text-outline hover:text-on-surface"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>
            <div className="space-y-2 text-xs text-on-surface-variant">
              <p className="leading-relaxed">
                Welcome to the <strong>StudyMate AI Academic Workspace</strong>. All responses are source-grounded in your uploaded course materials.
              </p>
              <div className="p-3 bg-surface-container-low rounded-xl space-y-1.5 border border-outline-variant/20">
                <div className="font-semibold text-on-surface">Keyboard Shortcuts:</div>
                <div className="flex justify-between">
                  <span>Toggle Left Sources Panel</span>
                  <kbd className="px-1.5 py-0.5 rounded bg-surface-container font-code-block">⌘B / Ctrl+B</kbd>
                </div>
                <div className="flex justify-between">
                  <span>Start New Session</span>
                  <kbd className="px-1.5 py-0.5 rounded bg-surface-container font-code-block">⌘K / Ctrl+K</kbd>
                </div>
                <div className="flex justify-between">
                  <span>Close Floating Inspector</span>
                  <kbd className="px-1.5 py-0.5 rounded bg-surface-container font-code-block">Esc</kbd>
                </div>
              </div>
              <p className="leading-relaxed">
                Click any citation tag like <code>[1: Course Slide, p.14]</code> to inspect the verbatim source passage with page numbers.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setHelpModalOpen(false)}
              className="w-full py-1.5 bg-primary text-on-primary hover:bg-primary-container rounded-lg text-xs font-semibold"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
