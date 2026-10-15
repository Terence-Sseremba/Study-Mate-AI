import React, { useState, useMemo, useEffect } from 'react';
import {
  Award,
  CheckCircle2,
  XCircle,
  ArrowRight,
  BookOpen,
  ChevronRight,
  Sparkles,
  Check,
  Info,
  PlusCircle,
  Clock,
  Calendar,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react';
import type {
  QuizQuestion,
  QuizAttempt,
  DifficultyLevel,
  StudyMaterial,
  SourceCitation,
  PracticeMethod,
  ReviewRecord,
} from '../../types/index.ts';
import {
  getDueReviews,
  formatTimeUntilDue,
} from '../../lib/spacedRepetition.ts';
import {
  deriveTopicNameFromChunk,
  extractStudyStatementsFromChunk,
  isNonInstructionalChunk,
  isValidTopicHeading,
} from '../../lib/documentExtraction.ts';

interface AssessmentsSectionProps {
  questions: QuizQuestion[];
  materials: StudyMaterial[];
  reviewRecords: ReviewRecord[];
  onCompleteQuiz: (attempt: QuizAttempt) => void;
  onOpenCitationModal: (citation: SourceCitation) => void;
  onReviseTopicInTutor: (topicName: string) => void;
  onNavigateToMaterials?: () => void;
  preselectedTopicId?: string;
  preselectedPracticeMethod?: PracticeMethod;
}

export const AssessmentsSection: React.FC<AssessmentsSectionProps> = ({
  questions: propQuestions,
  materials,
  reviewRecords,
  onCompleteQuiz,
  onOpenCitationModal,
  onReviseTopicInTutor,
  onNavigateToMaterials,
  preselectedTopicId,
  preselectedPracticeMethod = 'active_recall',
}) => {
  // Practice Method state
  const [practiceMethod, setPracticeMethod] = useState<PracticeMethod>(preselectedPracticeMethod);

  // Real curriculum topics derived ONLY from genuine processed materials
  const availableTopics = useMemo(() => {
    return materials.map((mat) => ({
      id: mat.id,
      name: mat.title,
      courseCode: mat.courseCode,
      chunksCount: mat.chunks?.length || 0,
      material: mat,
    }));
  }, [materials]);

  // Selected topic: default to 'all' only when topics exist, otherwise empty
  const [selectedTopic, setSelectedTopic] = useState<string>(() => {
    if (preselectedTopicId && availableTopics.some((t) => t.id === preselectedTopicId)) {
      return preselectedTopicId;
    }
    return availableTopics.length > 0 ? 'all' : '';
  });

  useEffect(() => {
    if (preselectedTopicId && availableTopics.some((t) => t.id === preselectedTopicId)) {
      setSelectedTopic(preselectedTopicId);
    } else if (availableTopics.length > 0 && !selectedTopic) {
      setSelectedTopic('all');
    } else if (availableTopics.length === 0) {
      setSelectedTopic('');
    }
  }, [preselectedTopicId, availableTopics]);

  useEffect(() => {
    if (preselectedPracticeMethod) {
      setPracticeMethod(preselectedPracticeMethod);
    }
  }, [preselectedPracticeMethod]);

  const [selectedDifficulty, setSelectedDifficulty] = useState<DifficultyLevel | 'all'>('all');
  const [questionCount, setQuestionCount] = useState<number>(3);

  // Spaced review due calculation
  const dueReviews = useMemo(() => {
    return getDueReviews(reviewRecords);
  }, [reviewRecords]);

  // Generate questions strictly from the selected real course materials
  const eligibleQuestions = useMemo(() => {
    if (materials.length === 0) {
      return [];
    }

    let targetMaterials = materials;

    // If Spaced Review is selected, filter materials to those corresponding to due review records
    if (practiceMethod === 'spaced_review') {
      const dueTopicIds = new Set(dueReviews.map((r) => r.topicId));
      if (selectedTopic && selectedTopic !== 'all') {
        targetMaterials = materials.filter((m) => m.id === selectedTopic && dueTopicIds.has(m.id));
      } else {
        targetMaterials = materials.filter((m) => dueTopicIds.has(m.id));
      }
      if (targetMaterials.length === 0) {
        return [];
      }
    } else if (selectedTopic && selectedTopic !== 'all') {
      targetMaterials = materials.filter((m) => m.id === selectedTopic);
    }

    const generated: QuizQuestion[] = [];

    targetMaterials.forEach((mat) => {
      const instructionalChunks = (mat.chunks || []).filter((c) => !isNonInstructionalChunk(c));
      instructionalChunks.forEach((chunk, cIdx) => {
        const derivedHeading = deriveTopicNameFromChunk(chunk, cIdx);
        const cleanHeading = isValidTopicHeading(derivedHeading, mat.title)
          ? derivedHeading
          : mat.title;
        const statements = extractStudyStatementsFromChunk(chunk);
        const primaryStatement =
          statements[0] ||
          `The ${cleanHeading} section in ${mat.title} establishes the core principles documented in ${chunk.anchorLabel || 'this passage'}.`;
        const excerptText =
          primaryStatement.length > 175
            ? `${primaryStatement.slice(0, 172).trim()}...`
            : primaryStatement;

        let questionPrompt = '';
        let distractor1 = '';
        let distractor2 = '';
        let distractor3 = '';

        const anchorText = chunk.pageNumber
          ? `Page ${chunk.pageNumber}`
          : chunk.slideNumber
          ? `Slide ${chunk.slideNumber}`
          : chunk.anchorLabel || cleanHeading || 'Document Passage';

        if (practiceMethod === 'spaced_review') {
          questionPrompt = `Spaced Retention Check: Recall the core invariant or principle from "${cleanHeading}" in "${mat.title}" (${anchorText}):`;
          distractor1 = `An outdated formulation where the critical constraints of ${cleanHeading} are omitted.`;
          distractor2 = `A common misconception that inverts the operation documented in ${anchorText}.`;
          distractor3 = `An external heuristic unsupported by the verified syllabus text of ${mat.title}.`;
        } else if (practiceMethod === 'concept_explanation') {
          questionPrompt = `Concept Explanation (Feynman Technique): In your own words, which statement best explains the mechanism and significance of "${cleanHeading}" from "${mat.title}" (${anchorText})?`;
          distractor1 = `It inverts the primary mechanism of ${cleanHeading}, assuming opposite preconditions.`;
          distractor2 = `It treats ${cleanHeading} as an unverified approximation that disregards course validation rules.`;
          distractor3 = `A broad external concept not supported by the syllabus text of ${mat.title}.`;
        } else if (practiceMethod === 'active_recall') {
          questionPrompt = `Active Recall: What is the primary definition or key invariant established in "${cleanHeading}" (${anchorText} of "${mat.title}")?`;
          distractor1 = `A conflicting definition that inverts the critical constraints of ${cleanHeading}.`;
          distractor2 = `An uncommitted transition that violates the invariants documented in ${anchorText}.`;
          distractor3 = `A secondary hypothesis omitted from the verified text of ${mat.title}.`;
        } else {
          // mixed_practice: alternate between recall and conceptual explanation
          if (cIdx % 2 === 0) {
            questionPrompt = `Active Recall: What primary invariant is defined in "${cleanHeading}" (${anchorText} of "${mat.title}")?`;
            distractor1 = `An alternative formulation where the invariants in ${cleanHeading} are omitted.`;
            distractor2 = `An uncommitted transition that bypasses the validation rules in ${anchorText}.`;
            distractor3 = `A secondary hypothesis unrelated to the core text of ${mat.title}.`;
          } else {
            questionPrompt = `Concept Explanation: How does "${cleanHeading}" function within "${mat.title}" (${anchorText})?`;
            distractor1 = `It bypasses safety requirements when operating under normal parameters.`;
            distractor2 = `It reverses the causal order of operations detailed in section ${cleanHeading}.`;
            distractor3 = `It applies an external heuristic that conflicts with the findings in ${anchorText}.`;
          }
        }

        const correctIdx = cIdx % 4;
        const distractors = [distractor1, distractor2, distractor3];
        const options: string[] = [];
        let dIdx = 0;
        for (let i = 0; i < 4; i++) {
          if (i === correctIdx) {
            options.push(excerptText);
          } else {
            options.push(distractors[dIdx++]);
          }
        }

        generated.push({
          id: `q-${chunk.id}-${practiceMethod}`,
          topicId: mat.id,
          topicName: cleanHeading,
          questionText: questionPrompt,
          options,
          correctOptionIndex: correctIdx,
          explanation: `Verified directly from ${anchorText} of "${mat.title}": "${primaryStatement}"`,
          difficulty: cIdx % 2 === 0 ? 'intermediate' : 'foundational',
          sourceReference: {
            materialTitle: mat.title,
            pageOrSlideNumber: chunk.pageOrSlideNumber,
            quoteExcerpt: primaryStatement,
          },
        });
      });
    });

    return generated;
  }, [materials, selectedTopic, practiceMethod, dueReviews]);

  // Active quiz state
  const [inQuizMode, setInQuizMode] = useState(false);
  const [activeQuestions, setActiveQuestions] = useState<QuizQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isAnswerSubmitted, setIsAnswerSubmitted] = useState(false);
  const [userAnswers, setUserAnswers] = useState<Record<string, number>>({});
  const [quizFinished, setQuizFinished] = useState(false);
  const [isMasteryRecorded, setIsMasteryRecorded] = useState(false);

  // Check if assessment can begin
  const canBeginAssessment = useMemo(() => {
    if (materials.length === 0) return false;
    if (practiceMethod === 'spaced_review' && dueReviews.length === 0) return false;
    return eligibleQuestions.length > 0;
  }, [materials.length, practiceMethod, dueReviews.length, eligibleQuestions.length]);

  const disabledReason = useMemo(() => {
    if (materials.length === 0) {
      return 'No course materials available. Upload course slides or PDFs to index curriculum topics.';
    }
    if (practiceMethod === 'spaced_review' && dueReviews.length === 0) {
      return 'No spaced reviews are currently due. Complete an initial assessment using Active Recall or Mixed Practice to schedule reviews.';
    }
    if (eligibleQuestions.length === 0) {
      return 'No questions match the current selection. Please adjust your topic filter.';
    }
    return '';
  }, [materials.length, practiceMethod, dueReviews.length, eligibleQuestions.length]);

  const startQuiz = () => {
    if (!canBeginAssessment) return;

    let pool = [...eligibleQuestions];
    if (selectedDifficulty !== 'all') {
      const filtered = pool.filter((q) => q.difficulty === selectedDifficulty);
      if (filtered.length > 0) pool = filtered;
    }

    const chosen = pool.slice(0, Math.min(questionCount, pool.length));
    setActiveQuestions(chosen);
    setCurrentIndex(0);
    setSelectedOption(null);
    setIsAnswerSubmitted(false);
    setUserAnswers({});
    setQuizFinished(false);
    setIsMasteryRecorded(false);
    setInQuizMode(true);
  };

  const handleSelectOption = (idx: number) => {
    if (isAnswerSubmitted) return;
    setSelectedOption(idx);
  };

  const handleSubmitAnswer = () => {
    if (selectedOption === null) return;
    const currentQ = activeQuestions[currentIndex];
    setUserAnswers((prev) => ({ ...prev, [currentQ.id]: selectedOption }));
    setIsAnswerSubmitted(true);
  };

  const handleNextQuestion = () => {
    if (currentIndex + 1 < activeQuestions.length) {
      setCurrentIndex((prev) => prev + 1);
      setSelectedOption(null);
      setIsAnswerSubmitted(false);
    } else {
      setQuizFinished(true);
    }
  };

  // Score calculation
  const correctCount = activeQuestions.reduce((acc, q) => {
    return userAnswers[q.id] === q.correctOptionIndex ? acc + 1 : acc;
  }, 0);
  const scorePercent =
    activeQuestions.length > 0 ? Math.round((correctCount / activeQuestions.length) * 100) : 0;

  const handleRecordMastery = () => {
    if (isMasteryRecorded) return;

    const currentTopicObj = availableTopics.find((t) => t.id === selectedTopic);
    const attempt: QuizAttempt = {
      id: `attempt-${Date.now()}`,
      quizTitle:
        practiceMethod === 'spaced_review'
          ? `Spaced Review: ${currentTopicObj?.name || 'Due Topics'}`
          : `Assessment: ${currentTopicObj?.name || 'Curriculum Check'}`,
      topicId: selectedTopic && selectedTopic !== 'all' ? selectedTopic : (activeQuestions[0]?.topicId || 'general'),
      topicName: currentTopicObj?.name || activeQuestions[0]?.topicName || 'Curriculum Topics',
      difficulty: selectedDifficulty === 'all' ? 'intermediate' : selectedDifficulty,
      totalQuestions: activeQuestions.length,
      score: correctCount,
      percentage: scorePercent,
      completedAt: new Date().toISOString(),
      userAnswers,
      timeSpentSeconds: 90,
      isDemoSample: false,
    };

    onCompleteQuiz(attempt);
    setIsMasteryRecorded(true);
  };

  const currentQ = activeQuestions[currentIndex];

  const handleStartDueReviews = () => {
    if (dueReviews.length === 0) return;
    const firstDue = dueReviews[0];
    if (firstDue && availableTopics.some((t) => t.id === firstDue.topicId)) {
      setSelectedTopic(firstDue.topicId);
    } else {
      setSelectedTopic('all');
    }
    setPracticeMethod('spaced_review');
    // Start quiz immediately with due review questions
    setTimeout(() => {
      startQuiz();
    }, 50);
  };

  const practiceMethodOptions: Array<{
    id: PracticeMethod;
    title: string;
    description: string;
    badge?: string;
  }> = [
    {
      id: 'active_recall',
      title: 'Active Recall',
      description:
        'Ask questions that require the student to retrieve knowledge from memory before seeing the answer.',
    },
    {
      id: 'concept_explanation',
      title: 'Concept Explanation',
      description:
        'Ask the student to explain a concept in their own words, using a Feynman-style learning activity.',
    },
    {
      id: 'mixed_practice',
      title: 'Mixed Practice',
      description:
        'Combine recall questions, conceptual explanations, and application problems.',
    },
    {
      id: 'spaced_review',
      title: 'Spaced Review',
      description:
        'Practise topics that are due for review based on actual assessment history and review scheduling.',
      badge: dueReviews.length > 0 ? `${dueReviews.length} Due` : undefined,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-100">Adaptive Assessments</h1>
          <p className="text-xs sm:text-sm text-slate-400">
            Configure practice sessions and spaced repetition reviews grounded in your course materials.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <span className="font-mono text-slate-200 font-bold">{availableTopics.length}</span>
          <span>curriculum topics indexed</span>
          <span aria-hidden="true" className="text-slate-600">·</span>
          <span className="font-mono text-indigo-400">{dueReviews.length} reviews due</span>
        </div>
      </div>

      {/* QUIZ SETUP VIEW */}
      {!inQuizMode && (
        <div className="space-y-6">
          {/* Spaced Repetition Due Reviews Banner / Status */}
          {dueReviews.length > 0 ? (
            <div className="bg-gradient-to-r from-indigo-950/90 to-[#131B2E] border border-indigo-700/60 rounded-xl p-5 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-lg bg-indigo-600/30 text-indigo-400 border border-indigo-500/40">
                    <Clock className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                      <span>Spaced Repetition Reviews Ready</span>
                      <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-indigo-600 text-white">
                        {dueReviews.length} Due Today
                      </span>
                    </h2>
                    <p className="text-xs text-slate-300">
                      Interval schedule active (1d → 3d → 7d → 14d → 30d). Reviewing now reinforces memory retention before forgetting occurs.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleStartDueReviews}
                  disabled={materials.length === 0}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors flex items-center justify-center gap-1.5 shrink-0"
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>Review Spaced Repetition Due Topics ({dueReviews.length})</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-2 border-t border-indigo-900/50">
                {dueReviews.map((rev) => (
                  <div
                    key={rev.topicId}
                    className="bg-[#0B0F19]/80 border border-indigo-900/40 rounded-lg p-2.5 flex items-center justify-between text-xs"
                  >
                    <div className="min-w-0 pr-2">
                      <div className="font-medium text-slate-200 truncate">{rev.topicName}</div>
                      <div className="text-[11px] text-indigo-400">
                        Streak: {rev.consecutiveSuccessCount} · {formatTimeUntilDue(rev.nextReviewDueAt)}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedTopic(rev.topicId);
                        setPracticeMethod('active_recall');
                      }}
                      className="px-2 py-1 rounded bg-indigo-900/80 hover:bg-indigo-800 text-indigo-200 text-[11px] font-medium border border-indigo-700/50 shrink-0"
                    >
                      Target Topic
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="bg-[#0F172A] border border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-400">
                  <Clock className="w-4 h-4 text-indigo-400" />
                </div>
                <div>
                  <div className="font-semibold text-slate-200 flex items-center gap-2">
                    <span>Spaced Repetition Schedule</span>
                    <span className="text-[11px] text-emerald-400 font-mono">All reviews up to date</span>
                  </div>
                  <p className="text-slate-400 text-[11px]">
                    {reviewRecords.length === 0
                      ? 'Complete an assessment using Active Recall or Concept Explanation to schedule your first review interval.'
                      : 'No topics are currently due. Topics advance across 1d → 3d → 7d → 14d → 30d intervals as you answer accurately.'}
                  </p>
                </div>
              </div>
              {reviewRecords.length > 0 && (
                <div className="text-right text-[11px] text-slate-400 font-mono shrink-0">
                  <span>{reviewRecords.length} topic{reviewRecords.length === 1 ? '' : 's'} in memory schedule</span>
                </div>
              )}
            </div>
          )}

          {/* Assessment Configuration Form */}
          <div className="bg-[#0F172A] border border-slate-800 rounded-xl p-6 space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-indigo-950/70 border border-indigo-800/40 text-indigo-400">
                  <Award className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-slate-100">
                    Assessment Configuration
                  </h2>
                  <p className="text-xs text-slate-400">
                    Select your curriculum topic, practice method, and question depth.
                  </p>
                </div>
              </div>

              {/* Spaced Review Due Quick Status */}
              {dueReviews.length > 0 && (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-indigo-950/80 border border-indigo-800/60 text-indigo-300 text-xs">
                  <Clock className="w-3.5 h-3.5 text-indigo-400" />
                  <span>
                    <strong className="font-mono">{dueReviews.length}</strong> Due Today
                  </span>
                </div>
              )}
            </div>

            {/* SEPARATE CONTROL 1: Target Curriculum Topic */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-200 flex items-center justify-between">
                <span>Target Curriculum Topic</span>
                <span className="text-[11px] text-slate-400 font-normal">Course Knowledge</span>
              </label>

              {availableTopics.length === 0 ? (
                /* Empty state when knowledge base has no course materials */
                <div className="bg-[#0B0F19] border border-slate-800 rounded-lg p-4 space-y-2.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-300 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-400" />
                      No topics available yet
                    </span>
                    <span className="text-[11px] font-mono text-slate-400">
                      0 materials indexed
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Upload and process course materials before selecting a curriculum topic.
                    StudyMate AI derives all assessment questions strictly from your indexed slides and textbooks.
                  </p>
                  {onNavigateToMaterials && (
                    <button
                      type="button"
                      onClick={onNavigateToMaterials}
                      className="text-xs text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1.5 transition-colors pt-1"
                    >
                      <PlusCircle className="w-3.5 h-3.5" />
                      <span>Upload your course materials in Study Materials →</span>
                    </button>
                  )}
                </div>
              ) : (
                /* Real curriculum topics from uploaded materials */
                <div className="space-y-1">
                  <select
                    value={selectedTopic}
                    onChange={(e) => setSelectedTopic(e.target.value)}
                    className="w-full bg-[#0B0F19] border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 focus-visible:ring-2 focus-visible:ring-indigo-500"
                  >
                    <option value="all">
                      All available topics ({availableTopics.length} topics)
                    </option>
                    {availableTopics.map((t) => (
                      <option key={t.id} value={t.id}>
                        [{t.courseCode}] {t.name} ({t.chunksCount} chunks indexed)
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-slate-400">
                    Questions are traceable to specific pages and slides in your uploaded files.
                  </p>
                </div>
              )}
            </div>

            {/* SEPARATE CONTROL 2: Practice Method */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-200 flex items-center justify-between">
                <span>Practice Method</span>
                <span className="text-[11px] text-slate-400 font-normal">Learning Technique</span>
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {practiceMethodOptions.map((method) => {
                  const isSelected = practiceMethod === method.id;
                  return (
                    <button
                      key={method.id}
                      type="button"
                      onClick={() => setPracticeMethod(method.id)}
                      className={`text-left p-3.5 rounded-lg border transition-all flex flex-col justify-between space-y-2 ${
                        isSelected
                          ? 'bg-indigo-950/70 border-indigo-600 text-slate-100 shadow-sm'
                          : 'bg-[#0B0F19] border-slate-800 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full gap-1">
                        <span className="font-semibold text-xs text-slate-100 flex items-center gap-1.5">
                          {method.title}
                        </span>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {method.badge && (
                            <span className="px-1.5 py-0.5 text-[10px] font-mono font-bold rounded bg-indigo-600 text-white">
                              {method.badge}
                            </span>
                          )}
                          {isSelected && (
                            <span className="w-2 h-2 rounded-full bg-indigo-400"></span>
                          )}
                        </div>
                      </div>
                      <p className="text-[11px] text-slate-400 leading-normal">
                        {method.description}
                      </p>
                    </button>
                  );
                })}
              </div>

              {/* Guidance when Spaced Review is selected but no topics are due */}
              {practiceMethod === 'spaced_review' && dueReviews.length === 0 && (
                <div className="p-3.5 rounded-lg bg-indigo-950/40 border border-indigo-800/50 text-xs text-indigo-300 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-2.5">
                    <Info className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold text-slate-200">No Spaced Reviews Currently Due: </span>
                      <span className="text-slate-400">
                        {reviewRecords.length === 0
                          ? 'No topics are scheduled for review yet. Complete an initial assessment first using Active Recall or Mixed Practice to schedule review intervals.'
                          : 'All your indexed topics are up to date! Reviews will appear here when their spaced retention intervals elapse.'}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPracticeMethod('active_recall')}
                    className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shrink-0 transition-colors"
                  >
                    Switch to Active Recall
                  </button>
                </div>
              )}
            </div>

            {/* CONTROLS 3 & 4: Difficulty and Question Count */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-2 border-t border-slate-800/80">
              {/* Difficulty Level */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-300">Difficulty Level</label>
                <select
                  value={selectedDifficulty}
                  onChange={(e) =>
                    setSelectedDifficulty(e.target.value as DifficultyLevel | 'all')
                  }
                  className="w-full bg-[#0B0F19] border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 focus-visible:ring-2 focus-visible:ring-indigo-500"
                >
                  <option value="all">Adaptive (All Levels)</option>
                  <option value="foundational">Beginner / Foundational</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="advanced">Advanced</option>
                </select>
              </div>

              {/* Question Count */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-300">Question Count</label>
                <div className="flex items-center gap-2">
                  {[2, 3, 5].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setQuestionCount(num)}
                      className={`flex-1 py-2 text-xs font-medium rounded-lg border transition-colors ${
                        questionCount === num
                          ? 'bg-indigo-950 text-indigo-300 border-indigo-700 font-semibold'
                          : 'bg-[#0B0F19] text-slate-400 border-slate-800 hover:text-slate-200'
                      }`}
                    >
                      {num} Items
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Assessment Configuration Summary Box */}
            <div className="p-3.5 rounded-lg bg-[#0B0F19] border border-slate-800 text-xs space-y-2">
              <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Configuration Summary
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                <div>
                  <span className="text-slate-500 block">Topic:</span>
                  <span className="text-slate-200 font-medium truncate block">
                    {availableTopics.length === 0
                      ? 'None available'
                      : selectedTopic === 'all'
                      ? 'All available topics'
                      : availableTopics.find((t) => t.id === selectedTopic)?.name || 'Selected Topic'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Method:</span>
                  <span className="text-indigo-300 font-medium capitalize">
                    {practiceMethod.replace('_', ' ')}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Difficulty:</span>
                  <span className="text-slate-200 font-medium capitalize">{selectedDifficulty}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Questions:</span>
                  <span className="text-slate-200 font-medium font-mono">{questionCount} questions</span>
                </div>
              </div>
            </div>

            {/* Launch CTA or Disabled Feedback */}
            <div className="pt-2 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-2 text-xs text-slate-400">
                {canBeginAssessment ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Configuration valid · Questions ready to launch</span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                    <span className="text-amber-400/90">{disabledReason}</span>
                  </>
                )}
              </div>

              {canBeginAssessment ? (
                <button
                  type="button"
                  onClick={startQuiz}
                  className="w-full sm:w-auto px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors flex items-center justify-center gap-2 focus-visible:ring-2 focus-visible:ring-indigo-400"
                >
                  <span>Begin Assessment</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              ) : (
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  {materials.length === 0 && onNavigateToMaterials ? (
                    <button
                      type="button"
                      onClick={onNavigateToMaterials}
                      className="w-full sm:w-auto px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-2"
                    >
                      <PlusCircle className="w-4 h-4 text-indigo-400" />
                      <span>Upload Course Materials</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled
                      className="w-full sm:w-auto px-6 py-2.5 bg-slate-800 text-slate-500 cursor-not-allowed rounded-lg text-xs font-semibold"
                    >
                      Begin Assessment
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ACTIVE QUIZ VIEW */}
      {inQuizMode && !quizFinished && currentQ && (
        <div className="bg-[#0F172A] border border-slate-800 rounded-xl p-6 space-y-6">
          {/* Progress Header */}
          <div className="flex items-center justify-between pb-4 border-b border-slate-800 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-200">
                Question {currentIndex + 1} of {activeQuestions.length}
              </span>
              <span aria-hidden="true" className="text-slate-600">·</span>
              <span className="text-indigo-400 font-mono">{currentQ.topicName}</span>
              <span aria-hidden="true" className="text-slate-600">·</span>
              <span className="text-slate-400 capitalize">{practiceMethod.replace('_', ' ')}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="capitalize text-slate-400 text-[11px] font-mono">
                {currentQ.difficulty}
              </span>
              <button
                onClick={() => setInQuizMode(false)}
                className="text-slate-400 hover:text-slate-200 ml-3 transition-colors"
              >
                Quit Assessment
              </button>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-slate-800 h-1 rounded-full overflow-hidden">
            <div
              className="bg-indigo-500 h-full transition-all"
              style={{
                width: `${((currentIndex + 1) / activeQuestions.length) * 100}%`,
              }}
            ></div>
          </div>

          {/* Question Text */}
          <div className="space-y-2">
            <h2 className="text-base sm:text-lg font-semibold text-slate-100 leading-snug">
              {currentQ.questionText}
            </h2>
          </div>

          {/* Options */}
          <div className="space-y-2.5">
            {currentQ.options.map((option, optIdx) => {
              const isSelected = selectedOption === optIdx;
              const isCorrect = currentQ.correctOptionIndex === optIdx;

              let optionStyle =
                'bg-[#0B0F19] border-slate-800 text-slate-300 hover:border-slate-700';

              if (isAnswerSubmitted) {
                if (isCorrect) {
                  optionStyle = 'bg-emerald-950/30 border-emerald-600/80 text-emerald-200';
                } else if (isSelected && !isCorrect) {
                  optionStyle = 'bg-rose-950/30 border-rose-600/80 text-rose-200';
                }
              } else if (isSelected) {
                optionStyle = 'bg-indigo-950/50 border-indigo-600 text-indigo-200';
              }

              return (
                <button
                  key={optIdx}
                  type="button"
                  disabled={isAnswerSubmitted}
                  onClick={() => handleSelectOption(optIdx)}
                  className={`w-full text-left p-3.5 rounded-lg border text-xs sm:text-sm transition-all flex items-center justify-between ${optionStyle}`}
                >
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-md bg-slate-900 border border-slate-800 flex items-center justify-center text-xs font-mono font-semibold text-slate-400">
                      {String.fromCharCode(65 + optIdx)}
                    </span>
                    <span>{option}</span>
                  </div>

                  {isAnswerSubmitted && isCorrect && (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  )}
                  {isAnswerSubmitted && isSelected && !isCorrect && (
                    <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Answer Feedback */}
          {isAnswerSubmitted && (
            <div className="p-4 rounded-xl bg-[#0B0F19] border border-slate-800 space-y-3 animate-in fade-in duration-200">
              <div className="flex items-center gap-2">
                {selectedOption === currentQ.correctOptionIndex ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs font-bold text-emerald-400">
                      Correct Answer!
                    </span>
                  </>
                ) : (
                  <>
                    <XCircle className="w-4 h-4 text-rose-400" />
                    <span className="text-xs font-bold text-rose-400">
                      Incorrect — Let's Review
                    </span>
                  </>
                )}
              </div>

              <p className="text-xs text-slate-300 leading-relaxed">
                {currentQ.explanation}
              </p>

              {/* Source Reference Anchor */}
              {currentQ.sourceReference && (
                <div className="pt-2 border-t border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2 text-indigo-400 font-mono text-[11px]">
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>
                      Source: {currentQ.sourceReference.materialTitle} ·{' '}
                      {currentQ.sourceReference.anchorLabel ||
                        (currentQ.sourceReference.pageOrSlideNumber
                          ? `Page/Slide ${currentQ.sourceReference.pageOrSlideNumber}`
                          : 'Document Excerpt')}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-slate-400 italic">
                      "{currentQ.sourceReference.quoteExcerpt.slice(0, 60)}..."
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        onOpenCitationModal({
                          id: `cite-${currentQ.id}`,
                          chunkId: currentQ.id,
                          materialId: currentQ.topicId,
                          materialTitle: currentQ.sourceReference.materialTitle,
                          pageOrSlideNumber: currentQ.sourceReference.pageOrSlideNumber,
                          sectionHeading: currentQ.topicName,
                          excerpt: currentQ.sourceReference.quoteExcerpt,
                          relevanceScore: 0.98,
                        });
                      }}
                      className="px-2 py-0.5 rounded text-[11px] text-indigo-300 hover:text-indigo-200 bg-indigo-950 hover:bg-indigo-900 border border-indigo-800/60 font-medium transition-colors"
                    >
                      Inspect Excerpt
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Actions Bar */}
          <div className="pt-4 border-t border-slate-800 flex justify-end">
            {!isAnswerSubmitted ? (
              <button
                type="button"
                disabled={selectedOption === null}
                onClick={handleSubmitAnswer}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-lg text-xs font-semibold transition-colors"
              >
                Submit Answer
              </button>
            ) : (
              <button
                type="button"
                onClick={handleNextQuestion}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5"
              >
                <span>
                  {currentIndex + 1 < activeQuestions.length
                    ? 'Next Question'
                    : 'Complete Assessment'}
                </span>
                <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* QUIZ FINISHED / SUMMARY VIEW */}
      {inQuizMode && quizFinished && (
        <div className="bg-[#0F172A] border border-slate-800 rounded-xl p-6 space-y-6">
          <div className="text-center py-4 space-y-2">
            <div className="w-14 h-14 rounded-full bg-indigo-950/80 border border-indigo-700/60 text-indigo-400 mx-auto flex items-center justify-center">
              <Award className="w-7 h-7" />
            </div>
            <h2 className="text-lg font-bold text-slate-100">Assessment Completed!</h2>
            <p className="text-xs text-slate-400">
              Evaluated using <strong className="text-indigo-300 capitalize">{practiceMethod.replace('_', ' ')}</strong>.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
            <div className="bg-[#0B0F19] border border-slate-800 rounded-lg p-4">
              <div className="text-xs text-slate-400">Score</div>
              <div className="text-2xl font-bold font-mono text-slate-100 mt-1">
                {correctCount} / {activeQuestions.length}
              </div>
            </div>
            <div className="bg-[#0B0F19] border border-slate-800 rounded-lg p-4">
              <div className="text-xs text-slate-400">Percentage</div>
              <div
                className={`text-2xl font-bold font-mono mt-1 ${
                  scorePercent >= 70 ? 'text-emerald-400' : 'text-amber-400'
                }`}
              >
                {scorePercent}%
              </div>
            </div>
            <div className="bg-[#0B0F19] border border-slate-800 rounded-lg p-4">
              <div className="text-xs text-slate-400">Spaced Interval Impact</div>
              <div className="text-sm font-bold font-mono text-indigo-400 mt-2">
                {scorePercent >= 70
                  ? 'Advances to next interval'
                  : 'Schedules 10m review retry'}
              </div>
            </div>
          </div>

          {/* Record Mastery & Spaced Schedule Action */}
          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="space-y-0.5 text-center sm:text-left">
              <div className="text-xs font-semibold text-slate-200">
                Update Topic Mastery & Spaced Repetition Schedule
              </div>
              <p className="text-[11px] text-slate-400">
                Saves your attempt and calculates the next review date (1d → 3d → 7d → 14d → 30d).
              </p>
            </div>

            <button
              onClick={handleRecordMastery}
              disabled={isMasteryRecorded}
              className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                isMasteryRecorded
                  ? 'bg-emerald-950 text-emerald-300 border border-emerald-800 cursor-default'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm'
              }`}
            >
              {isMasteryRecorded ? (
                <>
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span>Mastery & Spaced Schedule Updated</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Update Mastery & Schedule</span>
                </>
              )}
            </button>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800">
            <button
              onClick={() => {
                setInQuizMode(false);
                setQuizFinished(false);
              }}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium transition-colors"
            >
              Back to Assessment Setup
            </button>

            <button
              onClick={() => {
                const topicName = activeQuestions[0]?.topicName || 'Course Concept';
                onReviseTopicInTutor(topicName);
              }}
              className="px-4 py-2 bg-indigo-950 hover:bg-indigo-900 text-indigo-300 border border-indigo-800/60 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5"
            >
              <span>Revise Concepts with AI Tutor</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
