import React, { useState } from 'react';
import {
  LayoutDashboard,
  FileText,
  BrainCircuit,
  Award,
  TrendingUp,
  Menu,
  X,
  Sparkles,
  BookMarked,
  ShieldCheck,
  Server,
  Zap,
  Edit2,
} from 'lucide-react';
import type { StudentProfile } from '../../types';

export type SectionType = 'dashboard' | 'materials' | 'tutor' | 'assessments' | 'progress';

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
  children,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems: Array<{
    id: SectionType;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: string | number;
    description: string;
  }> = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: LayoutDashboard,
      description: 'Overview & recent study focus',
    },
    {
      id: 'materials',
      label: 'Study Materials',
      icon: FileText,
      badge: materialsCount,
      description: 'Uploaded PDFs, slides & chunk index',
    },
    {
      id: 'tutor',
      label: 'AI Tutor',
      icon: BrainCircuit,
      description: 'Source-grounded inquiry & explanations',
    },
    {
      id: 'assessments',
      label: 'Assessments',
      icon: Award,
      badge: completedAssessmentsCount > 0 ? completedAssessmentsCount : undefined,
      description: 'Curriculum quizzes & citation checks',
    },
    {
      id: 'progress',
      label: 'Learning Progress',
      icon: TrendingUp,
      description: 'Topic mastery & cognitive strengths',
    },
  ];

  const handleNavClick = (section: SectionType) => {
    onNavigate(section);
    setMobileMenuOpen(false);
  };

  const displayName = student.name || 'Learner';
  const displayInitials = (student.name ? student.name.slice(0, 2) : 'SM').toUpperCase();

  return (
    <div className="min-h-screen bg-[#0B0F19] text-slate-100 flex flex-col font-sans">
      {/* Top Header */}
      <header className="sticky top-0 z-40 bg-[#0B0F19]/90 backdrop-blur-md border-b border-slate-800/80 px-4 lg:px-8 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          {/* Logo & Platform Title */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => handleNavClick('dashboard')}
              className="flex items-center gap-2.5 text-left group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded-lg p-1"
            >
              <div className="w-9 h-9 rounded-lg bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400 group-hover:bg-indigo-600/30 transition-all shadow-sm">
                <BookMarked className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold tracking-tight text-slate-100 text-base">StudyMate</span>
                  <span className="text-[11px] font-mono font-medium px-1.5 py-0.5 rounded bg-indigo-950/80 text-indigo-300 border border-indigo-800/50">
                    AI
                  </span>
                </div>
                <div className="text-[11px] text-slate-400 hidden sm:block">
                  Personalized Learning & Source-Grounded Tutoring
                </div>
              </div>
            </button>

            {/* Product Tagline (Replacing hackathon label) */}
            <div className="hidden md:flex items-center gap-1.5 pl-4 border-l border-slate-800 text-xs text-slate-400">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400"></span>
              <span>Your Personal Study Space</span>
              <span aria-hidden="true" className="text-slate-600">·</span>
              <span>Learn from your own course materials</span>
            </div>
          </div>

          {/* Right Header: Backend Engine Indicator & Profile */}
          <div className="flex items-center gap-3">
            {/* Engine Status indicator */}
            <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-md bg-slate-900 border border-slate-800 text-xs">
              {apiStatus?.apiKeyConfigured ? (
                <>
                  <Zap className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-slate-300 font-mono text-[11px]">Gemini 3.8-Flash Live</span>
                </>
              ) : (
                <>
                  <Server className="w-3.5 h-3.5 text-indigo-400" />
                  <span className="text-slate-300 font-mono text-[11px]">Grounded Engine</span>
                </>
              )}
            </div>

            {/* Personalized Profile Button (Clickable to edit preferred name) */}
            <button
              onClick={onEditProfile}
              className="flex items-center gap-2.5 pl-2 border-l border-slate-800 hover:opacity-90 transition-opacity group text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded-lg p-1"
              title="Click to edit your preferred name"
            >
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-xs font-semibold text-white shadow-inner group-hover:ring-2 group-hover:ring-indigo-400/50 transition-all">
                {displayInitials}
              </div>
              <div className="text-left hidden lg:block">
                <div className="text-xs font-medium text-slate-200 flex items-center gap-1">
                  <span>{displayName}</span>
                  <Edit2 className="w-2.5 h-2.5 text-slate-400 group-hover:text-indigo-400 transition-colors" />
                </div>
                <div className="text-[11px] text-slate-400">Personal Study Space</div>
              </div>
            </button>

            {/* Mobile Hamburger Toggle */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors focus-visible:ring-2 focus-visible:ring-indigo-500"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </header>

      {/* Main Workspace Layout */}
      <div className="flex-1 max-w-7xl w-full mx-auto flex">
        {/* Left Desktop Sidebar */}
        <aside className="hidden lg:flex w-64 flex-col border-r border-slate-800/80 bg-[#0B0F19] p-4 shrink-0">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-3 mb-2">
            Learning Workspace
          </div>

          <nav className="space-y-1" aria-label="Main Navigation">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentSection === item.id;

              return (
                <button
                  key={item.id}
                  onClick={() => handleNavClick(item.id)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-all group text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                    isActive
                      ? 'bg-indigo-950/60 text-indigo-300 border border-indigo-800/50 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/80'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon
                      className={`w-4 h-4 transition-colors ${
                        isActive ? 'text-indigo-400' : 'text-slate-400 group-hover:text-slate-200'
                      }`}
                    />
                    <span>{item.label}</span>
                  </div>

                  {item.badge !== undefined && (
                    <span
                      className={`text-[11px] font-mono px-1.5 py-0.5 rounded ${
                        isActive
                          ? 'bg-indigo-900/80 text-indigo-200'
                          : 'bg-slate-800/80 text-slate-400 group-hover:bg-slate-800'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Current Academic Status Card */}
          <div className="mt-auto pt-6">
            <div className="p-3.5 rounded-lg bg-[#0F172A] border border-slate-800 text-xs space-y-2">
              <div className="flex items-center justify-between text-slate-300 font-medium">
                <span className="flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
                  Your Learning Journey
                </span>
                <span className="text-[11px] text-indigo-400 font-mono">Self-Paced</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                {materialsCount === 0
                  ? 'Upload textbooks or slides to build your personalized knowledge base.'
                  : `Grounding active across ${materialsCount} uploaded ${
                      materialsCount === 1 ? 'document' : 'documents'
                    }.`}
              </p>
              <div className="pt-1 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                <span>{materialsCount} Materials</span>
                <span className="text-slate-300 font-mono">
                  {completedAssessmentsCount} Completed
                </span>
              </div>
            </div>

            {/* Verification Guarantee */}
            <div className="mt-3 px-2 text-[11px] text-slate-400 flex items-center gap-1.5">
              <Sparkles className="w-3 h-3 text-indigo-400 shrink-0" />
              <span>Verifiable citations from your materials</span>
            </div>
          </div>
        </aside>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="lg:hidden fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex">
            <div className="w-72 bg-[#0F172A] border-r border-slate-800 p-5 flex flex-col">
              <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded bg-indigo-600/30 text-indigo-400 flex items-center justify-center">
                    <BookMarked className="w-4 h-4" />
                  </div>
                  <span className="font-bold text-sm text-slate-100">StudyMate AI</span>
                </div>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-1 text-slate-400 hover:text-slate-200"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Sections
              </div>
              <nav className="space-y-1">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = currentSection === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleNavClick(item.id)}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium ${
                        isActive
                          ? 'bg-indigo-950/80 text-indigo-300 border border-indigo-800/60'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Icon className="w-4 h-4" />
                        <span>{item.label}</span>
                      </div>
                      {item.badge !== undefined && (
                        <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </nav>

              <div className="mt-auto pt-4 border-t border-slate-800 text-xs text-slate-400">
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onEditProfile();
                  }}
                  className="w-full flex items-center justify-between p-2 rounded-lg bg-slate-900 text-left hover:bg-slate-800 transition-colors"
                >
                  <div>
                    <div className="font-medium text-slate-200">{displayName}</div>
                    <div className="text-[11px] text-slate-400">Change preferred name</div>
                  </div>
                  <Edit2 className="w-3.5 h-3.5 text-indigo-400" />
                </button>
              </div>
            </div>
            <div className="flex-1" onClick={() => setMobileMenuOpen(false)}></div>
          </div>
        )}

        {/* Main Content Area */}
        <main className="flex-1 p-4 lg:p-8 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
};
