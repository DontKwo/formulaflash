export type SpacedRating = 1 | 2 | 3 | 4;

export const SpacedRatings = {
  AGAIN: 1 as SpacedRating,
  HARD: 2 as SpacedRating,
  GOOD: 3 as SpacedRating,
  EASY: 4 as SpacedRating,
} as const;

export type SpacedCardState = 'new' | 'learning' | 'review' | 'relearning';

export interface SpacedReviewLog {
  rating: SpacedRating;
  reviewedAt: number;
  intervalDays: number;
  stability: number;
  difficulty: number;
}

export interface SpacedCardRecord {
  cardId: string;
  state: SpacedCardState;
  stability: number;
  difficulty: number;
  reps: number;
  lapses: number;
  lastReview?: number;
  due: number;
  history: SpacedReviewLog[];
}

export interface SchedulerConfig {
  requestRetention: number;
  maximumIntervalDays: number;
  leechThreshold: number;
}
