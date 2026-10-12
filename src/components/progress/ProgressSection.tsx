import React from 'react';
import {
  TrendingUp,
  Award,
  BrainCircuit,
  Info,
  Clock,
  PlusCircle,
} from 'lucide-react';
import type { TopicMastery, QuizAttempt } from '../../types';

interface ProgressSectionProps {
  masteryTopics: TopicMastery[];
  quizAttempts: QuizAttempt[];
  onReviseInTutor: (topicName: string) => void;
  onTakeQuizForTopic: (topicId: string) => void;
}

export const ProgressSection: React.FC<ProgressSectionProps> = ({
  masteryTopics,
  quizAttempts,
  onReviseInTutor,
  onTakeQuizForTopic,
}) => {
  const topicsWithEvidence = masteryTopics.filter((t) => t.evidenceCount > 0);
  const hasMasteryData = topicsWithEvidence.length > 0;
  const avgMastery = hasMasteryData
    ? Math.round(
        topicsWithEvidence.reduce((acc, t) => acc + t.masteryPercentage, 0) /
          topicsWithEvidence.length
      )
    : null;

  const totalEvidence = masteryTopics.reduce((acc, t) => acc + t.evidenceCount, 0);
  const masteredCount = masteryTopics.filter((t) => t.status === 'mastered').length;
  const reviewCount = masteryTopics.filter((t) => t.status === 'review_needed').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-100">Learning Progress & Mastery</h1>
          <p className="text-xs sm:text-sm text-slate-400">
            Cognitive evidence model derived from your verified quizzes and source-grounded inquiries.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <span className="font-mono text-slate-200 font-bold">{masteryTopics.length}</span>
          <span>curriculum concepts tracked</span>
        </div>
      </div>

      {/* Honest Evidence Model Notice */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-3.5 flex items-start gap-3 text-xs text-slate-400">
        <Info className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
        <div className="space-y-0.5">
          <span className="font-medium text-slate-300">Evidence Model Disclosure:</span>
          <p>
            Mastery percentages represent an algorithmic estimate based strictly on your quiz answers and study sessions.
            No prefilled or simulated scores are represented as real-world learning gains.
          </p>
        </div>
      </div>

      {/* Top 3 Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Card 1: Overall Mastery */}
        <div className="bg-[#0F172A] border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>Overall Curriculum Mastery</span>
            <TrendingUp className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="my-3">
            {hasMasteryData ? (
              <>
                <div className="text-3xl font-bold font-mono text-slate-100">{avgMastery}%</div>
                <div className="w-full bg-slate-800 h-1.5 rounded-full mt-2 overflow-hidden">
                  <div
                    className="bg-indigo-500 h-full rounded-full transition-all"
                    style={{ width: `${avgMastery}%` }}
                  ></div>
                </div>
              </>
            ) : (
              <div className="space-y-1">
                <div className="text-sm font-semibold text-slate-300">Not enough activity yet</div>
                <div className="text-[11px] text-slate-400">
                  Complete assessments to establish your baseline
                </div>
              </div>
            )}
          </div>
          <div className="text-[11px] text-slate-400 flex items-center justify-between pt-2 border-t border-slate-800/80">
            <span>{masteredCount} Mastered (≥80%)</span>
            <span className="text-amber-400">{reviewCount} Need Revision</span>
          </div>
        </div>

        {/* Card 2: Cognitive Evidence Points */}
        <div className="bg-[#0F172A] border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>Cognitive Evidence Points</span>
            <BrainCircuit className="w-4 h-4 text-violet-400" />
          </div>
          <div className="my-3">
            <div className="text-3xl font-bold font-mono text-slate-100">{totalEvidence}</div>
            <div className="text-xs text-slate-400 mt-1">
              Verifiable interactive answers logged
            </div>
          </div>
          <div className="text-[11px] text-slate-400 pt-2 border-t border-slate-800/80">
            <span>Evidence weight: 1.0 per verified question</span>
          </div>
        </div>

        {/* Card 3: Assessments Completed */}
        <div className="bg-[#0F172A] border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>Assessments Completed</span>
            <Award className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="my-3">
            <div className="text-3xl font-bold font-mono text-slate-100">{quizAttempts.length}</div>
            <div className="text-xs text-slate-400 mt-1">
              Diagnostic & practice evaluations
            </div>
          </div>
          <div className="text-[11px] text-slate-400 pt-2 border-t border-slate-800/80">
            <span>Real-time calibration active</span>
          </div>
        </div>
      </div>

      {/* Topic Mastery Matrix Table or Empty State */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-100">Topic-Level Mastery Breakdown</h2>
          <span className="text-xs text-slate-400">Target score: 80%+</span>
        </div>

        {masteryTopics.length === 0 ? (
          <div className="bg-[#0F172A] border border-slate-800 rounded-xl p-8 text-center space-y-3">
            <div className="w-12 h-12 rounded-xl bg-slate-900 border border-slate-800 text-indigo-400 mx-auto flex items-center justify-center">
              <TrendingUp className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-slate-200">
                No learning evidence recorded yet
              </h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
                Complete diagnostic assessments or practice quizzes on your course materials to establish your topic mastery curves and cognitive domain profiles.
              </p>
            </div>
            <div className="pt-2">
              <button
                onClick={() => onTakeQuizForTopic('all')}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold transition-colors inline-flex items-center gap-1.5"
              >
                <Award className="w-3.5 h-3.5" />
                <span>Take Your First Assessment</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {masteryTopics.map((topic) => {
              const isMastered = topic.status === 'mastered';
              const isReview = topic.status === 'review_needed';

              return (
                <div
                  key={topic.topicId}
                  className="bg-[#0F172A] border border-slate-800 rounded-xl p-4 hover:border-slate-700 transition-colors space-y-3"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-xs">
                        <span className="font-mono text-indigo-400 font-semibold">
                          {topic.courseCode}
                        </span>
                        <span aria-hidden="true" className="text-slate-600">·</span>
                        <span
                          className={`text-[11px] font-mono font-medium ${
                            isMastered
                              ? 'text-emerald-400'
                              : isReview
                              ? 'text-amber-400'
                              : 'text-indigo-300'
                          }`}
                        >
                          {isMastered
                            ? 'Mastered'
                            : isReview
                            ? 'Revision Needed'
                            : 'In Progress'}
                        </span>
                        <span aria-hidden="true" className="text-slate-600">·</span>
                        <span className="text-slate-400 text-[11px]">
                          Last: {new Date(topic.lastPracticed).toLocaleDateString()}
                        </span>
                      </div>

                      <h3 className="text-sm font-semibold text-slate-200">{topic.topicName}</h3>
                    </div>

                    {/* Actions & Mastery Score */}
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        <div className="text-xs text-slate-400">Mastery</div>
                        <div
                          className={`text-base font-mono font-bold ${
                            topic.masteryPercentage >= 80
                              ? 'text-emerald-400'
                              : topic.masteryPercentage >= 50
                              ? 'text-indigo-300'
                              : 'text-amber-400'
                          }`}
                        >
                          {topic.masteryPercentage}%
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => onReviseInTutor(topic.topicName)}
                          className="px-2.5 py-1.5 rounded-lg bg-indigo-950/70 hover:bg-indigo-900/80 text-indigo-300 text-xs font-medium border border-indigo-800/40 transition-colors flex items-center gap-1"
                          title="Revise in AI Tutor"
                        >
                          <BrainCircuit className="w-3.5 h-3.5" />
                          <span>Revise</span>
                        </button>
                        <button
                          onClick={() => onTakeQuizForTopic(topic.topicId)}
                          className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition-colors flex items-center gap-1"
                          title="Test with practice quiz"
                        >
                          <Award className="w-3.5 h-3.5 text-violet-400" />
                          <span>Quiz</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Cognitive Domain Mini-Bars */}
                  {topic.cognitiveStrengths && (
                    <div className="pt-2 border-t border-slate-800/80 grid grid-cols-1 sm:grid-cols-3 gap-3 text-[11px] text-slate-400">
                      <div className="space-y-1">
                        <div className="flex justify-between">
                          <span>Recall & Terminology</span>
                          <span className="font-mono text-slate-300">
                            {topic.cognitiveStrengths.recall}%
                          </span>
                        </div>
                        <div className="w-full bg-slate-800 h-1 rounded-full overflow-hidden">
                          <div
                            className="bg-indigo-400 h-full"
                            style={{ width: `${topic.cognitiveStrengths.recall}%` }}
                          ></div>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <div className="flex justify-between">
                          <span>Application & Scenarios</span>
                          <span className="font-mono text-slate-300">
                            {topic.cognitiveStrengths.application}%
                          </span>
                        </div>
                        <div className="w-full bg-slate-800 h-1 rounded-full overflow-hidden">
                          <div
                            className="bg-indigo-400 h-full"
                            style={{ width: `${topic.cognitiveStrengths.application}%` }}
                          ></div>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <div className="flex justify-between">
                          <span>Analysis & Problem Solving</span>
                          <span className="font-mono text-slate-300">
                            {topic.cognitiveStrengths.analysis}%
                          </span>
                        </div>
                        <div className="w-full bg-slate-800 h-1 rounded-full overflow-hidden">
                          <div
                            className="bg-indigo-400 h-full"
                            style={{ width: `${topic.cognitiveStrengths.analysis}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Assessment History Log */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-100">Assessment History Log</h2>
        <div className="bg-[#0F172A] border border-slate-800 rounded-xl overflow-hidden">
          {quizAttempts.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400 space-y-1">
              <Clock className="w-6 h-6 mx-auto mb-2 text-slate-600" />
              <div className="text-slate-300 font-medium">No assessments completed yet</div>
              <p>When you complete quizzes, your scores and timestamps will appear here.</p>
            </div>
          ) : (
            <table className="w-full text-left text-xs">
              <thead className="bg-[#131B2E] border-b border-slate-800 text-slate-400">
                <tr>
                  <th className="p-3.5 font-medium">Assessment Title</th>
                  <th className="p-3.5 font-medium">Difficulty</th>
                  <th className="p-3.5 font-medium">Completed Date</th>
                  <th className="p-3.5 font-medium text-right">Score</th>
                  <th className="p-3.5 font-medium text-right">Result</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {quizAttempts.map((attempt) => (
                  <tr key={attempt.id} className="hover:bg-slate-900/50 transition-colors">
                    <td className="p-3.5 text-slate-200 font-medium">
                      {attempt.quizTitle}
                    </td>
                    <td className="p-3.5 text-slate-400 capitalize">{attempt.difficulty}</td>
                    <td className="p-3.5 text-slate-400">
                      {new Date(attempt.completedAt).toLocaleString([], {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="p-3.5 text-right font-mono font-bold text-emerald-400">
                      {attempt.score}/{attempt.totalQuestions} ({attempt.percentage}%)
                    </td>
                    <td className="p-3.5 text-right font-mono text-[11px] text-slate-300">
                      {attempt.percentage >= 80 ? 'Mastered' : 'Recorded'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};
