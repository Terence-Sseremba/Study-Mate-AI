/**
 * StudyMate AI — Core TypeScript Contracts
 * Designed for Multimodal AI Hackathon 2026, Track D
 */

export type DocumentType =
  | 'pdf'
  | 'docx'
  | 'pptx'
  | 'md'
  | 'txt'
  | 'slides'
  | 'notes'
  | 'textbook';

export type ProcessingStatus =
  | 'uploaded'
  | 'parsing'
  | 'indexed'
  | 'partially_extracted'
  | 'failed'
  | 'error'
  | 'prototype_staged';

export interface SourceChunk {
  id: string;
  materialId: string;
  materialTitle: string;
  filename?: string;
  documentType?: DocumentType;
  chunkIndex?: number;
  pageNumber?: number; // Genuine page number (PDF only)
  slideNumber?: number; // Genuine slide number (PPTX only)
  pageOrSlideNumber?: number; // Backward compatibility with existing components
  sectionHeading: string;
  anchorLabel: string; // Honest source anchor: "Page 2", "Slide 4", "Word Document — Section 1", "Markdown — ## Intro", "Chunk 3"
  extractedText: string; // VERBATIM source text
  tokenEstimate?: number;
  confidenceScore?: number;
}

export interface StudyMaterial {
  id: string;
  title: string;
  filename: string;
  fileType: DocumentType;
  fileExtension?: string;
  mimeType?: string;
  fileSizeBytes?: number;
  fileSizeFormatted: string;
  pageCount?: number; // Real page count for PDFs only
  slideCount?: number; // Real slide count for PPTX only
  chunksCount: number;
  uploadedAt: string;
  courseCode: string;
  courseName: string;
  processingStatus: ProcessingStatus;
  statusMessage?: string;
  extractionError?: string;
  chunks: SourceChunk[];
  isDemoSample?: boolean;
}

export interface SourceCitation {
  id: string;
  chunkId: string;
  materialId: string;
  materialTitle: string;
  pageOrSlideNumber?: number;
  pageNumber?: number;
  slideNumber?: number;
  anchorLabel?: string;
  sectionHeading: string;
  excerpt: string;
  relevanceScore: number; // 0.0 - 1.0
}

export type TutorRole = 'user' | 'assistant' | 'system';

export type TeachingApproach = 'socratic' | 'step_by_step' | 'direct';
export type TutorDifficulty = 'beginner' | 'intermediate' | 'advanced';
export type InteractionStyle = 'gentle' | 'balanced' | 'rigorous';
export type ExplanationLength = 'concise' | 'detailed';

export interface TutorPreferences {
  teachingApproach: TeachingApproach;
  difficultyLevel: TutorDifficulty;
  interactionStyle: InteractionStyle;
  explanationLength: ExplanationLength;
  enableKnowledgeChecks: boolean;
  customInstructions: string;
}

export type TutorMode = 'socratic' | 'deep_dive' | 'exam_summary';

export interface TutorMessage {
  id: string;
  role: TutorRole;
  text: string;
  timestamp: string;
  citations?: SourceCitation[];
  isGroundingVerified: boolean;
  modelUsed?: string;
  isSimulated?: boolean;
  topicRef?: string;
}

export type DifficultyLevel = 'foundational' | 'intermediate' | 'advanced';

export interface QuizQuestion {
  id: string;
  topicId: string;
  topicName: string;
  questionText: string;
  options: string[];
  correctOptionIndex: number;
  explanation: string;
  difficulty: DifficultyLevel;
  sourceReference: {
    materialTitle: string;
    pageOrSlideNumber?: number;
    anchorLabel?: string;
    quoteExcerpt: string;
  };
}

export interface QuizAttempt {
  id: string;
  quizTitle: string;
  topicId: string;
  topicName: string;
  difficulty: DifficultyLevel;
  totalQuestions: number;
  score: number;
  percentage: number;
  completedAt: string;
  userAnswers: Record<string, number>; // questionId -> selectedIndex
  timeSpentSeconds: number;
  isDemoSample?: boolean;
}

export type PracticeMethod =
  | 'active_recall'
  | 'concept_explanation'
  | 'mixed_practice'
  | 'spaced_review';

export interface ReviewRecord {
  topicId: string;
  topicName: string;
  materialId?: string;
  materialTitle?: string;
  sourceReference?: {
    materialTitle: string;
    pageOrSlideNumber: number;
    quoteExcerpt?: string;
  };
  lastReviewedAt: string;
  nextReviewDueAt: string;
  consecutiveSuccessCount: number;
  totalAttempts: number;
  correctAttempts: number;
  lastScorePercentage: number;
  lastResult: 'pass' | 'fail';
  intervalDays?: number;
  easeFactor?: number;
}

export type MasteryStatus = 'mastered' | 'in_progress' | 'review_needed' | 'untested';

export interface TopicMastery {
  topicId: string;
  topicName: string;
  courseCode: string;
  masteryPercentage: number;
  status: MasteryStatus;
  evidenceCount: number; // total questions & interactive evaluations
  correctCount: number;
  lastPracticed: string;
  weakSubtopics: string[];
  cognitiveStrengths: {
    recall: number; // 0-100
    application: number; // 0-100
    analysis: number; // 0-100
  };
}

export interface StudentProfile {
  name: string;
  role: string;
  track: string;
  currentSprint: string;
  targetExamDate: string;
  enrolledCourses: Array<{
    code: string;
    name: string;
    materialsCount: number;
  }>;
}

export interface GroundedAnswerRequest {
  question: string;
  materialId?: string;
  mode?: TutorMode;
  courseFilter?: string;
}

export interface GroundedAnswerResponse {
  answer: string;
  citations: SourceCitation[];
  isGroundingVerified: boolean;
  model: string;
  apiKeyConfigured: boolean;
}
