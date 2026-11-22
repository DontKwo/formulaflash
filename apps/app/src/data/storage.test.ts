import { describe, it, expect, beforeEach } from 'vitest';

const mockStorage = new Map<string, string>();
const fakeLocalStorage = {
  getItem: (key: string) => mockStorage.get(key) ?? null,
  setItem: (key: string, val: string) => {
    mockStorage.set(key, val);
  },
  removeItem: (key: string) => {
    mockStorage.delete(key);
  },
  clear: () => {
    mockStorage.clear();
  },
};

(globalThis as unknown as { localStorage: typeof fakeLocalStorage }).localStorage = fakeLocalStorage;

import {
  loadSets,
  saveSet,
  saveSetGlossary,
  importStarterDeck,
  CFD_DEFAULT_SET_ID,
} from './storage';

describe('Storage and Versioned Seeding', () => {
  beforeEach(() => {
    fakeLocalStorage.clear();
  });

  it('seeds CFD: Complete Reference for brand new installs with current seed version', () => {
    const sets = loadSets();
    expect(sets.length).toBe(1);
    expect(sets[0].id).toBe(CFD_DEFAULT_SET_ID);
    expect(sets[0].name).toBe('CFD: Complete Reference');
    expect(sets[0].cards.length).toBe(1500);
    expect(fakeLocalStorage.getItem('formulaflash_seed_version')).toBe('3');
  });

  it('preserves existing custom user sets and non-destructively adds CFD deck', () => {
    const userCustomSet = {
      id: 'my-custom-deck',
      name: 'Aerospace Propulsion 101',
      category: 'Aerospace',
      glossary: {},
      cards: [
        {
          id: 'custom-01',
          category: 'Aerospace',
          title: 'Thrust Equation',
          prompt: 'Thrust formula:',
          latexAnswer: 'F = \\dot{m} v_e + (p_e - p_0) A_e',
          hint: 'Mass flow times exhaust velocity plus pressure thrust.',
          explanation: 'Standard rocket thrust equation.',
        },
      ],
    };
    fakeLocalStorage.setItem('formulaflash_sets', JSON.stringify([userCustomSet]));
    fakeLocalStorage.setItem('formulaflash_seed_version', '1');

    const sets = loadSets();
    expect(sets.length).toBe(2);
    const foundUserSet = sets.find((s) => s.id === 'my-custom-deck');
    expect(foundUserSet).toBeDefined();
    expect(foundUserSet?.cards.length).toBe(1);
    expect(foundUserSet?.cards[0].title).toBe('Thrust Equation');

    const foundCfd = sets.find((s) => s.id === CFD_DEFAULT_SET_ID);
    expect(foundCfd).toBeDefined();
    expect(foundCfd?.cards.length).toBe(1500);

    expect(fakeLocalStorage.getItem('formulaflash_seed_version')).toBe('3');
  });

  it('does not duplicate CFD deck on subsequent loads', () => {
    loadSets();
    const secondLoad = loadSets();
    const cfdDecks = secondLoad.filter((s) => s.id === CFD_DEFAULT_SET_ID);
    expect(cfdDecks.length).toBe(1);
  });

  it('keeps glossaries strictly per-deck without global pollution', () => {
    loadSets();
    saveSet({
      id: 'deck-a',
      name: 'Deck A',
      category: 'Physics',
      cards: [],
      glossary: {},
    });
    const imported = importStarterDeck('algebra');
    expect(imported).not.toBeNull();
    expect(imported?.glossary).toEqual({});

    saveSetGlossary('deck-a', {
      k: { symbol: 'k', name: 'Spring constant', definition: 'Hooke stiffness.', units: 'N/m' },
    });

    const setsAfter = loadSets();
    const deckA = setsAfter.find((s) => s.id === 'deck-a');
    const deckB = setsAfter.find((s) => s.id === 'starter-algebra');
    const cfdDeck = setsAfter.find((s) => s.id === CFD_DEFAULT_SET_ID);

    expect(deckA?.glossary.k?.name).toBe('Spring constant');
    expect(deckB?.glossary.k).toBeUndefined();
    expect(cfdDeck?.glossary.k?.name).toBe('TKE / thermal conductivity');
  });
});
