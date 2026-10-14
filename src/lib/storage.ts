import { StudyMaterial, QuizAttempt, TopicMastery, QuizQuestion } from '../types';

const STORAGE_KEY_NAME = 'studymate_user_name';
const STORAGE_KEY_MATERIALS = 'studymate_materials';
const STORAGE_KEY_ATTEMPTS = 'studymate_attempts';
const STORAGE_KEY_MASTERY = 'studymate_mastery';
const STORAGE_KEY_QUESTIONS = 'studymate_questions';

/**
 * Safely accesses localStorage with fallback for SSR or restricted environments.
 */
function isStorageAvailable(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const testKey = '__sm_test__';
    window.localStorage.setItem(testKey, testKey);
    window.localStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

export function getStoredUserName(): string | null {
  if (!isStorageAvailable()) return null;
  try {
    const val = window.localStorage.getItem(STORAGE_KEY_NAME);
    return val && val.trim().length > 0 ? val.trim() : null;
  } catch {
    return null;
  }
}

export function setStoredUserName(name: string): boolean {
  if (!isStorageAvailable()) return false;
  try {
    window.localStorage.setItem(STORAGE_KEY_NAME, name.trim());
    return true;
  } catch {
    return false;
  }
}

export function getStoredMaterials(): StudyMaterial[] {
  if (!isStorageAvailable()) return [];
  try {
    const data = window.localStorage.getItem(STORAGE_KEY_MATERIALS);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function setStoredMaterials(materials: StudyMaterial[]): void {
  if (!isStorageAvailable()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY_MATERIALS, JSON.stringify(materials));
  } catch {
    // Ignore quota or private storage errors
  }
}

export function getStoredAttempts(): QuizAttempt[] {
  if (!isStorageAvailable()) return [];
  try {
    const data = window.localStorage.getItem(STORAGE_KEY_ATTEMPTS);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function setStoredAttempts(attempts: QuizAttempt[]): void {
  if (!isStorageAvailable()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY_ATTEMPTS, JSON.stringify(attempts));
  } catch {
    // Ignore quota or private storage errors
  }
}

export function getStoredMastery(): TopicMastery[] {
  if (!isStorageAvailable()) return [];
  try {
    const data = window.localStorage.getItem(STORAGE_KEY_MASTERY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function setStoredMastery(mastery: TopicMastery[]): void {
  if (!isStorageAvailable()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY_MASTERY, JSON.stringify(mastery));
  } catch {
    // Ignore quota or private storage errors
  }
}

export function getStoredQuestions(): QuizQuestion[] {
  if (!isStorageAvailable()) return [];
  try {
    const data = window.localStorage.getItem(STORAGE_KEY_QUESTIONS);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function setStoredQuestions(questions: QuizQuestion[]): void {
  if (!isStorageAvailable()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY_QUESTIONS, JSON.stringify(questions));
  } catch {
    // Ignore quota or private storage errors
  }
}

const STORAGE_KEY_TUTOR_PREFERENCES = 'studymate_tutor_preferences';

export const DEFAULT_TUTOR_PREFERENCES: import('../types').TutorPreferences = {
  teachingApproach: 'socratic',
  difficultyLevel: 'intermediate',
  interactionStyle: 'balanced',
  explanationLength: 'detailed',
  enableKnowledgeChecks: true,
  customInstructions: '',
};

export function getStoredTutorPreferences(): import('../types').TutorPreferences {
  if (!isStorageAvailable()) return DEFAULT_TUTOR_PREFERENCES;
  try {
    const data = window.localStorage.getItem(STORAGE_KEY_TUTOR_PREFERENCES);
    if (!data) return DEFAULT_TUTOR_PREFERENCES;
    const parsed = JSON.parse(data);
    return {
      ...DEFAULT_TUTOR_PREFERENCES,
      ...parsed,
    };
  } catch {
    return DEFAULT_TUTOR_PREFERENCES;
  }
}

export function setStoredTutorPreferences(
  preferences: import('../types').TutorPreferences
): boolean {
  if (!isStorageAvailable()) return false;
  try {
    window.localStorage.setItem(STORAGE_KEY_TUTOR_PREFERENCES, JSON.stringify(preferences));
    return true;
  } catch {
    return false;
  }
}

const STORAGE_KEY_REVIEW_RECORDS = 'studymate_review_records_v1';

export function getStoredReviewRecords(): import('../types').ReviewRecord[] {
  if (!isStorageAvailable()) return [];
  try {
    const data = window.localStorage.getItem(STORAGE_KEY_REVIEW_RECORDS);
    if (!data) return [];
    const parsed = JSON.parse(data);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function setStoredReviewRecords(
  records: import('../types').ReviewRecord[]
): boolean {
  if (!isStorageAvailable()) return false;
  try {
    window.localStorage.setItem(STORAGE_KEY_REVIEW_RECORDS, JSON.stringify(records));
    return true;
  } catch {
    return false;
  }
}

const STORAGE_KEY_TUTOR_INTERACTION_MODE = 'studymate_tutor_interaction_mode';

export function getStoredTutorInteractionMode(): import('../types').TutorInteractionMode {
  if (!isStorageAvailable()) return 'smart_tutor';
  try {
    const val = window.localStorage.getItem(STORAGE_KEY_TUTOR_INTERACTION_MODE);
    if (val === 'grounded_study' || val === 'smart_tutor') {
      return val;
    }
    return 'smart_tutor';
  } catch {
    return 'smart_tutor';
  }
}

export function setStoredTutorInteractionMode(
  mode: import('../types').TutorInteractionMode
): boolean {
  if (!isStorageAvailable()) return false;
  try {
    window.localStorage.setItem(STORAGE_KEY_TUTOR_INTERACTION_MODE, mode);
    return true;
  } catch {
    return false;
  }
}

