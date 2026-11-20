import { loadCfdCompleteDeck } from './cfd-loader';
import { CFD_GLOSSARY, type FlashcardItem } from './sample-deck';
import { STARTER_DECKS, type StarterDeck, type TermDefinition } from '@formulaflash/core';

export interface FlashcardSet {
  id: string;
  name: string;
  category: string;
  cards: FlashcardItem[];
  glossary?: Record<string, TermDefinition>;
  isDefault?: boolean;
}

const STORAGE_KEY_SETS = 'formulaflash_sets';
const STORAGE_KEY_SEED_VERSION = 'formulaflash_seed_version';
const CURRENT_SEED_VERSION = 2;

export const CFD_DEFAULT_SET_ID = 'cfd-complete-reference';

export function createCfdDefaultSet(): FlashcardSet {
  return {
    id: CFD_DEFAULT_SET_ID,
    name: 'CFD: Complete Reference',
    category: 'Fluid Dynamics',
    cards: loadCfdCompleteDeck(),
    glossary: CFD_GLOSSARY,
    isDefault: true,
  };
}

function getStorageSets(): FlashcardSet[] {
  const data = localStorage.getItem(STORAGE_KEY_SETS);
  if (!data) return [];
  try {
    return JSON.parse(data) as FlashcardSet[];
  } catch {
    return [];
  }
}

export function loadSets(): FlashcardSet[] {
  const rawSets = getStorageSets();
  const seedVersionStr = localStorage.getItem(STORAGE_KEY_SEED_VERSION);
  const seedVersion = seedVersionStr ? parseInt(seedVersionStr, 10) : 0;

  let sets = [...rawSets];

  if (sets.length === 0) {
    sets = [createCfdDefaultSet()];
    localStorage.setItem(STORAGE_KEY_SETS, JSON.stringify(sets));
    localStorage.setItem(STORAGE_KEY_SEED_VERSION, CURRENT_SEED_VERSION.toString());
    return sets;
  }

  const existingCfd = sets.find((s) => s.id === CFD_DEFAULT_SET_ID);
  if (!existingCfd) {
    sets.unshift(createCfdDefaultSet());
    localStorage.setItem(STORAGE_KEY_SETS, JSON.stringify(sets));
  }

  if (seedVersion < CURRENT_SEED_VERSION) {
    localStorage.setItem(STORAGE_KEY_SEED_VERSION, CURRENT_SEED_VERSION.toString());
  }

  return sets;
}

export function saveSet(set: FlashcardSet): void {
  const sets = loadSets();
  const index = sets.findIndex((s) => s.id === set.id);
  if (index >= 0) {
    sets[index] = set;
  } else {
    sets.push(set);
  }
  localStorage.setItem(STORAGE_KEY_SETS, JSON.stringify(sets));
}

export function deleteSet(setId: string): void {
  if (setId === CFD_DEFAULT_SET_ID) return;
  const sets = loadSets().filter((s) => s.id !== setId);
  localStorage.setItem(STORAGE_KEY_SETS, JSON.stringify(sets));
}

export function saveCard(setId: string, card: FlashcardItem): void {
  const sets = loadSets();
  const setIndex = sets.findIndex((s) => s.id === setId);
  if (setIndex >= 0) {
    const cardIndex = sets[setIndex].cards.findIndex((c) => c.id === card.id);
    if (cardIndex >= 0) {
      sets[setIndex].cards[cardIndex] = card;
    } else {
      sets[setIndex].cards.push(card);
    }
    localStorage.setItem(STORAGE_KEY_SETS, JSON.stringify(sets));
  }
}

export function deleteCard(setId: string, cardId: string): void {
  const sets = loadSets();
  const setIndex = sets.findIndex((s) => s.id === setId);
  if (setIndex >= 0) {
    sets[setIndex].cards = sets[setIndex].cards.filter((c) => c.id !== cardId);
    localStorage.setItem(STORAGE_KEY_SETS, JSON.stringify(sets));
  }
}

export function saveSetGlossary(setId: string, glossary: Record<string, TermDefinition>): void {
  const sets = loadSets();
  const setIndex = sets.findIndex((s) => s.id === setId);
  if (setIndex >= 0) {
    sets[setIndex].glossary = glossary;
    localStorage.setItem(STORAGE_KEY_SETS, JSON.stringify(sets));
  }
}

export function importStarterDeck(deckId: string): FlashcardSet | null {
  const deck = STARTER_DECKS[deckId];
  if (!deck) return null;
  const set: FlashcardSet = {
    id: deck.id,
    name: deck.title,
    category: deck.category,
    cards: deck.cards.map((c) => ({
      id: c.id,
      category: c.category,
      title: c.title,
      prompt: c.prompt,
      latexAnswer: c.latexAnswer,
      hint: c.hint ?? '',
      explanation: c.explanation,
    })),
    isDefault: true,
  };
  saveSet(set);
  return set;
}

export function getAvailableStarterDecks(): StarterDeck[] {
  return Object.values(STARTER_DECKS);
}
