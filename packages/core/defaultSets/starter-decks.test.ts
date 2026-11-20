import { describe, it, expect } from 'vitest';
import { STARTER_DECKS, getStarterDeck } from './index.js';
import { mathChecker } from '../checking/math-checker.js';

describe('Starter Decks Validation', () => {
  const deckKeys = Object.keys(STARTER_DECKS);

  it('contains curated decks for algebra, trigonometry, calculus, linear-algebra, and physics', () => {
    expect(deckKeys).toContain('algebra');
    expect(deckKeys).toContain('trigonometry');
    expect(deckKeys).toContain('calculus');
    expect(deckKeys).toContain('linear-algebra');
    expect(deckKeys).toContain('physics');
  });

  for (const key of deckKeys) {
    const deck = getStarterDeck(key);

    describe(`Deck: ${key}`, () => {
      it('has valid deck metadata', () => {
        expect(deck).toBeDefined();
        expect(deck!.id).toBeTruthy();
        expect(deck!.title).toBeTruthy();
        expect(deck!.description).toBeTruthy();
        expect(deck!.cards.length).toBeGreaterThan(0);
      });

      it('validates every card structure and self-checks answer', () => {
        for (const card of deck!.cards) {
          expect(card.id).toBeTruthy();
          expect(card.title).toBeTruthy();
          expect(card.prompt).toBeTruthy();
          expect(card.latexAnswer).toBeTruthy();
          expect(card.explanation).toBeTruthy();

          const verdict = mathChecker.check(card.latexAnswer, card.latexAnswer);
          expect(verdict.correct).toBe(true);
        }
      });
    });
  }
});
