import React, { useState, useEffect } from 'react';
import {
  FileText,
  Award,
  TrendingUp,
  AlertTriangle,
  ArrowRight,
  BookOpen,
  BrainCircuit,
  PlusCircle,
  Clock,
  Sparkles,
  Info,
  CheckCircle2,
  Calendar,
} from 'lucide-react';
import type { StudentProfile, StudyMaterial, TopicMastery, QuizAttempt, ReviewRecord } from '../../types/index.ts';
import type { SectionType } from '../layout/AppShell';
import { getTimeAwareGreeting } from '../../lib/greeting';
import { getDueReviews, getUpcomingReviews, formatTimeUntilDue } from '../../lib/spacedRepetition';

interface DashboardSectionProps {
  student: StudentProfile;
  materials: StudyMaterial[];
  masteryTopics: TopicMastery[];
  recentAttempts: QuizAttempt[];
  reviewRecords: ReviewRecord[];
  onNavigate: (section: SectionType) => void;
  onSelectTopicForTutor: (topicName: string, materialId?: string) => void;
  onStartQuizForTopic: (topicId: string) => void;
  onStartSpacedReview: (topicId?: string) => void;
}

export const DashboardSection: React.FC<DashboardSectionProps> = ({
  student,
  materials,
  masteryTopics,
  recentAttempts,
  reviewRecords,
  onNavigate,
  onSelectTopicForTutor,
  onStartQuizForTopic,
  onStartSpacedReview,
}) => {
  // Safe client-side time-aware greeting calculation
  const [greeting, setGreeting] = useState<string>('Welcome to StudyMate AI');

  useEffect(() => {
    setGreeting(getTimeAwareGreeting(student.name));
  }, [student.name]);

  // Compute metrics from genuine user actions
  const totalChunks = materials.reduce((acc, m) => acc + (m.chunksCount || 0), 0);
  const totalPages = materials.reduce((acc, m) => acc + (m.pageCount || 0), 0);

  // Overall mastery is ONLY computed if topics exist with actual evidence
  const topicsWithEvidence = masteryTopics.filter((t) => t.evidenceCount > 0);
  const hasMasteryData = topicsWithEvidence.length > 0;
  const avgMastery = hasMasteryData
    ? Math.round(
        topicsWithEvidence.reduce((acc, t) => acc + t.masteryPercentage, 0) /
          topicsWithEvidence.length
      )
    : null;

  const topicsNeedingRevision = masteryTopics.filter(
    (t) => t.status === 'review_needed' || t.masteryPercentage < 60
  );

  const dueReviews = getDueReviews(reviewRecords);
  const upcomingReviews = getUpcomingReviews(reviewRecords);

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-[#0F172A] to-[#131B2E] border border-slate-800 rounded-xl p-6 relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs text-indigo-400 font-mono">
              <span>Your Personal Study Space</span>
              <span aria-hidden="true">·</span>
              <span>Learn from your own course materials</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-100">
              {greeting}
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 max-w-2xl">
              {materials.length === 0
                ? 'Your study space is ready. Upload your lecture slides, notes, or textbook PDFs to enable verifiable source grounding, adaptive quizzes, and topic mastery tracking.'
                : `You have ${materials.length} course ${
                    materials.length === 1 ? 'material' : 'materials'
                  } indexed with ${totalChunks} verified passages. Ask your tutor questions or take adaptive assessments to measure your progress.`}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              onClick={() => onNavigate('materials')}
              className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700/80 transition-colors flex items-center gap-1.5 focus-visible:ring-2 focus-visible:ring-indigo-500"
            >
              <PlusCircle className="w-3.5 h-3.5 text-indigo-400" />
              <span>{materials.length === 0 ? 'Upload First Material' : 'Add Materials'}</span>
            </button>
            <button
              onClick={() => onNavigate('assessments')}
              className="px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-sm transition-colors flex items-center gap-1.5 focus-visible:ring-2 focus-visible:ring-indigo-400"
            >
              <Award className="w-3.5 h-3.5" />
              <span>Take Assessment</span>
            </button>
          </div>
        </div>
      </div>

      {/* Honest Real-Time Mastery Notice */}
      <div className="bg-slate-900/60 border border-slate-800/80 rounded-lg px-4 py-3 flex items-start gap-3 text-xs text-slate-400">
        <Info className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
        <div className="space-y-0.5">
          <span className="font-medium text-slate-300">Live Learning Calibrations:</span>
          <p>
            StudyMate AI derives all progress scores, mastery indicators, and spaced repetition schedules
            exclusively from your actual quiz answers and uploaded documents. No simulated or prefilled history is shown.
          </p>
        </div>
      </div>

      {/* 4 Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Course Materials */}
        <div className="bg-[#0F172A] border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium">Uploaded Materials</span>
            <FileText className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="my-3">
            <div className="text-2xl font-bold text-slate-100 font-mono">{materials.length}</div>
            <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1.5">
              {materials.length === 0 ? (
                <span className="text-slate-400">No documents uploaded yet</span>
              ) : (
                <>
                  <span>{totalPages} pages/slides</span>
                  <span aria-hidden="true">·</span>
                  <span className="text-indigo-400 font-mono">{totalChunks} chunks</span>
                </>
              )}
            </div>
          </div>
          <button
            onClick={() => onNavigate('materials')}
            className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-medium pt-2 border-t border-slate-800/60 transition-colors"
          >
            <span>{materials.length === 0 ? 'Upload your first material' : 'Manage documents'}</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        {/* Card 2: Average Mastery */}
        <div className="bg-[#0F172A] border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium">Estimated Overall Mastery</span>
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="my-3">
            {hasMasteryData ? (
              <>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-slate-100 font-mono">{avgMastery}%</span>
                  <span className="text-[11px] text-emerald-400 font-mono font-medium">
                    {avgMastery! >= 75 ? 'On Target' : 'In Progress'}
                  </span>
                </div>
                <div className="w-full bg-slate-800 h-1.5 rounded-full mt-2 overflow-hidden">
                  <div
                    className="bg-indigo-500 h-full rounded-full transition-all duration-500"
                    style={{ width: `${avgMastery}%` }}
                  ></div>
                </div>
              </>
            ) : (
              <div className="space-y-1">
                <div className="text-sm font-semibold text-slate-300">Not enough activity yet</div>
                <div className="text-[11px] text-slate-400">
                  Complete an assessment to establish your baseline
                </div>
              </div>
            )}
          </div>
          <button
            onClick={() => onNavigate(hasMasteryData ? 'progress' : 'assessments')}
            className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-medium pt-2 border-t border-slate-800/60 transition-colors"
          >
            <span>{hasMasteryData ? 'View mastery breakdown' : 'Take initial assessment'}</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        {/* Card 3: Assessments Completed */}
        <div className="bg-[#0F172A] border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium">Assessments Completed</span>
            <Award className="w-4 h-4 text-violet-400" />
          </div>
          <div className="my-3">
            <div className="text-2xl font-bold text-slate-100 font-mono">{recentAttempts.length}</div>
            <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1.5">
              {recentAttempts.length === 0 ? (
                <span>No quizzes recorded yet</span>
              ) : (
                <>
                  <span>Recorded quizzes</span>
                  <span aria-hidden="true">·</span>
                  <span className="text-slate-300">
                    Avg:{' '}
                    {Math.round(
                      recentAttempts.reduce((acc, a) => acc + a.percentage, 0) /
                        recentAttempts.length
                    )}
                    %
                  </span>
                </>
              )}
            </div>
          </div>
          <button
            onClick={() => onNavigate('assessments')}
            className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-medium pt-2 border-t border-slate-800/60 transition-colors"
          >
            <span>Start assessment</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        {/* Card 4: Spaced Reviews Due */}
        <div className="bg-[#0F172A] border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium">Spaced Reviews Due</span>
            <Clock className={`w-4 h-4 ${dueReviews.length > 0 ? 'text-indigo-400' : 'text-slate-400'}`} />
          </div>
          <div className="my-3">
            <div className={`text-2xl font-bold font-mono ${dueReviews.length > 0 ? 'text-indigo-400' : 'text-slate-200'}`}>
              {dueReviews.length}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              {dueReviews.length > 0
                ? `${dueReviews.length} topic${dueReviews.length === 1 ? '' : 's'} scheduled for review`
                : upcomingReviews.length > 0
                ? `Next review in ${formatTimeUntilDue(upcomingReviews[0].nextReviewDueAt)}`
                : 'No reviews scheduled yet'}
            </div>
          </div>
          <button
            onClick={() => onStartSpacedReview()}
            className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-medium pt-2 border-t border-slate-800/60 transition-colors"
          >
            <span>{dueReviews.length > 0 ? 'Review due topics now' : 'View spaced schedule'}</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Spaced Reviews Due Card (when reviews are due) */}
      {dueReviews.length > 0 && (
        <div className="bg-[#131B2E] border border-indigo-900/60 rounded-xl p-5 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                  <span>Spaced Reviews Ready</span>
                  <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-indigo-900 text-indigo-300">
                    {dueReviews.length} Due
                  </span>
                </h3>
                <p className="text-xs text-slate-400">
                  Calculated using progressive intervals (1d → 3d → 7d → 14d → 30d) based on your real performance.
                </p>
              </div>
            </div>

            <button
              onClick={() => onStartSpacedReview()}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors flex items-center gap-1.5 shrink-0"
            >
              <span>Review All Due Topics</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-2 border-t border-slate-800">
            {dueReviews.map((rev) => (
              <div
                key={rev.topicId}
                className="bg-[#0B0F19] border border-slate-800 rounded-lg p-3 flex items-center justify-between gap-2"
              >
                <div className="min-w-0">
                  <div className="text-xs font-medium text-slate-200 truncate">{rev.topicName}</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    Streak: {rev.consecutiveSuccessCount} · {formatTimeUntilDue(rev.nextReviewDueAt)}
                  </div>
                </div>
                <button
                  onClick={() => onStartSpacedReview(rev.topicId)}
                  className="px-2.5 py-1 rounded bg-indigo-950 hover:bg-indigo-900 text-indigo-300 text-xs font-medium border border-indigo-800/50 shrink-0"
                >
                  Review
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Content Grid: Priority Revision & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 spans): Topics Needing Revision */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                <span>Adaptive Revision Priorities</span>
                <span className="text-xs font-mono text-slate-400">
                  ({topicsNeedingRevision.length} flagged)
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Targeted concepts identified from your assessment answers and revision history.
              </p>
            </div>
            {topicsNeedingRevision.length > 0 && (
              <button
                onClick={() => onNavigate('progress')}
                className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
              >
                See all topics
              </button>
            )}
          </div>

          {topicsNeedingRevision.length === 0 ? (
            <div className="bg-[#0F172A] border border-slate-800 rounded-xl p-6 text-center space-y-3">
              <div className="w-10 h-10 rounded-full bg-slate-900 border border-slate-800 text-indigo-400 mx-auto flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-slate-200">
                  {materials.length === 0
                    ? 'Upload course documents to begin'
                    : 'No revision topics identified yet'}
                </h3>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  {materials.length === 0
                    ? 'Once you upload slides or textbook PDFs and complete quizzes, topics that require reinforcement will automatically appear here.'
                    : 'Take an assessment on your uploaded materials. As you answer questions, any concepts needing review will be tracked here.'}
                </p>
              </div>
              <div className="pt-2 flex justify-center gap-2">
                {materials.length === 0 ? (
                  <button
                    onClick={() => onNavigate('materials')}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5"
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    <span>Upload Your First Material</span>
                  </button>
                ) : (
                  <button
                    onClick={() => onNavigate('assessments')}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5"
                  >
                    <Award className="w-3.5 h-3.5" />
                    <span>Take a Practice Quiz</span>
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {topicsNeedingRevision.map((topic) => (
                <div
                  key={topic.topicId}
                  className="bg-[#0F172A] border border-slate-800 rounded-xl p-4 hover:border-slate-700 transition-colors"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-xs">
                        <span className="font-mono text-indigo-400 font-medium">
                          {topic.courseCode}
                        </span>
                        <span aria-hidden="true" className="text-slate-600">·</span>
                        <span className="text-slate-400">
                          Evidence: {topic.evidenceCount} inquiries
                        </span>
                      </div>
                      <div className="text-sm font-semibold text-slate-200">
                        {topic.topicName}
                      </div>
                      {topic.weakSubtopics.length > 0 && (
                        <div className="text-xs text-slate-400 flex flex-wrap gap-1 items-center pt-0.5">
                          <span className="text-amber-400/90 font-medium">Weak areas:</span>
                          <span>{topic.weakSubtopics.join(' · ')}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-800">
                      <div className="text-right">
                        <div className="text-xs text-slate-400">Mastery</div>
                        <div className="text-sm font-mono font-bold text-amber-400">
                          {topic.masteryPercentage}%
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => onSelectTopicForTutor(topic.topicName)}
                          className="px-2.5 py-1.5 rounded-lg bg-indigo-950/70 hover:bg-indigo-900/80 text-indigo-300 text-xs font-medium border border-indigo-800/40 transition-colors flex items-center gap-1"
                          title="Open AI Tutor with this topic"
                        >
                          <BrainCircuit className="w-3.5 h-3.5" />
                          <span>Revise</span>
                        </button>
                        <button
                          onClick={() => onStartQuizForTopic(topic.topicId)}
                          className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition-colors flex items-center gap-1"
                          title="Take practice quiz"
                        >
                          <Award className="w-3.5 h-3.5 text-violet-400" />
                          <span>Quiz</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Quick Study Actions Card */}
          <div className="bg-[#131B2E] border border-indigo-950/60 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <div className="text-sm font-semibold text-slate-100">
                  Personalized AI Tutoring
                </div>
                <div className="text-xs text-slate-400">
                  {materials.length === 0
                    ? 'Upload materials to ask questions grounded in your course slides and notes.'
                    : 'Every factual answer cites verbatim page numbers and slide passages from your documents.'}
                </div>
              </div>
            </div>
            <button
              onClick={() => onNavigate('tutor')}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors flex items-center gap-1.5 shrink-0"
            >
              <span>Launch AI Tutor</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Right Column (1 span): Recent Study Activity */}
        <div className="space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-100">Recent Study Activity</h2>
            <p className="text-xs text-slate-400">Chronological record of your learning sessions.</p>
          </div>

          <div className="bg-[#0F172A] border border-slate-800 rounded-xl p-4 space-y-4">
            {recentAttempts.length === 0 ? (
              <div className="py-6 text-center space-y-2">
                <Clock className="w-8 h-8 mx-auto text-slate-600" />
                <div className="text-xs font-medium text-slate-300">No activity logged yet</div>
                <p className="text-[11px] text-slate-400 leading-relaxed max-w-xs mx-auto">
                  As you complete quizzes and review topics, your verified session log will record here.
                </p>
                <div className="pt-2">
                  <button
                    onClick={() => onNavigate('materials')}
                    className="text-xs text-indigo-400 hover:text-indigo-300 font-medium transition-colors"
                  >
                    Upload course material →
                  </button>
                </div>
              </div>
            ) : (
              recentAttempts.map((attempt) => (
                <div
                  key={attempt.id}
                  className="pb-3 border-b border-slate-800/80 last:border-b-0 last:pb-0 space-y-1.5"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-200">{attempt.quizTitle}</span>
                    <span className="font-mono text-emerald-400 font-bold">
                      {attempt.score}/{attempt.totalQuestions} ({attempt.percentage}%)
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-slate-400">
                    <Clock className="w-3 h-3 text-slate-400" />
                    <span>
                      {new Date(attempt.completedAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="capitalize">{attempt.difficulty}</span>
                  </div>
                </div>
              ))
            )}

            {recentAttempts.length > 0 && (
              <div className="pt-2 text-center">
                <button
                  onClick={() => onNavigate('progress')}
                  className="text-xs text-slate-400 hover:text-slate-200 font-medium transition-colors"
                >
                  View complete study log →
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
