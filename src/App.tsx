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
} from './lib/storage';

import { calculateNextReview } from './lib/spacedRepetition';

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
} from './types';

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

  // Learning Resources & Tracking State (loaded safely from storage)
  const [materials, setMaterials] = useState<StudyMaterial[]>(() => {
    const stored = getStoredMaterials();
    return stored.length > 0 ? stored : INITIAL_MATERIALS;
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

  const [questions, setQuestions] = useState(INITIAL_QUIZ_QUESTIONS);
  const [tutorMessages, setTutorMessages] = useState<TutorMessage[]>(INITIAL_TUTOR_MESSAGES);
  const [isTutorLoading, setIsTutorLoading] = useState(false);
  const [tutorInteractionMode, setTutorInteractionMode] = useState<TutorInteractionMode>(() =>
    getStoredTutorInteractionMode()
  );

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
    // Check backend API status
    fetch('/api/status')
      .then((res) => res.json())
      .then((data) => {
        setApiStatus({
          apiKeyConfigured: data.apiKeyConfigured,
          model: data.model,
          groundingEngine: data.groundingEngine,
        });
      })
      .catch((err) => {
        console.warn('Backend /api/status check deferred:', err);
        setApiStatus({
          apiKeyConfigured: false,
          model: 'gemini-3.8-flash',
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
    const updated = [newMaterial, ...materials];
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
    const targetMaterial = materials.find((m) => m.id === citation.materialId);
    setInspectedMaterial(targetMaterial || null);
    setInspectedCitation(citation);
    setInspectorModalOpen(true);
  };

  // Tutor interactions
  const handleSelectTopicForTutor = (topicName: string, materialId?: string) => {
    setTutorInitialPrompt(
      `Please explain the foundational concepts and potential failure modes of "${topicName}" using my course materials.`
    );
    if (materialId) setActiveMaterialFilter(materialId);
    setCurrentSection('workspace');
  };

  const handleSelectMaterialForTutor = (material: StudyMaterial) => {
    setActiveMaterialFilter(material.id);
    setTutorInitialPrompt(
      `Provide a structured high-yield conceptual overview of ${material.title}.`
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
    isRetry = false
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
          materials,
          studentName: student?.name || 'Student',
          mode: tutorInteractionMode,
          interactionMode: tutorInteractionMode,
          history: tutorMessages.slice(-6),
          preferences: tutorPreferences,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: Failed to reach tutor API`);
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
            : 'General Knowledge'),
        interactionMode: tutorInteractionMode,
        route: data.route || 'grounded',
        modelUsed: data.model || data.modelUsed || 'StudyMate AI',
        isSimulated: data.isSimulated || false,
      };

      setTutorMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      console.warn('API chat request encountered error, generating fallback grounding:', err);

      const isTimeout = err?.name === 'AbortError' || err?.message?.includes('timeout');
      const userErrorMessage = isTimeout
        ? 'StudyMate is taking longer than expected. Please try again.'
        : "StudyMate's AI service is temporarily unavailable. Please retry.";

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
      await handleSendMessage(failedMsg.failedQuestion, failedMsg.failedMaterialFilter, true);
    }
  };

  const handleClearTutorHistory = () => {
    setTutorMessages(INITIAL_TUTOR_MESSAGES);
  };

  const handleNewSession = () => {
    setTutorMessages([
      {
        id: `msg-new-session-${Date.now()}`,
        role: 'assistant',
        text: `Welcome to a new study session for **${activeCourse}**!\n\nI am actively grounded in your **${materials.length} indexed documents**. Ask me any question, explore mathematical proofs, or quiz yourself on key concepts.`,
        timestamp: new Date().toISOString(),
        isGroundingVerified: true,
        modelUsed: 'StudyMate-Neural-v3.2',
      },
    ]);
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
      const existingIdx = prevTopics.findIndex((t) => t.topicId === attempt.topicId);
      let nextTopics: TopicMastery[];

      if (existingIdx >= 0) {
        nextTopics = prevTopics.map((topic, idx) => {
          if (idx === existingIdx) {
            const current = topic.masteryPercentage;
            const delta = Math.round((attempt.percentage - current) * 0.3);
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
