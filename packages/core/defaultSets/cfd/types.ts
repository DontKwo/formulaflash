import type { TermDefinition } from '../../model/index.js';

export interface CfdFlashcardItem {
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
}
