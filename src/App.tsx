import React, { useState, useEffect } from 'react';
import { AppShell, SectionType } from './components/layout/AppShell';
import { DashboardSection } from './components/dashboard/DashboardSection';
import { MaterialsSection } from './components/materials/MaterialsSection';
import { TutorSection } from './components/tutor/TutorSection';
import { AssessmentsSection } from './components/assessments/AssessmentsSection';
import { ProgressSection } from './components/progress/ProgressSection';
import { SourceChunkViewerModal } from './components/common/SourceChunkViewerModal';
import { OnboardingModal } from './components/common/OnboardingModal';

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
  TutorMode,
  TutorInteractionMode,
  StudentProfile,
  TutorPreferences,
  ReviewRecord,
  PracticeMethod,
} from './types';

export default function App() {
  const [currentSection, setCurrentSection] = useState<SectionType>('dashboard');

  // Student & Onboarding State
  const [student, setStudent] = useState<StudentProfile>(() => {
    const savedName = getStoredUserName();
    return {
      ...INITIAL_STUDENT,
      name: savedName || '',
    };
  });
  const [onboardingOpen, setOnboardingOpen] = useState<boolean>(() => {
    return !getStoredUserName();
  });
  const [isFirstVisit, setIsFirstVisit] = useState<boolean>(() => {
    return !getStoredUserName();
  });

  // AI Tutor Preferences & Custom Instructions State
  const [tutorPreferences, setTutorPreferences] = useState<TutorPreferences>(() => {
    return getStoredTutorPreferences();
  });

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
    setCurrentSection('tutor');
  };

  const handleSelectMaterialForTutor = (material: StudyMaterial) => {
    setActiveMaterialFilter(material.id);
    setTutorInitialPrompt(
      `Provide a structured high-yield conceptual overview of ${material.title}.`
    );
    setCurrentSection('tutor');
  };

  const handleStartQuizForTopic = (topicId: string) => {
    setPreselectedTopicId(topicId);
    setPreselectedPracticeMethod('active_recall');
    setCurrentSection('assessments');
  };

  const handleStartSpacedReview = (topicId?: string) => {
    if (topicId) {
      setPreselectedTopicId(topicId);
    } else {
      setPreselectedTopicId(undefined);
    }
    setPreselectedPracticeMethod('spaced_review');
    setCurrentSection('assessments');
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
      const response = await fetch('/api/tutor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question,
          materialId,
          mode: tutorInteractionMode,
          materials,
          preferences: tutorPreferences,
          studentName: student.name,
        }),
      });

      // Robust response parsing: verify Content-Type before calling .json()
      const contentType = response.headers.get('content-type') || '';
      let data: any = null;

      if (contentType.includes('application/json')) {
        try {
          data = await response.json();
        } catch {
          data = null;
        }
      } else {
        // Non-JSON response (e.g., HTML 502/504 gateway error from proxy/server)
        const rawText = await response.text().catch(() => '');
        console.warn('Received non-JSON response from /api/tutor:', response.status, rawText.slice(0, 80));
      }

      // Check for error status codes or structured error responses
      if (!response.ok || data?.route === 'error' || data?.error) {
        let errorText = 'The AI service is temporarily unavailable.';

        if (response.status === 504 || response.status === 408 || data?.isTimeout) {
          errorText = 'StudyMate is taking longer than expected. Please try again.';
        } else if (response.status === 429 || data?.isRateLimit) {
          errorText = 'AI usage limit reached. Please try again when service is available.';
        } else if (response.status === 503 || data?.isBusyError) {
          errorText = 'The AI service is temporarily unavailable.';
        } else if (data?.error && typeof data.error === 'string') {
          errorText = data.error;
        } else {
          errorText = 'StudyMate\'s AI service is temporarily unavailable. Please retry.';
        }

        const errorMsg: TutorMessage = {
          id: `msg-tutor-err-${Date.now()}`,
          role: 'assistant',
          text: errorText,
          timestamp: new Date().toISOString(),
          isGroundingVerified: false,
          errorState: true,
          canRetry: true,
          failedQuestion: question,
          failedMaterialFilter: materialId,
          interactionMode: tutorInteractionMode,
          route: 'error',
        };
        setTutorMessages((prev) => [...prev, errorMsg]);
        return;
      }

      // Successful response from /api/tutor
      const route = data?.route;
      const isGrounded = route === 'grounded' || (Boolean(data?.isGroundingVerified) && (data?.citations?.length || 0) > 0);

      const assistantMsg: TutorMessage = {
        id: `msg-tutor-${Date.now()}`,
        role: 'assistant',
        text: data?.answer || "I couldn't generate a response for that question.",
        timestamp: new Date().toISOString(),
        citations: isGrounded ? (data?.citations || []) : [],
        isGroundingVerified: isGrounded,
        sourceLabel: isGrounded
          ? 'Based on Your Study Materials'
          : route === 'general' || data?.sourceLabel === 'General Knowledge' || data?.sourceLabel === 'General AI Knowledge'
          ? 'General Knowledge'
          : undefined,
        interactionMode: tutorInteractionMode,
        route: route || (isGrounded ? 'grounded' : 'general'),
        modelUsed: data?.model,
        isSimulated: !data?.apiKeyConfigured,
      };

      setTutorMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      console.error('Tutor API fetch error:', err);

      // Graceful error state: NEVER disguise an API or network failure as an unrelated grounded answer!
      const isTimeout =
        String(err?.message || '').toLowerCase().includes('timeout') ||
        String(err?.message || '').toLowerCase().includes('timed out');

      const userErrorMessage = isTimeout
        ? 'StudyMate is taking longer than expected. Please try again.'
        : 'StudyMate\'s AI service is temporarily unavailable. Please retry.';

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
    // Remove the failed error message to avoid duplicate errors in the thread
    setTutorMessages((prev) => prev.filter((m) => m.id !== failedMsg.id));
    if (failedMsg.failedQuestion) {
      await handleSendMessage(failedMsg.failedQuestion, failedMsg.failedMaterialFilter, true);
    }
  };

  const handleClearTutorHistory = () => {
    setTutorMessages(INITIAL_TUTOR_MESSAGES);
  };

  // Complete quiz & dynamically update learner mastery profile
  const handleCompleteQuiz = (attempt: QuizAttempt) => {
    const updatedAttempts = [attempt, ...quizAttempts];
    setQuizAttempts(updatedAttempts);
    setStoredAttempts(updatedAttempts);

    // Dynamically calibrate spaced repetition schedule using calculateNextReview
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
        // Create new topic mastery entry for this newly tested topic
        const newEntry: TopicMastery = {
          topicId: attempt.topicId,
          topicName: attempt.topicName,
          courseCode: 'COURSE',
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
      >
        {currentSection === 'dashboard' && (
          <DashboardSection
            student={student}
            materials={materials}
            masteryTopics={masteryTopics}
            recentAttempts={quizAttempts}
            reviewRecords={reviewRecords}
            onNavigate={handleNavigate}
            onSelectTopicForTutor={handleSelectTopicForTutor}
            onStartQuizForTopic={handleStartQuizForTopic}
            onStartSpacedReview={handleStartSpacedReview}
          />
        )}

        {currentSection === 'materials' && (
          <MaterialsSection
            materials={materials}
            onAddMaterial={handleAddMaterial}
            onDeleteMaterial={handleDeleteMaterial}
            onInspectMaterial={handleInspectMaterial}
            onSelectMaterialForTutor={handleSelectMaterialForTutor}
          />
        )}

        {currentSection === 'tutor' && (
          <TutorSection
            materials={materials}
            messages={tutorMessages}
            preferences={tutorPreferences}
            onSavePreferences={handleSaveTutorPreferences}
            onSendMessage={handleSendMessage}
            onRetryMessage={handleRetryMessage}
            onOpenCitation={handleOpenCitation}
            onClearHistory={handleClearTutorHistory}
            isLoading={isTutorLoading}
            activeMaterialFilter={activeMaterialFilter}
            onMaterialFilterChange={setActiveMaterialFilter}
            interactionMode={tutorInteractionMode}
            onModeChange={handleTutorModeChange}
            initialQuestionPrompt={tutorInitialPrompt}
            onNavigateToMaterials={() => handleNavigate('materials')}
          />
        )}

        {currentSection === 'assessments' && (
          <AssessmentsSection
            questions={questions}
            materials={materials}
            reviewRecords={reviewRecords}
            onCompleteQuiz={handleCompleteQuiz}
            onOpenCitationModal={handleOpenCitation}
            onReviseTopicInTutor={handleSelectTopicForTutor}
            onNavigateToMaterials={() => handleNavigate('materials')}
            preselectedTopicId={preselectedTopicId}
            preselectedPracticeMethod={preselectedPracticeMethod}
          />
        )}

        {currentSection === 'progress' && (
          <ProgressSection
            masteryTopics={masteryTopics}
            quizAttempts={quizAttempts}
            reviewRecords={reviewRecords}
            onReviseInTutor={handleSelectTopicForTutor}
            onTakeQuizForTopic={handleStartQuizForTopic}
          />
        )}

        {/* Global Source Chunk & Verifiable Citation Inspector Modal */}
        <SourceChunkViewerModal
          isOpen={inspectorModalOpen}
          onClose={() => setInspectorModalOpen(false)}
          material={inspectedMaterial}
          selectedChunk={inspectedCitation}
        />
      </AppShell>

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
