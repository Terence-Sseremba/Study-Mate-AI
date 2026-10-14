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
  track: 'Academic Workspace',
  currentSprint: 'General Studies',
  targetExamDate: 'Upcoming',
  enrolledCourses: [],
};

export const INITIAL_MATERIALS: StudyMaterial[] = [];

export const INITIAL_TUTOR_MESSAGES: TutorMessage[] = [];

export const INITIAL_QUIZ_ATTEMPTS: QuizAttempt[] = [];

export const INITIAL_QUIZ_QUESTIONS: QuizQuestion[] = [];

export const INITIAL_TOPIC_MASTERY: TopicMastery[] = [];

export const INITIAL_SUGGESTED_QUESTIONS: { topic: string; text: string; materialId?: string }[] = [];
