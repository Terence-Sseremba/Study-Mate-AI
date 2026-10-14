import React, { useState, useRef, useEffect } from 'react';
import type {
  StudyMaterial,
  TutorMessage,
  SourceCitation,
  TutorInteractionMode,
  QuizAttempt,
  TopicMastery,
  QuizQuestion,
  ReviewRecord,
  PracticeMethod,
  SavedStudyNote,
  TutorSession,
} from '../../types';
import { processUploadedDocument, deriveTopicNameFromChunk } from '../../lib/documentExtraction';
import { FormattedMessageContent } from '../tutor/FormattedMessageContent';
import {
  INITIAL_QUIZ_ATTEMPTS,
  INITIAL_TOPIC_MASTERY,
  INITIAL_QUIZ_QUESTIONS,
} from '../../data/sampleCurriculum';

export type StudioTabType = 'quizzes' | 'mastery' | 'library';

interface WorkspaceViewProps {
  materials: StudyMaterial[];
  messages: TutorMessage[];
  onSendMessage: (
    question: string,
    materialId?: string,
    isRetry?: boolean,
    selectedMaterialIds?: string[]
  ) => Promise<void>;
  onRetryMessage?: (message: TutorMessage) => Promise<void>;
  onAddMaterial: (material: StudyMaterial) => void;
  onDeleteMaterial?: (materialId: string) => void;
  onOpenCitation: (citation: SourceCitation) => void;
  onInspectMaterial: (material: StudyMaterial) => void;
  isLoading: boolean;
  interactionMode: TutorInteractionMode;
  onModeChange: (mode: TutorInteractionMode) => void;
  quizAttempts: QuizAttempt[];
  masteryTopics: TopicMastery[];
  questions?: QuizQuestion[];
  reviewRecords?: ReviewRecord[];
  onCompleteQuiz?: (attempt: QuizAttempt) => void;
  initialQuestionPrompt?: string;
  onStartQuizForTopic?: (topicId: string) => void;
  onClearSession?: () => void;
  onNewSession?: () => void;
  pastSessions?: TutorSession[];
  activeSessionId?: string;
  onSelectSession?: (sessionId: string) => void;
  onDeleteSession?: (sessionId: string) => void;
  savedNotes?: SavedStudyNote[];
  onSaveNote?: (note: SavedStudyNote) => void;
  onDeleteNote?: (noteId: string) => void;
  onTuneClick?: () => void;
  onExportNotes?: () => void;
  activeMaterialFilter?: string;
  onMaterialFilterChange?: (materialId: string | undefined) => void;
  inspectorOpen?: boolean;
  onToggleInspector?: (open: boolean, tab?: 'quizzes' | 'notes' | 'mastery' | 'sessions') => void;
  preselectedTopicId?: string;
  onClearPreselectedTopic?: () => void;
  preselectedPracticeMethod?: PracticeMethod;
}

export const WorkspaceView: React.FC<WorkspaceViewProps> = ({
  materials,
  messages,
  onSendMessage,
  onRetryMessage,
  onAddMaterial,
  onDeleteMaterial,
  onOpenCitation,
  onInspectMaterial,
  isLoading,
  interactionMode,
  onModeChange,
  quizAttempts,
  masteryTopics,
  questions,
  reviewRecords: _reviewRecords,
  onCompleteQuiz,
  initialQuestionPrompt,
  onStartQuizForTopic,
  onClearSession: _onClearSession,
  onNewSession,
  pastSessions = [],
  activeSessionId,
  onSelectSession,
  onDeleteSession,
  savedNotes = [],
  onSaveNote,
  onDeleteNote,
  onTuneClick: _onTuneClick,
  onExportNotes,
  activeMaterialFilter,
  onMaterialFilterChange,
  inspectorOpen: controlledInspectorOpen,
  onToggleInspector,
  preselectedTopicId,
  onClearPreselectedTopic,
  preselectedPracticeMethod,
}) => {
  // Panel collapse states
  const [sourcesCollapsed, setSourcesCollapsed] = useState(false);
  const [deckCollapsed, setDeckCollapsed] = useState(false);

  // Adjustable column widths (Left Sources & Right Studio)
  const [leftPanelWidth, setLeftPanelWidth] = useState<number>(() => {
    const saved = localStorage.getItem('studymate_left_width');
    return saved ? parseInt(saved, 10) : 280;
  });
  const [rightPanelWidth, setRightPanelWidth] = useState<number>(() => {
    const saved = localStorage.getItem('studymate_right_width');
    return saved ? parseInt(saved, 10) : 340;
  });
  const [isResizingLeft, setIsResizingLeft] = useState(false);
  const [isResizingRight, setIsResizingRight] = useState(false);

  // Studio tabs (Quizzes, Mastery, Library)
  const [studioTab, setStudioTab] = useState<StudioTabType>('quizzes');
  const [copiedNoteId, setCopiedNoteId] = useState<string | null>(null);

  // Quiz Configuration State (restored from original AssessmentsSection)
  const [quizConfigTopicId, setQuizConfigTopicId] = useState<string>('all');
  const [quizConfigMaterialId, setQuizConfigMaterialId] = useState<string>('selected');
  const [quizConfigMethod, setQuizConfigMethod] = useState<PracticeMethod>(
    preselectedPracticeMethod || 'active_recall'
  );
  const [quizConfigDifficulty, setQuizConfigDifficulty] = useState<
    'foundation' | 'intermediate' | 'advanced'
  >('intermediate');
  const [quizConfigQuestionCount, setQuizConfigQuestionCount] = useState<number>(4);

  // Inline & Floating Interactive Quiz Runner State
  const [isQuizActive, setIsQuizActive] = useState(false);
  const [isQuizFloating, setIsQuizFloating] = useState(true);
  const [activeQuizQuestions, setActiveQuizQuestions] = useState<QuizQuestion[]>([]);
  const [activeQuizIndex, setActiveQuizIndex] = useState(0);
  const [selectedAnswerIndex, setSelectedAnswerIndex] = useState<number | null>(null);
  const [isAnswerSubmitted, setIsAnswerSubmitted] = useState(false);
  const [quizScoreCount, setQuizScoreCount] = useState(0);
  const [quizAnswersMap, setQuizAnswersMap] = useState<Record<string, number>>({});
  const [isQuizCompleted, setIsQuizCompleted] = useState(false);
  const [quizElapsedSeconds, setQuizElapsedSeconds] = useState(0);
  const [inspectingAttemptId, setInspectingAttemptId] = useState<string | null>(null);

  // Quiz timer
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    if (isQuizActive && !isQuizCompleted) {
      timer = setInterval(() => {
        setQuizElapsedSeconds((prev) => prev + 1);
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isQuizActive, isQuizCompleted]);

  // Effective quiz attempts and topic mastery
  const effectiveQuizAttempts =
    quizAttempts && quizAttempts.length > 0 ? quizAttempts : INITIAL_QUIZ_ATTEMPTS;
  const effectiveMasteryTopics =
    masteryTopics && masteryTopics.length > 0 ? masteryTopics : INITIAL_TOPIC_MASTERY;

  // Generate grounded assessment questions dynamically from uploaded study materials
  const buildDynamicQuizQuestions = (
    targetTopicId?: string,
    targetMaterialId?: string,
    method: PracticeMethod = quizConfigMethod,
    difficulty: 'foundation' | 'intermediate' | 'advanced' = quizConfigDifficulty,
    desiredCount: number = quizConfigQuestionCount
  ): QuizQuestion[] => {
    const basePool = questions && questions.length > 0 ? questions : INITIAL_QUIZ_QUESTIONS;

    // Filter materials based on selection
    let sourceMaterials = materials;
    if (targetMaterialId && targetMaterialId !== 'all' && targetMaterialId !== 'selected') {
      sourceMaterials = materials.filter((m) => m.id === targetMaterialId);
    } else if (targetMaterialId === 'selected') {
      const selectedMats = materials.filter((m) => activeGroundingIds[m.id] !== false);
      if (selectedMats.length > 0) sourceMaterials = selectedMats;
    }

    // Collect candidate chunks matching topic if specified
    const selectedTopicObj =
      targetTopicId && targetTopicId !== 'all'
        ? effectiveMasteryTopics.find((t) => t.topicId === targetTopicId)
        : undefined;

    const candidateChunks = sourceMaterials.flatMap((m) =>
      m.chunks.map((c, cIdx) => {
        const derivedTopic = deriveTopicNameFromChunk(c, cIdx);
        return {
          ...c,
          materialTitle: m.title,
          derivedTopic,
        };
      })
    );

    const filteredChunks = selectedTopicObj
      ? candidateChunks.filter(
          (c) =>
            c.derivedTopic.toLowerCase() === selectedTopicObj.topicName.toLowerCase() ||
            c.sectionHeading.toLowerCase().includes(selectedTopicObj.topicName.toLowerCase()) ||
            selectedTopicObj.topicName.toLowerCase().includes(c.derivedTopic.toLowerCase())
        )
      : candidateChunks;

    const activeChunks = filteredChunks.length > 0 ? filteredChunks : candidateChunks;

    if (activeChunks.length === 0) {
      return basePool;
    }

    // Gather distinct statements across all chunks for realistic distractors
    const allStatements = candidateChunks
      .flatMap((c) =>
        c.extractedText
          .split(/(?<=[.!?])\s+|\n+/)
          .map((s) => s.replace(/^[-*•\d.)\s]+/, '').trim())
          .filter((s) => s.length > 35 && s.length < 220)
      );

    const generated: QuizQuestion[] = [];
    const maxCount = Math.min(desiredCount, Math.max(activeChunks.length, 3));

    for (let idx = 0; idx < maxCount; idx++) {
      const chunk = activeChunks[idx % activeChunks.length];
      const cleanTopicName = selectedTopicObj?.topicName || chunk.derivedTopic || chunk.materialTitle;
      const topicSlug = cleanTopicName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 40);
      const resolvedTopicId = selectedTopicObj?.topicId || `topic-${topicSlug || idx}`;

      const sentences = chunk.extractedText
        .split(/(?<=[.!?])\s+|\n+/)
        .map((s) => s.replace(/^[-*•\d.)\s]+/, '').trim())
        .filter((s) => s.length > 30);

      const primarySentence =
        sentences[idx % Math.max(sentences.length, 1)] ||
        chunk.extractedText.slice(0, 180).trim();
      const correctStatement =
        primarySentence.length > 175
          ? `${primarySentence.slice(0, 172)}...`
          : primarySentence;

      // Pick distractors from other chunks/sentences if available, plus academic distractors
      const otherStatements = allStatements.filter(
        (s) => s !== primarySentence && !chunk.extractedText.includes(s.slice(0, 35))
      );

      const distractor1 =
        otherStatements[idx % Math.max(otherStatements.length, 1)] ||
        `The passage states that ${cleanTopicName} operates independently of the requirements or conditions in ${chunk.materialTitle}.`;
      const distractor2 =
        otherStatements[(idx + 2) % Math.max(otherStatements.length, 1)] &&
        otherStatements[(idx + 2) % Math.max(otherStatements.length, 1)] !== distractor1
          ? otherStatements[(idx + 2) % Math.max(otherStatements.length, 1)]
          : `According to ${chunk.anchorLabel}, ${cleanTopicName} applies only when primary constraints are omitted.`;
      const distractor3 = `The source explicitly excludes ${cleanTopicName} from the scope of ${chunk.materialTitle}.`;

      // Rotate correct option index deterministically so it isn't always option A or B
      const correctOptionIndex = (idx + 1) % 4;
      const distractors = [distractor1, distractor2, distractor3];
      const options: string[] = [];
      let dIdx = 0;
      for (let o = 0; o < 4; o++) {
        if (o === correctOptionIndex) {
          options.push(correctStatement);
        } else {
          options.push(distractors[dIdx++]);
        }
      }

      const methodPrefix =
        method === 'concept_explanation'
          ? `How do your study materials explain "${cleanTopicName}" in ${chunk.materialTitle} (${chunk.anchorLabel})?`
          : method === 'spaced_review'
          ? `Spaced Review — Which key principle or requirement is established under "${cleanTopicName}" (${chunk.anchorLabel})?`
          : `According to ${chunk.materialTitle} (${chunk.anchorLabel}), which statement accurately reflects "${cleanTopicName}"?`;

      generated.push({
        id: `q-dyn-${chunk.id}-${idx}`,
        topicId: resolvedTopicId,
        topicName: cleanTopicName,
        difficulty,
        practiceMethod: method,
        questionText: methodPrefix,
        options,
        correctOptionIndex,
        explanation: `Verified directly from ${chunk.materialTitle} (${chunk.anchorLabel} — ${cleanTopicName}): "${primarySentence}"`,
        sourceReference: {
          id: `cite-quiz-${chunk.id}-${idx}`,
          materialId: chunk.materialId,
          materialTitle: chunk.materialTitle,
          sectionHeading: cleanTopicName,
          anchorLabel: chunk.anchorLabel,
          quoteExcerpt: chunk.extractedText.slice(0, 260),
          similarityScore: 0.96,
        },
      });
    }

    return generated;
  };

  // Launch Interactive Quiz (opens in Floating Window by default, or docked in sidebar)
  const startInlineQuiz = (
    topicId?: string,
    materialIdOverride?: string,
    floatingMode: boolean = true
  ) => {
    const resolvedTopic = topicId !== undefined ? topicId : quizConfigTopicId;
    const resolvedMaterial = materialIdOverride !== undefined ? materialIdOverride : quizConfigMaterialId;
    if (topicId) setQuizConfigTopicId(topicId);
    if (materialIdOverride) setQuizConfigMaterialId(materialIdOverride);

    const activeSet = buildDynamicQuizQuestions(
      resolvedTopic,
      resolvedMaterial,
      quizConfigMethod,
      quizConfigDifficulty,
      quizConfigQuestionCount
    );

    setActiveQuizQuestions(activeSet);
    setActiveQuizIndex(0);
    setSelectedAnswerIndex(null);
    setIsAnswerSubmitted(false);
    setQuizScoreCount(0);
    setQuizAnswersMap({});
    setIsQuizCompleted(false);
    setQuizElapsedSeconds(0);
    setIsQuizActive(true);
    setIsQuizFloating(floatingMode);
    setStudioTab('quizzes');
    if (!floatingMode) {
      setDeckCollapsed(false);
    }
  };

  // Push floating quiz window back to the right sidebar without affecting any quiz or workspace state
  const dockQuizToSidebar = () => {
    setIsQuizFloating(false);
    setStudioTab('quizzes');
    setDeckCollapsed(false);
  };

  // Expand docked sidebar quiz back into the floating blurred window without affecting any state
  const popQuizToFloatingWindow = () => {
    setIsQuizFloating(true);
  };

  // Preselected topic triggers from outside or chat
  useEffect(() => {
    if (preselectedTopicId) {
      if (preselectedPracticeMethod) {
        setQuizConfigMethod(preselectedPracticeMethod);
      }
      startInlineQuiz(preselectedTopicId);
      onClearPreselectedTopic?.();
    }
  }, [preselectedTopicId, preselectedPracticeMethod]);

  const handleSubmitQuizAnswer = () => {
    if (selectedAnswerIndex === null) return;
    const currentQ = activeQuizQuestions[activeQuizIndex];
    if (!currentQ) return;

    const isCorrect = selectedAnswerIndex === currentQ.correctOptionIndex;
    if (isCorrect) {
      setQuizScoreCount((prev) => prev + 1);
    }
    setQuizAnswersMap((prev) => ({
      ...prev,
      [currentQ.id]: selectedAnswerIndex,
    }));
    setIsAnswerSubmitted(true);
  };

  const handleNextQuizQuestion = () => {
    if (activeQuizIndex + 1 < activeQuizQuestions.length) {
      setActiveQuizIndex((prev) => prev + 1);
      setSelectedAnswerIndex(null);
      setIsAnswerSubmitted(false);
    } else {
      // Completed quiz!
      setIsQuizCompleted(true);
      const currentQ = activeQuizQuestions[activeQuizIndex];
      const finalAnswers = {
        ...quizAnswersMap,
        ...(currentQ && selectedAnswerIndex !== null ? { [currentQ.id]: selectedAnswerIndex } : {}),
      };
      const finalScore = activeQuizQuestions.reduce(
        (acc, q) => acc + (finalAnswers[q.id] === q.correctOptionIndex ? 1 : 0),
        0
      );
      const totalQ = activeQuizQuestions.length;
      const percentage = Math.round((finalScore / Math.max(totalQ, 1)) * 100);

      // Compute topic breakdown & weak areas
      const breakdownMap = new Map<
        string,
        { topicId: string; topicName: string; correct: number; total: number }
      >();
      activeQuizQuestions.forEach((q) => {
        const existing = breakdownMap.get(q.topicId) || {
          topicId: q.topicId,
          topicName: q.topicName,
          correct: 0,
          total: 0,
        };
        existing.total += 1;
        if (finalAnswers[q.id] === q.correctOptionIndex) {
          existing.correct += 1;
        }
        breakdownMap.set(q.topicId, existing);
      });

      const topicBreakdown = Array.from(breakdownMap.values());
      const weakAreas = topicBreakdown
        .filter((b) => b.correct / b.total < 0.75)
        .map((b) => b.topicName);

      const attempt: QuizAttempt = {
        id: `attempt-${Date.now()}`,
        quizTitle: `Assessment: ${currentQ?.topicName || 'Course Concept Review'}`,
        topicId: currentQ?.topicId || `topic-${Date.now()}`,
        topicName: currentQ?.topicName || 'Active Topic Review',
        difficulty: quizConfigDifficulty,
        practiceMethod: quizConfigMethod,
        totalQuestions: totalQ,
        score: finalScore,
        percentage,
        completedAt: new Date().toISOString(),
        userAnswers: finalAnswers,
        timeSpentSeconds: quizElapsedSeconds || 60,
        topicBreakdown,
        weakAreas,
      };

      if (onCompleteQuiz) {
        onCompleteQuiz(attempt);
      }
    }
  };

  const handleExitQuiz = () => {
    setIsQuizActive(false);
    setIsQuizCompleted(false);
    setActiveQuizIndex(0);
    setSelectedAnswerIndex(null);
    setIsAnswerSubmitted(false);
  };

  // Resize handler for left Sources panel
  const handleLeftResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizingLeft(true);
    const startX = e.clientX;
    const startWidth = leftPanelWidth;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const delta = moveEvent.clientX - startX;
      const newWidth = Math.max(200, Math.min(480, startWidth + delta));
      setLeftPanelWidth(newWidth);
    };

    const onMouseUp = () => {
      setIsResizingLeft(false);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      setLeftPanelWidth((curr) => {
        localStorage.setItem('studymate_left_width', String(curr));
        return curr;
      });
    };

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  // Resize handler for right Studio panel
  const handleRightResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizingRight(true);
    const startX = e.clientX;
    const startWidth = rightPanelWidth;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const delta = startX - moveEvent.clientX;
      const newWidth = Math.max(260, Math.min(560, startWidth + delta));
      setRightPanelWidth(newWidth);
    };

    const onMouseUp = () => {
      setIsResizingRight(false);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      setRightPanelWidth((curr) => {
        localStorage.setItem('studymate_right_width', String(curr));
        return curr;
      });
    };

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  // Inspector modal internal state (fallback if not controlled)
  const [localInspectorOpen, setLocalInspectorOpen] = useState(false);
  const isInspectorOpen = controlledInspectorOpen !== undefined ? controlledInspectorOpen : localInspectorOpen;
  const [inspectorTab, setInspectorTab] = useState<'quizzes' | 'notes' | 'mastery' | 'sessions'>('quizzes');

  const openInspector = (tab: 'quizzes' | 'notes' | 'mastery' | 'sessions' = 'quizzes') => {
    setInspectorTab(tab);
    if (onToggleInspector) {
      onToggleInspector(true, tab);
    } else {
      setLocalInspectorOpen(true);
    }
  };

  const closeInspector = () => {
    if (onToggleInspector) {
      onToggleInspector(false);
    } else {
      setLocalInspectorOpen(false);
    }
  };

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [sourceDropdownOpen, setSourceDropdownOpen] = useState(false);
  const [activeGroundingIds, setActiveGroundingIds] = useState<Record<string, boolean>>(() => {
    const map: Record<string, boolean> = {};
    materials.forEach((m) => {
      map[m.id] = true;
    });
    return map;
  });

  // Sync activeGroundingIds whenever materials list changes
  useEffect(() => {
    setActiveGroundingIds((prev) => {
      const next: Record<string, boolean> = {};
      materials.forEach((m) => {
        next[m.id] = prev[m.id] !== undefined ? prev[m.id] : true;
      });
      return next;
    });
  }, [materials]);

  // Selected material IDs for retrieval grounding
  const selectedMaterialIds = materials
    .filter((m) => activeGroundingIds[m.id] !== false)
    .map((m) => m.id);

  // Composer Input state
  const [inputText, setInputText] = useState(initialQuestionPrompt || '');
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);
  const [savedNotesToast, setSavedNotesToast] = useState(false);
  const [isProcessingUpload, setIsProcessingUpload] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Hidden file inputs
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const docxInputRef = useRef<HTMLInputElement>(null);
  const pptxInputRef = useRef<HTMLInputElement>(null);
  const generalFileInputRef = useRef<HTMLInputElement>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Paste raw text modal state
  const [pasteModalOpen, setPasteModalOpen] = useState(false);
  const [pasteTitle, setPasteTitle] = useState('');
  const [pasteContent, setPasteContent] = useState('');

  useEffect(() => {
    if (initialQuestionPrompt) {
      setInputText(initialQuestionPrompt);
      textareaRef.current?.focus();
    }
  }, [initialQuestionPrompt]);

  useEffect(() => {
    chatScrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Keyboard shortcut listeners (⌘B to toggle sources, Esc to close inspector or dock floating quiz)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        setSourcesCollapsed((prev) => !prev);
      }
      if (e.key === 'Escape') {
        if (isInspectorOpen) {
          closeInspector();
        } else if (isQuizActive && isQuizFloating) {
          dockQuizToSidebar();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isInspectorOpen, isQuizActive, isQuizFloating]);

  // Handle source checkbox toggle
  const toggleGrounding = (materialId: string) => {
    setActiveGroundingIds((prev) => ({
      ...prev,
      [materialId]: prev[materialId] === false ? true : false,
    }));
  };

  // Upload handler for real files
  const handleFileUpload = async (file: File) => {
    setUploadError(null);
    setIsProcessingUpload(true);
    try {
      const newMaterial = await processUploadedDocument(file);
      onAddMaterial(newMaterial);
      setActiveGroundingIds((prev) => ({ ...prev, [newMaterial.id]: true }));
      setSourceDropdownOpen(false);
    } catch (err: any) {
      console.error('File upload error:', err);
      setUploadError(err?.message || 'Failed to parse file.');
    } finally {
      setIsProcessingUpload(false);
    }
  };

  // Paste raw text submit
  const handlePasteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pasteContent.trim()) return;

    const cleanTitle = pasteTitle.trim() || 'Study Notes';
    const virtualFile = new File(
      [pasteContent.trim()],
      `${cleanTitle.replace(/\s+/g, '_')}.txt`,
      { type: 'text/plain' }
    );

    try {
      const parsedMaterial = await processUploadedDocument(virtualFile);
      const newMaterial: StudyMaterial = {
        ...parsedMaterial,
        title: cleanTitle,
      };
      onAddMaterial(newMaterial);
      setActiveGroundingIds((prev) => ({ ...prev, [newMaterial.id]: true }));
    } catch {
      const matId = `mat-pasted-${Date.now()}`;
      const newMaterial: StudyMaterial = {
        id: matId,
        title: cleanTitle,
        filename: `${cleanTitle.replace(/\s+/g, '_')}.txt`,
        fileType: 'notes',
        fileSizeFormatted: `${Math.max(0.1, pasteContent.length / 1024).toFixed(1)} KB`,
        chunksCount: 1,
        uploadedAt: new Date().toISOString(),
        courseCode: materials[0]?.courseCode || 'Workspace',
        courseName: materials[0]?.courseName || 'General Studies',
        processingStatus: 'indexed',
        chunks: [
          {
            id: `chunk-pasted-${Date.now()}`,
            materialId: matId,
            materialTitle: cleanTitle,
            sectionHeading: cleanTitle,
            anchorLabel: 'Section 1',
            extractedText: pasteContent.trim(),
            confidenceScore: 0.99,
          },
        ],
      };
      onAddMaterial(newMaterial);
      setActiveGroundingIds((prev) => ({ ...prev, [newMaterial.id]: true }));
    }

    setPasteTitle('');
    setPasteContent('');
    setPasteModalOpen(false);
    setSourceDropdownOpen(false);
  };

  const handleFormSubmit = async (e?: React.FormEvent, promptOverride?: string) => {
    if (e) e.preventDefault();
    const rawText = promptOverride !== undefined ? promptOverride : inputText;
    if (!rawText.trim() || isLoading) return;
    const text = rawText.trim();
    if (promptOverride === undefined) {
      setInputText('');
    }
    await onSendMessage(text, activeMaterialFilter, false, selectedMaterialIds);
  };

  const handleCopyText = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedMsgId(id);
      setTimeout(() => setCopiedMsgId(null), 2000);
    } catch (err) {
      console.warn('Clipboard write error:', err);
    }
  };

  const handleSaveNote = (msg?: TutorMessage) => {
    if (onSaveNote) {
      const targetMsg =
        msg ||
        [...messages]
          .reverse()
          .find((m) => m.role === 'assistant' && !m.errorState);
      if (targetMsg) {
        const firstLine = targetMsg.text
          .replace(/[#*`]/g, '')
          .split('\n')
          .map((l) => l.trim())
          .find((l) => l.length > 4);
        const note: SavedStudyNote = {
          id: `note-${Date.now()}`,
          title: firstLine ? firstLine.slice(0, 64) : 'Study Note',
          content: targetMsg.text,
          sourceTitle:
            targetMsg.citations?.[0]?.materialTitle ||
            materials[0]?.title ||
            'Tutor Explanation',
          anchorLabel: targetMsg.citations?.[0]?.anchorLabel,
          createdAt: new Date().toISOString(),
        };
        onSaveNote(note);
      }
    }
    setSavedNotesToast(true);
    setTimeout(() => setSavedNotesToast(false), 2500);
  };

  // Filter materials based on search
  const filteredMaterials = materials.filter((m) => {
    return (
      m.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.courseCode.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  const activeCount = selectedMaterialIds.length;

  return (
    <div className="w-full h-full flex flex-row overflow-hidden relative select-none">
      {/* Toast Feedback for Save Note */}
      {savedNotesToast && (
        <div className="fixed top-20 right-6 z-50 bg-secondary text-on-secondary px-3.5 py-2 rounded-xl shadow-lg flex items-center gap-2 text-label-md font-medium animate-in fade-in slide-in-from-top-2">
          <span className="material-symbols-outlined text-sm">bookmark_added</span>
          <span>Saved to Scholarly Notes Archive!</span>
        </div>
      )}

      {/* Hidden File Inputs */}
      <input
        ref={pdfInputRef}
        type="file"
        accept=".pdf"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
      />
      <input
        ref={docxInputRef}
        type="file"
        accept=".docx"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
      />
      <input
        ref={pptxInputRef}
        type="file"
        accept=".pptx"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
      />
      <input
        ref={generalFileInputRef}
        type="file"
        accept=".pdf,.docx,.pptx,.md,.txt"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
      />

      {/* ======================================================== */}
      {/* LEFT PANEL: STUDY SOURCES & GROUNDING REPOSITORY         */}
      {/* ======================================================== */}
      <aside
        id="left-sources-panel"
        style={{ width: sourcesCollapsed ? '48px' : `${leftPanelWidth}px` }}
        className={`relative flex-shrink-0 bg-white border-r border-neutral-200/80 flex flex-col justify-between shadow-[1px_0_3px_rgba(0,0,0,0.02)] z-10 ${
          isResizingLeft ? 'select-none' : 'transition-[width] duration-150'
        } select-none group/sidebar`}
      >
        {/* Resize Handle on Right Border */}
        {!sourcesCollapsed && (
          <div
            className="absolute top-0 right-0 bottom-0 w-2 cursor-col-resize hover:bg-neutral-300 active:bg-neutral-400 z-30 flex items-center justify-center transition-colors group"
            onMouseDown={handleLeftResizeStart}
            onDoubleClick={() => setLeftPanelWidth(280)}
            title="Drag to resize Sources panel (Double click to reset: 280px)"
          >
            <div className="w-[2px] h-8 rounded-full bg-neutral-300 group-hover:bg-neutral-500 transition-colors" />
          </div>
        )}

        {/* Collapse Toggle & Sources Header */}
        <div className="p-3 space-y-2 bg-white flex-shrink-0 border-b border-neutral-200/60">
          <div className="flex items-center justify-between">
            {!sourcesCollapsed ? (
              <>
                <div className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-neutral-800 text-lg">folder_open</span>
                  <span className="font-semibold text-neutral-900 text-xs sm:text-sm">
                    Sources
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-600 font-medium border border-neutral-200/60">
                    {activeCount} / {materials.length}
                  </span>
                  <button
                    id="collapse-sources-btn"
                    className="p-1 rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors"
                    title="Collapse sources panel [⌘B]"
                    onClick={() => setSourcesCollapsed(true)}
                    type="button"
                  >
                    <span className="material-symbols-outlined text-base">left_panel_close</span>
                  </button>
                </div>
              </>
            ) : (
              <button
                className="w-full flex items-center justify-center p-1.5 rounded-lg bg-neutral-100 hover:bg-neutral-200/70 text-neutral-700 transition-colors"
                title="Expand Sources [⌘B]"
                onClick={() => setSourcesCollapsed(false)}
                type="button"
              >
                <span className="material-symbols-outlined text-base">left_panel_open</span>
              </button>
            )}
          </div>

          {/* Collapsed Rail View */}
          {sourcesCollapsed && (
            <div id="sources-collapsed-rail" className="flex flex-col items-center gap-2.5 pt-2">
              <div className="w-6 h-[1px] bg-neutral-200"></div>
              {materials.slice(0, 5).map((mat) => {
                const isPdf = mat.fileType === 'pdf';
                const isDocx = mat.fileType === 'docx';
                const isPptx = mat.fileType === 'pptx';
                const tagColor = isPdf
                  ? 'bg-rose-50 text-rose-700 border-rose-200/60'
                  : isDocx
                  ? 'bg-blue-50 text-blue-700 border-blue-200/60'
                  : isPptx
                  ? 'bg-amber-50 text-amber-700 border-amber-200/60'
                  : 'bg-emerald-50 text-emerald-700 border-emerald-200/60';
                return (
                  <span
                    key={mat.id}
                    className={`p-1 rounded-md ${tagColor} font-mono font-bold text-[10px] uppercase cursor-pointer hover:opacity-80 border`}
                    title={mat.title}
                    onClick={() => onInspectMaterial(mat)}
                  >
                    {mat.fileType.slice(0, 3)}
                  </span>
                );
              })}
            </div>
          )}

          {/* Expandable Content Wrap */}
          {!sourcesCollapsed && (
            <div id="sources-content-wrap" className="space-y-2 pt-1">
              {/* Add Source Button + Dropdown (NotebookLM Style) */}
              <div className="relative">
                <button
                  className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 bg-neutral-50 hover:bg-neutral-100 text-neutral-800 rounded-xl border border-dashed border-neutral-300 hover:border-neutral-400 text-xs font-medium transition-all shadow-xs cursor-pointer"
                  id="add-source-btn"
                  onClick={() => setSourceDropdownOpen(!sourceDropdownOpen)}
                  type="button"
                >
                  <span className="material-symbols-outlined text-base text-neutral-600">add</span>
                  <span>{isProcessingUpload ? 'Extracting text...' : 'Add sources'}</span>
                  <span className="material-symbols-outlined text-xs ml-auto text-neutral-400">expand_more</span>
                </button>

                {sourceDropdownOpen && (
                  <div
                    className="absolute top-full left-0 right-0 mt-1 py-1 bg-white rounded-xl shadow-xl border border-neutral-200 z-30 animate-in fade-in duration-100"
                    id="source-dropdown"
                  >
                    <button
                      className="w-full text-left px-3 py-2 text-xs text-neutral-800 hover:bg-neutral-50 flex items-center gap-2 cursor-pointer"
                      onClick={() => {
                        pdfInputRef.current?.click();
                      }}
                      type="button"
                    >
                      <span className="material-symbols-outlined text-rose-600 text-base">picture_as_pdf</span>
                      PDF Document
                    </button>
                    <button
                      className="w-full text-left px-3 py-2 text-xs text-neutral-800 hover:bg-neutral-50 flex items-center gap-2 cursor-pointer"
                      onClick={() => {
                        docxInputRef.current?.click();
                      }}
                      type="button"
                    >
                      <span className="material-symbols-outlined text-blue-600 text-base">description</span>
                      Word Document (.docx)
                    </button>
                    <button
                      className="w-full text-left px-3 py-2 text-xs text-neutral-800 hover:bg-neutral-50 flex items-center gap-2 cursor-pointer"
                      onClick={() => {
                        pptxInputRef.current?.click();
                      }}
                      type="button"
                    >
                      <span className="material-symbols-outlined text-amber-600 text-base">slideshow</span>
                      Slide Deck (.pptx)
                    </button>
                    <button
                      className="w-full text-left px-3 py-2 text-xs text-neutral-800 hover:bg-neutral-50 flex items-center gap-2 cursor-pointer"
                      onClick={() => {
                        setPasteModalOpen(true);
                      }}
                      type="button"
                    >
                      <span className="material-symbols-outlined text-emerald-600 text-base">content_paste</span>
                      Copied Text / Excerpt
                    </button>
                  </div>
                )}
              </div>

              {uploadError && (
                <div className="p-2 bg-red-50 text-red-700 text-xs rounded-lg flex items-center gap-1.5 border border-red-200/60">
                  <span className="material-symbols-outlined text-sm text-red-600">error</span>
                  <span className="truncate">{uploadError}</span>
                </div>
              )}

              {/* Filter / Quick Search */}
              <div className="relative">
                <span className="material-symbols-outlined absolute left-2.5 top-1.5 text-neutral-400 text-sm">
                  search
                </span>
                <input
                  className="w-full pl-7 pr-6 py-1 text-xs bg-neutral-100/70 rounded-lg text-neutral-800 placeholder-neutral-400 focus:outline-none focus:bg-white focus:border-neutral-300 transition-all border border-neutral-200/50"
                  placeholder="Search sources..."
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <kbd className="absolute right-1.5 top-1 font-mono text-[9px] text-neutral-400 px-1 rounded bg-neutral-200/50">
                  ⌘F
                </kbd>
              </div>
            </div>
          )}
        </div>

        {/* Scrollable Source Cards Stream */}
        {!sourcesCollapsed && (
          <div className="flex-1 overflow-y-auto px-2.5 space-y-2 py-2">
            {filteredMaterials.length === 0 ? (
              <div className="text-center py-10 px-3 text-neutral-400 space-y-2">
                <div className="w-10 h-10 mx-auto rounded-full bg-neutral-100 flex items-center justify-center text-neutral-400 border border-neutral-200/60">
                  <span className="material-symbols-outlined text-lg">upload_file</span>
                </div>
                <p className="text-xs font-semibold text-neutral-700">No sources added yet</p>
                <p className="text-[11px] text-neutral-400 leading-relaxed max-w-[200px] mx-auto">
                  Click <strong className="text-neutral-700 font-medium">Add sources</strong> above to upload PDFs, slides, or paste notes.
                </p>
              </div>
            ) : (
              <>
                {filteredMaterials.map((mat) => {
                  const isActive = activeGroundingIds[mat.id] !== false;
                  const isPdf = mat.fileType === 'pdf';
                  const isDocx = mat.fileType === 'docx';
                  const isPptx = mat.fileType === 'pptx';
                  const tagColor = isPdf
                    ? 'bg-rose-50 text-rose-700 border-rose-200/60'
                    : isDocx
                    ? 'bg-blue-50 text-blue-700 border-blue-200/60'
                    : isPptx
                    ? 'bg-amber-50 text-amber-700 border-amber-200/60'
                    : 'bg-emerald-50 text-emerald-700 border-emerald-200/60';
                  const tagLabel = isPdf ? 'PDF' : isDocx ? 'DOCX' : isPptx ? 'PPTX' : 'NOTES';

                  // Derive unique organized topics from this material's chunks
                  const matTopics = Array.from(
                    new Set(
                      (mat.chunks || [])
                        .map((c, cIdx) => deriveTopicNameFromChunk(c, cIdx))
                        .filter(Boolean)
                    )
                  ).slice(0, 6);

                  return (
                    <div
                      key={mat.id}
                      className={`group relative p-2.5 rounded-xl transition-all border ${
                        isActive
                          ? 'bg-white text-neutral-900 shadow-xs border-neutral-200/80 hover:border-neutral-300'
                          : 'bg-neutral-50/70 hover:bg-neutral-100/80 text-neutral-400 border-neutral-200/50'
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <input
                          checked={isActive}
                          onChange={() => toggleGrounding(mat.id)}
                          className="mt-0.5 h-3.5 w-3.5 rounded bg-neutral-900 text-white accent-neutral-900 cursor-pointer shrink-0"
                          type="checkbox"
                          title={isActive ? 'Source included in query context' : 'Source excluded'}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-1">
                            <div
                              className="flex items-center gap-1.5 min-w-0 flex-1 cursor-pointer"
                              onClick={() => onInspectMaterial(mat)}
                            >
                              <span className={`px-1 py-0.2 rounded ${tagColor} font-mono text-[9px] font-bold border shrink-0`}>
                                {tagLabel}
                              </span>
                              <p
                                className={`text-xs font-medium truncate ${
                                  isActive
                                    ? 'text-neutral-800 group-hover:text-neutral-900 group-hover:underline'
                                    : 'text-neutral-400 line-through'
                                }`}
                              >
                                {mat.title}
                              </p>
                            </div>

                            {/* Source Card Quick Actions (Inspect & Remove) */}
                            <div className="flex items-center gap-0.5 shrink-0">
                              {isActive && (
                                <span
                                  className="w-1.5 h-1.5 rounded-full bg-emerald-600 mr-1 group-hover:hidden"
                                  title="Actively grounded"
                                />
                              )}
                              <button
                                type="button"
                                title="Inspect source chunks"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onInspectMaterial(mat);
                                }}
                                className="p-1 rounded-md text-neutral-400 hover:text-neutral-800 hover:bg-neutral-100 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-all cursor-pointer"
                              >
                                <span className="material-symbols-outlined text-[14px] leading-none block">
                                  visibility
                                </span>
                              </button>
                              {onDeleteMaterial && (
                                <button
                                  type="button"
                                  title={`Remove "${mat.title}"`}
                                  aria-label={`Remove ${mat.title}`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (quizConfigMaterialId === mat.id) {
                                      setQuizConfigMaterialId('selected');
                                    }
                                    onDeleteMaterial(mat.id);
                                  }}
                                  className="p-1 rounded-md text-neutral-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                                >
                                  <span className="material-symbols-outlined text-[14px] leading-none block">
                                    delete
                                  </span>
                                </button>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 text-neutral-400 font-mono text-[10px] mt-1">
                            <span>{mat.fileSizeFormatted}</span>
                            {mat.pageCount && (
                              <>
                                <span>•</span>
                                <span>{mat.pageCount} pages</span>
                              </>
                            )}
                            {mat.slideCount && (
                              <>
                                <span>•</span>
                                <span>{mat.slideCount} slides</span>
                              </>
                            )}
                            {mat.chunksCount > 0 && (
                              <>
                                <span>•</span>
                                <span className="text-emerald-700 font-medium">
                                  {mat.chunksCount} chunks
                                </span>
                              </>
                            )}
                          </div>

                          {/* Organized Topics extracted from this material */}
                          {matTopics.length > 0 && (
                            <div className="mt-2 pt-1.5 border-t border-neutral-100 space-y-1">
                              <span className="block font-mono text-[9px] uppercase tracking-wider text-neutral-400 font-semibold">
                                Organized Topics ({matTopics.length})
                              </span>
                              <div className="flex flex-wrap gap-1">
                                {matTopics.map((topicName, tIdx) => (
                                  <button
                                    key={`${mat.id}-topic-${tIdx}`}
                                    type="button"
                                    title={`Ask about "${topicName}" from ${mat.title}`}
                                    onClick={() => {
                                      setInputText(`Explain "${topicName}" from ${mat.title}.`);
                                      textareaRef.current?.focus();
                                    }}
                                    className="px-1.5 py-0.5 rounded bg-neutral-100 hover:bg-neutral-200/80 text-neutral-700 text-[10px] font-medium truncate max-w-full transition-colors cursor-pointer text-left"
                                  >
                                    {topicName}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </div>
        )}

        {/* Sync Status Footer */}
        {!sourcesCollapsed && (
          <div className="p-2.5 bg-neutral-50 border-t border-neutral-200/70 flex items-center justify-between text-neutral-500 font-mono text-[11px]">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
              {activeCount > 0 ? `${activeCount} sources selected` : 'None selected'}
            </span>
            <div className="flex items-center gap-2">
              <button
                className="text-neutral-700 hover:text-neutral-900 hover:underline cursor-pointer"
                type="button"
                onClick={() => {
                  const allSelected = activeCount === materials.length && materials.length > 0;
                  const map: Record<string, boolean> = {};
                  materials.forEach((m) => (map[m.id] = !allSelected));
                  setActiveGroundingIds(map);
                }}
              >
                {activeCount === materials.length && materials.length > 0 ? 'Deselect All' : 'Select All'}
              </button>
            </div>
          </div>
        )}

        {/* Vertical Resize Grip */}
        <div
          className="absolute top-0 right-0 bottom-0 w-1 cursor-col-resize hover:bg-neutral-300 transition-colors z-20 group"
          title="Drag to resize sources panel"
        ></div>
      </aside>

      {/* ======================================================== */}
      {/* CENTER PANEL: AI TUTOR WORKSPACE (NOTEBOOKLM CHAT STYLE)  */}
      {/* ======================================================== */}
      <section className="flex-1 min-w-0 flex flex-col bg-[#F8F9FA] relative overflow-hidden">
        {/* Grounding Context Indicator Strip */}
        <div className="bg-white/80 backdrop-blur px-4 py-1.5 border-b border-neutral-200/70 flex items-center justify-between z-10 flex-shrink-0">
          <div className="flex items-center gap-2 text-neutral-600 text-xs truncate">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
            <span className="font-medium text-neutral-800">
              {interactionMode === 'smart_tutor' ? 'Smart Tutor:' : 'Grounded Study:'}
            </span>
            <span className="truncate text-neutral-500">
              {activeCount > 0
                ? `${activeCount} source${activeCount > 1 ? 's' : ''} active${
                    interactionMode === 'grounded_study'
                      ? ' (strictly restricted to uploaded sources)'
                      : ' (prioritizes sources + general academic explanations)'
                  }`
                : interactionMode === 'grounded_study'
                ? 'No sources selected — select or upload study materials'
                : 'No sources selected — answering from general academic knowledge'}
            </span>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {messages.length > 0 && onNewSession && (
              <button
                type="button"
                onClick={onNewSession}
                className="text-[11px] px-2 py-0.5 rounded-full bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-medium border border-neutral-200/60 transition-colors cursor-pointer flex items-center gap-1"
                title="Save current conversation and start a new study session"
              >
                <span className="material-symbols-outlined text-xs">add_comment</span>
                <span>New Session</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => openInspector('sessions')}
              className="text-[11px] px-2 py-0.5 rounded-full bg-neutral-100 hover:bg-neutral-200 text-neutral-600 font-medium border border-neutral-200/60 transition-colors cursor-pointer flex items-center gap-1"
              title="View past study conversations"
            >
              <span className="material-symbols-outlined text-xs">history</span>
              <span className="hidden sm:inline">History ({pastSessions.length})</span>
            </button>
          </div>
        </div>

        {/* Main Conversation Scroll Stream */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-4">
          <div className="max-w-3xl mx-auto space-y-4">
            {messages.length === 0 ? (
              <div className="py-12 px-4 max-w-xl mx-auto text-center space-y-4 animate-in fade-in duration-300">
                <div className="w-12 h-12 mx-auto rounded-2xl bg-neutral-100 flex items-center justify-center text-neutral-800 shadow-xs border border-neutral-200">
                  <span className="material-symbols-outlined text-2xl">auto_awesome</span>
                </div>
                <div className="space-y-1.5">
                  <h3 className="text-base font-semibold text-neutral-900">
                    Welcome to StudyMate AI
                  </h3>
                  <p className="text-xs text-neutral-500 leading-relaxed max-w-md mx-auto">
                    Upload your course syllabus, lecture slides, or textbook readings in the left panel to ground conversations in your exact materials. Or ask any question below to get started.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 text-left">
                  <button
                    type="button"
                    onClick={() => pdfInputRef.current?.click()}
                    className="p-3 rounded-xl bg-white border border-neutral-200/80 hover:border-neutral-300 hover:shadow-xs transition-all cursor-pointer group"
                  >
                    <span className="material-symbols-outlined text-rose-600 text-lg mb-1 block">
                      picture_as_pdf
                    </span>
                    <span className="text-xs font-semibold text-neutral-800 group-hover:text-neutral-900 block">
                      Upload PDF
                    </span>
                    <span className="text-[10px] text-neutral-400 block mt-0.5">
                      Lectures, papers, textbooks
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPasteModalOpen(true)}
                    className="p-3 rounded-xl bg-white border border-neutral-200/80 hover:border-neutral-300 hover:shadow-xs transition-all cursor-pointer group"
                  >
                    <span className="material-symbols-outlined text-blue-600 text-lg mb-1 block">
                      content_paste
                    </span>
                    <span className="text-xs font-semibold text-neutral-800 group-hover:text-neutral-900 block">
                      Paste Notes
                    </span>
                    <span className="text-[10px] text-neutral-400 block mt-0.5">
                      Study notes, syllabus text
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => startInlineQuiz()}
                    className="p-3 rounded-xl bg-white border border-neutral-200/80 hover:border-neutral-300 hover:shadow-xs transition-all cursor-pointer group"
                  >
                    <span className="material-symbols-outlined text-emerald-600 text-lg mb-1 block">
                      quiz
                    </span>
                    <span className="text-xs font-semibold text-neutral-800 group-hover:text-neutral-900 block">
                      Take a Concept Quiz
                    </span>
                    <span className="text-[10px] text-neutral-400 block mt-0.5">
                      Interactive assessment from sources
                    </span>
                  </button>
                </div>
              </div>
            ) : (
              messages.map((msg) => {
                const isUser = msg.role === 'user';
                const formattedTime = new Date(msg.timestamp).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                });

                if (isUser) {
                  return (
                    <article key={msg.id} className="flex justify-end">
                      <div className="max-w-xl bg-neutral-100 border border-neutral-200/70 text-neutral-900 rounded-2xl px-4 py-2.5 shadow-xs text-xs sm:text-sm leading-relaxed space-y-1">
                        <div className="flex items-center justify-between gap-4 text-neutral-400 text-[10px]">
                          <span className="font-medium text-neutral-600">You</span>
                          <span>{formattedTime}</span>
                        </div>
                        <p>{msg.text}</p>
                      </div>
                    </article>
                  );
                }

                // AI Assistant Response
                const isErrorMsg = Boolean(msg.errorState || msg.route === 'error');
                const groundingBadgeLabel = isErrorMsg
                  ? 'Service Notice'
                  : msg.isGroundingVerified
                  ? 'Grounded in Sources'
                  : msg.route === 'insufficient'
                  ? 'Grounded Study Scope'
                  : 'General Knowledge';

                const groundingDotColor = isErrorMsg
                  ? 'bg-rose-500'
                  : msg.isGroundingVerified
                  ? 'bg-emerald-600'
                  : msg.route === 'insufficient'
                  ? 'bg-amber-500'
                  : 'bg-blue-600';

                return (
                  <article key={msg.id} className="flex items-start gap-2.5 max-w-3xl">
                    <div className="w-7 h-7 rounded-full bg-neutral-900 text-white flex items-center justify-center flex-shrink-0 shadow-xs mt-0.5">
                      <span className="material-symbols-outlined text-sm">auto_awesome</span>
                    </div>
                    <div className="flex-1 space-y-1.5 min-w-0">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-xs sm:text-sm text-neutral-900">
                            StudyMate AI
                          </span>
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-600 font-mono text-[10px] border border-neutral-200/60 font-medium">
                            <span className={`w-1.5 h-1.5 rounded-full ${groundingDotColor}`}></span>
                            {groundingBadgeLabel}
                          </span>
                          <span className="text-neutral-400 text-[11px]">• {formattedTime}</span>
                        </div>
                        <button
                          className="text-neutral-400 hover:text-neutral-700 transition-colors p-1"
                          title="Tutor source trace"
                          type="button"
                          onClick={() => openInspector('notes')}
                        >
                          <span className="material-symbols-outlined text-base">analytics</span>
                        </button>
                      </div>

                      {/* AI Response Card (Clean White NotebookLM Style) */}
                      <div className="p-4 sm:p-5 rounded-2xl bg-white border border-neutral-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.02)] space-y-3 text-neutral-800 text-xs sm:text-sm leading-relaxed">
                        {msg.errorState ? (
                          <div className="space-y-3">
                            <div className="flex items-start gap-2.5 text-amber-800 bg-amber-50/80 border border-amber-200/70 p-3 rounded-xl">
                              <span className="material-symbols-outlined text-base text-amber-600 shrink-0 mt-0.5">
                                error_outline
                              </span>
                              <div className="flex-1 text-xs sm:text-sm font-medium leading-relaxed">
                                {msg.text}
                              </div>
                            </div>
                            {msg.canRetry && onRetryMessage && (
                              <div className="flex items-center gap-2 pt-1">
                                <button
                                  type="button"
                                  onClick={() => onRetryMessage(msg)}
                                  className="px-3 py-1.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-medium transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
                                >
                                  <span className="material-symbols-outlined text-xs">replay</span>
                                  <span>Retry Question</span>
                                </button>
                              </div>
                            )}
                          </div>
                        ) : (
                          <>
                            {/* Render Rich Message with KaTeX / Equations */}
                            <FormattedMessageContent text={msg.text} />

                            {/* Grounded Citation Chips Bar */}
                            {msg.citations && msg.citations.length > 0 && (
                              <div className="pt-1 flex flex-wrap gap-1.5">
                                {msg.citations.map((cite) => (
                                  <button
                                    key={cite.id}
                                    type="button"
                                    onClick={() => onOpenCitation(cite)}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-neutral-100 hover:bg-neutral-200/80 text-neutral-700 font-mono text-[11px] transition-colors cursor-pointer border border-neutral-200/70 font-medium"
                                    title={`Inspect citation from ${cite.materialTitle}`}
                                  >
                                    <span className="material-symbols-outlined text-xs text-emerald-700">bookmark</span>
                                    <span>
                                      {cite.materialTitle}
                                      {cite.anchorLabel ? ` (${cite.anchorLabel})` : ''}
                                    </span>
                                  </button>
                                ))}
                              </div>
                            )}

                            {/* Action Bar for Answer */}
                            <div className="flex items-center justify-between pt-2 border-t border-neutral-100">
                              <div className="flex items-center gap-1">
                                <button
                                  className="flex items-center gap-1 px-2 py-1 rounded-md hover:bg-neutral-100 text-neutral-500 hover:text-neutral-800 text-xs transition-colors cursor-pointer"
                                  type="button"
                                  onClick={() => handleCopyText(msg.text, msg.id)}
                                >
                                  <span className="material-symbols-outlined text-xs">
                                    {copiedMsgId === msg.id ? 'check' : 'content_copy'}
                                  </span>
                                  <span>{copiedMsgId === msg.id ? 'Copied' : 'Copy'}</span>
                                </button>
                                <button
                                  className="flex items-center gap-1 px-2 py-1 rounded-md hover:bg-neutral-100 text-neutral-500 hover:text-neutral-800 text-xs transition-colors cursor-pointer"
                                  type="button"
                                  onClick={() => handleSaveNote(msg)}
                                >
                                  <span className="material-symbols-outlined text-xs">edit_note</span>
                                  <span>Save Note</span>
                                </button>
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })
            )}

            {/* AI Loading Skeleton */}
            {isLoading && (
              <article className="flex items-start gap-2.5 max-w-2xl animate-pulse">
                <div className="w-7 h-7 rounded-full bg-neutral-200 flex items-center justify-center">
                  <span className="material-symbols-outlined text-neutral-500 text-sm">auto_awesome</span>
                </div>
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-28 bg-neutral-200 rounded"></div>
                  <div className="p-4 rounded-2xl bg-white border border-neutral-200/80 space-y-2">
                    <div className="h-3 w-3/4 bg-neutral-100 rounded"></div>
                    <div className="h-3 w-1/2 bg-neutral-100 rounded"></div>
                  </div>
                </div>
              </article>
            )}

            <div ref={chatScrollRef} />
          </div>
        </div>

        {/* Suggestion Prompts Row */}
        <div className="max-w-2xl xl:max-w-3xl mx-auto w-full px-4 mb-2 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {(materials.length > 0
            ? [
                {
                  label: `Summarize ${materials[0].title.replace(/\.[^/.]+$/, '').slice(0, 24)}`,
                  action: 'prompt' as const,
                },
                {
                  label: 'Quiz me on key concepts',
                  action: 'quiz' as const,
                },
                {
                  label: 'Explain a difficult concept',
                  action: 'prompt' as const,
                },
                {
                  label: 'Compare key concepts in my sources',
                  action: 'prompt' as const,
                },
              ]
            : [
                {
                  label: 'Explain a core academic concept',
                  action: 'prompt' as const,
                },
                {
                  label: 'Compare two related concepts',
                  action: 'prompt' as const,
                },
                {
                  label: 'Quiz me on key concepts',
                  action: 'quiz' as const,
                },
              ]
          ).map((item) => (
            <button
              key={item.label}
              type="button"
              className="flex-shrink-0 px-3 py-1 rounded-full bg-white hover:bg-neutral-100 text-neutral-700 text-xs border border-neutral-200/80 shadow-[0_1px_2px_rgba(0,0,0,0.02)] transition-colors cursor-pointer flex items-center gap-1"
              onClick={() => {
                if (item.action === 'quiz') {
                  startInlineQuiz();
                } else {
                  setInputText(item.label);
                  textareaRef.current?.focus();
                }
              }}
            >
              {item.action === 'quiz' && (
                <span className="material-symbols-outlined text-xs text-emerald-700">quiz</span>
              )}
              <span>{item.label}</span>
            </button>
          ))}
        </div>

        {/* NOTEBOOKLM-STYLE FLOATING PILL COMPOSER */}
        <div className="p-2 sm:pb-3 max-w-2xl xl:max-w-3xl mx-auto w-full px-4 z-20 flex-shrink-0">
          <div className="relative bg-white rounded-3xl p-2.5 transition-all shadow-[0_4px_20px_rgba(0,0,0,0.06)] border border-neutral-200 focus-within:border-neutral-400 focus-within:shadow-[0_4px_24px_rgba(0,0,0,0.1)]">
            <textarea
              ref={textareaRef}
              className="w-full bg-transparent text-neutral-900 text-xs sm:text-sm placeholder-neutral-400 focus:outline-none resize-none px-3 py-1 font-sans"
              placeholder="Ask a question about your sources... (Enter to send)"
              rows={2}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleFormSubmit();
                }
              }}
            />
            <div className="flex items-center justify-between pt-1 px-1">
              <div className="flex items-center gap-2 flex-wrap">
                {/* Active sources count pill */}
                <button
                  className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-neutral-100 hover:bg-neutral-200/70 text-neutral-700 font-mono text-[11px] font-medium transition-colors cursor-pointer border border-neutral-200/60"
                  type="button"
                  onClick={() => {
                    const target = materials[0]?.id;
                    if (onMaterialFilterChange) {
                      onMaterialFilterChange(activeMaterialFilter ? undefined : target);
                    }
                  }}
                  title="Selected sources used for grounding"
                >
                  <span className="material-symbols-outlined text-xs text-emerald-700">check_circle</span>
                  <span>{activeCount} sources selected</span>
                </button>

                <div className="hidden sm:flex items-center bg-neutral-100 rounded-lg p-0.5 border border-neutral-200/60 text-[11px]">
                  <button
                    className={`px-2 py-0.5 rounded-md font-medium transition-all cursor-pointer ${
                      interactionMode === 'smart_tutor'
                        ? 'bg-white text-neutral-900 shadow-xs font-semibold'
                        : 'text-neutral-500 hover:text-neutral-800'
                    }`}
                    type="button"
                    onClick={() => onModeChange('smart_tutor')}
                  >
                    Smart Tutor
                  </button>
                  <button
                    className={`px-2 py-0.5 rounded-md font-medium transition-all cursor-pointer ${
                      interactionMode === 'grounded_study'
                        ? 'bg-white text-neutral-900 shadow-xs font-semibold'
                        : 'text-neutral-500 hover:text-neutral-800'
                    }`}
                    type="button"
                    onClick={() => onModeChange('grounded_study')}
                  >
                    Grounded Study
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-1 sm:gap-1.5">
                {/* Circular Send Button */}
                <button
                  aria-label="Send Query"
                  className="flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-neutral-900 hover:bg-neutral-800 text-white shadow-xs transition-transform active:scale-95 cursor-pointer disabled:opacity-40"
                  type="button"
                  disabled={!inputText.trim() || isLoading}
                  onClick={() => handleFormSubmit()}
                >
                  <span className="material-symbols-outlined text-base">arrow_upward</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ======================================================== */}
      {/* RIGHT PANEL: TWO COLUMNS WITH CARDS (WORKSTATION TOOLS)  */}
      {/* ======================================================== */}
      <aside
        id="right-study-deck"
        style={{ width: deckCollapsed ? '48px' : `${rightPanelWidth}px` }}
        className={`relative flex-shrink-0 bg-white border-l border-neutral-200/80 flex flex-col justify-between shadow-[-1px_0_3px_rgba(0,0,0,0.02)] z-10 ${
          isResizingRight ? 'select-none' : 'transition-[width] duration-150'
        } select-none group/deck`}
      >
        {/* Resize Handle on Left Border */}
        {!deckCollapsed && (
          <div
            className="absolute top-0 left-0 bottom-0 w-2 cursor-col-resize hover:bg-neutral-300/80 active:bg-neutral-400 z-30 flex items-center justify-center transition-colors group"
            onMouseDown={handleRightResizeStart}
            onDoubleClick={() => setRightPanelWidth(340)}
            title="Drag to resize Studio panel (Double click to reset: 340px)"
          >
            <div className="w-[2px] h-8 rounded-full bg-neutral-300 group-hover:bg-neutral-500 transition-colors" />
          </div>
        )}

        {/* Section Header with Collapse & Expand Actions */}
        <div className="p-3 bg-white border-b border-neutral-200/60 flex-shrink-0 space-y-2">
          <div className="flex items-center justify-between">
            {!deckCollapsed ? (
              <>
                <div className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-neutral-800 text-lg">
                    auto_awesome
                  </span>
                  <span className="font-semibold text-neutral-900 text-xs sm:text-sm">
                    Studio
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-600 font-mono font-medium border border-neutral-200/60 uppercase">
                    {studioTab}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    className="p-1 rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors cursor-pointer"
                    title="Collapse Studio Deck"
                    onClick={() => setDeckCollapsed(true)}
                    type="button"
                  >
                    <span className="material-symbols-outlined text-base">right_panel_close</span>
                  </button>
                </div>
              </>
            ) : (
              <button
                className="w-full flex items-center justify-center p-1.5 rounded-lg bg-neutral-100 hover:bg-neutral-200/70 text-neutral-700 transition-colors cursor-pointer"
                title="Expand Studio Deck"
                onClick={() => setDeckCollapsed(false)}
                type="button"
              >
                <span className="material-symbols-outlined text-base">right_panel_open</span>
              </button>
            )}
          </div>

          {/* Segmented Tab Switcher */}
          {!deckCollapsed && (
            <div className="grid grid-cols-3 gap-1 bg-neutral-100/90 p-1 rounded-2xl border border-neutral-200/70 shadow-2xs">
              <button
                id="studio-tab-quizzes"
                type="button"
                className={`flex items-center justify-center gap-1 py-1 px-2.5 rounded-xl text-xs whitespace-nowrap transition-all cursor-pointer ${
                  studioTab === 'quizzes'
                    ? 'bg-white text-neutral-900 shadow-xs font-semibold border border-neutral-200/50'
                    : 'text-neutral-600 hover:text-neutral-900 hover:bg-white/40 font-medium'
                }`}
                onClick={() => setStudioTab('quizzes')}
              >
                <span className="material-symbols-outlined text-sm">quiz</span>
                <span>Quizzes</span>
              </button>
              <button
                id="studio-tab-mastery"
                type="button"
                className={`flex items-center justify-center gap-1 py-1 px-2.5 rounded-xl text-xs whitespace-nowrap transition-all cursor-pointer ${
                  studioTab === 'mastery'
                    ? 'bg-white text-neutral-900 shadow-xs font-semibold border border-neutral-200/50'
                    : 'text-neutral-600 hover:text-neutral-900 hover:bg-white/40 font-medium'
                }`}
                onClick={() => setStudioTab('mastery')}
              >
                <span className="material-symbols-outlined text-sm">analytics</span>
                <span>Mastery</span>
              </button>
              <button
                id="studio-tab-library"
                type="button"
                className={`flex items-center justify-center gap-1 py-1 px-2.5 rounded-xl text-xs whitespace-nowrap transition-all cursor-pointer ${
                  studioTab === 'library'
                    ? 'bg-white text-neutral-900 shadow-xs font-semibold border border-neutral-200/50'
                    : 'text-neutral-600 hover:text-neutral-900 hover:bg-white/40 font-medium'
                }`}
                onClick={() => setStudioTab('library')}
              >
                <span className="material-symbols-outlined text-sm">folder</span>
                <span>Library</span>
              </button>
            </div>
          )}
        </div>

        {/* Collapsed Deck Rail */}
        {deckCollapsed && (
          <div id="deck-collapsed-rail" className="flex flex-col items-center gap-2 pt-2 flex-1">
            <div className="w-6 h-[1px] bg-neutral-200"></div>
            <button
              className="p-1.5 rounded-lg bg-neutral-100 text-neutral-700 cursor-pointer hover:bg-neutral-200"
              title="Quizzes & Assessment"
              onClick={() => {
                setDeckCollapsed(false);
                setStudioTab('quizzes');
              }}
            >
              <span className="material-symbols-outlined text-base">quiz</span>
            </button>
            <button
              className="p-1.5 rounded-lg bg-neutral-100 text-neutral-700 cursor-pointer hover:bg-neutral-200"
              title="Topic Mastery"
              onClick={() => {
                setDeckCollapsed(false);
                setStudioTab('mastery');
              }}
            >
              <span className="material-symbols-outlined text-base">analytics</span>
            </button>
            <button
              className="p-1.5 rounded-lg bg-neutral-100 text-neutral-700 cursor-pointer hover:bg-neutral-200"
              title="Library, Notes & Past Conversations"
              onClick={() => {
                setDeckCollapsed(false);
                setStudioTab('library');
              }}
            >
              <span className="material-symbols-outlined text-base">folder</span>
            </button>
            <button
              className="p-1.5 rounded-lg bg-neutral-100 text-neutral-700 cursor-pointer hover:bg-neutral-200"
              title="Open Inspector"
              onClick={() => openInspector('quizzes')}
            >
              <span className="material-symbols-outlined text-base">fullscreen</span>
            </button>
          </div>
        )}

        {/* Deck Scrollable Content */}
        {!deckCollapsed && (
          <div id="deck-content-wrap" className="flex-1 overflow-y-auto p-3 space-y-3">
            {/* ======================================================== */}
            {/* TAB 1: QUIZZES (Interactive Inline Quiz Runner + Config)  */}
            {/* ======================================================== */}
            {studioTab === 'quizzes' && (
              <div className="space-y-3">
                {/* CASE 1: QUIZ IS DOCKED IN SIDEBAR (isQuizActive && !isQuizFloating) */}
                {isQuizActive && !isQuizFloating ? (
                  <div className="space-y-2.5 animate-in fade-in duration-150">
                    {/* Docked Active Quiz Header */}
                    <div className="p-2.5 rounded-2xl bg-white border border-neutral-200/80 shadow-xs space-y-2">
                      <div className="flex items-center justify-between gap-1.5">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="px-2 py-0.5 rounded-full bg-neutral-900 text-white font-mono text-[10px] font-bold shrink-0">
                            Q{activeQuizIndex + 1}/{activeQuizQuestions.length}
                          </span>
                          <span className="text-[11px] text-neutral-600 font-medium truncate">
                            {activeQuizQuestions[activeQuizIndex]?.topicName}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <span className="font-mono text-[11px] text-neutral-400 mr-0.5">
                            {Math.floor(quizElapsedSeconds / 60)}:{String(quizElapsedSeconds % 60).padStart(2, '0')}
                          </span>
                          <button
                            id="pop-out-quiz-btn"
                            type="button"
                            title="Expand to Floating Window"
                            className="inline-flex items-center gap-1 text-[10px] font-semibold text-neutral-700 bg-neutral-100 hover:bg-neutral-900 hover:text-white px-2 py-1 rounded-lg transition-colors cursor-pointer"
                            onClick={popQuizToFloatingWindow}
                          >
                            <span className="material-symbols-outlined text-xs">open_in_full</span>
                            <span>Float</span>
                          </button>
                          <button
                            type="button"
                            title="Exit Quiz"
                            className="text-[11px] text-neutral-400 hover:text-rose-600 p-1 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
                            onClick={handleExitQuiz}
                          >
                            <span className="material-symbols-outlined text-sm">close</span>
                          </button>
                        </div>
                      </div>

                      {/* Progress bar */}
                      <div className="h-1.5 w-full bg-neutral-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-neutral-900 rounded-full transition-all duration-300"
                          style={{
                            width: `${((activeQuizIndex + 1) / Math.max(activeQuizQuestions.length, 1)) * 100}%`,
                          }}
                        />
                      </div>
                    </div>

                    {/* Docked Question Card or Completion Results */}
                    {!isQuizCompleted ? (
                      activeQuizQuestions[activeQuizIndex] && (
                        <div className="p-3 rounded-2xl bg-white border border-neutral-200/80 shadow-xs space-y-2.5">
                          {/* Question Prompt */}
                          <div className="space-y-1">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[10px] uppercase font-semibold text-neutral-400 tracking-wider font-mono">
                                {(
                                  activeQuizQuestions[activeQuizIndex].practiceMethod ||
                                  quizConfigMethod
                                ).replace('_', ' ')}{' '}
                                •{' '}
                                {activeQuizQuestions[activeQuizIndex].difficulty ||
                                  quizConfigDifficulty}
                              </span>
                              <span className="text-[10px] font-mono text-neutral-500 truncate max-w-[120px]">
                                {activeQuizQuestions[activeQuizIndex].sourceReference.materialTitle}
                              </span>
                            </div>
                            <h3 className="text-xs font-semibold text-neutral-900 leading-snug">
                              {activeQuizQuestions[activeQuizIndex].questionText}
                            </h3>
                          </div>

                          {/* Options List */}
                          <div className="space-y-1.5">
                            {activeQuizQuestions[activeQuizIndex].options.map((option, idx) => {
                              const isSelected = selectedAnswerIndex === idx;
                              const isCorrectOption =
                                idx === activeQuizQuestions[activeQuizIndex].correctOptionIndex;
                              const isWrongSelected = isAnswerSubmitted && isSelected && !isCorrectOption;

                              let optionStyle =
                                'border-neutral-200/80 bg-white hover:border-neutral-300 text-neutral-800';
                              if (!isAnswerSubmitted && isSelected) {
                                optionStyle =
                                  'border-neutral-900 bg-neutral-900/5 text-neutral-950 font-medium ring-1 ring-neutral-900';
                              } else if (isAnswerSubmitted) {
                                if (isCorrectOption) {
                                  optionStyle =
                                    'border-emerald-600 bg-emerald-50 text-emerald-950 font-medium ring-1 ring-emerald-600';
                                } else if (isWrongSelected) {
                                  optionStyle =
                                    'border-rose-500 bg-rose-50 text-rose-950 font-medium ring-1 ring-rose-500';
                                } else {
                                  optionStyle =
                                    'border-neutral-200/60 bg-neutral-50/50 text-neutral-400 opacity-60';
                                }
                              }

                              return (
                                <button
                                  key={idx}
                                  id={`quiz-option-${idx}`}
                                  type="button"
                                  disabled={isAnswerSubmitted}
                                  className={`w-full text-left p-2 rounded-xl border transition-all flex items-start gap-2 text-xs cursor-pointer ${optionStyle}`}
                                  onClick={() => setSelectedAnswerIndex(idx)}
                                >
                                  <span
                                    className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5 ${
                                      isSelected && !isAnswerSubmitted
                                        ? 'bg-neutral-900 text-white'
                                        : isAnswerSubmitted && isCorrectOption
                                        ? 'bg-emerald-600 text-white'
                                        : isAnswerSubmitted && isWrongSelected
                                        ? 'bg-rose-500 text-white'
                                        : 'bg-neutral-100 text-neutral-600'
                                    }`}
                                  >
                                    {String.fromCharCode(65 + idx)}
                                  </span>
                                  <span className="flex-1 leading-snug">{option}</span>
                                  {isAnswerSubmitted && isCorrectOption && (
                                    <span className="material-symbols-outlined text-sm text-emerald-600 flex-shrink-0">
                                      check_circle
                                    </span>
                                  )}
                                  {isAnswerSubmitted && isWrongSelected && (
                                    <span className="material-symbols-outlined text-sm text-rose-500 flex-shrink-0">
                                      cancel
                                    </span>
                                  )}
                                </button>
                              );
                            })}
                          </div>

                          {/* Grounded Citation & Explanation (Revealed on Submit) */}
                          {isAnswerSubmitted && (
                            <div className="p-2.5 rounded-xl bg-neutral-50 border border-neutral-200/80 space-y-1.5 text-xs animate-in fade-in">
                              <div className="flex items-center justify-between text-[11px] font-medium text-emerald-800">
                                <span className="flex items-center gap-1 font-semibold">
                                  <span className="material-symbols-outlined text-sm text-emerald-600">
                                    verified
                                  </span>
                                  Grounded Explanation
                                </span>
                                <span className="font-mono text-[10px] text-neutral-500 truncate max-w-[110px]">
                                  {activeQuizQuestions[activeQuizIndex].sourceReference.materialTitle}
                                </span>
                              </div>
                              <p className="text-neutral-700 leading-relaxed text-[11px]">
                                {activeQuizQuestions[activeQuizIndex].explanation}
                              </p>
                              <div className="p-2 bg-white rounded-lg border border-neutral-200/60 text-[10px] text-neutral-600 italic line-clamp-3">
                                “{activeQuizQuestions[activeQuizIndex].sourceReference.quoteExcerpt}”
                              </div>
                              <button
                                type="button"
                                className="text-[10px] font-semibold text-neutral-900 hover:underline flex items-center gap-1 cursor-pointer pt-0.5"
                                onClick={() => {
                                  const ref = activeQuizQuestions[activeQuizIndex].sourceReference;
                                  const fullCitation: SourceCitation = {
                                    id: ref.id || `cite-${Date.now()}`,
                                    chunkId: ref.chunkId || `chunk-${Date.now()}`,
                                    materialId:
                                      ref.materialId ||
                                      materials.find((m) => m.title === ref.materialTitle)?.id ||
                                      materials[0]?.id ||
                                      'mat-ref',
                                    materialTitle: ref.materialTitle,
                                    anchorLabel: ref.anchorLabel || ref.pageOrSection || 'Source Reference',
                                    sectionHeading: ref.sectionHeading || 'Assessment Reference',
                                    excerpt: ref.quoteExcerpt,
                                    relevanceScore: ref.similarityScore ?? 0.95,
                                  };
                                  onOpenCitation(fullCitation);
                                }}
                              >
                                <span>
                                  Inspect Source (
                                  {activeQuizQuestions[activeQuizIndex].sourceReference.anchorLabel ||
                                    activeQuizQuestions[activeQuizIndex].sourceReference.pageOrSection ||
                                    activeQuizQuestions[activeQuizIndex].sourceReference.materialTitle}
                                  )
                                </span>
                                <span className="material-symbols-outlined text-xs">open_in_new</span>
                              </button>
                            </div>
                          )}

                          {/* Action Buttons */}
                          <div className="pt-0.5">
                            {!isAnswerSubmitted ? (
                              <button
                                id="check-answer-btn"
                                type="button"
                                disabled={selectedAnswerIndex === null}
                                className={`w-full py-2 px-3 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5 shadow-xs ${
                                  selectedAnswerIndex !== null
                                    ? 'bg-neutral-900 text-white hover:bg-neutral-800 cursor-pointer'
                                    : 'bg-neutral-200 text-neutral-400 cursor-not-allowed'
                                }`}
                                onClick={handleSubmitQuizAnswer}
                              >
                                <span>Check Answer</span>
                                <span className="material-symbols-outlined text-sm">arrow_forward</span>
                              </button>
                            ) : (
                              <button
                                id="next-question-btn"
                                type="button"
                                className="w-full py-2 px-3 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                                onClick={handleNextQuizQuestion}
                              >
                                <span>
                                  {activeQuizIndex + 1 < activeQuizQuestions.length
                                    ? 'Next Question'
                                    : 'Finish & View Score'}
                                </span>
                                <span className="material-symbols-outlined text-sm">
                                  {activeQuizIndex + 1 < activeQuizQuestions.length
                                    ? 'arrow_forward'
                                    : 'celebration'}
                                </span>
                              </button>
                            )}
                          </div>
                        </div>
                      )
                    ) : (
                      /* Docked Quiz Completed Score Summary Card */
                      <div className="p-4 rounded-2xl bg-white border border-neutral-200/80 shadow-xs space-y-3 text-center animate-in zoom-in-95">
                        <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center mx-auto border border-emerald-200/60">
                          <span className="material-symbols-outlined text-xl">emoji_events</span>
                        </div>
                        <div>
                          <h3 className="font-semibold text-neutral-900 text-sm">
                            Quiz Completed!
                          </h3>
                          <p className="text-neutral-500 text-xs">
                            Scored {quizScoreCount} of {activeQuizQuestions.length} correct in{' '}
                            {Math.floor(quizElapsedSeconds / 60)}m {quizElapsedSeconds % 60}s
                          </p>
                        </div>

                        <div className="p-2.5 rounded-xl bg-neutral-50 border border-neutral-200/70 inline-block w-full">
                          <div className="text-xl font-bold font-mono text-neutral-900">
                            {Math.round((quizScoreCount / Math.max(activeQuizQuestions.length, 1)) * 100)}%
                          </div>
                          <p className="text-[11px] text-emerald-700 font-semibold pt-0.5">
                            {quizScoreCount === activeQuizQuestions.length
                              ? 'Flawless Mastery Achieved!'
                              : quizScoreCount / Math.max(activeQuizQuestions.length, 1) >= 0.75
                              ? 'Strong Comprehension & Recall'
                              : 'Concepts identified for revision'}
                          </p>
                        </div>

                        <div className="flex items-center gap-2 pt-1">
                          <button
                            type="button"
                            className="flex-1 py-1.5 px-3 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl text-xs font-medium transition-colors cursor-pointer"
                            onClick={() => startInlineQuiz(quizConfigTopicId, undefined, false)}
                          >
                            Retake
                          </button>
                          <button
                            type="button"
                            className="flex-1 py-1.5 px-3 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 rounded-xl text-xs font-medium transition-colors cursor-pointer"
                            onClick={handleExitQuiz}
                          >
                            Done
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  /* CASE 2: QUIZ BUILDER & RECENT ATTEMPTS (with live banner if floating quiz is open) */
                  <div className="space-y-2.5">
                    {/* Live Banner when Quiz is Active in Floating Window */}
                    {isQuizActive && isQuizFloating && (
                      <div className="p-2.5 rounded-2xl bg-emerald-950 text-white border border-emerald-800/80 shadow-xs space-y-2 animate-in fade-in">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                            <span className="text-xs font-semibold truncate">
                              Quiz Active (Q{activeQuizIndex + 1}/{activeQuizQuestions.length})
                            </span>
                          </div>
                          <span className="font-mono text-[11px] text-emerald-300 shrink-0">
                            {Math.floor(quizElapsedSeconds / 60)}:{String(quizElapsedSeconds % 60).padStart(2, '0')}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            className="flex-1 py-1.5 px-2.5 rounded-lg bg-white text-neutral-900 hover:bg-neutral-100 text-[11px] font-semibold transition-colors flex items-center justify-center gap-1 cursor-pointer"
                            onClick={dockQuizToSidebar}
                          >
                            <span className="material-symbols-outlined text-xs">dock_to_left</span>
                            <span>Dock to Sidebar</span>
                          </button>
                          <button
                            type="button"
                            className="py-1.5 px-2.5 rounded-lg bg-emerald-900/80 hover:bg-rose-600 text-emerald-100 hover:text-white text-[11px] font-medium transition-colors cursor-pointer"
                            onClick={handleExitQuiz}
                          >
                            Exit
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Streamlined Grounded Quiz Configuration & Generator Card */}
                    <div className="p-3 rounded-2xl bg-neutral-900 text-white space-y-2 shadow-xs">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold flex items-center gap-1.5 text-white">
                          <span className="material-symbols-outlined text-amber-400 text-sm">
                            psychology
                          </span>
                          Grounded Quiz Builder
                        </span>
                        {/* Question Count Pill Selector */}
                        <div className="flex items-center gap-0.5 bg-neutral-800 p-0.5 rounded-lg border border-neutral-700/80">
                          {[3, 4, 6].map((cnt) => (
                            <button
                              key={cnt}
                              type="button"
                              onClick={() => setQuizConfigQuestionCount(cnt)}
                              className={`px-1.5 py-0.5 rounded-md font-mono text-[10px] font-semibold transition-colors cursor-pointer ${
                                quizConfigQuestionCount === cnt
                                  ? 'bg-white text-neutral-900'
                                  : 'text-neutral-400 hover:text-white'
                              }`}
                            >
                              {cnt}Q
                            </button>
                          ))}
                        </div>
                      </div>

                      {materials.length > 0 ? (
                        <div className="space-y-1.5 pt-0.5">
                          {/* Topic & Source Compact Selectors */}
                          <div className="grid grid-cols-1 gap-1.5">
                            <div>
                              <label className="block text-[9px] font-mono uppercase text-neutral-400 mb-0.5">
                                Topic Scope
                              </label>
                              <select
                                value={quizConfigTopicId}
                                onChange={(e) => setQuizConfigTopicId(e.target.value)}
                                className="w-full px-2 py-1 rounded-lg bg-neutral-800 border border-neutral-700 text-white text-[11px] focus:outline-none focus:border-neutral-500"
                              >
                                <option value="all">All Topics ({effectiveMasteryTopics.length})</option>
                                {effectiveMasteryTopics.map((t) => (
                                  <option key={t.topicId} value={t.topicId}>
                                    {t.topicName} ({t.masteryPercentage}%)
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div>
                              <label className="block text-[9px] font-mono uppercase text-neutral-400 mb-0.5">
                                Source Filter
                              </label>
                              <select
                                value={quizConfigMaterialId}
                                onChange={(e) => setQuizConfigMaterialId(e.target.value)}
                                className="w-full px-2 py-1 rounded-lg bg-neutral-800 border border-neutral-700 text-white text-[11px] focus:outline-none focus:border-neutral-500"
                              >
                                <option value="selected">Selected Sources ({activeCount})</option>
                                <option value="all">All Uploaded Sources ({materials.length})</option>
                                {materials.map((m) => (
                                  <option key={m.id} value={m.id}>
                                    {m.title}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>

                          {/* Practice Method & Difficulty Row */}
                          <div className="grid grid-cols-2 gap-1.5">
                            <div>
                              <label className="block text-[9px] font-mono uppercase text-neutral-400 mb-0.5">
                                Method
                              </label>
                              <select
                                value={quizConfigMethod}
                                onChange={(e) => setQuizConfigMethod(e.target.value as PracticeMethod)}
                                className="w-full px-2 py-1 rounded-lg bg-neutral-800 border border-neutral-700 text-white text-[11px] focus:outline-none"
                              >
                                <option value="active_recall">Active Recall</option>
                                <option value="concept_explanation">Concept Check</option>
                                <option value="mixed_practice">Mixed Practice</option>
                                <option value="spaced_review">Spaced Review</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-[9px] font-mono uppercase text-neutral-400 mb-0.5">
                                Difficulty
                              </label>
                              <select
                                value={quizConfigDifficulty}
                                onChange={(e) =>
                                  setQuizConfigDifficulty(
                                    e.target.value as 'foundation' | 'intermediate' | 'advanced'
                                  )
                                }
                                className="w-full px-2 py-1 rounded-lg bg-neutral-800 border border-neutral-700 text-white text-[11px] focus:outline-none"
                              >
                                <option value="foundation">Foundation</option>
                                <option value="intermediate">Intermediate</option>
                                <option value="advanced">Advanced</option>
                              </select>
                            </div>
                          </div>

                          {/* Launch Buttons: Floating Window (Primary) + Docked Sidebar Icon Button */}
                          <div className="flex items-center gap-1.5 pt-1">
                            <button
                              id="launch-inline-quiz-btn"
                              type="button"
                              className="flex-1 py-2 px-3 bg-white text-neutral-900 hover:bg-neutral-100 rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                              onClick={() => startInlineQuiz(quizConfigTopicId, undefined, true)}
                            >
                              <span className="material-symbols-outlined text-sm">open_in_new</span>
                              <span>Start Quiz ({quizConfigQuestionCount}Q)</span>
                            </button>
                            <button
                              id="launch-docked-quiz-btn"
                              type="button"
                              title="Start Docked in Sidebar"
                              className="py-2 px-2.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 rounded-xl text-xs font-medium transition-colors flex items-center justify-center cursor-pointer"
                              onClick={() => startInlineQuiz(quizConfigTopicId, undefined, false)}
                            >
                              <span className="material-symbols-outlined text-sm">dock_to_left</span>
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="pt-1">
                          <button
                            id="upload-for-quiz-btn"
                            type="button"
                            className="w-full py-2 px-3 bg-white text-neutral-900 hover:bg-neutral-100 rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                            onClick={() => {
                              const fileInput = document.getElementById('workspace-file-upload');
                              if (fileInput) fileInput.click();
                            }}
                          >
                            <span className="material-symbols-outlined text-sm">upload_file</span>
                            <span>Upload Sources to Generate Quiz</span>
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Recent Quiz Attempts Header */}
                    <div className="flex items-center justify-between px-0.5 pt-0.5">
                      <span className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wide font-mono">
                        Recent Attempts
                      </span>
                      <span className="text-[10px] text-neutral-400 font-mono">
                        {effectiveQuizAttempts.length} completed
                      </span>
                    </div>

                    {/* Compact Recent Quiz Attempts List */}
                    {effectiveQuizAttempts.length === 0 ? (
                      <div className="text-center py-5 px-3 bg-white rounded-2xl border border-neutral-200/80 text-neutral-400 space-y-1">
                        <span className="material-symbols-outlined text-lg text-neutral-300">history_edu</span>
                        <p className="text-xs font-medium text-neutral-600">No quiz attempts yet</p>
                        <p className="text-[10px] text-neutral-400">Start a grounded quiz above to track mastery.</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {effectiveQuizAttempts.map((attempt) => (
                          <div
                            key={attempt.id}
                            className="p-2.5 rounded-xl bg-white border border-neutral-200/80 hover:border-neutral-300 shadow-2xs transition-all space-y-1.5"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <h4 className="text-xs font-semibold text-neutral-900 truncate">
                                  {attempt.quizTitle}
                                </h4>
                                <p className="text-[10px] text-neutral-400 truncate">
                                  {attempt.topicName} • {attempt.difficulty}
                                </p>
                              </div>
                              <span
                                className={`px-1.5 py-0.5 rounded-full font-mono text-[10px] font-bold flex-shrink-0 ${
                                  attempt.percentage >= 80
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                                    : 'bg-amber-50 text-amber-700 border border-amber-200/60'
                                }`}
                              >
                                {attempt.score}/{attempt.totalQuestions} ({attempt.percentage}%)
                              </span>
                            </div>

                            {/* Slim Progress Bar */}
                            <div className="h-1 w-full bg-neutral-100 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-500 ${
                                  attempt.percentage >= 80 ? 'bg-emerald-600' : 'bg-amber-500'
                                }`}
                                style={{ width: `${attempt.percentage}%` }}
                              />
                            </div>

                            {/* Compact Single-Line Footer with Drill & Review Actions */}
                            <div className="flex items-center justify-between pt-0.5 text-[10px] text-neutral-400">
                              <span className="flex items-center gap-1 font-mono">
                                <span className="material-symbols-outlined text-[11px]">schedule</span>
                                {Math.floor(attempt.timeSpentSeconds / 60)}m {attempt.timeSpentSeconds % 60}s
                              </span>
                              <div className="flex items-center gap-2">
                                {attempt.percentage < 100 && (
                                  <button
                                    id="drill-this-concept-btn"
                                    type="button"
                                    className="px-2 py-0.5 rounded-md bg-rose-50 hover:bg-rose-600 text-rose-700 hover:text-white border border-rose-200/70 text-[10px] font-semibold transition-colors flex items-center gap-0.5 cursor-pointer"
                                    onClick={() => startInlineQuiz(attempt.topicId, undefined, true)}
                                  >
                                    <span className="material-symbols-outlined text-[11px]">bolt</span>
                                    <span>Drill</span>
                                  </button>
                                )}
                                <button
                                  type="button"
                                  className="text-neutral-600 hover:text-neutral-900 font-medium hover:underline flex items-center gap-0.5 cursor-pointer"
                                  onClick={() => openInspector('quizzes')}
                                >
                                  <span>Review</span>
                                  <span className="material-symbols-outlined text-[11px]">arrow_forward</span>
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ======================================================== */}
            {/* TAB 2: MASTERY (Topic Progress & Diagnostic Radar)       */}
            {/* ======================================================== */}
            {studioTab === 'mastery' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between px-0.5">
                  <span className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wide font-mono">
                    Curriculum Mastery Diagnostics
                  </span>
                  <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/60 font-mono">
                    {effectiveMasteryTopics.length > 0
                      ? `${Math.round(
                          effectiveMasteryTopics.reduce((acc, t) => acc + t.masteryPercentage, 0) /
                            effectiveMasteryTopics.length
                        )}% Avg`
                      : '0% Avg'}
                  </span>
                </div>

                {effectiveMasteryTopics.length === 0 ? (
                  <div className="text-center py-8 px-3 bg-white rounded-2xl border border-neutral-200/80 text-neutral-400 space-y-2">
                    <span className="material-symbols-outlined text-2xl text-neutral-300">analytics</span>
                    <p className="text-xs font-semibold text-neutral-700">No mastery records yet</p>
                    <p className="text-[11px] text-neutral-400 max-w-[220px] mx-auto leading-relaxed">
                      Upload study materials or complete quizzes to track topic organization and retention.
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Overall Progress Gauge Card */}
                    <div className="p-3 rounded-2xl bg-white border border-neutral-200/80 shadow-xs space-y-2">
                      <div className="flex items-center justify-between text-xs font-semibold text-neutral-900">
                        <span>Overall Course Preparedness</span>
                        <span className="font-mono text-emerald-700">
                          {Math.round(
                            effectiveMasteryTopics.reduce((acc, t) => acc + t.masteryPercentage, 0) /
                              effectiveMasteryTopics.length
                          )}%
                        </span>
                      </div>
                      <div className="h-2 w-full bg-neutral-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-neutral-900 rounded-full transition-all duration-500"
                          style={{
                            width: `${Math.round(
                              effectiveMasteryTopics.reduce((acc, t) => acc + t.masteryPercentage, 0) /
                                effectiveMasteryTopics.length
                            )}%`,
                          }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-neutral-500 pt-0.5">
                        <span className="flex items-center gap-1 text-rose-600 font-medium">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                          {effectiveMasteryTopics.filter((t) => t.status === 'review_needed' || t.masteryPercentage < 60).length} Weak
                        </span>
                        <span className="flex items-center gap-1 text-amber-600 font-medium">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                          {effectiveMasteryTopics.filter((t) => t.masteryPercentage >= 60 && t.masteryPercentage < 85).length} In Progress
                        </span>
                        <span className="flex items-center gap-1 text-emerald-600 font-medium">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          {effectiveMasteryTopics.filter((t) => t.masteryPercentage >= 85).length} Mastered
                        </span>
                      </div>
                    </div>

                    {/* Topic Breakdown List */}
                    <div className="space-y-2">
                      {effectiveMasteryTopics.map((topic) => {
                        const isWeak = topic.status === 'review_needed' || topic.masteryPercentage < 60;
                        const isMastered = topic.masteryPercentage >= 85;

                        return (
                          <div
                            key={topic.topicId}
                            className="p-2.5 rounded-xl bg-white border border-neutral-200/80 hover:border-neutral-300 shadow-xs transition-all space-y-1.5"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-xs font-semibold text-neutral-900 truncate">
                                {topic.topicName}
                              </p>
                              <span
                                className={`px-2 py-0.5 rounded-full font-mono text-[10px] font-bold flex-shrink-0 ${
                                  isWeak
                                    ? 'bg-rose-50 text-rose-700 border border-rose-200/60'
                                    : isMastered
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                                    : 'bg-amber-50 text-amber-700 border border-amber-200/60'
                                }`}
                              >
                                {topic.masteryPercentage}% {isWeak ? '• Weak' : isMastered ? '• Mastered' : ''}
                              </span>
                            </div>

                            {/* Progress Bar */}
                            <div className="h-1.5 w-full bg-neutral-100 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  isWeak
                                    ? 'bg-rose-500'
                                    : isMastered
                                    ? 'bg-emerald-600'
                                    : 'bg-amber-500'
                                }`}
                                style={{ width: `${topic.masteryPercentage}%` }}
                              />
                            </div>

                            {/* Weak subtopic or details */}
                            <div className="flex items-center justify-between pt-1">
                              <span className="text-[10px] text-neutral-400 truncate max-w-[170px]">
                                {topic.weakSubtopics && topic.weakSubtopics.length > 0
                                  ? `Focus: ${topic.weakSubtopics[0]}`
                                  : `${topic.evidenceCount} questions evaluated`}
                              </span>
                              <button
                                type="button"
                                className="px-2 py-0.5 rounded-md bg-neutral-100 hover:bg-neutral-900 hover:text-white text-neutral-700 text-[10px] font-medium transition-colors cursor-pointer"
                                onClick={() => startInlineQuiz(topic.topicId)}
                              >
                                Quiz Topic
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* ======================================================== */}
            {/* TAB 3: LIBRARY (Course Materials, Notes & Conversations) */}
            {/* ======================================================== */}
            {studioTab === 'library' && (
              <div className="space-y-3">
                {/* Section A: Past Study Conversations */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between px-0.5">
                    <span className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wide font-mono">
                      Study Conversations ({pastSessions.length})
                    </span>
                    {onNewSession && (
                      <button
                        type="button"
                        className="text-[11px] font-semibold text-neutral-900 hover:underline flex items-center gap-1 cursor-pointer"
                        onClick={onNewSession}
                      >
                        <span className="material-symbols-outlined text-xs">add_comment</span>
                        <span>New Chat</span>
                      </button>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    {pastSessions.length === 0 ? (
                      <div className="text-center py-4 px-3 bg-white rounded-2xl border border-neutral-200/80 text-neutral-400 space-y-1">
                        <p className="text-xs font-medium text-neutral-600">Current session active</p>
                        <p className="text-[11px] text-neutral-400">Ask questions in the tutor to build your conversation history.</p>
                      </div>
                    ) : (
                      pastSessions.slice(0, 5).map((session) => {
                        const isCurrent = session.id === activeSessionId;
                        return (
                          <div
                            key={session.id}
                            className={`p-2.5 rounded-xl border transition-all flex items-center justify-between gap-2 ${
                              isCurrent
                                ? 'bg-neutral-900 text-white border-neutral-900 shadow-xs'
                                : 'bg-white border-neutral-200/80 hover:border-neutral-300 text-neutral-900'
                            }`}
                          >
                            <button
                              type="button"
                              className="flex-1 text-left min-w-0 cursor-pointer"
                              onClick={() => onSelectSession?.(session.id)}
                            >
                              <p className={`text-xs font-semibold truncate ${isCurrent ? 'text-white' : 'text-neutral-900'}`}>
                                {session.title}
                              </p>
                              <p className={`text-[10px] font-mono ${isCurrent ? 'text-neutral-300' : 'text-neutral-400'}`}>
                                {session.messages.length} msgs • {session.mode === 'grounded_study' ? 'Grounded Study' : 'Smart Tutor'}
                              </p>
                            </button>
                            {onDeleteSession && pastSessions.length > 1 && (
                              <button
                                type="button"
                                className={`p-1 rounded transition-colors cursor-pointer ${
                                  isCurrent
                                    ? 'text-neutral-400 hover:text-rose-300 hover:bg-white/10'
                                    : 'text-neutral-400 hover:text-rose-600 hover:bg-rose-50'
                                }`}
                                title="Delete conversation"
                                onClick={() => onDeleteSession(session.id)}
                              >
                                <span className="material-symbols-outlined text-sm">delete</span>
                              </button>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Section B: Saved Study Notes */}
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between px-0.5">
                    <span className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wide font-mono">
                      Saved Study Notes ({savedNotes.length})
                    </span>
                    <button
                      type="button"
                      className="text-[11px] font-semibold text-neutral-900 hover:underline flex items-center gap-1 cursor-pointer"
                      onClick={() => handleSaveNote()}
                    >
                      <span className="material-symbols-outlined text-xs">bookmark_add</span>
                      <span>Save Latest</span>
                    </button>
                  </div>

                  {savedNotes.length === 0 ? (
                    <div className="text-center py-5 px-3 bg-white rounded-2xl border border-neutral-200/80 text-neutral-400 space-y-1">
                      <span className="material-symbols-outlined text-xl text-neutral-300">note_alt</span>
                      <p className="text-xs font-medium text-neutral-600">No saved notes yet</p>
                      <p className="text-[11px] text-neutral-400">
                        Click &ldquo;Save to Notes&rdquo; on any tutor response to bookmark key explanations.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {savedNotes.slice(0, 4).map((note) => (
                        <div
                          key={note.id}
                          className="p-3 rounded-xl bg-white border border-neutral-200/80 hover:border-neutral-300 shadow-xs space-y-1.5 transition-all"
                        >
                          <div className="flex items-start justify-between gap-1">
                            <h4 className="text-xs font-semibold text-neutral-900 truncate">
                              {note.title}
                            </h4>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                className="p-1 rounded text-neutral-400 hover:text-neutral-800 hover:bg-neutral-100 transition-colors cursor-pointer"
                                title="Copy note"
                                onClick={() => {
                                  navigator.clipboard.writeText(note.content);
                                  setCopiedNoteId(note.id);
                                  setTimeout(() => setCopiedNoteId(null), 2000);
                                }}
                              >
                                <span className="material-symbols-outlined text-xs">
                                  {copiedNoteId === note.id ? 'check' : 'content_copy'}
                                </span>
                              </button>
                              {onDeleteNote && (
                                <button
                                  type="button"
                                  className="p-1 rounded text-neutral-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                                  title="Delete note"
                                  onClick={() => onDeleteNote(note.id)}
                                >
                                  <span className="material-symbols-outlined text-xs">delete</span>
                                </button>
                              )}
                            </div>
                          </div>
                          <p className="text-[11px] text-neutral-600 leading-relaxed line-clamp-3 bg-neutral-50 p-2 rounded-lg border border-neutral-200/60">
                            {note.content}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Section C: Uploaded Course Materials */}
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between px-0.5">
                    <span className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wide font-mono">
                      Course Materials ({materials.length})
                    </span>
                    <button
                      type="button"
                      className="text-[11px] font-semibold text-neutral-900 hover:underline flex items-center gap-1 cursor-pointer"
                      onClick={() => {
                        const fileInput = document.getElementById('workspace-file-upload');
                        if (fileInput) fileInput.click();
                      }}
                    >
                      <span className="material-symbols-outlined text-xs">add</span>
                      <span>Upload</span>
                    </button>
                  </div>

                  <div className="space-y-1.5">
                    {materials.map((material) => (
                      <div
                        key={material.id}
                        className="p-2.5 rounded-xl bg-white border border-neutral-200/80 hover:border-neutral-300 shadow-xs transition-all space-y-1.5"
                      >
                        <div className="flex items-start justify-between gap-1">
                          <div className="flex items-start gap-2 min-w-0">
                            <span className="w-6 h-6 rounded-md bg-neutral-100 text-neutral-700 flex items-center justify-center flex-shrink-0 mt-0.5">
                              <span className="material-symbols-outlined text-xs">
                                {material.fileType === 'pdf' ? 'picture_as_pdf' : 'description'}
                              </span>
                            </span>
                            <div className="min-w-0">
                              <h4 className="text-xs font-semibold text-neutral-900 truncate">
                                {material.title}
                              </h4>
                              <p className="text-[10px] text-neutral-400">
                                {material.pageCount ? `${material.pageCount} pages • ` : ''}
                                {material.chunksCount} chunks • {material.fileSizeFormatted}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <button
                              type="button"
                              className="p-1 rounded text-neutral-400 hover:text-neutral-900 hover:bg-neutral-100 transition-colors cursor-pointer"
                              title="Inspect verbatim chunks"
                              onClick={() => onInspectMaterial(material)}
                            >
                              <span className="material-symbols-outlined text-sm">visibility</span>
                            </button>
                            {onDeleteMaterial && (
                              <button
                                type="button"
                                className="p-1 rounded text-neutral-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                                title="Remove material"
                                onClick={() => onDeleteMaterial(material.id)}
                              >
                                <span className="material-symbols-outlined text-sm">delete</span>
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Actions: Export or View full notes */}
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    className="flex-1 py-1.5 px-2 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl text-xs font-medium transition-colors flex items-center justify-center gap-1 shadow-xs cursor-pointer"
                    onClick={() => onExportNotes?.()}
                  >
                    <span className="material-symbols-outlined text-sm">download</span>
                    <span>Export Session</span>
                  </button>
                  <button
                    type="button"
                    className="py-1.5 px-3 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 rounded-xl text-xs font-medium transition-colors flex items-center justify-center gap-1 cursor-pointer"
                    onClick={() => openInspector('sessions')}
                  >
                    <span className="material-symbols-outlined text-sm">history</span>
                    <span>History</span>
                  </button>
                </div>
              </div>
            )}

            {/* Compact Action: Open Floating Studio Inspector */}
            <div className="pt-1">
              <button
                id="open-studio-inspector-btn"
                type="button"
                className="w-full py-2 px-3 bg-neutral-100 hover:bg-neutral-200/80 text-neutral-700 hover:text-neutral-900 border border-neutral-200/80 rounded-xl text-xs font-medium transition-colors flex items-center justify-between cursor-pointer"
                onClick={() => openInspector(studioTab === 'mastery' ? 'mastery' : studioTab === 'library' ? 'sessions' : 'quizzes')}
              >
                <span className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-sm text-neutral-500">fullscreen</span>
                  <span>Open Full Studio Inspector</span>
                </span>
                <span className="material-symbols-outlined text-xs text-neutral-400">open_in_new</span>
              </button>
            </div>
          </div>
        )}

        {/* Footer Sync State */}
        {!deckCollapsed && (
          <div className="p-2.5 bg-neutral-50 border-t border-neutral-200/70 flex items-center justify-between text-neutral-500 font-mono text-[11px] flex-shrink-0">
            <span>Local Storage: Synced</span>
            <span className="flex items-center gap-1 text-emerald-700 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
              Studio Ready
            </span>
          </div>
        )}
      </aside>

      {/* ======================================================== */}
      {/* FLOATING QUIZ WINDOW WITH BLURRED BG & DOCK-TO-SIDE       */}
      {/* ======================================================== */}
      {isQuizActive && isQuizFloating && (
        <div
          id="floating-quiz-modal"
          role="dialog"
          aria-modal="true"
          aria-label="Grounded Interactive Quiz Window"
          className="fixed inset-0 z-50 bg-neutral-900/35 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-150"
          onClick={dockQuizToSidebar}
        >
          <div
            className="bg-white w-full max-w-2xl max-h-[88vh] rounded-2xl shadow-2xl border border-neutral-200/90 flex flex-col overflow-hidden animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Floating Quiz Window Header */}
            <div className="px-5 py-3.5 bg-white border-b border-neutral-200/80 flex items-center justify-between gap-3 flex-shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="px-2.5 py-1 rounded-full bg-neutral-900 text-white font-mono text-xs font-bold shrink-0">
                  {isQuizCompleted
                    ? 'Completed'
                    : `Question ${activeQuizIndex + 1} / ${activeQuizQuestions.length}`}
                </span>
                <div className="min-w-0">
                  <h2 className="text-xs sm:text-sm font-semibold text-neutral-900 truncate">
                    {activeQuizQuestions[activeQuizIndex]?.topicName || 'Grounded Course Assessment'}
                  </h2>
                  <p className="text-[11px] text-neutral-400 font-mono truncate">
                    {(
                      activeQuizQuestions[activeQuizIndex]?.practiceMethod || quizConfigMethod
                    ).replace('_', ' ')}{' '}
                    • {activeQuizQuestions[activeQuizIndex]?.difficulty || quizConfigDifficulty}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <span className="px-2.5 py-1 rounded-lg bg-neutral-100 text-neutral-600 font-mono text-xs font-medium flex items-center gap-1">
                  <span className="material-symbols-outlined text-xs text-neutral-400">timer</span>
                  {Math.floor(quizElapsedSeconds / 60)}:{String(quizElapsedSeconds % 60).padStart(2, '0')}
                </span>

                {/* Push to Side (Dock to Right Sidebar without affecting state) */}
                <button
                  id="dock-quiz-to-sidebar-btn"
                  type="button"
                  title="Push quiz back to the right sidebar without losing state [Esc]"
                  className="px-3 py-1.5 rounded-xl bg-neutral-100 hover:bg-neutral-900 text-neutral-700 hover:text-white text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
                  onClick={dockQuizToSidebar}
                >
                  <span className="material-symbols-outlined text-sm">dock_to_left</span>
                  <span>Push to Side</span>
                </button>

                {/* Exit Quiz */}
                <button
                  type="button"
                  title="Exit Quiz"
                  className="p-1.5 rounded-xl text-neutral-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                  onClick={handleExitQuiz}
                >
                  <span className="material-symbols-outlined text-base">close</span>
                </button>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="h-1.5 w-full bg-neutral-100 overflow-hidden flex-shrink-0">
              <div
                className="h-full bg-neutral-900 transition-all duration-300"
                style={{
                  width: `${
                    isQuizCompleted
                      ? 100
                      : ((activeQuizIndex + 1) / Math.max(activeQuizQuestions.length, 1)) * 100
                  }%`,
                }}
              />
            </div>

            {/* Floating Quiz Scrollable Body */}
            <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-5">
              {!isQuizCompleted ? (
                activeQuizQuestions[activeQuizIndex] && (
                  <>
                    {/* Source Reference Pill & Question Prompt */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/70 font-mono text-[11px] font-medium">
                          <span className="material-symbols-outlined text-xs">menu_book</span>
                          <span className="truncate max-w-xs">
                            {activeQuizQuestions[activeQuizIndex].sourceReference.materialTitle}
                          </span>
                        </span>
                        {activeQuizQuestions[activeQuizIndex].sourceReference.anchorLabel && (
                          <span className="text-[11px] font-mono text-neutral-400">
                            {activeQuizQuestions[activeQuizIndex].sourceReference.anchorLabel}
                          </span>
                        )}
                      </div>
                      <h3 className="text-sm sm:text-base font-semibold text-neutral-900 leading-relaxed">
                        {activeQuizQuestions[activeQuizIndex].questionText}
                      </h3>
                    </div>

                    {/* Spacious Options List */}
                    <div className="space-y-2.5">
                      {activeQuizQuestions[activeQuizIndex].options.map((option, idx) => {
                        const isSelected = selectedAnswerIndex === idx;
                        const isCorrectOption =
                          idx === activeQuizQuestions[activeQuizIndex].correctOptionIndex;
                        const isWrongSelected =
                          isAnswerSubmitted && isSelected && !isCorrectOption;

                        let optionStyle =
                          'border-neutral-200 bg-white hover:border-neutral-300 hover:bg-neutral-50/60 text-neutral-800';
                        if (!isAnswerSubmitted && isSelected) {
                          optionStyle =
                            'border-neutral-900 bg-neutral-900/5 text-neutral-950 font-medium ring-1 ring-neutral-900';
                        } else if (isAnswerSubmitted) {
                          if (isCorrectOption) {
                            optionStyle =
                              'border-emerald-600 bg-emerald-50/90 text-emerald-950 font-medium ring-1 ring-emerald-600';
                          } else if (isWrongSelected) {
                            optionStyle =
                              'border-rose-500 bg-rose-50/90 text-rose-950 font-medium ring-1 ring-rose-500';
                          } else {
                            optionStyle =
                              'border-neutral-200/60 bg-neutral-50/50 text-neutral-400 opacity-65';
                          }
                        }

                        return (
                          <button
                            key={idx}
                            id={`floating-quiz-option-${idx}`}
                            type="button"
                            disabled={isAnswerSubmitted}
                            className={`w-full text-left p-3.5 sm:p-4 rounded-xl border transition-all flex items-start gap-3 text-xs sm:text-sm cursor-pointer ${optionStyle}`}
                            onClick={() => setSelectedAnswerIndex(idx)}
                          >
                            <span
                              className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5 ${
                                isSelected && !isAnswerSubmitted
                                  ? 'bg-neutral-900 text-white'
                                  : isAnswerSubmitted && isCorrectOption
                                  ? 'bg-emerald-600 text-white'
                                  : isAnswerSubmitted && isWrongSelected
                                  ? 'bg-rose-500 text-white'
                                  : 'bg-neutral-100 text-neutral-600'
                              }`}
                            >
                              {String.fromCharCode(65 + idx)}
                            </span>
                            <span className="flex-1 leading-relaxed">{option}</span>
                            {isAnswerSubmitted && isCorrectOption && (
                              <span className="material-symbols-outlined text-base text-emerald-600 flex-shrink-0 mt-0.5">
                                check_circle
                              </span>
                            )}
                            {isAnswerSubmitted && isWrongSelected && (
                              <span className="material-symbols-outlined text-base text-rose-500 flex-shrink-0 mt-0.5">
                                cancel
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>

                    {/* Grounded Citation & Explanation (Revealed on Submit) */}
                    {isAnswerSubmitted && (
                      <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-200/90 space-y-2.5 text-xs sm:text-sm animate-in fade-in">
                        <div className="flex items-center justify-between text-xs font-semibold text-emerald-800">
                          <span className="flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-base text-emerald-600">
                              verified
                            </span>
                            Grounded Source Explanation
                          </span>
                          <span className="font-mono text-[11px] text-neutral-500 truncate max-w-xs">
                            {activeQuizQuestions[activeQuizIndex].sourceReference.materialTitle}
                          </span>
                        </div>
                        <p className="text-neutral-700 leading-relaxed text-xs sm:text-sm">
                          {activeQuizQuestions[activeQuizIndex].explanation}
                        </p>
                        <div className="p-3 bg-white rounded-xl border border-neutral-200/70 text-xs text-neutral-600 italic leading-relaxed">
                          “{activeQuizQuestions[activeQuizIndex].sourceReference.quoteExcerpt}”
                        </div>
                        <button
                          type="button"
                          className="text-xs font-semibold text-neutral-900 hover:underline flex items-center gap-1 cursor-pointer pt-0.5"
                          onClick={() => {
                            const ref = activeQuizQuestions[activeQuizIndex].sourceReference;
                            const fullCitation: SourceCitation = {
                              id: ref.id || `cite-${Date.now()}`,
                              chunkId: ref.chunkId || `chunk-${Date.now()}`,
                              materialId:
                                ref.materialId ||
                                materials.find((m) => m.title === ref.materialTitle)?.id ||
                                materials[0]?.id ||
                                'mat-ref',
                              materialTitle: ref.materialTitle,
                              anchorLabel:
                                ref.anchorLabel || ref.pageOrSection || 'Source Reference',
                              sectionHeading: ref.sectionHeading || 'Assessment Reference',
                              excerpt: ref.quoteExcerpt,
                              relevanceScore: ref.similarityScore ?? 0.95,
                            };
                            onOpenCitation(fullCitation);
                          }}
                        >
                          <span>
                            Inspect Verbatim Source Passage (
                            {activeQuizQuestions[activeQuizIndex].sourceReference.anchorLabel ||
                              activeQuizQuestions[activeQuizIndex].sourceReference.pageOrSection ||
                              activeQuizQuestions[activeQuizIndex].sourceReference.materialTitle}
                            )
                          </span>
                          <span className="material-symbols-outlined text-sm">open_in_new</span>
                        </button>
                      </div>
                    )}
                  </>
                )
              ) : (
                /* Floating Quiz Completed Score Summary */
                <div className="py-4 px-2 space-y-5 text-center animate-in zoom-in-95">
                  <div className="w-14 h-14 rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center mx-auto border border-emerald-200/60 shadow-xs">
                    <span className="material-symbols-outlined text-3xl">emoji_events</span>
                  </div>
                  <div className="space-y-1">
                    <h3 className="font-semibold text-neutral-900 text-lg">
                      Assessment Completed!
                    </h3>
                    <p className="text-neutral-500 text-xs sm:text-sm">
                      You scored {quizScoreCount} out of {activeQuizQuestions.length} correct in{' '}
                      {Math.floor(quizElapsedSeconds / 60)}m {quizElapsedSeconds % 60}s
                    </p>
                  </div>

                  <div className="p-5 rounded-2xl bg-neutral-50 border border-neutral-200/80 max-w-sm mx-auto space-y-1">
                    <div className="text-3xl font-bold font-mono text-neutral-900">
                      {Math.round(
                        (quizScoreCount / Math.max(activeQuizQuestions.length, 1)) * 100
                      )}
                      %
                    </div>
                    <p className="text-xs text-emerald-700 font-semibold">
                      {quizScoreCount === activeQuizQuestions.length
                        ? 'Flawless Mastery Achieved!'
                        : quizScoreCount / Math.max(activeQuizQuestions.length, 1) >= 0.75
                        ? 'Strong Comprehension & Recall'
                        : 'Concepts identified for focused revision'}
                    </p>
                  </div>

                  <div className="flex items-center justify-center gap-3 pt-2 max-w-md mx-auto">
                    <button
                      type="button"
                      className="flex-1 py-2.5 px-4 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl text-xs sm:text-sm font-semibold transition-colors cursor-pointer shadow-xs"
                      onClick={() => startInlineQuiz(quizConfigTopicId, undefined, true)}
                    >
                      Retake Quiz
                    </button>
                    <button
                      type="button"
                      className="py-2.5 px-4 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 rounded-xl text-xs sm:text-sm font-medium transition-colors cursor-pointer"
                      onClick={dockQuizToSidebar}
                    >
                      Push to Sidebar
                    </button>
                    <button
                      type="button"
                      className="py-2.5 px-4 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 rounded-xl text-xs sm:text-sm font-medium transition-colors cursor-pointer"
                      onClick={handleExitQuiz}
                    >
                      Close
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Floating Quiz Footer Action Bar */}
            {!isQuizCompleted && (
              <div className="px-5 py-3.5 bg-neutral-50 border-t border-neutral-200/80 flex items-center justify-between gap-3 flex-shrink-0">
                <div className="flex items-center gap-2 text-xs text-neutral-500">
                  <span className="font-mono font-medium text-neutral-700">
                    Score: {quizScoreCount}/{activeQuizQuestions.length}
                  </span>
                  <span className="hidden sm:inline text-neutral-300">•</span>
                  <span className="hidden sm:inline text-[11px] text-neutral-400">
                    Click backdrop or &ldquo;Push to Side&rdquo; to dock in sidebar
                  </span>
                </div>

                <div>
                  {!isAnswerSubmitted ? (
                    <button
                      id="floating-check-answer-btn"
                      type="button"
                      disabled={selectedAnswerIndex === null}
                      className={`py-2 px-5 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center gap-1.5 shadow-xs ${
                        selectedAnswerIndex !== null
                          ? 'bg-neutral-900 text-white hover:bg-neutral-800 cursor-pointer'
                          : 'bg-neutral-200 text-neutral-400 cursor-not-allowed'
                      }`}
                      onClick={handleSubmitQuizAnswer}
                    >
                      <span>Check Answer</span>
                      <span className="material-symbols-outlined text-sm">arrow_forward</span>
                    </button>
                  ) : (
                    <button
                      id="floating-next-question-btn"
                      type="button"
                      className="py-2 px-5 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
                      onClick={handleNextQuizQuestion}
                    >
                      <span>
                        {activeQuizIndex + 1 < activeQuizQuestions.length
                          ? 'Next Question'
                          : 'Finish & View Score'}
                      </span>
                      <span className="material-symbols-outlined text-sm">
                        {activeQuizIndex + 1 < activeQuizQuestions.length
                          ? 'arrow_forward'
                          : 'celebration'}
                      </span>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* FULLSCREEN FLOATING INSPECTOR OVERLAY WITH BLURRED BG     */}
      {/* ======================================================== */}
      {isInspectorOpen && (
        <div
          id="fullscreen-inspector-modal"
          className="fixed inset-0 z-50 bg-neutral-900/40 backdrop-blur-sm flex items-center justify-center p-4 lg:p-8 animate-in fade-in duration-150"
        >
          <div className="bg-white w-full max-w-4xl h-[88vh] rounded-2xl shadow-2xl border border-neutral-200 flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-4 bg-white border-b border-neutral-200/80 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-xl bg-neutral-900 text-white flex items-center justify-center shadow-xs">
                  <span className="material-symbols-outlined text-base">find_in_page</span>
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-semibold text-neutral-900 text-sm sm:text-base">
                      Workspace Studio Inspector
                    </h2>
                    <span className="px-2 py-0.5 rounded-full font-mono bg-emerald-50 text-emerald-700 border border-emerald-200/60 font-medium text-[10px]">
                      {materials.length > 0 ? 'Grounded Studio' : 'Active Workspace'}
                    </span>
                  </div>
                  <p className="text-neutral-400 text-xs truncate max-w-md">
                    {materials.length > 0
                      ? `Cross-referencing: ${materials.map((m) => m.title).join(' • ')}`
                      : 'No external documents loaded'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-800 hover:bg-neutral-100 transition-colors cursor-pointer"
                  title="Close Floating Inspector [Esc]"
                  onClick={closeInspector}
                >
                  <span className="material-symbols-outlined text-lg">close</span>
                </button>
              </div>
            </div>

            {/* Quick Switcher Tabs */}
            <div className="px-4 py-2 bg-neutral-50 border-b border-neutral-200/70 flex items-center gap-2 flex-wrap flex-shrink-0 text-xs">
              <button
                type="button"
                className={`px-3 py-1.5 rounded-full font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
                  inspectorTab === 'quizzes'
                    ? 'bg-neutral-900 text-white shadow-xs font-semibold'
                    : 'bg-white hover:bg-neutral-200 text-neutral-700 border border-neutral-200/70'
                }`}
                onClick={() => setInspectorTab('quizzes')}
              >
                <span className="material-symbols-outlined text-sm">quiz</span>
                <span>Quiz History &amp; Review</span>
              </button>
              <button
                type="button"
                className={`px-3 py-1.5 rounded-full font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
                  inspectorTab === 'notes'
                    ? 'bg-neutral-900 text-white shadow-xs font-semibold'
                    : 'bg-white hover:bg-neutral-200 text-neutral-700 border border-neutral-200/70'
                }`}
                onClick={() => setInspectorTab('notes')}
              >
                <span className="material-symbols-outlined text-sm">edit_note</span>
                <span>Saved Notes &amp; Sources ({savedNotes.length})</span>
              </button>
              <button
                type="button"
                className={`px-3 py-1.5 rounded-full font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
                  inspectorTab === 'mastery'
                    ? 'bg-neutral-900 text-white shadow-xs font-semibold'
                    : 'bg-white hover:bg-neutral-200 text-neutral-700 border border-neutral-200/70'
                }`}
                onClick={() => setInspectorTab('mastery')}
              >
                <span className="material-symbols-outlined text-sm">analytics</span>
                <span>Mastery Diagnostics</span>
              </button>
              <button
                type="button"
                className={`px-3 py-1.5 rounded-full font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
                  inspectorTab === 'sessions'
                    ? 'bg-neutral-900 text-white shadow-xs font-semibold'
                    : 'bg-white hover:bg-neutral-200 text-neutral-700 border border-neutral-200/70'
                }`}
                onClick={() => setInspectorTab('sessions')}
              >
                <span className="material-symbols-outlined text-sm">history</span>
                <span>Past Study Conversations ({pastSessions.length})</span>
              </button>
            </div>

            {/* Scrollable Modal Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-[#F8F9FA]">
              {/* Primary Grounded Excerpt Box */}
              <div className="p-4 rounded-xl bg-white border border-neutral-200/80 space-y-2 shadow-xs">
                <div className="flex items-center justify-between text-neutral-400 font-mono text-[11px]">
                  <span className="font-semibold text-neutral-700 flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm text-emerald-600">verified</span>
                    {materials.length > 0 ? 'Grounded Excerpt Inspector' : 'Workspace Context'}
                  </span>
                  <span>{materials.length > 0 ? `${materials.length} Sources Loaded` : '0 Sources Grounded'}</span>
                </div>
                <blockquote className="text-neutral-800 bg-neutral-50 p-3 rounded-lg italic border border-neutral-200/60 leading-relaxed text-xs sm:text-sm">
                  {materials.length > 0 && materials[0]?.chunks?.[0]?.extractedText
                    ? `“${materials[0].chunks[0].extractedText.slice(0, 220)}...”`
                    : '“Upload research papers, lecture slides, or syllabi to view citations, indexed chunks, and highlighted passage context.”'}
                </blockquote>
                {materials.length > 0 && (
                  <div className="flex items-center justify-between pt-1">
                    <button
                      className="text-neutral-900 hover:underline text-xs font-medium flex items-center gap-1 cursor-pointer"
                      type="button"
                      onClick={() => onInspectMaterial(materials[0])}
                    >
                      <span>Inspect {materials[0].title}</span>
                      <span className="material-symbols-outlined text-xs">open_in_new</span>
                    </button>
                    <button
                      className="text-neutral-500 hover:text-neutral-800 text-xs flex items-center gap-1 cursor-pointer"
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(materials[0]?.chunks?.[0]?.extractedText || materials[0]?.title);
                      }}
                    >
                      <span className="material-symbols-outlined text-xs">content_copy</span> Copy snippet
                    </button>
                  </div>
                )}
              </div>

              {/* TAB 1: QUIZ HISTORY & MISSED QUESTIONS */}
              {inspectorTab === 'quizzes' && (
                <div className="p-4 rounded-xl bg-white border border-neutral-200/80 space-y-3 shadow-xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-neutral-900 text-xs sm:text-sm">
                        Quiz History &amp; Question Review
                      </span>
                      <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-neutral-100 text-neutral-700 border border-neutral-200/60 font-medium">
                        {effectiveQuizAttempts.length} Recorded Attempts
                      </span>
                    </div>
                  </div>

                  {effectiveQuizAttempts.length === 0 ? (
                    <div className="p-6 rounded-xl bg-neutral-50 border border-neutral-200/60 text-center space-y-2">
                      <div className="w-9 h-9 rounded-xl bg-neutral-100 text-neutral-500 flex items-center justify-center mx-auto">
                        <span className="material-symbols-outlined text-lg">quiz</span>
                      </div>
                      <p className="text-xs font-semibold text-neutral-800">No Quizzes Completed Yet</p>
                      <p className="text-[11px] text-neutral-500 max-w-sm mx-auto">
                        Complete an interactive assessment in the Quizzes tab to populate your performance history.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {effectiveQuizAttempts.map((attempt) => (
                        <div key={attempt.id} className="p-3.5 rounded-xl bg-neutral-50 border border-neutral-200/70 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-neutral-900 text-xs">{attempt.quizTitle}</span>
                            <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-bold">
                              {attempt.percentage}% ({attempt.score}/{attempt.totalQuestions})
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-[11px] text-neutral-500 font-mono">
                            <span>Topic: {attempt.topicName}</span>
                            <span>{new Date(attempt.completedAt).toLocaleDateString()}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: SAVED STUDY NOTES & CITATIONS */}
              {inspectorTab === 'notes' && (
                <div className="p-4 rounded-xl bg-white border border-neutral-200/80 space-y-4 shadow-xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-neutral-900 text-xs sm:text-sm">
                        Saved Study Notes &amp; Source Takeaways
                      </span>
                      <span className="font-mono text-[11px] px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-700 font-medium">
                        {savedNotes.length} Saved Notes • {materials.length} Sources
                      </span>
                    </div>
                    {onExportNotes && (
                      <button
                        type="button"
                        className="text-neutral-900 hover:underline text-xs font-medium flex items-center gap-1 cursor-pointer"
                        onClick={() => onExportNotes()}
                      >
                        <span>Export Session Notes</span>
                        <span className="material-symbols-outlined text-xs">download</span>
                      </button>
                    )}
                  </div>

                  {savedNotes.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-xs font-semibold text-neutral-700 uppercase font-mono">
                        Bookmarked Tutor Notes
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {savedNotes.map((note) => (
                          <div key={note.id} className="p-3 rounded-lg bg-neutral-50 border border-neutral-200/70 space-y-1.5">
                            <div className="flex items-center justify-between font-mono text-[11px]">
                              <span className="font-semibold text-neutral-900 truncate max-w-[200px]">{note.title}</span>
                              {onDeleteNote && (
                                <button
                                  type="button"
                                  onClick={() => onDeleteNote(note.id)}
                                  className="text-neutral-400 hover:text-rose-600 cursor-pointer"
                                  title="Delete note"
                                >
                                  <span className="material-symbols-outlined text-xs">delete</span>
                                </button>
                              )}
                            </div>
                            <p className="text-neutral-600 text-xs leading-relaxed line-clamp-3">
                              {note.content}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {materials.length === 0 && savedNotes.length === 0 ? (
                    <div className="p-6 rounded-xl bg-neutral-50 border border-neutral-200/60 text-center space-y-2">
                      <div className="w-9 h-9 rounded-xl bg-neutral-100 text-neutral-500 flex items-center justify-center mx-auto">
                        <span className="material-symbols-outlined text-lg">edit_note</span>
                      </div>
                      <p className="text-xs font-semibold text-neutral-800">No Notes or Sources Recorded</p>
                      <p className="text-[11px] text-neutral-500 max-w-sm mx-auto">
                        Save tutor responses or upload lecture materials to build your study notes archive.
                      </p>
                    </div>
                  ) : (
                    materials.length > 0 && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {materials.map((mat) => (
                          <div key={mat.id} className="p-3 rounded-lg bg-neutral-50 border border-neutral-200/70 space-y-1.5">
                            <div className="flex items-center justify-between font-mono text-[11px]">
                              <span className="font-semibold text-neutral-900 truncate max-w-[180px]">{mat.title}</span>
                              <span className="text-neutral-400">{mat.courseCode || 'Workspace'}</span>
                            </div>
                            <p className="text-neutral-600 text-xs leading-relaxed line-clamp-2">
                              {mat.chunks?.[0]?.extractedText ? `${mat.chunks[0].extractedText.slice(0, 140)}...` : 'Document ready for citation and question grounding.'}
                            </p>
                          </div>
                        ))}
                      </div>
                    )
                  )}
                </div>
              )}

              {/* TAB 3: MASTERY DIAGNOSTICS */}
              {inspectorTab === 'mastery' && (
                <div className="p-4 rounded-xl bg-white border border-neutral-200/80 space-y-3 shadow-xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-neutral-900 text-xs sm:text-sm">
                        Mastery Insights &amp; Exam Readiness
                      </span>
                      <span className="font-mono text-[11px] px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-700 font-medium">
                        {effectiveMasteryTopics.length} Topics Tracked
                      </span>
                    </div>
                  </div>

                  {effectiveMasteryTopics.length === 0 ? (
                    <div className="p-6 rounded-xl bg-neutral-50 border border-neutral-200/60 text-center space-y-2">
                      <div className="w-9 h-9 rounded-xl bg-neutral-100 text-neutral-500 flex items-center justify-center mx-auto">
                        <span className="material-symbols-outlined text-lg">analytics</span>
                      </div>
                      <p className="text-xs font-semibold text-neutral-800">No Topic Diagnostics Yet</p>
                      <p className="text-[11px] text-neutral-500 max-w-sm mx-auto">
                        Upload course materials or complete quizzes to generate organized topic breakdown scores.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-3 p-3 rounded-lg bg-neutral-50 border border-neutral-200/70">
                        {effectiveMasteryTopics.map((topic) => (
                          <div key={topic.topicId}>
                            <div className="flex justify-between font-mono text-xs mb-1">
                              <span className="font-medium text-neutral-800">{topic.topicName}</span>
                              <span className={`font-bold ${topic.masteryPercentage >= 75 ? 'text-emerald-700' : 'text-amber-700'}`}>
                                {topic.masteryPercentage}%
                              </span>
                            </div>
                            <div className="w-full bg-neutral-200 rounded-full h-1.5 overflow-hidden">
                              <div
                                className={`h-1.5 rounded-full ${topic.masteryPercentage >= 75 ? 'bg-emerald-600' : 'bg-amber-500'}`}
                                style={{ width: `${topic.masteryPercentage}%` }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="p-3 rounded-lg bg-neutral-50 border border-neutral-200/60 text-neutral-800 space-y-2 flex flex-col justify-between">
                        <div className="space-y-1">
                          <div className="font-semibold flex items-center gap-1 text-xs">
                            <span className="material-symbols-outlined text-sm text-neutral-700">target</span>
                            <span>Targeted Review</span>
                          </div>
                          <p className="text-xs text-neutral-600 leading-relaxed">
                            Continuous practice reinforces retrieval pathways for exam retention.
                          </p>
                        </div>
                        <button
                          type="button"
                          className="py-1.5 px-3 bg-neutral-900 text-white rounded-lg text-xs font-medium self-start hover:bg-neutral-800 transition-colors cursor-pointer shadow-xs"
                          onClick={() => {
                            closeInspector();
                            startInlineQuiz(effectiveMasteryTopics[0]?.topicId);
                          }}
                        >
                          Launch Topic Quiz Drill
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 4: SESSION ARCHIVE */}
              {inspectorTab === 'sessions' && (
                <div className="p-4 rounded-xl bg-white border border-neutral-200/80 space-y-3 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-neutral-900 text-xs sm:text-sm">
                      Past Study Conversations &amp; Chat History
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[11px] text-neutral-400">
                        {pastSessions.length} saved session{pastSessions.length === 1 ? '' : 's'}
                      </span>
                      {onNewSession && (
                        <button
                          type="button"
                          onClick={() => {
                            onNewSession();
                            closeInspector();
                          }}
                          className="px-2.5 py-1 rounded-lg bg-neutral-900 text-white text-xs font-medium hover:bg-neutral-800 cursor-pointer"
                        >
                          + New Conversation
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="space-y-2">
                    {pastSessions.map((session) => {
                      const isCurrent = session.id === activeSessionId;
                      return (
                        <div
                          key={session.id}
                          className={`p-3 rounded-lg border flex items-center justify-between gap-3 ${
                            isCurrent
                              ? 'bg-neutral-50 border-neutral-900'
                              : 'bg-white border-neutral-200/80 hover:border-neutral-300'
                          }`}
                        >
                          <button
                            type="button"
                            className="flex items-center gap-3 text-left flex-1 min-w-0 cursor-pointer"
                            onClick={() => {
                              onSelectSession?.(session.id);
                              closeInspector();
                            }}
                          >
                            <span className="material-symbols-outlined text-neutral-800 text-base">chat</span>
                            <div className="min-w-0">
                              <p className="font-medium text-neutral-900 text-xs truncate">
                                {session.title}
                              </p>
                              <p className="font-mono text-neutral-400 text-[10px]">
                                {session.messages.length} messages • {session.mode === 'grounded_study' ? 'Grounded Study' : 'Smart Tutor'} • Updated {new Date(session.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </p>
                            </div>
                          </button>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {isCurrent ? (
                              <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/60 font-mono font-medium text-[10px]">
                                Current Session
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  onSelectSession?.(session.id);
                                  closeInspector();
                                }}
                                className="px-2.5 py-1 rounded-md bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-[11px] font-medium cursor-pointer"
                              >
                                Resume
                              </button>
                            )}
                            {onDeleteSession && pastSessions.length > 1 && (
                              <button
                                type="button"
                                onClick={() => onDeleteSession(session.id)}
                                className="p-1 text-neutral-400 hover:text-rose-600 cursor-pointer"
                                title="Delete session"
                              >
                                <span className="material-symbols-outlined text-sm">delete</span>
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-3.5 bg-white border-t border-neutral-200/80 flex items-center justify-between flex-shrink-0">
              <button
                type="button"
                className="px-3.5 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-full text-xs font-medium transition-colors cursor-pointer"
                onClick={closeInspector}
              >
                Close
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="px-3.5 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 rounded-full text-xs font-medium transition-colors cursor-pointer border border-neutral-200/70"
                  onClick={() => {
                    handleSaveNote();
                    closeInspector();
                  }}
                >
                  Save Latest to Notes
                </button>
                <button
                  type="button"
                  className="px-4 py-1.5 bg-neutral-900 text-white hover:bg-neutral-800 rounded-full text-xs font-medium transition-colors shadow-xs cursor-pointer"
                  onClick={() => {
                    closeInspector();
                    startInlineQuiz(effectiveMasteryTopics[0]?.topicId);
                  }}
                >
                  Practice Topic Quiz
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Paste Raw Excerpt Modal */}
      {pasteModalOpen && (
        <div className="fixed inset-0 z-50 bg-neutral-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white max-w-lg w-full rounded-2xl shadow-xl border border-neutral-200 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-neutral-900 text-sm sm:text-base">
                Paste Raw Excerpt or Notes
              </h3>
              <button
                type="button"
                onClick={() => setPasteModalOpen(false)}
                className="p-1 rounded-lg text-neutral-400 hover:text-neutral-800"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>
            <form onSubmit={handlePasteSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-neutral-600 mb-1">
                  Title / Topic Label
                </label>
                <input
                  type="text"
                  placeholder="e.g. Professor Lecture Notes — Hessian Analysis"
                  className="w-full px-3 py-1.5 bg-neutral-50 border border-neutral-200 rounded-lg text-neutral-900 text-xs sm:text-sm focus:outline-none focus:border-neutral-400"
                  value={pasteTitle}
                  onChange={(e) => setPasteTitle(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-600 mb-1">
                  Text Content / Excerpt
                </label>
                <textarea
                  rows={6}
                  placeholder="Paste verbatim notes, theorem definitions, or textbook excerpts here..."
                  className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-lg text-neutral-900 text-xs sm:text-sm focus:outline-none focus:border-neutral-400 resize-none font-sans"
                  value={pasteContent}
                  onChange={(e) => setPasteContent(e.target.value)}
                  required
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setPasteModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-neutral-600 hover:bg-neutral-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg text-xs font-medium bg-neutral-900 text-white hover:bg-neutral-800 shadow-xs cursor-pointer"
                >
                  Add to Sources
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
