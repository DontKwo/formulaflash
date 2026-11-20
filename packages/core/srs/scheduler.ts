import type {
  SpacedCardRecord,
  SpacedRating,
  SpacedReviewLog,
  SchedulerConfig,
} from './types.js';

const DEFAULT_CONFIG: SchedulerConfig = {
  requestRetention: 0.90,
  maximumIntervalDays: 36500,
  leechThreshold: 8,
};

const MS_PER_DAY = 86_400_000;

export class SpacedScheduler {
  private config: SchedulerConfig;

  constructor(config?: Partial<SchedulerConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Initializes a new card record for spaced repetition tracking.
   */
  createInitialCard(cardId: string, now: number = Date.now()): SpacedCardRecord {
    return {
      cardId,
      state: 'new',
      stability: 0,
      difficulty: 5.0,
      reps: 0,
      lapses: 0,
      due: now,
      history: [],
    };
  }

  /**
   * Computes card retrievability probability R in [0, 1] at a given timestamp.
   */
  calculateRetrievability(card: SpacedCardRecord, now: number = Date.now()): number {
    if (card.state === 'new' || card.stability <= 0 || !card.lastReview) {
      return 0;
    }
    const elapsedDays = Math.max(0, (now - card.lastReview) / MS_PER_DAY);
    // Standard power-law retrievability model: R(t, S) = (1 + 0.2346 * t / S)^-1
    return 1 / (1 + (19 / 81) * (elapsedDays / card.stability));
  }

  /**
   * Schedules next review based on user rating (1=Again, 2=Hard, 3=Good, 4=Easy).
   */
  schedule(card: SpacedCardRecord, rating: SpacedRating, now: number = Date.now()): SpacedCardRecord {
    const updated: SpacedCardRecord = {
      ...card,
      history: [...card.history],
      lastReview: now,
    };

    if (card.state === 'new') {
      return this.scheduleNewCard(updated, rating, now);
    }

    return this.scheduleReviewCard(updated, rating, now);
  }

  private scheduleNewCard(card: SpacedCardRecord, rating: SpacedRating, now: number): SpacedCardRecord {
    const initialDifficulty: Record<SpacedRating, number> = {
      1: 7.5,
      2: 6.0,
      3: 5.0,
      4: 3.5,
    };

    const initialStability: Record<SpacedRating, number> = {
      1: 0.25, // 6 hours
      2: 1.0,  // 1 day
      3: 3.0,  // 3 days
      4: 7.0,  // 7 days
    };

    card.difficulty = initialDifficulty[rating];
    card.stability = initialStability[rating];
    card.reps = 1;

    if (rating === 1) {
      card.state = 'learning';
      card.lapses = 1;
    } else {
      card.state = 'review';
    }

    const intervalDays = this.calculateIntervalDays(card.stability);
    card.due = now + Math.round(intervalDays * MS_PER_DAY);

    const log: SpacedReviewLog = {
      rating,
      reviewedAt: now,
      intervalDays,
      stability: card.stability,
      difficulty: card.difficulty,
    };
    card.history.push(log);

    return card;
  }

  private scheduleReviewCard(card: SpacedCardRecord, rating: SpacedRating, now: number): SpacedCardRecord {
    const retrievability = this.calculateRetrievability(card, now);
    card.reps += 1;

    // Update difficulty with mean reversion toward 5.0
    const deltaD = (3 - rating) * 0.8;
    card.difficulty = Math.min(10, Math.max(1, card.difficulty + deltaD));

    if (rating === 1) {
      // Lapse
      card.lapses += 1;
      card.state = 'relearning';
      card.stability = Math.max(0.2, card.stability * 0.25);
    } else {
      card.state = 'review';
      const factorMap: Record<2 | 3 | 4, number> = {
        2: 1.2,
        3: 2.2,
        4: 3.5,
      };
      // Bonus multiplier when retrievability was low but recall succeeded
      const recallSurprise = 1 + (1 - retrievability) * 0.5;
      card.stability = card.stability * factorMap[rating as 2 | 3 | 4] * recallSurprise;
    }

    const intervalDays = this.calculateIntervalDays(card.stability);
    card.due = now + Math.round(intervalDays * MS_PER_DAY);

    const log: SpacedReviewLog = {
      rating,
      reviewedAt: now,
      intervalDays,
      stability: card.stability,
      difficulty: card.difficulty,
    };
    card.history.push(log);

    return card;
  }

  /**
   * Computes the interval in days needed to reach the target retention.
   */
  calculateIntervalDays(stability: number): number {
    const r = this.config.requestRetention;
    // Solve R(I, S) = r -> I = S * (1/r - 1) * (81/19)
    const factor = (1 / r - 1) * (81 / 19);
    const interval = stability * factor;
    return Math.min(this.config.maximumIntervalDays, Math.max(0.1, Number(interval.toFixed(2))));
  }

  /**
   * Checks whether a card has exceeded the lapse threshold (leech).
   */
  isLeech(card: SpacedCardRecord): boolean {
    return card.lapses >= this.config.leechThreshold;
  }

  /**
   * Returns cards due for review, sorted by urgency (earliest due first).
   */
  getDueQueue(cards: SpacedCardRecord[], now: number = Date.now(), limit?: number): SpacedCardRecord[] {
    const due = cards.filter((c) => c.due <= now);
    due.sort((a, b) => a.due - b.due);
    if (limit && limit > 0) {
      return due.slice(0, limit);
    }
    return due;
  }
}

export const defaultSpacedScheduler = new SpacedScheduler();
