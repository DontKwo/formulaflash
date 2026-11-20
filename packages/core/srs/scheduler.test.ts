import { describe, it, expect } from 'vitest';
import { SpacedScheduler } from './scheduler.js';

describe('SpacedScheduler', () => {
  const scheduler = new SpacedScheduler({ leechThreshold: 4 });
  const BASE_TIME = 1700000000000;

  it('creates initial card in new state', () => {
    const card = scheduler.createInitialCard('card-1', BASE_TIME);
    expect(card.cardId).toBe('card-1');
    expect(card.state).toBe('new');
    expect(card.reps).toBe(0);
    expect(card.lapses).toBe(0);
    expect(card.due).toBe(BASE_TIME);
  });

  it('schedules initial review correctly based on rating', () => {
    const newCard = scheduler.createInitialCard('card-1', BASE_TIME);
    const goodCard = scheduler.schedule(newCard, 3, BASE_TIME);

    expect(goodCard.reps).toBe(1);
    expect(goodCard.state).toBe('review');
    expect(goodCard.stability).toBeGreaterThan(2);
    expect(goodCard.due).toBeGreaterThan(BASE_TIME);
    expect(goodCard.history.length).toBe(1);
    expect(goodCard.history[0].rating).toBe(3);
  });

  it('handles lapse (rating Again) by incrementing lapses', () => {
    const newCard = scheduler.createInitialCard('card-1', BASE_TIME);
    const lapsedCard = scheduler.schedule(newCard, 1, BASE_TIME);

    expect(lapsedCard.state).toBe('learning');
    expect(lapsedCard.lapses).toBe(1);
    expect(lapsedCard.stability).toBeLessThan(1);
  });

  it('expands stability and intervals over successive successful reviews', () => {
    let card = scheduler.createInitialCard('card-1', BASE_TIME);
    card = scheduler.schedule(card, 3, BASE_TIME);
    const firstDue = card.due;

    // Review again 3 days later
    const reviewTime = firstDue;
    card = scheduler.schedule(card, 3, reviewTime);

    expect(card.reps).toBe(2);
    expect(card.stability).toBeGreaterThan(5);
    expect(card.due - reviewTime).toBeGreaterThan(firstDue - BASE_TIME);
  });

  it('calculates retrievability decay over time', () => {
    let card = scheduler.createInitialCard('card-1', BASE_TIME);
    card = scheduler.schedule(card, 3, BASE_TIME);

    const rImmediate = scheduler.calculateRetrievability(card, BASE_TIME);
    expect(rImmediate).toBeCloseTo(1.0, 2);

    const oneWeekLater = BASE_TIME + 7 * 86_400_000;
    const rLater = scheduler.calculateRetrievability(card, oneWeekLater);
    expect(rLater).toBeLessThan(rImmediate);
    expect(rLater).toBeGreaterThan(0);
  });

  it('flags leeches when lapses exceed threshold', () => {
    let card = scheduler.createInitialCard('card-1', BASE_TIME);
    for (let i = 0; i < 4; i++) {
      card = scheduler.schedule(card, 1, BASE_TIME + i * 1000);
    }
    expect(card.lapses).toBe(4);
    expect(scheduler.isLeech(card)).toBe(true);
  });

  it('filters and sorts due queue by timestamp', () => {
    const c1 = scheduler.createInitialCard('c1', BASE_TIME + 10000);
    const c2 = scheduler.createInitialCard('c2', BASE_TIME - 5000);
    const c3 = scheduler.createInitialCard('c3', BASE_TIME - 20000);

    const queue = scheduler.getDueQueue([c1, c2, c3], BASE_TIME);
    expect(queue.length).toBe(2);
    expect(queue[0].cardId).toBe('c3');
    expect(queue[1].cardId).toBe('c2');
  });
});
