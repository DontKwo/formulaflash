export interface StarterCardItem {
  id: string;
  category: string;
  title: string;
  prompt: string;
  latexAnswer: string;
  hint?: string;
  explanation: string;
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
