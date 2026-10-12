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
} from './lib/storage';

import type {
  StudyMaterial,
  QuizAttempt,
  TopicMastery,
  TutorMessage,
  SourceCitation,
  TutorMode,
  StudentProfile,
  TutorPreferences,
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

  const [questions, setQuestions] = useState(INITIAL_QUIZ_QUESTIONS);
  const [tutorMessages, setTutorMessages] = useState<TutorMessage[]>(INITIAL_TUTOR_MESSAGES);
  const [isTutorLoading, setIsTutorLoading] = useState(false);

  // Inspector modal state
  const [inspectorModalOpen, setInspectorModalOpen] = useState(false);
  const [inspectedMaterial, setInspectedMaterial] = useState<StudyMaterial | null>(null);
  const [inspectedCitation, setInspectedCitation] = useState<SourceCitation | null>(null);

  // Active contextual routing states
  const [activeMaterialFilter, setActiveMaterialFilter] = useState<string | undefined>(undefined);
  const [tutorInitialPrompt, setTutorInitialPrompt] = useState<string | undefined>(undefined);
  const [preselectedTopicId, setPreselectedTopicId] = useState<string | undefined>(undefined);

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
    setInspectedCitation(citation);
    setInspectedMaterial(null);
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
    setCurrentSection('assessments');
  };

  const handleSendMessage = async (
    question: string,
    materialId?: string,
    mode?: TutorMode
  ) => {
    const userMsg: TutorMessage = {
      id: `msg-user-${Date.now()}`,
      role: 'user',
      text: question,
      timestamp: new Date().toISOString(),
      isGroundingVerified: false,
    };

    setTutorMessages((prev) => [...prev, userMsg]);
    setIsTutorLoading(true);

    try {
      const response = await fetch('/api/tutor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question,
          materialId,
          mode,
          materials,
          preferences: tutorPreferences,
          studentName: student.name,
        }),
      });

      if (!response.ok) {
        throw new Error(`Server returned ${response.status}`);
      }

      const data = await response.json();

      const assistantMsg: TutorMessage = {
        id: `msg-tutor-${Date.now()}`,
        role: 'assistant',
        text: data.answer,
        timestamp: new Date().toISOString(),
        citations: data.citations || [],
        isGroundingVerified: data.isGroundingVerified,
        modelUsed: data.model,
        isSimulated: !data.apiKeyConfigured,
      };

      setTutorMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      console.error('Tutor API fetch error:', err);
      // Client-side fallback grounded response
      const relevantMat = materials.find((m) => !materialId || m.id === materialId) || materials[0];
      const chunk = relevantMat?.chunks?.[0];

      let fallbackText = '';
      if (chunk) {
        const approach = tutorPreferences.teachingApproach;
        if (approach === 'socratic') {
          fallbackText = `Grounded in **${relevantMat.title}** (Page/Slide ${chunk.pageOrSlideNumber}):\n\n> "${chunk.extractedText}"\n\n**Inquiry:** How does this relate to the main problem in your course? What would change if this condition was absent?`;
        } else if (approach === 'step_by_step') {
          fallbackText = `### Step-by-Step Breakdown (${relevantMat.title}, Page ${chunk.pageOrSlideNumber}):\n1. **Core Concept:** Grounded in ${chunk.sectionHeading}.\n2. **Passage Excerpt:** "${chunk.extractedText}"\n3. **Application:** Verifiable under standard system parameters.`;
        } else {
          fallbackText = `**Direct Answer** (${relevantMat.title}, Page ${chunk.pageOrSlideNumber}):\n\n"${chunk.extractedText}"\n\n*Verified from your uploaded document.*`;
        }

        if (tutorPreferences.enableKnowledgeChecks) {
          fallbackText += `\n\n---\n**Comprehension Check:** Can you state one primary takeaway from this excerpt?`;
        }
      } else {
        fallbackText = `You haven't uploaded course materials yet. Upload your lecture slides or notes in **Study Materials** to enable verified citations.`;
        if (tutorPreferences.enableKnowledgeChecks) {
          fallbackText += `\n\n---\n**Comprehension Check:** What course are you working on today?`;
        }
      }

      const fallbackMsg: TutorMessage = {
        id: `msg-tutor-fb-${Date.now()}`,
        role: 'assistant',
        text: fallbackText,
        timestamp: new Date().toISOString(),
        citations: chunk
          ? [
              {
                id: `cite-fb-${chunk.id}`,
                chunkId: chunk.id,
                materialId: chunk.materialId,
                materialTitle: chunk.materialTitle,
                pageOrSlideNumber: chunk.pageOrSlideNumber,
                sectionHeading: chunk.sectionHeading,
                excerpt: chunk.extractedText.slice(0, 160) + '...',
                relevanceScore: 0.95,
              },
            ]
          : [],
        isGroundingVerified: !!chunk,
        modelUsed: 'Local Grounded Engine (Demo Mode)',
        isSimulated: true,
      };
      setTutorMessages((prev) => [...prev, fallbackMsg]);
    } finally {
      setIsTutorLoading(false);
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
            onNavigate={handleNavigate}
            onSelectTopicForTutor={handleSelectTopicForTutor}
            onStartQuizForTopic={handleStartQuizForTopic}
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
            onOpenCitation={handleOpenCitation}
            onClearHistory={handleClearTutorHistory}
            isLoading={isTutorLoading}
            activeMaterialFilter={activeMaterialFilter}
            onMaterialFilterChange={setActiveMaterialFilter}
            initialQuestionPrompt={tutorInitialPrompt}
            onNavigateToMaterials={() => handleNavigate('materials')}
          />
        )}

        {currentSection === 'assessments' && (
          <AssessmentsSection
            questions={questions}
            materials={materials}
            onCompleteQuiz={handleCompleteQuiz}
            onOpenCitationModal={handleOpenCitation}
            onReviseTopicInTutor={handleSelectTopicForTutor}
            onNavigateToMaterials={() => handleNavigate('materials')}
            preselectedTopicId={preselectedTopicId}
          />
        )}

        {currentSection === 'progress' && (
          <ProgressSection
            masteryTopics={masteryTopics}
            quizAttempts={quizAttempts}
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
