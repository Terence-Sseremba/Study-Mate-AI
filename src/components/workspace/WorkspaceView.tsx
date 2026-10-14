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
} from '../../types';
import { processUploadedDocument } from '../../lib/documentExtraction';
import { FormattedMessageContent } from '../tutor/FormattedMessageContent';
import {
  INITIAL_QUIZ_ATTEMPTS,
  INITIAL_TOPIC_MASTERY,
  INITIAL_QUIZ_QUESTIONS,
} from '../../data/sampleCurriculum';

export type StudioTabType =
  | 'quizzes'
  | 'mastery'
  | 'library'
  | 'flashcards'
  | 'audio'
  | 'cheatsheet';

export interface FlashcardItem {
  id: string;
  topic: string;
  front: string;
  back: string;
  formula?: string;
  source: string;
  citationSnippet: string;
}

const DEFAULT_FLASHCARDS: FlashcardItem[] = [];

interface WorkspaceViewProps {
  materials: StudyMaterial[];
  messages: TutorMessage[];
  onSendMessage: (question: string, materialId?: string) => Promise<void>;
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
  onClearSession,
  onTuneClick,
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

  // Studio tabs (Quizzes, Mastery, Library, Flashcards, Audio, Cheatsheet)
  const [studioTab, setStudioTab] = useState<StudioTabType>('quizzes');
  const [copiedNoteId, setCopiedNoteId] = useState<string | null>(null);

  // Inline Interactive Quiz Runner State
  const [isQuizActive, setIsQuizActive] = useState(false);
  const [activeQuizQuestions, setActiveQuizQuestions] = useState<QuizQuestion[]>([]);
  const [activeQuizIndex, setActiveQuizIndex] = useState(0);
  const [selectedAnswerIndex, setSelectedAnswerIndex] = useState<number | null>(null);
  const [isAnswerSubmitted, setIsAnswerSubmitted] = useState(false);
  const [quizScoreCount, setQuizScoreCount] = useState(0);
  const [quizAnswersMap, setQuizAnswersMap] = useState<Record<string, number>>({});
  const [isQuizCompleted, setIsQuizCompleted] = useState(false);
  const [quizElapsedSeconds, setQuizElapsedSeconds] = useState(0);

  // Flashcards (Spaced Repetition) State
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isCardFlipped, setIsCardFlipped] = useState(false);
  const [flashcardsReviewedCount, setFlashcardsReviewedCount] = useState(0);

  // NotebookLM Audio Deep Dive Player State
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [audioSpeed, setAudioSpeed] = useState<number>(1.0);
  const [audioElapsedSeconds, setAudioElapsedSeconds] = useState(74); // 1:14

  // Audio playback ticker
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    if (isPlayingAudio) {
      timer = setInterval(() => {
        setAudioElapsedSeconds((prev) => {
          if (prev >= 150) {
            setIsPlayingAudio(false);
            return 150;
          }
          return prev + 1;
        });
      }, 1000 / audioSpeed);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isPlayingAudio, audioSpeed]);

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

  // Launch Inline Quiz
  const startInlineQuiz = (topicId?: string) => {
    const pool = questions && questions.length > 0 ? questions : INITIAL_QUIZ_QUESTIONS;
    const matching = topicId ? pool.filter((q) => q.topicId === topicId) : pool;
    const activeSet = matching.length > 0 ? matching : pool;

    setActiveQuizQuestions(activeSet);
    setActiveQuizIndex(0);
    setSelectedAnswerIndex(null);
    setIsAnswerSubmitted(false);
    setQuizScoreCount(0);
    setQuizAnswersMap({});
    setIsQuizCompleted(false);
    setQuizElapsedSeconds(0);
    setIsQuizActive(true);
    setStudioTab('quizzes');
    setDeckCollapsed(false);
  };

  // Preselected topic triggers from outside or chat
  useEffect(() => {
    if (preselectedTopicId) {
      if (preselectedPracticeMethod === 'spaced_review') {
        setStudioTab('flashcards');
        setDeckCollapsed(false);
      } else {
        startInlineQuiz(preselectedTopicId);
      }
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
      const finalScore =
        quizScoreCount +
        (selectedAnswerIndex === currentQ?.correctOptionIndex ? 1 : 0);
      const totalQ = activeQuizQuestions.length;
      const percentage = Math.round((finalScore / totalQ) * 100);

      const attempt: QuizAttempt = {
        id: `attempt-${Date.now()}`,
        quizTitle: `Review Drill: ${currentQ?.topicName || 'Academic Practice'}`,
        topicId: currentQ?.topicId || `topic-${Date.now()}`,
        topicName: currentQ?.topicName || 'Active Topic Review',
        difficulty: currentQ?.difficulty || 'intermediate',
        totalQuestions: totalQ,
        score: finalScore,
        percentage,
        completedAt: new Date().toISOString(),
        userAnswers: {
          ...quizAnswersMap,
          ...(currentQ && selectedAnswerIndex !== null ? { [currentQ.id]: selectedAnswerIndex } : {}),
        },
        timeSpentSeconds: quizElapsedSeconds || 120,
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

  const handleRateFlashcard = () => {
    setFlashcardsReviewedCount((prev) => prev + 1);
    setIsCardFlipped(false);
    if (currentCardIndex + 1 < DEFAULT_FLASHCARDS.length) {
      setCurrentCardIndex((prev) => prev + 1);
    } else {
      setCurrentCardIndex(0);
    }
  };

  const handleAskTutorFormula = (formulaPrompt: string) => {
    onSendMessage(formulaPrompt, activeMaterialFilter);
  };

  // Effective quiz attempts and topic mastery (with safe fallbacks to rich curriculum sample)
  const effectiveQuizAttempts =
    quizAttempts && quizAttempts.length > 0 ? quizAttempts : INITIAL_QUIZ_ATTEMPTS;
  const effectiveMasteryTopics =
    masteryTopics && masteryTopics.length > 0 ? masteryTopics : INITIAL_TOPIC_MASTERY;

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
      // Default syllabus excluded, others included
      map[m.id] = !m.title.toLowerCase().includes('syllabus');
    });
    return map;
  });

  // Composer Input state
  const [inputText, setInputText] = useState(initialQuestionPrompt || '');
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);
  const [copiedLatex, setCopiedLatex] = useState(false);
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

  // Keyboard shortcut listeners (⌘B to toggle sources, ⌘K, Esc to close inspector)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        setSourcesCollapsed((prev) => !prev);
      }
      if (e.key === 'Escape' && isInspectorOpen) {
        closeInspector();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isInspectorOpen]);

  // Handle source checkbox toggle
  const toggleGrounding = (materialId: string) => {
    setActiveGroundingIds((prev) => ({
      ...prev,
      [materialId]: !prev[materialId],
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
  const handlePasteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pasteContent.trim()) return;

    const newMaterial: StudyMaterial = {
      id: `mat-pasted-${Date.now()}`,
      title: pasteTitle.trim() || 'Pasted Research Notes',
      filename: `${(pasteTitle.trim() || 'Pasted_Notes').replace(/\s+/g, '_')}.txt`,
      fileType: 'notes',
      fileSizeFormatted: `${(pasteContent.length / 1024).toFixed(1)} KB`,
      chunksCount: 1,
      uploadedAt: new Date().toISOString(),
      courseCode: materials[0]?.courseCode || 'Workspace',
      courseName: materials[0]?.courseName || 'General Studies',
      processingStatus: 'indexed',
      chunks: [
        {
          id: `chunk-pasted-${Date.now()}`,
          materialId: `mat-pasted-${Date.now()}`,
          materialTitle: pasteTitle.trim() || 'Pasted Research Notes',
          sectionHeading: 'Pasted Excerpt',
          anchorLabel: 'Notes — Section 1',
          extractedText: pasteContent.trim(),
          confidenceScore: 0.99,
        },
      ],
    };

    onAddMaterial(newMaterial);
    setActiveGroundingIds((prev) => ({ ...prev, [newMaterial.id]: true }));
    setPasteTitle('');
    setPasteContent('');
    setPasteModalOpen(false);
    setSourceDropdownOpen(false);
  };

  const handleFormSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || isLoading) return;
    const text = inputText.trim();
    setInputText('');
    await onSendMessage(text, activeMaterialFilter);
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

  const handleCopyLatex = async (formula?: string) => {
    const textToCopy = formula || '';
    if (!textToCopy) return;
    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopiedLatex(true);
      setTimeout(() => setCopiedLatex(false), 2000);
    } catch (err) {
      console.warn('Clipboard error:', err);
    }
  };

  const handleSaveNote = () => {
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

  const activeCount = Object.values(activeGroundingIds).filter(Boolean).length;

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
          <div className="flex-1 overflow-y-auto px-2.5 space-y-1.5 py-2">
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
              filteredMaterials.map((mat) => {
                const isActive = !!activeGroundingIds[mat.id];
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

                return (
                  <div
                    key={mat.id}
                    className={`group relative p-2.5 rounded-xl transition-all border ${
                      isActive
                        ? 'bg-white text-neutral-900 shadow-xs border-neutral-200/80 hover:border-neutral-300'
                        : 'bg-neutral-50/60 hover:bg-neutral-100 opacity-60 text-neutral-400 border-neutral-200/40'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <input
                        checked={isActive}
                        onChange={() => toggleGrounding(mat.id)}
                        className="mt-0.5 h-3.5 w-3.5 rounded bg-neutral-900 text-white accent-neutral-900 cursor-pointer"
                        type="checkbox"
                        title={isActive ? 'Source included in query context' : 'Source excluded'}
                      />
                      <div
                        className="min-w-0 flex-1 cursor-pointer"
                        onClick={() => onInspectMaterial(mat)}
                      >
                        <div className="flex items-center gap-1.5">
                          <span className={`px-1 py-0.2 rounded ${tagColor} font-mono text-[9px] font-bold border`}>
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
                      </div>
                    </div>
                    {isActive && (
                      <span
                        className="absolute top-2.5 right-2.5 w-1.5 h-1.5 rounded-full bg-emerald-600"
                        title="Actively grounded"
                      ></span>
                    )}
                  </div>
                );
              })
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
            <button
              className="text-neutral-700 hover:text-neutral-900 hover:underline cursor-pointer"
              type="button"
              onClick={() => {
                const map: Record<string, boolean> = {};
                materials.forEach((m) => (map[m.id] = true));
                setActiveGroundingIds(map);
              }}
            >
              Select All
            </button>
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
              {interactionMode === 'smart_tutor' ? 'Smart Tutor:' : 'Strict Grounded:'}
            </span>
            <span className="truncate text-neutral-500">
              {activeCount > 0
                ? `Grounded in ${activeCount} source${activeCount > 1 ? 's' : ''}`
                : 'No sources selected — ask any academic question'}
            </span>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-600 font-medium border border-neutral-200/60">
              {activeCount > 0 ? 'Curriculum Grounded' : 'General Tutoring'}
            </span>
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
                    onClick={() => {
                      setInputText('Explain the core concepts and help me study.');
                      textareaRef.current?.focus();
                    }}
                    className="p-3 rounded-xl bg-white border border-neutral-200/80 hover:border-neutral-300 hover:shadow-xs transition-all cursor-pointer group"
                  >
                    <span className="material-symbols-outlined text-emerald-600 text-lg mb-1 block">
                      psychology
                    </span>
                    <span className="text-xs font-semibold text-neutral-800 group-hover:text-neutral-900 block">
                      Ask AI Tutor
                    </span>
                    <span className="text-[10px] text-neutral-400 block mt-0.5">
                      Adaptive Socratic tutoring
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
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                            {msg.isGroundingVerified ? 'Grounded in sources' : 'Curriculum Grounded'}
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
                                    <span>{cite.anchorLabel || cite.materialTitle}</span>
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
                                  onClick={handleSaveNote}
                                >
                                  <span className="material-symbols-outlined text-xs">edit_note</span>
                                  <span>Save Note</span>
                                </button>
                              </div>
                              <button
                                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-neutral-100 hover:bg-neutral-200/70 text-neutral-800 text-xs font-medium transition-colors cursor-pointer border border-neutral-200/60"
                                onClick={() => openInspector('quizzes')}
                                type="button"
                              >
                                <span className="material-symbols-outlined text-xs">quiz</span>
                                <span>Inspect Quiz</span>
                              </button>
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
                `Summarize ${materials[0].title.replace(/\.[^/.]+$/, '').slice(0, 20)}`,
                'Quiz me on key concepts',
                'Extract high-yield formulas',
                'Create flashcards from my notes',
              ]
            : [
                'Help me plan a study schedule',
                'Explain an academic concept',
                'How does grounded tutoring work?',
              ]
          ).map((prompt) => (
            <button
              key={prompt}
              type="button"
              className="flex-shrink-0 px-3 py-1 rounded-full bg-white hover:bg-neutral-100 text-neutral-700 text-xs border border-neutral-200/80 shadow-[0_1px_2px_rgba(0,0,0,0.02)] transition-colors cursor-pointer"
              onClick={() => {
                setInputText(prompt);
                textareaRef.current?.focus();
              }}
            >
              {prompt}
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
                  title="Filter grounding scope"
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
                    Grounded Only
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-1 sm:gap-1.5">
                <button
                  className="p-1 rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors cursor-pointer"
                  title="Insert Math Equation"
                  type="button"
                  onClick={() => {
                    setInputText((prev) => prev + ' $$\\nabla_\\theta L(\\theta)$$ ');
                    textareaRef.current?.focus();
                  }}
                >
                  <span className="material-symbols-outlined text-base">functions</span>
                </button>
                <button
                  className="p-1 rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors cursor-pointer"
                  title="Voice Prompt"
                  type="button"
                  onClick={() => {
                    setInputText((prev) => prev + ' explain saddle point condition number');
                  }}
                >
                  <span className="material-symbols-outlined text-base">mic</span>
                </button>
                {/* Circular Send Button (NotebookLM Iconic Pill button) */}
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

          {/* Segmented Tab Switcher with a lot of tabs */}
          {!deckCollapsed && (
            <div className="flex items-center gap-1 bg-neutral-100/90 p-1 rounded-2xl border border-neutral-200/70 shadow-2xs overflow-x-auto no-scrollbar">
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
              <button
                id="studio-tab-flashcards"
                type="button"
                className={`flex items-center justify-center gap-1 py-1 px-2.5 rounded-xl text-xs whitespace-nowrap transition-all cursor-pointer ${
                  studioTab === 'flashcards'
                    ? 'bg-white text-neutral-900 shadow-xs font-semibold border border-neutral-200/50'
                    : 'text-neutral-600 hover:text-neutral-900 hover:bg-white/40 font-medium'
                }`}
                onClick={() => setStudioTab('flashcards')}
              >
                <span className="material-symbols-outlined text-sm">style</span>
                <span>Flashcards</span>
              </button>
              <button
                id="studio-tab-audio"
                type="button"
                className={`flex items-center justify-center gap-1 py-1 px-2.5 rounded-xl text-xs whitespace-nowrap transition-all cursor-pointer ${
                  studioTab === 'audio'
                    ? 'bg-white text-neutral-900 shadow-xs font-semibold border border-neutral-200/50'
                    : 'text-neutral-600 hover:text-neutral-900 hover:bg-white/40 font-medium'
                }`}
                onClick={() => setStudioTab('audio')}
              >
                <span className="material-symbols-outlined text-sm">headphones</span>
                <span>Audio</span>
              </button>
              <button
                id="studio-tab-cheatsheet"
                type="button"
                className={`flex items-center justify-center gap-1 py-1 px-2.5 rounded-xl text-xs whitespace-nowrap transition-all cursor-pointer ${
                  studioTab === 'cheatsheet'
                    ? 'bg-white text-neutral-900 shadow-xs font-semibold border border-neutral-200/50'
                    : 'text-neutral-600 hover:text-neutral-900 hover:bg-white/40 font-medium'
                }`}
                onClick={() => setStudioTab('cheatsheet')}
              >
                <span className="material-symbols-outlined text-sm">menu_book</span>
                <span>Cheatsheet</span>
              </button>
            </div>
          )}
        </div>

        {/* Collapsed Deck Rail with all tabs */}
        {deckCollapsed && (
          <div id="deck-collapsed-rail" className="flex flex-col items-center gap-2 pt-2 flex-1">
            <div className="w-6 h-[1px] bg-neutral-200"></div>
            <button
              className="p-1.5 rounded-lg bg-neutral-100 text-neutral-700 cursor-pointer hover:bg-neutral-200"
              title="Quizzes"
              onClick={() => {
                setDeckCollapsed(false);
                setStudioTab('quizzes');
              }}
            >
              <span className="material-symbols-outlined text-base">quiz</span>
            </button>
            <button
              className="p-1.5 rounded-lg bg-neutral-100 text-neutral-700 cursor-pointer hover:bg-neutral-200"
              title="Mastery"
              onClick={() => {
                setDeckCollapsed(false);
                setStudioTab('mastery');
              }}
            >
              <span className="material-symbols-outlined text-base">analytics</span>
            </button>
            <button
              className="p-1.5 rounded-lg bg-neutral-100 text-neutral-700 cursor-pointer hover:bg-neutral-200"
              title="Library & Notes"
              onClick={() => {
                setDeckCollapsed(false);
                setStudioTab('library');
              }}
            >
              <span className="material-symbols-outlined text-base">folder</span>
            </button>
            <button
              className="p-1.5 rounded-lg bg-neutral-100 text-neutral-700 cursor-pointer hover:bg-neutral-200"
              title="Flashcards"
              onClick={() => {
                setDeckCollapsed(false);
                setStudioTab('flashcards');
              }}
            >
              <span className="material-symbols-outlined text-base">style</span>
            </button>
            <button
              className="p-1.5 rounded-lg bg-neutral-100 text-neutral-700 cursor-pointer hover:bg-neutral-200"
              title="Audio Overview"
              onClick={() => {
                setDeckCollapsed(false);
                setStudioTab('audio');
              }}
            >
              <span className="material-symbols-outlined text-base">headphones</span>
            </button>
            <button
              className="p-1.5 rounded-lg bg-neutral-100 text-neutral-700 cursor-pointer hover:bg-neutral-200"
              title="Formula Cheatsheet"
              onClick={() => {
                setDeckCollapsed(false);
                setStudioTab('cheatsheet');
              }}
            >
              <span className="material-symbols-outlined text-base">menu_book</span>
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

        {/* Deck Scrollable Content: Latest Information Stream */}
        {!deckCollapsed && (
          <div id="deck-content-wrap" className="flex-1 overflow-y-auto p-3 space-y-3">
            {/* ======================================================== */}
            {/* TAB 1: QUIZZES (Interactive Inline Quiz Runner + History) */}
            {/* ======================================================== */}
            {studioTab === 'quizzes' && (
              <div className="space-y-3">
                {/* MODE A: ACTIVE INLINE QUIZ RUNNER */}
                {isQuizActive ? (
                  <div className="space-y-3 animate-in fade-in duration-150">
                    {/* Active Quiz Header */}
                    <div className="p-3 rounded-2xl bg-white border border-neutral-200/80 shadow-xs space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span className="px-2 py-0.5 rounded-full bg-neutral-900 text-white font-mono text-[10px] font-bold">
                            Question {activeQuizIndex + 1}/{activeQuizQuestions.length}
                          </span>
                          <span className="text-[11px] text-neutral-500 font-medium truncate max-w-[140px]">
                            {activeQuizQuestions[activeQuizIndex]?.topicName}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[11px] text-neutral-400">
                            {Math.floor(quizElapsedSeconds / 60)}:{String(quizElapsedSeconds % 60).padStart(2, '0')}
                          </span>
                          <button
                            type="button"
                            className="text-[11px] text-neutral-500 hover:text-neutral-900 px-2 py-0.5 rounded-md hover:bg-neutral-100 transition-colors cursor-pointer"
                            onClick={handleExitQuiz}
                          >
                            Exit
                          </button>
                        </div>
                      </div>

                      {/* Progress bar */}
                      <div className="h-1.5 w-full bg-neutral-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-neutral-900 rounded-full transition-all duration-300"
                          style={{
                            width: `${((activeQuizIndex + 1) / activeQuizQuestions.length) * 100}%`,
                          }}
                        />
                      </div>
                    </div>

                    {/* Question Card or Completion Results */}
                    {!isQuizCompleted ? (
                      activeQuizQuestions[activeQuizIndex] && (
                        <div className="p-3.5 rounded-2xl bg-white border border-neutral-200/80 shadow-xs space-y-3">
                          {/* Question Prompt */}
                          <div className="space-y-1">
                            <span className="text-[10px] uppercase font-semibold text-neutral-400 tracking-wider font-mono">
                              Active Recall Challenge
                            </span>
                            <h3 className="text-xs sm:text-sm font-semibold text-neutral-900 leading-snug">
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
                                  className={`w-full text-left p-2.5 rounded-xl border transition-all flex items-start gap-2.5 text-xs cursor-pointer ${optionStyle}`}
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
                                  <span className="flex-1 leading-relaxed">{option}</span>
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
                            <div className="p-3 rounded-xl bg-neutral-50 border border-neutral-200/80 space-y-2 text-xs animate-in fade-in">
                              <div className="flex items-center justify-between text-[11px] font-medium text-emerald-800">
                                <span className="flex items-center gap-1 font-semibold">
                                  <span className="material-symbols-outlined text-sm text-emerald-600">
                                    verified
                                  </span>
                                  Grounded Source Explanation
                                </span>
                                <span className="font-mono text-[10px] text-neutral-500">
                                  {activeQuizQuestions[activeQuizIndex].sourceReference.materialTitle}
                                </span>
                              </div>
                              <p className="text-neutral-700 leading-relaxed text-[11px]">
                                {activeQuizQuestions[activeQuizIndex].explanation}
                              </p>
                              <div className="p-2 bg-white rounded-lg border border-neutral-200/60 text-[10px] text-neutral-600 italic">
                                “{activeQuizQuestions[activeQuizIndex].sourceReference.quoteExcerpt}”
                              </div>
                              <button
                                type="button"
                                className="text-[10px] font-semibold text-neutral-900 hover:underline flex items-center gap-1 cursor-pointer pt-0.5"
                                onClick={() => {
                                  const targetMat = materials.find((m) =>
                                    m.title.includes('Lecture_04')
                                  );
                                  if (targetMat) onInspectMaterial(targetMat);
                                }}
                              >
                                <span>Inspect Verbatim Source Passage</span>
                                <span className="material-symbols-outlined text-xs">open_in_new</span>
                              </button>
                            </div>
                          )}

                          {/* Action Buttons */}
                          <div className="pt-1">
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
                      /* Quiz Completed Score Summary Card */
                      <div className="p-4 rounded-2xl bg-white border border-neutral-200/80 shadow-xs space-y-3 text-center animate-in zoom-in-95">
                        <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center mx-auto border border-emerald-200/60">
                          <span className="material-symbols-outlined text-2xl">emoji_events</span>
                        </div>
                        <div>
                          <h3 className="font-semibold text-neutral-900 text-sm sm:text-base">
                            Quiz Completed!
                          </h3>
                          <p className="text-neutral-500 text-xs">
                            Scored {quizScoreCount} of {activeQuizQuestions.length} correct in{' '}
                            {Math.floor(quizElapsedSeconds / 60)}m {quizElapsedSeconds % 60}s
                          </p>
                        </div>

                        <div className="p-3 rounded-xl bg-neutral-50 border border-neutral-200/70 inline-block w-full">
                          <div className="text-2xl font-bold font-mono text-neutral-900">
                            {Math.round((quizScoreCount / activeQuizQuestions.length) * 100)}%
                          </div>
                          <p className="text-[11px] text-emerald-700 font-semibold pt-0.5">
                            {quizScoreCount === activeQuizQuestions.length
                              ? '🌟 Flawless Mastery Achieved!'
                              : quizScoreCount >= 3
                              ? '🎯 Strong Comprehension & Recall'
                              : '💡 Concepts identified for revision'}
                          </p>
                        </div>

                        <div className="flex items-center gap-2 pt-1">
                          <button
                            type="button"
                            className="flex-1 py-1.5 px-3 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl text-xs font-medium transition-colors cursor-pointer"
                            onClick={() => startInlineQuiz()}
                          >
                            Retake Quiz
                          </button>
                          <button
                            type="button"
                            className="flex-1 py-1.5 px-3 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 rounded-xl text-xs font-medium transition-colors cursor-pointer"
                            onClick={handleExitQuiz}
                          >
                            All Quizzes
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  /* MODE B: QUIZZES OVERVIEW & RECENT ATTEMPTS */
                  <div className="space-y-3">
                    <div className="flex items-center justify-between px-0.5">
                      <span className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wide font-mono">
                        Active Recall &amp; Performance
                      </span>
                      <span className="text-[11px] text-neutral-400">
                        {effectiveQuizAttempts.length} completed
                      </span>
                    </div>

                    {/* Adaptive Quiz Generator Hero Card */}
                    <div className="p-3.5 rounded-2xl bg-neutral-900 text-white space-y-2 shadow-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold flex items-center gap-1.5 text-white">
                          <span className="material-symbols-outlined text-amber-400 text-sm">
                            psychology
                          </span>
                          Adaptive Concept Quiz
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-white/10 text-white/90 font-mono text-[9px] font-medium border border-white/10">
                          {activeQuizQuestions.length > 0 ? activeQuizQuestions.length : 4} Questions
                        </span>
                      </div>
                      <p className="text-[11px] text-neutral-300 leading-relaxed">
                        {activeQuizQuestions.length > 0
                          ? 'Test active recall directly on this page across your course concepts.'
                          : 'Generate tailored active recall questions from your uploaded study materials or prompt your AI tutor.'}
                      </p>
                      {activeQuizQuestions.length > 0 ? (
                        <button
                          id="launch-inline-quiz-btn"
                          type="button"
                          className="w-full py-2 px-3 bg-white text-neutral-900 hover:bg-neutral-100 rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                          onClick={() => startInlineQuiz()}
                        >
                          <span className="material-symbols-outlined text-sm">quiz</span>
                          <span>Launch Inline Quiz Now</span>
                        </button>
                      ) : (
                        <button
                          id="generate-quiz-btn"
                          type="button"
                          className="w-full py-2 px-3 bg-white text-neutral-900 hover:bg-neutral-100 rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                          onClick={() => onSendMessage('Generate a 4-question active recall practice quiz based on my study materials.', activeMaterialFilter)}
                        >
                          <span className="material-symbols-outlined text-sm">auto_awesome</span>
                          <span>Ask Tutor to Generate Quiz</span>
                        </button>
                      )}
                    </div>

                    {/* Latest Quiz Attempts List */}
                    {effectiveQuizAttempts.length === 0 ? (
                      <div className="text-center py-6 px-3 bg-white rounded-2xl border border-neutral-200/80 text-neutral-400 space-y-1">
                        <span className="material-symbols-outlined text-xl text-neutral-300">history_edu</span>
                        <p className="text-xs font-medium text-neutral-600">No quiz attempts yet</p>
                        <p className="text-[11px] text-neutral-400">Launch a quiz or practice with your tutor to track performance.</p>
                      </div>
                    ) : (
                      effectiveQuizAttempts.map((attempt) => (
                        <div
                          key={attempt.id}
                          className="p-3 rounded-2xl bg-white border border-neutral-200/80 hover:border-neutral-300 shadow-xs transition-all space-y-2.5"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <h4 className="text-xs font-semibold text-neutral-900 truncate">
                                {attempt.quizTitle}
                              </h4>
                              <p className="text-[11px] text-neutral-400 truncate">
                                {attempt.topicName} • {attempt.difficulty}
                              </p>
                            </div>
                            <span
                              className={`px-2 py-0.5 rounded-full font-mono text-[10px] font-bold flex-shrink-0 ${
                                attempt.percentage >= 80
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                                  : 'bg-amber-50 text-amber-700 border border-amber-200/60'
                              }`}
                            >
                              {attempt.score}/{attempt.totalQuestions} ({attempt.percentage}%)
                            </span>
                          </div>

                          {/* Progress Bar */}
                          <div className="h-1.5 w-full bg-neutral-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${
                                attempt.percentage >= 80 ? 'bg-emerald-600' : 'bg-amber-500'
                              }`}
                              style={{ width: `${attempt.percentage}%` }}
                            />
                          </div>

                          {/* Missed Concept Alert Banner */}
                          {attempt.percentage < 100 && (
                            <div className="p-2 rounded-xl bg-rose-50/70 border border-rose-200/60 text-[11px] text-rose-800 space-y-1">
                              <div className="flex items-center justify-between">
                                <span className="font-semibold flex items-center gap-1">
                                  <span className="material-symbols-outlined text-xs text-rose-600">
                                    warning
                                  </span>
                                  Review Concept
                                </span>
                              </div>
                              <p className="text-[10px] text-rose-700 leading-snug">
                                Reinforce understanding of this topic with a quick focused practice drill.
                              </p>
                              <button
                                id="drill-this-concept-btn"
                                type="button"
                                className="mt-1 w-full py-1 px-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-semibold transition-colors flex items-center justify-center gap-1 cursor-pointer shadow-2xs"
                                onClick={() => startInlineQuiz(attempt.topicId)}
                              >
                                <span className="material-symbols-outlined text-xs">bolt</span>
                                <span>Drill This Concept Inline</span>
                              </button>
                            </div>
                          )}

                          {/* Actions Row */}
                          <div className="flex items-center justify-between pt-0.5 text-[11px] text-neutral-400">
                            <span className="flex items-center gap-1">
                              <span className="material-symbols-outlined text-xs">schedule</span>
                              {Math.floor(attempt.timeSpentSeconds / 60)}m {attempt.timeSpentSeconds % 60}s
                            </span>
                            <button
                              type="button"
                              className="text-neutral-700 hover:text-neutral-900 font-medium hover:underline flex items-center gap-0.5 cursor-pointer"
                              onClick={() => openInspector('quizzes')}
                            >
                              <span>Review Answers</span>
                              <span className="material-symbols-outlined text-xs">arrow_forward</span>
                            </button>
                          </div>
                        </div>
                      ))
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
                      Complete quizzes or study sessions with your tutor to track retention and knowledge strength.
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
                                  ? `Fix: ${topic.weakSubtopics[0]}`
                                  : `${topic.evidenceCount} questions evaluated`}
                              </span>
                              <button
                                type="button"
                                className="px-2 py-0.5 rounded-md bg-neutral-100 hover:bg-neutral-900 hover:text-white text-neutral-700 text-[10px] font-medium transition-colors cursor-pointer"
                                onClick={() => startInlineQuiz(topic.topicId)}
                              >
                                Practice
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
            {/* TAB 3: LIBRARY (Course Materials & Synthesized Notes)   */}
            {/* ======================================================== */}
            {studioTab === 'library' && (
              <div className="space-y-3">
                {/* Section A: Uploaded Course Materials */}
                <div className="space-y-2">
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
                    {materials.length === 0 ? (
                      <div className="text-center py-6 px-3 bg-white rounded-2xl border border-neutral-200/80 text-neutral-400 space-y-1">
                        <span className="material-symbols-outlined text-xl text-neutral-300">folder_open</span>
                        <p className="text-xs font-medium text-neutral-600">No documents uploaded</p>
                        <p className="text-[11px] text-neutral-400">Click Add sources or upload files to index course materials.</p>
                      </div>
                    ) : (
                      materials.map((material) => (
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
                      ))
                    )}
                  </div>
                </div>

                {/* Section B: Synthesized Notes */}
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between px-0.5">
                    <span className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wide font-mono">
                      Synthesized Key Takeaways
                    </span>
                    <span className="text-[11px] text-neutral-400">
                      {materials.length > 0 ? `${materials.length} sources` : '0 notes'}
                    </span>
                  </div>

                  {materials.length === 0 ? (
                    <div className="text-center py-6 px-3 bg-white rounded-2xl border border-neutral-200/80 text-neutral-400 space-y-1">
                      <span className="material-symbols-outlined text-xl text-neutral-300">note_alt</span>
                      <p className="text-xs font-medium text-neutral-600">No synthesized notes yet</p>
                      <p className="text-[11px] text-neutral-400">
                        Upload study materials or chat with your tutor to build synthesized takeaways.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {materials.slice(0, 3).map((mat, idx) => (
                        <div
                          key={mat.id || idx}
                          className="p-3 rounded-xl bg-white border border-neutral-200/80 hover:border-neutral-300 shadow-xs space-y-2 transition-all"
                        >
                          <div className="flex items-start justify-between gap-1">
                            <h4 className="text-xs font-semibold text-neutral-900 truncate">
                              {mat.title} Takeaways
                            </h4>
                            <button
                              type="button"
                              className="p-1 rounded text-neutral-400 hover:text-neutral-800 hover:bg-neutral-100 transition-colors cursor-pointer"
                              title="Copy title"
                              onClick={() => {
                                navigator.clipboard.writeText(mat.title);
                                setCopiedNoteId(`note-${idx}`);
                                setTimeout(() => setCopiedNoteId(null), 2000);
                              }}
                            >
                              <span className="material-symbols-outlined text-xs">
                                {copiedNoteId === `note-${idx}` ? 'check' : 'content_copy'}
                              </span>
                            </button>
                          </div>
                          <p className="text-[11px] text-neutral-600 leading-relaxed font-mono bg-neutral-50 p-2 rounded-lg border border-neutral-200/60">
                            {mat.chunks[0]?.extractedText.slice(0, 160) || 'Indexed course material ready for query synthesis.'}...
                          </p>
                          <div className="flex items-center justify-between text-[10px] text-neutral-400">
                            <span className="px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-600 font-mono border border-neutral-200">
                              {mat.title}
                            </span>
                            <span>{mat.chunksCount} chunks</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Actions: Export or View full notes */}
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    className="flex-1 py-1.5 px-2 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl text-xs font-medium transition-colors flex items-center justify-center gap-1 shadow-xs cursor-pointer"
                    onClick={() => onExportNotes?.()}
                  >
                    <span className="material-symbols-outlined text-sm">download</span>
                    <span>Export Notes</span>
                  </button>
                  <button
                    type="button"
                    className="py-1.5 px-3 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 rounded-xl text-xs font-medium transition-colors flex items-center justify-center gap-1 cursor-pointer"
                    onClick={() => openInspector('notes')}
                  >
                    <span className="material-symbols-outlined text-sm">open_in_new</span>
                    <span>All Notes</span>
                  </button>
                </div>
              </div>
            )}

            {/* ======================================================== */}
            {/* TAB 4: FLASHCARDS (Spaced Repetition & Recall Flip Deck) */}
            {/* ======================================================== */}
            {studioTab === 'flashcards' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between px-0.5">
                  <span className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wide font-mono">
                    Spaced Repetition Flashcards
                  </span>
                  <span className="text-[10px] font-bold text-neutral-600 bg-neutral-100 px-2 py-0.5 rounded-full border border-neutral-200/60 font-mono">
                    {DEFAULT_FLASHCARDS.length > 0 ? `🔥 ${DEFAULT_FLASHCARDS.length} Due` : '0 Cards'}
                  </span>
                </div>

                {DEFAULT_FLASHCARDS.length === 0 ? (
                  <div className="p-5 rounded-2xl bg-white border border-neutral-200/80 shadow-xs text-center space-y-3">
                    <div className="w-10 h-10 rounded-xl bg-neutral-100 text-neutral-600 flex items-center justify-center mx-auto">
                      <span className="material-symbols-outlined text-lg">style</span>
                    </div>
                    <div className="space-y-1">
                      <h4 className="text-xs font-semibold text-neutral-900">No Flashcards in Deck</h4>
                      <p className="text-[11px] text-neutral-500 leading-relaxed max-w-xs mx-auto">
                        Upload study materials or ask your AI tutor to generate active recall cards with spaced repetition.
                      </p>
                    </div>
                    <button
                      type="button"
                      className="py-1.5 px-3 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-medium transition-colors inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
                      onClick={() => onSendMessage('Generate 5 spaced-repetition flashcards from my study materials to test active recall.')}
                    >
                      <span className="material-symbols-outlined text-xs">auto_awesome</span>
                      <span>Generate Flashcards</span>
                    </button>
                  </div>
                ) : (
                  /* Flashcard Active Deck */
                  DEFAULT_FLASHCARDS[currentCardIndex] && (
                    <div className="space-y-3">
                      {/* Progress indicator */}
                      <div className="flex items-center justify-between text-[11px] text-neutral-400">
                        <span>Card {currentCardIndex + 1} of {DEFAULT_FLASHCARDS.length}</span>
                        <span>{flashcardsReviewedCount} reviewed this session</span>
                      </div>

                      {/* Interactive 3D Card */}
                      <div
                        className="min-h-[220px] p-4 rounded-2xl bg-white border border-neutral-200/90 shadow-sm flex flex-col justify-between cursor-pointer hover:border-neutral-300 transition-all select-none group"
                        onClick={() => setIsCardFlipped(!isCardFlipped)}
                      >
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-600 text-[10px] font-semibold font-mono border border-neutral-200/60">
                              {DEFAULT_FLASHCARDS[currentCardIndex].topic}
                            </span>
                            <span className="material-symbols-outlined text-neutral-400 text-sm group-hover:rotate-180 transition-transform duration-300">
                              flip_to_back
                            </span>
                          </div>

                          {!isCardFlipped ? (
                            <div className="pt-2 space-y-2">
                              <span className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider">
                                Front Prompt
                              </span>
                              <p className="text-xs sm:text-sm font-semibold text-neutral-900 leading-relaxed">
                                {DEFAULT_FLASHCARDS[currentCardIndex].front}
                              </p>
                            </div>
                          ) : (
                            <div className="pt-1 space-y-2 animate-in fade-in">
                              <span className="text-[10px] uppercase font-bold text-emerald-700 tracking-wider flex items-center gap-1">
                                <span className="material-symbols-outlined text-xs">verified</span>
                                Grounded Explanation
                              </span>
                              <p className="text-xs text-neutral-800 leading-relaxed">
                                {DEFAULT_FLASHCARDS[currentCardIndex].back}
                              </p>
                              {DEFAULT_FLASHCARDS[currentCardIndex].formula && (
                                <div className="p-2 bg-neutral-50 rounded-lg border border-neutral-200/70 text-center font-mono text-xs font-semibold text-neutral-900">
                                  {DEFAULT_FLASHCARDS[currentCardIndex].formula}
                                </div>
                              )}
                              <div className="text-[10px] text-neutral-400 flex items-center gap-1 pt-1">
                                <span className="material-symbols-outlined text-xs">menu_book</span>
                                <span>{DEFAULT_FLASHCARDS[currentCardIndex].source}</span>
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="pt-3 border-t border-neutral-100 flex items-center justify-between text-[11px] text-neutral-400">
                          <span>{!isCardFlipped ? 'Tap card to reveal answer' : 'Rate recall difficulty below'}</span>
                          <span className="material-symbols-outlined text-xs">touch_app</span>
                        </div>
                      </div>

                      {/* Spaced Repetition Rating Buttons */}
                      {isCardFlipped ? (
                        <div className="space-y-1.5 animate-in fade-in">
                          <span className="text-[10px] uppercase font-bold text-neutral-400 px-0.5 tracking-wider font-mono">
                            SuperMemo Spaced Intervals
                          </span>
                          <div className="grid grid-cols-4 gap-1.5">
                            <button
                              type="button"
                              className="py-2 px-1 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200/60 text-[11px] font-semibold text-center transition-colors cursor-pointer"
                              onClick={handleRateFlashcard}
                            >
                              <div>Again</div>
                              <div className="text-[9px] font-mono text-rose-600 font-normal">&lt; 10m</div>
                            </button>
                            <button
                              type="button"
                              className="py-2 px-1 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200/60 text-[11px] font-semibold text-center transition-colors cursor-pointer"
                              onClick={handleRateFlashcard}
                            >
                              <div>Hard</div>
                              <div className="text-[9px] font-mono text-amber-600 font-normal">1 day</div>
                            </button>
                            <button
                              type="button"
                              className="py-2 px-1 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200/60 text-[11px] font-semibold text-center transition-colors cursor-pointer"
                              onClick={handleRateFlashcard}
                            >
                              <div>Good</div>
                              <div className="text-[9px] font-mono text-emerald-600 font-normal">3 days</div>
                            </button>
                            <button
                              type="button"
                              className="py-2 px-1 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white text-[11px] font-semibold text-center transition-colors cursor-pointer"
                              onClick={handleRateFlashcard}
                            >
                              <div>Easy</div>
                              <div className="text-[9px] font-mono text-neutral-300 font-normal">7 days</div>
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          className="w-full py-2 px-3 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-xs font-medium transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                          onClick={() => setIsCardFlipped(true)}
                        >
                          <span className="material-symbols-outlined text-sm">visibility</span>
                          <span>Reveal Answer</span>
                        </button>
                      )}
                    </div>
                  )
                )}
              </div>
            )}

            {/* ======================================================== */}
            {/* TAB 5: AUDIO & GUIDE (NotebookLM Deep Dive & Briefing)   */}
            {/* ======================================================== */}
            {studioTab === 'audio' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between px-0.5">
                  <span className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wide font-mono">
                    Audio Deep Dive &amp; Briefing
                  </span>
                  <span className="text-[11px] font-mono text-neutral-400">
                    {materials.length > 0 ? 'Ready' : '0 Sources'}
                  </span>
                </div>

                {materials.length === 0 ? (
                  <div className="p-5 rounded-2xl bg-white border border-neutral-200/80 shadow-xs text-center space-y-3">
                    <div className="w-10 h-10 rounded-xl bg-neutral-100 text-neutral-600 flex items-center justify-center mx-auto">
                      <span className="material-symbols-outlined text-lg">headphones</span>
                    </div>
                    <div className="space-y-1">
                      <h4 className="text-xs font-semibold text-neutral-900">No Audio Deep Dive Generated</h4>
                      <p className="text-[11px] text-neutral-500 leading-relaxed max-w-xs mx-auto">
                        Upload course materials or lecture notes in the left panel to synthesize an interactive conversational audio briefing and executive study guide.
                      </p>
                    </div>
                    <button
                      type="button"
                      className="py-1.5 px-3 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-medium transition-colors inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
                      onClick={() => onSendMessage('Generate an executive audio briefing and study guide based on my uploaded materials.')}
                    >
                      <span className="material-symbols-outlined text-xs">mic</span>
                      <span>Generate Audio Briefing</span>
                    </button>
                  </div>
                ) : (
                  <>
                    {/* NotebookLM Signature Audio Deep Dive Player Card */}
                    <div className="p-3.5 rounded-2xl bg-white border border-neutral-200/80 hover:border-neutral-300 shadow-xs transition-all space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <div className="w-9 h-9 rounded-xl bg-neutral-900 text-white flex items-center justify-center shadow-xs">
                            <span className="material-symbols-outlined text-lg">headphones</span>
                          </div>
                          <div>
                            <h4 className="text-xs font-semibold text-neutral-900 truncate max-w-[170px]">
                              {materials[0]?.title || 'Academic Briefing'}
                            </h4>
                            <p className="text-[10px] text-neutral-400">
                              Conversational overview by 2 AI hosts
                            </p>
                          </div>
                        </div>
                        {/* Play/Pause Button */}
                        <button
                          type="button"
                          className={`px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs ${
                            isPlayingAudio
                              ? 'bg-neutral-900 text-white ring-2 ring-neutral-900/20'
                              : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-800'
                          }`}
                          onClick={() => setIsPlayingAudio(!isPlayingAudio)}
                        >
                          <span className="material-symbols-outlined text-sm">
                            {isPlayingAudio ? 'pause' : 'play_arrow'}
                          </span>
                          <span>{isPlayingAudio ? 'Pause' : 'Play'}</span>
                        </button>
                      </div>

                      {/* Playback Progress Slider */}
                      <div className="space-y-1">
                        <div className="h-1.5 w-full bg-neutral-100 rounded-full overflow-hidden relative cursor-pointer">
                          <div
                            className="h-full bg-neutral-900 rounded-full transition-all duration-300"
                            style={{ width: `${(audioElapsedSeconds / 150) * 100}%` }}
                          />
                        </div>
                        <div className="flex items-center justify-between font-mono text-[10px] text-neutral-400">
                          <span>
                            {Math.floor(audioElapsedSeconds / 60)}:{String(audioElapsedSeconds % 60).padStart(2, '0')}
                          </span>
                          <span>2:30</span>
                        </div>
                      </div>

                      {/* Speed Controls & Equalizer Visualizer */}
                      <div className="flex items-center justify-between pt-1 border-t border-neutral-100">
                        <div className="flex items-center gap-1">
                          {[1.0, 1.25, 1.5].map((speed) => (
                            <button
                              key={speed}
                              type="button"
                              className={`px-2 py-0.5 rounded-md text-[10px] font-mono transition-colors cursor-pointer ${
                                audioSpeed === speed
                                  ? 'bg-neutral-900 text-white font-bold'
                                  : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-600'
                              }`}
                              onClick={() => setAudioSpeed(speed)}
                            >
                              {speed}x
                            </button>
                          ))}
                        </div>

                        {isPlayingAudio && (
                          <div className="flex items-center gap-1">
                            <span className="w-1 h-3.5 bg-emerald-600 rounded-full animate-bounce" />
                            <span className="w-1 h-5 bg-emerald-600 rounded-full animate-pulse" />
                            <span className="w-1 h-2 bg-emerald-600 rounded-full animate-bounce" />
                            <span className="w-1 h-4 bg-emerald-600 rounded-full animate-pulse" />
                            <span className="text-[10px] text-emerald-700 font-mono font-medium ml-1">
                              Live Audio
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Host Dialogue Snippet */}
                      <div className="p-2.5 rounded-xl bg-neutral-50 border border-neutral-200/60 text-[11px] space-y-1.5">
                        <div className="flex items-center gap-1.5 font-semibold text-neutral-800">
                          <span className="w-4 h-4 rounded-full bg-neutral-200 flex items-center justify-center text-[9px] font-mono">
                            A
                          </span>
                          <span>AI Host:</span>
                        </div>
                        <p className="text-neutral-600 italic text-[11px] leading-relaxed">
                          {materials[0]?.chunks?.[0]?.extractedText
                            ? `“${materials[0].chunks[0].extractedText.slice(0, 180)}...”`
                            : `“In this session, we break down core principles and key takeaways from ${materials[0]?.title || 'your materials'}.”`}
                        </p>
                      </div>
                    </div>

                    {/* Module Study Guide Briefing */}
                    <div className="p-3.5 rounded-2xl bg-white border border-neutral-200/80 shadow-xs space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-neutral-900 flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-sm text-neutral-700">
                            summarize
                          </span>
                          Comprehensive Study Guide
                        </span>
                        <span className="text-[10px] text-neutral-400 font-mono">
                          {materials[0]?.courseCode || 'Workspace'}
                        </span>
                      </div>

                      <div className="space-y-2 text-xs">
                        {materials[0]?.chunks && materials[0].chunks.length > 0 ? (
                          materials[0].chunks.slice(0, 3).map((chunk, idx: number) => (
                            <div key={chunk.id || idx} className="p-2 rounded-lg bg-neutral-50 border border-neutral-200/60 space-y-1">
                              <span className="font-semibold text-neutral-900 block text-[11px]">
                                {idx + 1}. {chunk.sectionHeading || chunk.anchorLabel || `Key Section ${idx + 1}`}
                              </span>
                              <p className="text-neutral-600 text-[11px] line-clamp-2">
                                {chunk.extractedText ? `${chunk.extractedText.slice(0, 120)}...` : `Grounded in ${materials[0].title}.`}
                              </p>
                            </div>
                          ))
                        ) : (
                          <div className="p-2 rounded-lg bg-neutral-50 border border-neutral-200/60">
                            <p className="text-neutral-600 text-[11px]">
                              Study guide synthesized from {materials.length} uploaded document{materials.length === 1 ? '' : 's'}.
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* ======================================================== */}
            {/* TAB 6: CHEATSHEET (High-Yield Formulas & Direct Prompts) */}
            {/* ======================================================== */}
            {studioTab === 'cheatsheet' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between px-0.5">
                  <span className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wide font-mono">
                    High-Yield Formula Cheatsheet
                  </span>
                  <span className="text-[11px] text-neutral-400 font-mono">
                    {materials.length > 0 ? `${materials.length} Sources` : '0 Equations'}
                  </span>
                </div>

                {materials.length === 0 ? (
                  <div className="p-5 rounded-2xl bg-white border border-neutral-200/80 shadow-xs text-center space-y-3">
                    <div className="w-10 h-10 rounded-xl bg-neutral-100 text-neutral-600 flex items-center justify-center mx-auto">
                      <span className="material-symbols-outlined text-lg">functions</span>
                    </div>
                    <div className="space-y-1">
                      <h4 className="text-xs font-semibold text-neutral-900">No Formulas Extracted</h4>
                      <p className="text-[11px] text-neutral-500 leading-relaxed max-w-xs mx-auto">
                        Upload lecture slides, problem sets, or papers with mathematical notation to extract a high-yield formula cheatsheet.
                      </p>
                    </div>
                    <button
                      type="button"
                      className="py-1.5 px-3 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-medium transition-colors inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
                      onClick={() =>
                        onSendMessage(
                          'Extract all key formulas, mathematical equations, and notation definitions from my uploaded materials into an organized cheatsheet.'
                        )
                      }
                    >
                      <span className="material-symbols-outlined text-xs">calculate</span>
                      <span>Extract Formulas</span>
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="p-3.5 rounded-2xl bg-white border border-neutral-200/80 shadow-xs space-y-2.5">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-semibold text-neutral-900">
                          {materials[0]?.title || 'Grounded Cheatsheet'}
                        </h4>
                        <span className="px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-600 text-[10px] font-mono">
                          {materials[0]?.courseCode || 'Workspace'}
                        </span>
                      </div>
                      <p className="text-[11px] text-neutral-500 leading-relaxed">
                        Synthesize high-yield equation sheets with notation definitions, derivation steps, and direct AI tutor explanations.
                      </p>
                      <button
                        type="button"
                        className="w-full py-1.5 px-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-medium transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                        onClick={() =>
                          onSendMessage(
                            `Generate a comprehensive formula and mathematical cheatsheet based on ${materials[0]?.title || 'my course materials'}.`
                          )
                        }
                      >
                        <span className="material-symbols-outlined text-xs">functions</span>
                        <span>Extract Cheatsheet from {materials[0]?.title ? 'Document' : 'Workspace'}</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Quick Action: Open Floating Studio Modal */}
            <div className="p-3 rounded-2xl bg-neutral-50 border border-neutral-200/80 space-y-2 shadow-xs mt-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-neutral-700 uppercase tracking-wide">
                  Comprehensive Review
                </span>
                <span className="material-symbols-outlined text-neutral-400 text-sm">open_in_new</span>
              </div>
              <p className="text-[11px] text-neutral-500 leading-relaxed">
                Review quiz history, missed concepts, synthesized notes, and topic analytics in the expanded Studio inspector.
              </p>
              <button
                id="open-studio-inspector-btn"
                type="button"
                className="w-full py-1.5 px-3 bg-neutral-900 text-white hover:bg-neutral-800 rounded-xl text-xs font-medium transition-colors flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                onClick={() => openInspector(studioTab === 'mastery' ? 'mastery' : studioTab === 'library' ? 'notes' : 'quizzes')}
              >
                <span className="material-symbols-outlined text-sm">fullscreen</span>
                <span>Open Studio Inspector</span>
              </button>
            </div>
          </div>
        )}

        {/* Footer Sync State */}
        {!deckCollapsed && (
          <div className="p-2.5 bg-neutral-50 border-t border-neutral-200/70 flex items-center justify-between text-neutral-500 font-mono text-[11px] flex-shrink-0">
            <span>Cloud Sync: Active</span>
            <span className="flex items-center gap-1 text-emerald-700 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
              Studio Ready
            </span>
          </div>
        )}
      </aside>

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
                <span>Quiz History &amp; Missed Questions</span>
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
                <span>Scholarly Notes &amp; Citations</span>
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
                <span>Session Archive</span>
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
                    : '“Upload research papers, lecture slides, or syllabi to view citations, semantic vector chunks, and highlighted passage context.”'}
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
                        Take a targeted drill or ask your AI tutor to generate a formative assessment to populate your quiz diagnostics.
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

              {/* TAB 2: SCHOLARLY NOTES & CITATIONS */}
              {inspectorTab === 'notes' && (
                <div className="p-4 rounded-xl bg-white border border-neutral-200/80 space-y-3 shadow-xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-neutral-900 text-xs sm:text-sm">
                        Scholarly Notes &amp; Citations Archive
                      </span>
                      <span className="font-mono text-[11px] px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-700 font-medium">
                        {materials.length} Sources Loaded
                      </span>
                    </div>
                    {materials.length > 0 && (
                      <button
                        type="button"
                        className="text-neutral-900 hover:underline text-xs font-medium flex items-center gap-1 cursor-pointer"
                        onClick={() => onExportNotes && onExportNotes()}
                      >
                        <span>Export All Notes</span>
                        <span className="material-symbols-outlined text-xs">download</span>
                      </button>
                    )}
                  </div>

                  {materials.length === 0 ? (
                    <div className="p-6 rounded-xl bg-neutral-50 border border-neutral-200/60 text-center space-y-2">
                      <div className="w-9 h-9 rounded-xl bg-neutral-100 text-neutral-500 flex items-center justify-center mx-auto">
                        <span className="material-symbols-outlined text-lg">edit_note</span>
                      </div>
                      <p className="text-xs font-semibold text-neutral-800">No Notes or Sources Recorded</p>
                      <p className="text-[11px] text-neutral-500 max-w-sm mx-auto">
                        Upload lecture slides, PDF readings, or notes to build your citation archive and scholarly takeaways.
                      </p>
                    </div>
                  ) : (
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
                        Upload course materials or complete quick quizzes to generate topic breakdown scores and targeted drills.
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
                            if (effectiveMasteryTopics[0] && onStartQuizForTopic) {
                              onStartQuizForTopic(effectiveMasteryTopics[0].topicId);
                            }
                          }}
                        >
                          Launch 5-min Practice Drill
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
                      Past Study Sessions &amp; Chat History
                    </span>
                    <span className="font-mono text-[11px] text-neutral-400">
                      1 active session
                    </span>
                  </div>
                  <div className="space-y-2">
                    <div className="p-3 rounded-lg bg-neutral-50 border border-neutral-300 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="material-symbols-outlined text-neutral-800 text-base">chat</span>
                        <div>
                          <p className="font-medium text-neutral-900 text-xs">
                            Academic Discussion &amp; Grounding
                          </p>
                          <p className="font-mono text-neutral-400 text-[10px]">
                            {messages.length} messages • {materials.length} docs referenced
                          </p>
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/60 font-mono font-medium text-[10px]">
                        Current Session
                      </span>
                    </div>
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
                  Save All to Notes
                </button>
                <button
                  type="button"
                  className="px-4 py-1.5 bg-neutral-900 text-white hover:bg-neutral-800 rounded-full text-xs font-medium transition-colors shadow-xs cursor-pointer"
                  onClick={() => {
                    closeInspector();
                    if (onStartQuizForTopic) {
                      onStartQuizForTopic('topic-cs229-sgd');
                    }
                  }}
                >
                  Practice Missed Questions
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
