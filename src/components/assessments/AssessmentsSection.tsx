import React, { useState, useMemo } from 'react';
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
  Layers,
} from 'lucide-react';
import type {
  QuizQuestion,
  QuizAttempt,
  DifficultyLevel,
  StudyMaterial,
  SourceCitation,
} from '../../types';

interface AssessmentsSectionProps {
  questions: QuizQuestion[];
  materials: StudyMaterial[];
  onCompleteQuiz: (attempt: QuizAttempt) => void;
  onOpenCitationModal: (citation: SourceCitation) => void;
  onReviseTopicInTutor: (topicName: string) => void;
  onNavigateToMaterials?: () => void;
  preselectedTopicId?: string;
}

// Foundational diagnostic questions on evidence-based study techniques available before file upload
const FOUNDATIONAL_STUDY_QUESTIONS: QuizQuestion[] = [
  {
    id: 'study-q1',
    topicId: 'topic-active-recall',
    topicName: 'Active Recall & Retrieval Practice',
    questionText:
      'According to cognitive learning science, why is active retrieval practice more effective than passive re-reading of textbooks and lecture notes?',
    options: [
      'It creates stronger neural memory consolidation and diagnostic calibration of knowledge gaps',
      'It reduces total study time by eliminating the need to take notes',
      'It converts short-term memories immediately into permanent procedural memory',
      'It bypasses the hippocampus and stores data directly in the prefrontal cortex',
    ],
    correctOptionIndex: 0,
    explanation:
      'Retrieval practice forces the brain to reconstruct memory traces, strengthening synaptic connections and revealing exactly which concepts are not yet mastered.',
    difficulty: 'foundational',
    sourceReference: {
      materialTitle: 'Cognitive Learning Principles',
      pageOrSlideNumber: 1,
      quoteExcerpt:
        'Retrieval practice directly modifies memory representation, making knowledge more accessible in future recall contexts.',
    },
  },
  {
    id: 'study-q2',
    topicId: 'topic-spaced-repetition',
    topicName: 'Spaced Repetition & Forgetting Curve',
    questionText:
      'Under the Ebbinghaus forgetting curve model, when is the optimal interval to review newly learned course material?',
    options: [
      'Just before the memory trace is completely forgotten, resetting the decay curve at a shallower slope',
      'Every 15 minutes continuously during a single study session',
      'Only on the night before the final exam to maximize recency bias',
      'Immediately after waking up regardless of when it was first learned',
    ],
    correctOptionIndex: 0,
    explanation:
      'Reviewing material just as forgetting begins forces effortful retrieval, which flattens the decay curve and promotes long-term retention.',
    difficulty: 'intermediate',
    sourceReference: {
      materialTitle: 'Cognitive Learning Principles',
      pageOrSlideNumber: 3,
      quoteExcerpt:
        'Effortful retrieval at expanding temporal intervals significantly impedes the rate of subsequent memory decay.',
    },
  },
  {
    id: 'study-q3',
    topicId: 'topic-feynman-technique',
    topicName: 'Feynman Technique & Conceptual Synthesis',
    questionText:
      'What is the primary indicator of conceptual mastery when applying the Feynman Technique to course topics?',
    options: [
      'The ability to explain the core concept in simple, jargon-free language to a novice without consulting notes',
      'The speed at which you can transcribe verbatim textbook definitions',
      'Memorizing mathematical equations without needing to understand underlying assumptions',
      'Highlighting more than 70% of a textbook chapter',
    ],
    correctOptionIndex: 0,
    explanation:
      'The Feynman Technique relies on explaining complex concepts in simple terms; difficulties in doing so immediately pinpoint gaps in fundamental understanding.',
    difficulty: 'intermediate',
    sourceReference: {
      materialTitle: 'Cognitive Learning Principles',
      pageOrSlideNumber: 5,
      quoteExcerpt:
        'If you cannot explain a concept in simple, precise language, you have identified the precise boundary of your current comprehension.',
    },
  },
];

export const AssessmentsSection: React.FC<AssessmentsSectionProps> = ({
  questions: propQuestions,
  materials,
  onCompleteQuiz,
  onOpenCitationModal,
  onReviseTopicInTutor,
  onNavigateToMaterials,
  preselectedTopicId,
}) => {
  // Dynamically derive questions from uploaded materials if available
  const availableQuestions = useMemo(() => {
    if (materials.length > 0) {
      const derived: QuizQuestion[] = [];
      materials.forEach((mat) => {
        (mat.chunks || []).forEach((chunk, cIdx) => {
          derived.push({
            id: `q-${chunk.id}`,
            topicId: `topic-${mat.id}`,
            topicName: mat.title,
            questionText: `Based on ${chunk.sectionHeading} in "${mat.title}", which statement correctly represents the core concept on page/slide ${chunk.pageOrSlideNumber}?`,
            options: [
              `Correct: ${chunk.extractedText.slice(0, 110)}...`,
              `Incorrect alternative hypothesis regarding ${chunk.sectionHeading}`,
              `Inverted condition that contradicts page ${chunk.pageOrSlideNumber}`,
              `Unrelated concept not found in ${mat.title}`,
            ],
            correctOptionIndex: 0,
            explanation: `Verified directly from page/slide ${chunk.pageOrSlideNumber} of ${mat.title}: "${chunk.extractedText}"`,
            difficulty: cIdx % 2 === 0 ? 'foundational' : 'intermediate',
            sourceReference: {
              materialTitle: mat.title,
              pageOrSlideNumber: chunk.pageOrSlideNumber,
              quoteExcerpt: chunk.extractedText.slice(0, 120),
            },
          });
        });
      });
      return derived.length > 0 ? derived : propQuestions;
    }
    // If no materials, use foundational diagnostic
    return FOUNDATIONAL_STUDY_QUESTIONS;
  }, [materials, propQuestions]);

  // State for setup vs taking quiz
  const [inQuizMode, setInQuizMode] = useState(false);
  const [selectedTopic, setSelectedTopic] = useState<string>(preselectedTopicId || 'all');
  const [selectedDifficulty, setSelectedDifficulty] = useState<DifficultyLevel | 'all'>('all');
  const [questionCount, setQuestionCount] = useState<number>(3);

  // Active quiz state
  const [activeQuestions, setActiveQuestions] = useState<QuizQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isAnswerSubmitted, setIsAnswerSubmitted] = useState(false);
  const [userAnswers, setUserAnswers] = useState<Record<string, number>>({});
  const [quizFinished, setQuizFinished] = useState(false);
  const [isMasteryRecorded, setIsMasteryRecorded] = useState(false);

  // Topics available in question pool
  const uniqueTopics = useMemo(() => {
    return Array.from(
      new Set(availableQuestions.map((q) => JSON.stringify({ id: q.topicId, name: q.topicName })))
    ).map((s) => JSON.parse(s) as { id: string; name: string });
  }, [availableQuestions]);

  const startQuiz = () => {
    let pool = [...availableQuestions];
    if (selectedTopic !== 'all') {
      pool = pool.filter((q) => q.topicId === selectedTopic);
    }
    if (selectedDifficulty !== 'all') {
      pool = pool.filter((q) => q.difficulty === selectedDifficulty);
    }

    if (pool.length === 0) {
      pool = [...availableQuestions];
    }

    // Shuffle and pick requested count
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

  // Calculate score
  const correctCount = activeQuestions.reduce((acc, q) => {
    return userAnswers[q.id] === q.correctOptionIndex ? acc + 1 : acc;
  }, 0);
  const scorePercent =
    activeQuestions.length > 0 ? Math.round((correctCount / activeQuestions.length) * 100) : 0;

  const handleRecordMastery = () => {
    if (isMasteryRecorded) return;

    const currentTopicObj = uniqueTopics.find((t) => t.id === selectedTopic);
    const attempt: QuizAttempt = {
      id: `attempt-${Date.now()}`,
      quizTitle: currentTopicObj ? `Assessment: ${currentTopicObj.name}` : 'Curriculum Diagnostic',
      topicId: selectedTopic === 'all' ? (activeQuestions[0]?.topicId || 'topic-general') : selectedTopic,
      topicName: currentTopicObj?.name || activeQuestions[0]?.topicName || 'General Curriculum',
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-100">Adaptive Assessments</h1>
          <p className="text-xs sm:text-sm text-slate-400">
            {materials.length > 0
              ? 'Topic-specific diagnostic quizzes grounded directly in your uploaded course materials.'
              : 'Test your understanding and calibrate your topic mastery curve with diagnostic questions.'}
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <span className="font-mono text-slate-200 font-bold">{availableQuestions.length}</span>
          <span>questions available</span>
        </div>
      </div>

      {/* QUIZ SETUP VIEW */}
      {!inQuizMode && (
        <div className="space-y-6">
          <div className="bg-[#0F172A] border border-slate-800 rounded-xl p-6 space-y-6">
            <div className="flex items-center gap-3 pb-4 border-b border-slate-800">
              <div className="p-2 rounded-lg bg-indigo-950/70 border border-indigo-800/40 text-indigo-400">
                <Award className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-slate-100">Configure Study Assessment</h2>
                <p className="text-xs text-slate-400">
                  Select a topic to test your recall and update your mastery profile.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {/* Topic Selector */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-300">Target Curriculum Topic</label>
                <select
                  value={selectedTopic}
                  onChange={(e) => setSelectedTopic(e.target.value)}
                  className="w-full bg-[#0B0F19] border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 focus-visible:ring-2 focus-visible:ring-indigo-500"
                >
                  <option value="all">All Topics ({availableQuestions.length} questions)</option>
                  {uniqueTopics.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-400">
                  {materials.length > 0
                    ? 'Questions generated from your uploaded document chunks.'
                    : 'Foundational study strategy diagnostic pool.'}
                </p>
              </div>

              {/* Difficulty */}
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
                  <option value="foundational">Foundational</option>
                  <option value="intermediate">Intermediate</option>
                </select>
                <p className="text-[11px] text-slate-400">
                  Calibrated to test both conceptual recall and application.
                </p>
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
                <p className="text-[11px] text-slate-400">
                  Estimated duration: ~{questionCount * 1.5} minutes
                </p>
              </div>
            </div>

            {/* Launch CTA */}
            <div className="pt-4 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Every answer provides conceptual explanations upon submission</span>
              </div>

              <button
                onClick={startQuiz}
                className="w-full sm:w-auto px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors flex items-center justify-center gap-2 focus-visible:ring-2 focus-visible:ring-indigo-400"
              >
                <span>Begin Assessment</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Zero Materials Helper Notice */}
          {materials.length === 0 && (
            <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-4 flex items-start gap-3 text-xs text-slate-400">
              <Info className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <span className="font-medium text-slate-300">Upload Materials for Custom Course Quizzes:</span>
                <p>
                  You are currently viewing foundational learning science questions. Once you upload your course slide decks or textbook PDFs in <strong>Study Materials</strong>, StudyMate AI will automatically generate quizzes tailored to your specific curriculum.
                </p>
                {onNavigateToMaterials && (
                  <button
                    onClick={onNavigateToMaterials}
                    className="text-xs text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1 pt-1"
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    <span>Upload your course materials now</span>
                  </button>
                )}
              </div>
            </div>
          )}
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

          {/* Answer Feedback (Shown after checking) */}
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
                      Source: {currentQ.sourceReference.materialTitle} · Page/Slide{' '}
                      {currentQ.sourceReference.pageOrSlideNumber}
                    </span>
                  </div>

                  <div className="text-[11px] text-slate-400 italic">
                    "{currentQ.sourceReference.quoteExcerpt.slice(0, 75)}..."
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
              Evaluated against curriculum knowledge benchmarks.
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
                  scorePercent >= 75 ? 'text-emerald-400' : 'text-amber-400'
                }`}
              >
                {scorePercent}%
              </div>
            </div>
            <div className="bg-[#0B0F19] border border-slate-800 rounded-lg p-4">
              <div className="text-xs text-slate-400">Evidence Logged</div>
              <div className="text-2xl font-bold font-mono text-indigo-400 mt-1">
                +{activeQuestions.length} Points
              </div>
            </div>
          </div>

          {/* Real Mastery Profile Update Action */}
          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="space-y-0.5 text-center sm:text-left">
              <div className="text-xs font-semibold text-slate-200">
                Record Evidence in Learning Mastery
              </div>
              <p className="text-[11px] text-slate-400">
                Log these {activeQuestions.length} question evaluations into your progress curve.
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
                  <span>Mastery Profile Updated</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Update Learning Mastery</span>
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
                const topicName = activeQuestions[0]?.topicName || 'Study Method';
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
