import React, { useState, useEffect } from 'react';
import { AppShell, SectionType } from './components/layout/AppShell';
import { WorkspaceView } from './components/workspace/WorkspaceView';
import { SourceChunkViewerModal } from './components/common/SourceChunkViewerModal';
import { OnboardingModal } from './components/common/OnboardingModal';
import { TutorPreferencesPanel } from './components/tutor/TutorPreferencesPanel';

import {
  INITIAL_STUDENT,
  INITIAL_MATERIALS,
  INITIAL_QUIZ_QUESTIONS,
  INITIAL_TOPIC_MASTERY,
  INITIAL_QUIZ_ATTEMPTS,
  INITIAL_TUTOR_MESSAGES,
} from './data/sampleCurriculum';

import {
  getStoredUserName,
  setStoredUserName,
  getStoredMaterials,
  setStoredMaterials,
  getStoredAttempts,
  setStoredAttempts,
  getStoredMastery,
  setStoredMastery,
  getStoredTutorPreferences,
  setStoredTutorPreferences,
  getStoredReviewRecords,
  setStoredReviewRecords,
  getStoredTutorInteractionMode,
  setStoredTutorInteractionMode,
  getStoredSessions,
  setStoredSessions,
  getStoredNotes,
  setStoredNotes,
} from './lib/storage';

import { calculateNextReview } from './lib/spacedRepetition';
import {
  deriveTopicNameFromChunk,
  extractOrganizedTopicsFromMaterial,
  isGenericSectionHeading,
  isValidTopicHeading,
} from './lib/documentExtraction';

import type {
  StudyMaterial,
  QuizAttempt,
  TopicMastery,
  TutorMessage,
  SourceCitation,
  TutorInteractionMode,
  StudentProfile,
  TutorPreferences,
  ReviewRecord,
  PracticeMethod,
  TutorSession,
  SavedStudyNote,
} from './types';

function normalizeMaterialsTopics(rawMaterials: StudyMaterial[]): StudyMaterial[] {
  return rawMaterials.map((mat) => {
    if (!Array.isArray(mat.chunks) || mat.chunks.length === 0) return mat;
    let changed = false;
    const normalizedChunks = mat.chunks.map((chunk, idx) => {
      if (
        isGenericSectionHeading(chunk.sectionHeading) ||
        !isValidTopicHeading(chunk.sectionHeading, mat.title)
      ) {
        const derived = deriveTopicNameFromChunk(chunk, idx);
        if (derived && derived !== chunk.sectionHeading) {
          changed = true;
          return { ...chunk, sectionHeading: derived };
        }
      }
      return chunk;
    });
    return changed ? { ...mat, chunks: normalizedChunks } : mat;
  });
}

export default function App() {
  // Default to the Stitch Workspace view!
  const [currentSection, setCurrentSection] = useState<SectionType>('workspace');
  const [activeCourse, setActiveCourse] = useState<string>('Academic Workspace');

  // Student & Onboarding State
  const [student, setStudent] = useState<StudentProfile>(() => {
    const savedName = getStoredUserName();
    return {
      ...INITIAL_STUDENT,
      name: savedName || INITIAL_STUDENT.name,
    };
  });
  const [onboardingOpen, setOnboardingOpen] = useState<boolean>(false);
  const [isFirstVisit, setIsFirstVisit] = useState<boolean>(() => !getStoredUserName());

  // AI Tutor Preferences & Custom Instructions State
  const [tutorPreferences, setTutorPreferences] = useState<TutorPreferences>(() => {
    return getStoredTutorPreferences();
  });
  const [tuneModalOpen, setTuneModalOpen] = useState(false);

  // Learning Resources & Tracking State (loaded safely from storage and normalized for topic headings)
  const [materials, setMaterials] = useState<StudyMaterial[]>(() => {
    const stored = getStoredMaterials();
    const initial = stored.length > 0 ? stored : INITIAL_MATERIALS;
    const normalized = normalizeMaterialsTopics(initial);
    if (stored.length > 0) {
      setStoredMaterials(normalized);
    }
    return normalized;
  });

  const [masteryTopics, setMasteryTopics] = useState<TopicMastery[]>(() => {
    const stored = getStoredMastery();
    return stored.length > 0 ? stored : INITIAL_TOPIC_MASTERY;
  });

  const [quizAttempts, setQuizAttempts] = useState<QuizAttempt[]>(() => {
    const stored = getStoredAttempts();
    return stored.length > 0 ? stored : INITIAL_QUIZ_ATTEMPTS;
  });

  const [reviewRecords, setReviewRecords] = useState<ReviewRecord[]>(() => {
    return getStoredReviewRecords();
  });

  const [questions] = useState(INITIAL_QUIZ_QUESTIONS);
  const [activeSessionId, setActiveSessionId] = useState<string>(() => `session-${Date.now()}`);
  const [tutorMessages, setTutorMessages] = useState<TutorMessage[]>(INITIAL_TUTOR_MESSAGES);
  const [pastSessions, setPastSessions] = useState<TutorSession[]>(() => getStoredSessions());
  const [savedNotes, setSavedNotes] = useState<SavedStudyNote[]>(() => getStoredNotes());
  const [isTutorLoading, setIsTutorLoading] = useState(false);
  const [tutorInteractionMode, setTutorInteractionMode] = useState<TutorInteractionMode>(() =>
    getStoredTutorInteractionMode()
  );

  // Automatically synchronize organized topics from uploaded materials into masteryTopics
  useEffect(() => {
    setMasteryTopics((prevTopics) => {
      const practicedMap = new Map<string, TopicMastery>();
      for (const t of prevTopics) {
        if (
          (t.evidenceCount > 0 || t.status !== 'untested') &&
          isValidTopicHeading(t.topicName)
        ) {
          practicedMap.set(t.topicId, t);
          practicedMap.set(t.topicName.toLowerCase(), t);
        }
      }

      const derivedList: TopicMastery[] = [];
      const seenTopicIds = new Set<string>();
      const seenTopicNames = new Set<string>();

      for (const mat of materials) {
        const matTopics = extractOrganizedTopicsFromMaterial(mat, 5);

        matTopics.forEach((topicName, idx) => {
          const topicId = idx === 0 ? mat.id : `${mat.id}-topic-${idx}`;
          const lowerName = topicName.toLowerCase();
          if (seenTopicIds.has(topicId) || seenTopicNames.has(lowerName)) return;

          const existingPracticed =
            practicedMap.get(topicId) || practicedMap.get(lowerName);

          if (existingPracticed) {
            seenTopicIds.add(existingPracticed.topicId);
            seenTopicNames.add(existingPracticed.topicName.toLowerCase());
            derivedList.push({
              ...existingPracticed,
              topicName,
            });
          } else {
            seenTopicIds.add(topicId);
            seenTopicNames.add(lowerName);
            derivedList.push({
              topicId,
              topicName,
              courseCode: mat.courseCode || 'Uploaded Material',
              masteryPercentage: 0,
              status: 'untested',
              evidenceCount: 0,
              correctCount: 0,
              lastPracticed: mat.uploadedAt || new Date().toISOString(),
              weakSubtopics: [],
              cognitiveStrengths: {
                recall: 0,
                application: 0,
                analysis: 0,
              },
            });
          }
        });
      }

      // Preserve any valid practiced topics whose source material was removed or came from custom quizzes
      for (const t of prevTopics) {
        if (
          (t.evidenceCount > 0 || t.status !== 'untested') &&
          isValidTopicHeading(t.topicName) &&
          !seenTopicIds.has(t.topicId) &&
          !seenTopicNames.has(t.topicName.toLowerCase())
        ) {
          seenTopicIds.add(t.topicId);
          seenTopicNames.add(t.topicName.toLowerCase());
          derivedList.push(t);
        }
      }

      setStoredMastery(derivedList);
      return derivedList;
    });
  }, [materials]);

  // Persist active conversation into pastSessions whenever user messages exist
  useEffect(() => {
    const userMessages = tutorMessages.filter((m) => m.role === 'user');
    if (userMessages.length === 0) return;

    const firstUserText = userMessages[0].text.trim();
    const sessionTitle =
      firstUserText.length > 60 ? `${firstUserText.slice(0, 57)}...` : firstUserText;
    const now = new Date().toISOString();

    setPastSessions((prev) => {
      const existing = prev.find((s) => s.id === activeSessionId);
      const updatedSession: TutorSession = {
        id: activeSessionId,
        title: existing?.title || sessionTitle || 'Study Conversation',
        createdAt: existing?.createdAt || userMessages[0].timestamp || now,
        updatedAt: now,
        messages: tutorMessages,
        interactionMode: tutorInteractionMode,
      };
      const next = [updatedSession, ...prev.filter((s) => s.id !== activeSessionId)].slice(0, 25);
      setStoredSessions(next);
      return next;
    });
  }, [tutorMessages, activeSessionId, tutorInteractionMode]);

  const handleTutorModeChange = (mode: TutorInteractionMode) => {
    setTutorInteractionMode(mode);
    setStoredTutorInteractionMode(mode);
  };

  // Inspector modal state
  const [inspectorModalOpen, setInspectorModalOpen] = useState(false);
  const [inspectedMaterial, setInspectedMaterial] = useState<StudyMaterial | null>(null);
  const [inspectedCitation, setInspectedCitation] = useState<SourceCitation | null>(null);

  // Active contextual routing states
  const [activeMaterialFilter, setActiveMaterialFilter] = useState<string | undefined>(undefined);
  const [tutorInitialPrompt, setTutorInitialPrompt] = useState<string | undefined>(undefined);
  const [preselectedTopicId, setPreselectedTopicId] = useState<string | undefined>(undefined);
  const [preselectedPracticeMethod, setPreselectedPracticeMethod] = useState<PracticeMethod>('active_recall');

  // Server API status state
  const [apiStatus, setApiStatus] = useState<{
    apiKeyConfigured: boolean;
    model: string;
    groundingEngine: string;
  } | null>(null);

  useEffect(() => {
    // Check backend API status safely
    fetch('/api/status')
      .then(async (res) => {
        const contentType = res.headers.get('content-type') || '';
        if (!res.ok || !contentType.includes('application/json')) {
          throw new Error(`Unexpected status response (${res.status})`);
        }
        return res.json();
      })
      .then((data) => {
        setApiStatus({
          apiKeyConfigured: Boolean(data.apiKeyConfigured),
          model: data.model || 'gemini-3.6-flash',
          groundingEngine: data.groundingEngine || 'Local-Semantic-Index + Relevance Gate',
        });
      })
      .catch((err) => {
        console.warn('Backend /api/status check deferred:', err);
        setApiStatus({
          apiKeyConfigured: false,
          model: 'gemini-3.6-flash',
          groundingEngine: 'Local-Semantic-Index (Client fallback)',
        });
      });
  }, []);

  const handleNavigate = (section: SectionType) => {
    setCurrentSection(section);
  };

  // Save / Edit Preferred Name Handler
  const handleSaveName = (newName: string) => {
    setStoredUserName(newName);
    setStudent((prev) => ({
      ...prev,
      name: newName,
    }));
    setOnboardingOpen(false);
    setIsFirstVisit(false);
  };

  const handleOpenEditProfile = () => {
    setIsFirstVisit(false);
    setOnboardingOpen(true);
  };

  // Save AI Tutor Preferences Handler
  const handleSaveTutorPreferences = (newPreferences: TutorPreferences) => {
    setTutorPreferences(newPreferences);
    setStoredTutorPreferences(newPreferences);
    setTuneModalOpen(false);
  };

  // Add material handler
  const handleAddMaterial = (newMaterial: StudyMaterial) => {
    const normalized = normalizeMaterialsTopics([newMaterial])[0];
    const updated = [normalized, ...materials];
    setMaterials(updated);
    setStoredMaterials(updated);
  };

  // Delete material handler
  const handleDeleteMaterial = (materialId: string) => {
    const updated = materials.filter((m) => m.id !== materialId);
    setMaterials(updated);
    setStoredMaterials(updated);
    if (activeMaterialFilter === materialId) {
      setActiveMaterialFilter(undefined);
    }
  };

  // Modal inspection triggers
  const handleInspectMaterial = (material: StudyMaterial) => {
    setInspectedMaterial(material);
    setInspectedCitation(null);
    setInspectorModalOpen(true);
  };

  const handleOpenCitation = (citation: SourceCitation) => {
    const targetMaterial =
      materials.find((m) => m.id === citation.materialId) ||
      materials.find((m) => m.title === citation.materialTitle);
    setInspectedMaterial(targetMaterial || null);
    setInspectedCitation(citation);
    setInspectorModalOpen(true);
  };

  // Tutor interactions
  const handleSelectTopicForTutor = (topicName: string, materialId?: string) => {
    setTutorInitialPrompt(
      `Please explain the key concepts and core details of "${topicName}" using my course materials.`
    );
    if (materialId) setActiveMaterialFilter(materialId);
    setCurrentSection('workspace');
  };

  const handleSelectMaterialForTutor = (material: StudyMaterial) => {
    setActiveMaterialFilter(material.id);
    setTutorInitialPrompt(
      `Provide a structured conceptual overview of ${material.title}.`
    );
    setCurrentSection('workspace');
  };

  const handleStartQuizForTopic = (topicId: string) => {
    setPreselectedTopicId(topicId);
    setPreselectedPracticeMethod('active_recall');
    setCurrentSection('workspace');
  };

  const handleStartSpacedReview = (topicId?: string) => {
    if (topicId) {
      setPreselectedTopicId(topicId);
    } else {
      setPreselectedTopicId(undefined);
    }
    setPreselectedPracticeMethod('spaced_review');
    setCurrentSection('workspace');
  };

  const handleSendMessage = async (
    question: string,
    materialId?: string,
    isRetry = false,
    selectedMaterialIds?: string[]
  ) => {
    if (!isRetry) {
      const userMsg: TutorMessage = {
        id: `msg-user-${Date.now()}`,
        role: 'user',
        text: question,
        timestamp: new Date().toISOString(),
        isGroundingVerified: false,
        interactionMode: tutorInteractionMode,
      };
      setTutorMessages((prev) => [...prev, userMsg]);
    }

    setIsTutorLoading(true);

    try {
      const response = await fetch('/api/tutor/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question,
          materialId,
          selectedMaterialIds,
          materials,
          studentName: student?.name || 'Student',
          mode: tutorInteractionMode,
          interactionMode: tutorInteractionMode,
          history: tutorMessages.filter((message) => !message.errorState).slice(-30),
          preferences: tutorPreferences,
        }),
      });

      const contentType = response.headers.get('content-type') || '';
      const isJson = contentType.includes('application/json');

      if (!response.ok) {
        let serverErrorMsg: string | undefined;
        if (isJson) {
          try {
            const errPayload = await response.json();
            if (typeof errPayload?.error === 'string' && errPayload.error.trim()) {
              serverErrorMsg = errPayload.error.trim();
            }
          } catch {
            // Ignore malformed JSON on error response
          }
        }
        const statusErr: any = new Error(
          serverErrorMsg || `HTTP ${response.status}: Failed to reach tutor API`
        );
        statusErr.status = response.status;
        statusErr.serverMessage = serverErrorMsg;
        throw statusErr;
      }

      if (!isJson) {
        throw new Error('Received non-JSON response from tutor endpoint');
      }

      const data = await response.json();
      const answerText = data.answer || data.text || '';

      const assistantMsg: TutorMessage = {
        id: `msg-assistant-${Date.now()}`,
        role: 'assistant',
        text: answerText,
        timestamp: new Date().toISOString(),
        citations: data.citations || [],
        isGroundingVerified: data.isGroundingVerified ?? (data.citations && data.citations.length > 0),
        sourceLabel:
          data.sourceLabel ||
          (data.citations && data.citations.length > 0
            ? 'Based on Your Study Materials'
            : data.route === 'insufficient'
            ? undefined
            : 'General Knowledge'),
        interactionMode: tutorInteractionMode,
        route: data.route || 'grounded',
        modelUsed: data.model || data.modelUsed || 'StudyMate AI',
        isSimulated: data.isSimulated || false,
      };

      setTutorMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      console.warn('API chat request encountered error:', err);

      const status = err?.status;
      const isTimeout =
        status === 504 ||
        err?.name === 'AbortError' ||
        err?.message?.toLowerCase()?.includes('timeout') ||
        err?.message?.toLowerCase()?.includes('longer than expected');
      const isRateLimit = status === 429;
      const userErrorMessage =
        err?.serverMessage ||
        (isTimeout
          ? 'StudyMate is taking longer than expected. Please try again.'
          : isRateLimit
          ? 'AI usage limit reached. Please try again in a moment.'
          : "StudyMate's AI service is temporarily unavailable. Please retry.");

      const failureMsg: TutorMessage = {
        id: `msg-tutor-err-${Date.now()}`,
        role: 'assistant',
        text: userErrorMessage,
        timestamp: new Date().toISOString(),
        isGroundingVerified: false,
        errorState: true,
        canRetry: true,
        failedQuestion: question,
        failedMaterialFilter: materialId,
        failedSelectedMaterialIds: selectedMaterialIds,
        interactionMode: tutorInteractionMode,
        route: 'error',
      };
      setTutorMessages((prev) => [...prev, failureMsg]);
    } finally {
      setIsTutorLoading(false);
    }
  };

  const handleRetryMessage = async (failedMsg: TutorMessage) => {
    setTutorMessages((prev) => prev.filter((m) => m.id !== failedMsg.id));
    if (failedMsg.failedQuestion) {
      await handleSendMessage(
        failedMsg.failedQuestion,
        failedMsg.failedMaterialFilter,
        true,
        failedMsg.failedSelectedMaterialIds
      );
    }
  };

  const handleClearTutorHistory = () => {
    setActiveSessionId(`session-${Date.now()}`);
    setTutorMessages(INITIAL_TUTOR_MESSAGES);
  };

  const handleNewSession = () => {
    setActiveSessionId(`session-${Date.now()}`);
    setTutorMessages([]);
  };

  const handleSelectSession = (sessionOrId: TutorSession | string) => {
    const session =
      typeof sessionOrId === 'string'
        ? pastSessions.find((s) => s.id === sessionOrId)
        : sessionOrId;
    if (!session) return;
    setActiveSessionId(session.id);
    setTutorMessages(session.messages);
    const mode = session.interactionMode || session.mode;
    if (mode) {
      handleTutorModeChange(mode);
    }
  };

  const handleDeleteSession = (sessionId: string) => {
    setPastSessions((prev) => {
      const next = prev.filter((s) => s.id !== sessionId);
      setStoredSessions(next);
      return next;
    });
    if (activeSessionId === sessionId) {
      setActiveSessionId(`session-${Date.now()}`);
      setTutorMessages([]);
    }
  };

  const handleSaveNote = (note: Omit<SavedStudyNote, 'id' | 'createdAt'>) => {
    const newNote: SavedStudyNote = {
      ...note,
      id: `note-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    setSavedNotes((prev) => {
      const next = [newNote, ...prev];
      setStoredNotes(next);
      return next;
    });
  };

  const handleDeleteNote = (noteId: string) => {
    setSavedNotes((prev) => {
      const next = prev.filter((n) => n.id !== noteId);
      setStoredNotes(next);
      return next;
    });
  };

  // Export Notes to Markdown file
  const handleExportNotes = () => {
    const notesContent = [
      `# StudyMate AI — Research & Synthesis Notes`,
      `Workspace: ${activeCourse}`,
      `Date: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`,
      `Total Sources Indexed: ${materials.length}`,
      ...materials.map((m) => `- ${m.title} (${m.chunksCount} chunks, ${m.fileType.toUpperCase()})`),
      ``,
      ...(savedNotes.length > 0
        ? [
            `---`,
            `## Saved Study Notes (${savedNotes.length})`,
            ...savedNotes.map((n) => `\n### ${n.title}\n${n.content}\n`),
          ]
        : []),
      `---`,
      `## Conversation Thread (${tutorMessages.length} messages)`,
      ...tutorMessages.map(
        (m) => `\n### ${m.role === 'user' ? 'Student' : 'StudyMate AI Tutor'}\n${m.text}\n`
      ),
    ].join('\n');

    const blob = new Blob([notesContent], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'StudyMate_Synthesis_Notes.md');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Complete quiz & dynamically update learner mastery profile
  const handleCompleteQuiz = (attempt: QuizAttempt) => {
    const updatedAttempts = [attempt, ...quizAttempts];
    setQuizAttempts(updatedAttempts);
    setStoredAttempts(updatedAttempts);

    // Dynamically calibrate spaced repetition schedule
    const isSuccess = attempt.percentage >= 70;
    const existingRev = reviewRecords.find((r) => r.topicId === attempt.topicId);
    const updatedRev = calculateNextReview(existingRev, {
      topicId: attempt.topicId,
      topicName: attempt.topicName,
      isSuccess,
      scorePercentage: attempt.percentage,
      materialId: attempt.topicId,
      materialTitle: attempt.topicName,
    });

    const nextReviewRecords = [
      updatedRev,
      ...reviewRecords.filter((r) => r.topicId !== attempt.topicId),
    ];
    setReviewRecords(nextReviewRecords);
    setStoredReviewRecords(nextReviewRecords);

    // Dynamically calibrate target topic mastery in state
    setMasteryTopics((prevTopics) => {
      const existingIdx = prevTopics.findIndex(
        (t) =>
          t.topicId === attempt.topicId ||
          t.topicName.toLowerCase() === attempt.topicName.toLowerCase()
      );
      let nextTopics: TopicMastery[];

      if (existingIdx >= 0) {
        nextTopics = prevTopics.map((topic, idx) => {
          if (idx === existingIdx) {
            const current = topic.evidenceCount > 0 ? topic.masteryPercentage : attempt.percentage;
            const delta =
              topic.evidenceCount > 0 ? Math.round((attempt.percentage - current) * 0.35) : 0;
            const newMastery = Math.min(100, Math.max(10, current + delta));

            let newStatus = topic.status;
            if (newMastery >= 80) newStatus = 'mastered';
            else if (newMastery < 55) newStatus = 'review_needed';
            else newStatus = 'in_progress';

            return {
              ...topic,
              masteryPercentage: newMastery,
              status: newStatus,
              evidenceCount: topic.evidenceCount + attempt.totalQuestions,
              correctCount: topic.correctCount + attempt.score,
              lastPracticed: new Date().toISOString(),
            };
          }
          return topic;
        });
      } else {
        const newEntry: TopicMastery = {
          topicId: attempt.topicId,
          topicName: attempt.topicName,
          courseCode: activeCourse || 'Workspace',
          masteryPercentage: attempt.percentage,
          status:
            attempt.percentage >= 80
              ? 'mastered'
              : attempt.percentage < 55
              ? 'review_needed'
              : 'in_progress',
          evidenceCount: attempt.totalQuestions,
          correctCount: attempt.score,
          lastPracticed: new Date().toISOString(),
          weakSubtopics: attempt.percentage < 70 ? ['Review required from quiz feedback'] : [],
          cognitiveStrengths: {
            recall: Math.min(100, attempt.percentage + 5),
            application: attempt.percentage,
            analysis: Math.max(10, attempt.percentage - 10),
          },
        };
        nextTopics = [newEntry, ...prevTopics];
      }

      setStoredMastery(nextTopics);
      return nextTopics;
    });
  };

  return (
    <>
      <AppShell
        currentSection={currentSection}
        onNavigate={handleNavigate}
        student={student}
        materialsCount={materials.length}
        completedAssessmentsCount={quizAttempts.length}
        apiStatus={apiStatus}
        onEditProfile={handleOpenEditProfile}
        interactionMode={tutorInteractionMode}
        onModeChange={handleTutorModeChange}
        onNewSession={handleNewSession}
        onResetSession={handleClearTutorHistory}
        onExportNotes={handleExportNotes}
        onOpenTune={() => setTuneModalOpen(true)}
        activeCourse={activeCourse}
        onSelectCourse={setActiveCourse}
      >
        <WorkspaceView
          preferredName={isFirstVisit ? undefined : student.name}
          materials={materials}
          messages={tutorMessages}
          onSendMessage={handleSendMessage}
          onRetryMessage={handleRetryMessage}
          onAddMaterial={handleAddMaterial}
          onDeleteMaterial={handleDeleteMaterial}
          onOpenCitation={handleOpenCitation}
          onInspectMaterial={handleInspectMaterial}
          isLoading={isTutorLoading}
          interactionMode={tutorInteractionMode}
          onModeChange={handleTutorModeChange}
          quizAttempts={quizAttempts}
          masteryTopics={masteryTopics}
          questions={questions}
          reviewRecords={reviewRecords}
          onCompleteQuiz={handleCompleteQuiz}
          initialQuestionPrompt={tutorInitialPrompt}
          onStartQuizForTopic={handleStartQuizForTopic}
          onClearSession={handleClearTutorHistory}
          onNewSession={handleNewSession}
          pastSessions={pastSessions}
          activeSessionId={activeSessionId}
          onSelectSession={handleSelectSession}
          onDeleteSession={handleDeleteSession}
          savedNotes={savedNotes}
          onSaveNote={handleSaveNote}
          onDeleteNote={handleDeleteNote}
          onTuneClick={() => setTuneModalOpen(true)}
          onExportNotes={handleExportNotes}
          activeMaterialFilter={activeMaterialFilter}
          onMaterialFilterChange={setActiveMaterialFilter}
          preselectedTopicId={preselectedTopicId}
          onClearPreselectedTopic={() => setPreselectedTopicId(undefined)}
          preselectedPracticeMethod={preselectedPracticeMethod}
        />

        {/* Global Source Chunk & Verifiable Citation Inspector Modal */}
        <SourceChunkViewerModal
          isOpen={inspectorModalOpen}
          onClose={() => setInspectorModalOpen(false)}
          material={inspectedMaterial}
          selectedChunk={inspectedCitation}
        />
      </AppShell>

      {/* Tutor Persona / Tuning Modal */}
      {tuneModalOpen && (
        <div className="fixed inset-0 z-50 bg-on-background/40 backdrop-blur flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest max-w-xl w-full rounded-2xl shadow-2xl border border-outline-variant/40 overflow-hidden animate-in zoom-in-95 duration-150">
            <TutorPreferencesPanel
              preferences={tutorPreferences}
              onSavePreferences={handleSaveTutorPreferences}
              onClose={() => setTuneModalOpen(false)}
            />
          </div>
        </div>
      )}

      {/* Onboarding & Edit Preferred Name Modal */}
      <OnboardingModal
        isOpen={onboardingOpen}
        initialName={student.name}
        isFirstVisit={isFirstVisit}
        onSaveName={handleSaveName}
        onClose={() => setOnboardingOpen(false)}
      />
    </>
  );
}
