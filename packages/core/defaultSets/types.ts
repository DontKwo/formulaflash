import type { TermDefinition } from '../model/index.js';

export interface StarterCardItem {
  id: string;
  category: string;
  title: string;
  prompt: string;
  shortPrompt?: string;
  latexAnswer: string;
  hint?: string;
  cheatSheetNote?: string;
  explanation: string;
  terms?: TermDefinition[];
  tags?: string[];
  alternates?: string[];
}

export interface StarterDeck {
  id: string;
  title: string;
  description: string;
  category: string;
  cards: StarterCardItem[];
}
