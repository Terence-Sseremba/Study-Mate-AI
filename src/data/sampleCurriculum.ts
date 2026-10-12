import {
  StudentProfile,
  StudyMaterial,
  QuizQuestion,
  QuizAttempt,
  TopicMastery,
  TutorMessage,
} from '../types';

export const INITIAL_STUDENT: StudentProfile = {
  name: '',
  role: 'Active Learner',
  track: 'Personal Study Space',
  currentSprint: 'Active Learning Journey',
  targetExamDate: 'Self-Paced',
  enrolledCourses: [],
};

export const INITIAL_MATERIALS: StudyMaterial[] = [];

export const INITIAL_QUIZ_QUESTIONS: QuizQuestion[] = [];

export const INITIAL_TOPIC_MASTERY: TopicMastery[] = [];

export const INITIAL_QUIZ_ATTEMPTS: QuizAttempt[] = [];

export const INITIAL_TUTOR_MESSAGES: TutorMessage[] = [
  {
    id: 'msg-init-1',
    role: 'assistant',
    text: `Welcome to your personal **StudyMate AI** space!\n\nTo get started:\n1. Upload your lecture slides, notes, or textbook chapters in **Study Materials**.\n2. Once uploaded, I will answer your questions strictly using your course documents with page-level citations.\n\nFeel free to ask questions about study planning or upload your first document to begin.`,
    timestamp: new Date().toISOString(),
    isGroundingVerified: true,
    modelUsed: 'StudyMate Tutor',
    isSimulated: false,
  },
];

export const INITIAL_SUGGESTED_QUESTIONS = [
  {
    topic: 'Getting Started',
    text: 'How does StudyMate AI ground answers in my uploaded course slides?',
    materialId: undefined,
  },
  {
    topic: 'Study Technique',
    text: 'What are the most effective active recall and spaced repetition strategies for exam prep?',
    materialId: undefined,
  },
  {
    topic: 'Course Setup',
    text: 'What types of documents work best for source citation indexing?',
    materialId: undefined,
  },
];
