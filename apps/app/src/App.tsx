import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { registry, type Verdict, type TermDefinition } from '@formulaflash/core';
import { MathDisplay, MathText } from './components/MathDisplay.tsx';
import { VirtualMathToolbar } from './components/VirtualMathToolbar.tsx';
import { MathLiveField } from './components/MathLiveField.tsx';
import { FlashcardViewer } from './components/FlashcardViewer.tsx';
import { CardCreatorModal } from './components/CardCreatorModal.tsx';
import { SetSelectorModal } from './components/SetSelectorModal.tsx';
import {
  SettingsModal,
  loadSettings,
  applyTheme,
  type AppSettings,
  type TermDefinitionsSetting,
} from './components/SettingsModal.tsx';
import { SetGlossaryModal } from './components/SetGlossaryModal.tsx';
import { ExportStudioModal } from './components/ExportStudioModal.tsx';
import { InteractiveEquation } from './components/InteractiveEquation.tsx';
import { AnalyticsView, type MasteryStats } from './components/AnalyticsView.tsx';
import {
  loadSets,
  saveSet,
  saveCard,
  deleteCard,
  saveSetGlossary,
  importStarterDeck,
  getAvailableStarterDecks,
  type FlashcardSet,
} from './data/storage.ts';
import type { FlashcardItem } from './data/sample-deck.ts';

type AppMode = 'home' | 'learn' | 'study' | 'analytics';
type LearnQuestionStage = 'auto' | 'mc' | 'write';

interface CardLearnRecord {
  level: 0 | 1 | 2 | 3;
  streak: number;
  seen: number;
  right: number;
  wrong: number;
}

interface ToastState {
  message: string;
  onUndo?: () => void;
}

const TERMS_MODE_LABELS: Record<TermDefinitionsSetting, string> = {
  'on-request': 'Terms: On Click',
  'after-answer': 'Terms: Auto-Show',
  'hint-before-answer': 'Terms: Hint First',
  'off': 'Terms: Off',
};

function loadProgressMap(setId: string): Record<string, CardLearnRecord> {
  try {
    const raw = localStorage.getItem(`formulaflash_progress_${setId}`);
    if (raw) return JSON.parse(raw) as Record<string, CardLearnRecord>;
  } catch {
    // Ignore storage errors
  }
  return {};
}

function computeMasteryStats(
  cards: FlashcardItem[],
  progress: Record<string, CardLearnRecord>
): MasteryStats {
  let mastered = 0;
  let proficient = 0;
  let familiar = 0;
  let unseen = 0;
  for (const c of cards) {
    const lvl = progress[c.id]?.level ?? 0;
    if (lvl === 3) mastered++;
    else if (lvl === 2) proficient++;
    else if (lvl === 1) familiar++;
    else unseen++;
  }
  return { mastered, proficient, familiar, unseen };
}

export const App: React.FC = () => {
  const [sets, setSets] = useState<FlashcardSet[]>(() => loadSets());
  const [activeSetId, setActiveSetId] = useState<string>(
    () => loadSets()[0]?.id || 'cfd-complete-reference'
  );
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [mode, setMode] = useState<AppMode>('home');
  const [isFlipped, setIsFlipped] = useState(false);

  // Home dashboard state
  const [homeSearch, setHomeSearch] = useState('');
  const [showHomeCreateSet, setShowHomeCreateSet] = useState(false);
  const [homeNewSetName, setHomeNewSetName] = useState('');
  const [homeNewSetCategory, setHomeNewSetCategory] = useState('');

  // Learn mode state
  const [userAnswer, setUserAnswer] = useState('');
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [showHint, setShowHint] = useState(false);
  const [showLearnTermsHint, setShowLearnTermsHint] = useState(false);
  const [learnStageOverride, setLearnStageOverride] = useState<LearnQuestionStage>('auto');
  const [selectedMcIdx, setSelectedMcIdx] = useState<number | null>(null);
  const [score, setScore] = useState({ correct: 0, total: 0 });
  const [toast, setToast] = useState<ToastState | null>(null);

  const [progressMap, setProgressMap] = useState<Record<string, CardLearnRecord>>(() =>
    loadProgressMap(loadSets()[0]?.id || 'cfd-complete-reference')
  );

  const [settings, setSettings] = useState<AppSettings>(() => {
    const loaded = loadSettings();
    applyTheme(loaded.theme);
    return loaded;
  });

  const [sessionTermsMode, setSessionTermsMode] = useState<TermDefinitionsSetting | null>(null);

  const [showCardCreator, setShowCardCreator] = useState(false);
  const [editingCard, setEditingCard] = useState<FlashcardItem | undefined>(undefined);
  const [showSetSelector, setShowSetSelector] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showGlossaryModal, setShowGlossaryModal] = useState(false);
  const [showExportStudio, setShowExportStudio] = useState(false);

  useEffect(() => {
    applyTheme(settings.theme);
  }, [settings.theme]);

  const activeSet = sets.find((s) => s.id === activeSetId) || sets[0];
  const fullDeck = useMemo(() => activeSet?.cards || [], [activeSet]);

  const starterDecks = useMemo(() => getAvailableStarterDecks(), []);
  const existingSetIds = useMemo(() => new Set(sets.map((s) => s.id)), [sets]);

  const filteredHomeSets = useMemo(() => {
    const q = homeSearch.trim().toLowerCase();
    if (!q) return sets;
    return sets.filter(
      (s) => s.name.toLowerCase().includes(q) || s.category.toLowerCase().includes(q)
    );
  }, [sets, homeSearch]);

  const filteredStarterDecks = useMemo(() => {
    const q = homeSearch.trim().toLowerCase();
    if (!q) return starterDecks;
    return starterDecks.filter(
      (d) =>
        d.title.toLowerCase().includes(q) ||
        d.category.toLowerCase().includes(q) ||
        d.description.toLowerCase().includes(q)
    );
  }, [starterDecks, homeSearch]);

  const categories = useMemo(() => {
    const seen = new Set<string>();
    for (const c of fullDeck) {
      if (c.category) seen.add(c.category);
    }
    return Array.from(seen);
  }, [fullDeck]);

  const deck = useMemo(() => {
    if (categoryFilter === 'all') return fullDeck;
    return fullDeck.filter((c) => c.category === categoryFilter);
  }, [fullDeck, categoryFilter]);

  const safeIndex = deck.length > 0 ? Math.min(currentIndex, deck.length - 1) : 0;
  const currentCard = deck[safeIndex];

  const effectiveTermsMode: TermDefinitionsSetting = sessionTermsMode || settings.termDefinitionsMode;

  const updateCardProgress = useCallback(
    (cardId: string, correct: boolean): void => {
      setProgressMap((prev) => {
        const cur = prev[cardId] || { level: 0, streak: 0, seen: 0, right: 0, wrong: 0 };
        const nextLevel = correct
          ? (Math.min(3, cur.level + 1) as 0 | 1 | 2 | 3)
          : (Math.max(0, cur.level - 1) as 0 | 1 | 2 | 3);
        const updated: Record<string, CardLearnRecord> = {
          ...prev,
          [cardId]: {
            level: nextLevel,
            streak: correct ? cur.streak + 1 : 0,
            seen: cur.seen + 1,
            right: cur.right + (correct ? 1 : 0),
            wrong: cur.wrong + (correct ? 0 : 1),
          },
        };
        localStorage.setItem(`formulaflash_progress_${activeSetId}`, JSON.stringify(updated));
        return updated;
      });
    },
    [activeSetId]
  );

  const currentProgress = currentCard
    ? progressMap[currentCard.id] || { level: 0 as const, streak: 0, seen: 0, right: 0, wrong: 0 }
    : { level: 0 as const, streak: 0, seen: 0, right: 0, wrong: 0 };

  const activeLearnStage: 'mc' | 'write' =
    learnStageOverride !== 'auto'
      ? learnStageOverride
      : currentProgress.level === 0
      ? 'mc'
      : 'write';

  // Build deterministic 4-choice options for the current card in MC stage
  const mcOptions = useMemo(() => {
    if (!currentCard) return [];
    const pool = fullDeck.filter(
      (c) => c.id !== currentCard.id && c.latexAnswer !== currentCard.latexAnswer
    );
    const sameCat = pool.filter((c) => c.category === currentCard.category);
    const diffCat = pool.filter((c) => c.category !== currentCard.category);
    const orderedPool = [...sameCat, ...diffCat];

    let seed = 17;
    for (let i = 0; i < currentCard.id.length; i++) {
      seed = (seed * 31 + currentCard.id.charCodeAt(i)) >>> 0;
    }
    const rand = (): number => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };

    const distractors: FlashcardItem[] = [];
    const working = [...orderedPool];
    while (distractors.length < 3 && working.length > 0) {
      const idx = Math.floor(rand() * working.length);
      const picked = working.splice(idx, 1)[0];
      if (!distractors.some((d) => d.latexAnswer === picked.latexAnswer)) {
        distractors.push(picked);
      }
    }

    const choices = [currentCard, ...distractors];
    for (let i = choices.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      const tmp = choices[i];
      choices[i] = choices[j];
      choices[j] = tmp;
    }
    return choices;
  }, [currentCard, fullDeck]);

  const analyticsStats = useMemo(
    () => computeMasteryStats(deck, progressMap),
    [deck, progressMap]
  );

  const showToastNotification = useCallback((message: string, onUndo?: () => void): void => {
    setToast({ message, onUndo });
    setTimeout(() => {
      setToast((prev) => (prev?.message === message ? null : prev));
    }, 4500);
  }, []);

  const resetCardSessionUi = useCallback((): void => {
    setUserAnswer('');
    setVerdict(null);
    setShowHint(false);
    setShowLearnTermsHint(false);
    setIsFlipped(false);
    setLearnStageOverride('auto');
    setSelectedMcIdx(null);
  }, []);

  const handleNext = useCallback((): void => {
    if (deck.length === 0) return;
    setCurrentIndex((prev) => (prev + 1) % deck.length);
    resetCardSessionUi();
  }, [deck.length, resetCardSessionUi]);

  const handlePrev = useCallback((): void => {
    if (deck.length === 0) return;
    setCurrentIndex((prev) => (prev - 1 + deck.length) % deck.length);
    resetCardSessionUi();
  }, [deck.length, resetCardSessionUi]);

  const handleSelectSetId = useCallback(
    (id: string): void => {
      setActiveSetId(id);
      setCategoryFilter('all');
      setCurrentIndex(0);
      setProgressMap(loadProgressMap(id));
      resetCardSessionUi();
    },
    [resetCardSessionUi]
  );

  const handleOpenSetInMode = (setId: string, nextMode: AppMode): void => {
    handleSelectSetId(setId);
    setMode(nextMode);
  };

  const handleInsertSnippet = useCallback((snippet: string): void => {
    setUserAnswer((prev) => prev + snippet);
  }, []);

  const handleSelectMcOption = useCallback(
    (idx: number): void => {
      if (!currentCard || verdict) return;
      const picked = mcOptions[idx];
      if (!picked) return;

      // Lock display to 'mc' until user chooses Next Card or Now Write This Formula
      setLearnStageOverride('mc');
      setSelectedMcIdx(idx);
      const isRight = picked.id === currentCard.id || picked.latexAnswer === currentCard.latexAnswer;
      const result: Verdict = {
        correct: isRight,
        via: 'exact',
        message: isRight
          ? 'Multiple choice mastered! You are ready to write this equation from recall.'
          : `Selected incorrect option (${String.fromCharCode(65 + idx)}). Compare with the target equation below.`,
      };
      setVerdict(result);
      updateCardProgress(currentCard.id, isRight);
      setScore((prev) => ({
        correct: prev.correct + (isRight ? 1 : 0),
        total: prev.total + 1,
      }));
    },
    [currentCard, mcOptions, verdict, updateCardProgress]
  );

  const handleCheckAnswer = useCallback((): void => {
    if (!userAnswer.trim() || !currentCard) return;

    const checker = registry.getChecker('math');
    if (!checker) return;

    const result = checker.check(userAnswer.trim(), currentCard.latexAnswer, {
      accentsMatter: settings.accentsMatter,
      greekVariantsEqual: settings.greekVariantsEqual,
      allowSideSwap: settings.allowSideSwap,
    });
    setLearnStageOverride('write');
    setVerdict(result);
    updateCardProgress(currentCard.id, result.correct);
    setScore((prev) => ({
      correct: prev.correct + (result.correct ? 1 : 0),
      total: prev.total + 1,
    }));
  }, [userAnswer, currentCard, settings, updateCardProgress]);

  const handleShowAnswer = useCallback((): void => {
    if (!currentCard) return;
    setLearnStageOverride(activeLearnStage);
    setVerdict({
      correct: false,
      via: 'normalized',
      message: 'Revealed answer',
    });
  }, [currentCard, activeLearnStage]);

  const handleAdvanceToWrite = useCallback((): void => {
    setLearnStageOverride('write');
    setVerdict(null);
    setUserAnswer('');
    setSelectedMcIdx(null);
  }, []);

  const handleCreateSet = (name: string, category: string): void => {
    const newSet: FlashcardSet = {
      id: crypto.randomUUID(),
      name,
      category,
      cards: [],
      glossary: {},
    };
    saveSet(newSet);
    const updated = loadSets();
    setSets(updated);
    handleSelectSetId(newSet.id);
    setMode('study');
    showToastNotification(`Created study set "${name}"`);
  };

  const handleHomeCreateSetSubmit = (): void => {
    const trimmed = homeNewSetName.trim();
    if (!trimmed) return;
    handleCreateSet(trimmed, homeNewSetCategory.trim() || 'General');
    setHomeNewSetName('');
    setHomeNewSetCategory('');
    setShowHomeCreateSet(false);
  };

  const handleImportStarterDeck = (deckId: string): void => {
    const existing = sets.find((s) => s.id === deckId);
    if (existing) {
      handleSelectSetId(existing.id);
      return;
    }
    const created = importStarterDeck(deckId);
    if (created) {
      setSets(loadSets());
      handleSelectSetId(created.id);
      showToastNotification(`Added starter set "${created.name}"`);
    }
  };

  const handleSaveCard = (card: FlashcardItem): void => {
    saveCard(activeSetId, card);
    setSets(loadSets());
    setEditingCard(undefined);
    showToastNotification(`Card "${card.title}" saved`);
  };

  const handleBulkAddCards = (cards: FlashcardItem[]): void => {
    for (const card of cards) {
      saveCard(activeSetId, card);
    }
    setSets(loadSets());
    showToastNotification(`Imported ${cards.length} cards`);
  };

  const handleDeleteCard = (cardId: string): void => {
    const cardToDelete = fullDeck.find((c) => c.id === cardId);
    if (!cardToDelete) return;

    deleteCard(activeSetId, cardId);
    setSets(loadSets());
    setCurrentIndex((prev) => Math.max(0, Math.min(prev, deck.length - 2)));

    showToastNotification('Card deleted', () => {
      saveCard(activeSetId, cardToDelete);
      setSets(loadSets());
    });
  };

  const handleSaveSetGlossary = (newGlossary: Record<string, TermDefinition>): void => {
    saveSetGlossary(activeSetId, newGlossary);
    setSets(loadSets());
  };

  const handleApplyTermToSetGlossary = (term: TermDefinition): void => {
    const currentGlossary = activeSet?.glossary || {};
    const updatedGlossary = { ...currentGlossary, [term.symbol]: term };
    handleSaveSetGlossary(updatedGlossary);
    showToastNotification(`Added "${term.symbol}" to ${activeSet?.name || 'deck'} glossary`);
  };

  const handleApplyGlossaryDefinitionToCards = (symbol: string, term: TermDefinition): void => {
    const currentSets = loadSets();
    const setIdx = currentSets.findIndex((s) => s.id === activeSetId);
    if (setIdx >= 0) {
      for (const card of currentSets[setIdx].cards) {
        if (!card.terms) card.terms = [];
        const existing = card.terms.find((t) => t.symbol === symbol);
        if (!existing || !existing.definition) {
          if (existing) {
            existing.name = term.name;
            existing.shortName = term.shortName;
            existing.definition = term.definition;
            existing.shortDefinition = term.shortDefinition;
            existing.units = term.units;
          } else {
            card.terms.push(term);
          }
        }
      }
      saveSet(currentSets[setIdx]);
      setSets(loadSets());
      showToastNotification(`Updated cards in "${activeSet?.name}" with "${symbol}"`);
    }
  };

  const progressPercent = deck.length > 0 ? ((safeIndex + 1) / deck.length) * 100 : 0;

  return (
    <>
      {/* Quizlet / Knowt Style Global Navigation Bar */}
      <header className="app-topbar" role="banner">
        <div className="topbar-left">
          <button
            type="button"
            className="brand-btn"
            onClick={() => setMode('home')}
            aria-label="Formula Flash Home"
          >
            <span className="brand-emblem" aria-hidden="true">f(x)</span>
            <div className="brand-copy">
              <span className="brand-title">Formula Flash</span>
              <span className="brand-subtitle">Symbolic Recall & Cheat Sheet Studio</span>
            </div>
          </button>
        </div>

        <nav className="mode-toggle" role="tablist" aria-label="Primary navigation">
          <button
            type="button"
            role="tab"
            data-testid="mode-tab-home"
            aria-selected={mode === 'home'}
            className={`mode-tab ${mode === 'home' ? 'active' : ''}`}
            onClick={() => setMode('home')}
          >
            Home
          </button>
          <button
            type="button"
            role="tab"
            data-testid="mode-tab-learn"
            aria-selected={mode === 'learn'}
            className={`mode-tab ${mode === 'learn' ? 'active' : ''}`}
            onClick={() => setMode('learn')}
          >
            Learn
          </button>
          <button
            type="button"
            role="tab"
            data-testid="mode-tab-study"
            aria-selected={mode === 'study'}
            className={`mode-tab ${mode === 'study' ? 'active' : ''}`}
            onClick={() => setMode('study')}
          >
            Flashcards
          </button>
          <button
            type="button"
            role="tab"
            data-testid="mode-tab-analytics"
            aria-selected={mode === 'analytics'}
            className={`mode-tab ${mode === 'analytics' ? 'active' : ''}`}
            onClick={() => setMode('analytics')}
          >
            Progress
          </button>
        </nav>

        <div className="topbar-actions">
          <button
            type="button"
            data-testid="nav-decks-btn"
            className="header-btn"
            onClick={() => setShowSetSelector(true)}
            aria-label="All Study Sets"
          >
            All Sets
          </button>
          <button
            type="button"
            data-testid="nav-export-pdf-btn"
            className="header-btn"
            onClick={() => setShowExportStudio(true)}
            aria-label="Export PDF"
          >
            Export PDF
          </button>
          <button
            type="button"
            data-testid="nav-add-card-btn"
            className="header-btn header-btn-accent"
            onClick={() => {
              setEditingCard(undefined);
              setShowCardCreator(true);
            }}
            aria-label="Add Card"
          >
            + Add Card
          </button>
          <button
            type="button"
            data-testid="nav-settings-btn"
            className="header-btn"
            onClick={() => setShowSettings(true)}
            aria-label="Settings"
          >
            Settings
          </button>
        </div>
      </header>

      <main className="app-main">
        {mode === 'home' ? (
          <section className="home-dashboard" aria-label="Study Library Home">
            <div className="home-hero">
              <div className="home-hero-copy">
                <h1 className="home-hero-title">Your Study Sets</h1>
                <p className="home-hero-desc">
                  Choose a set to practice in Learn or Flashcards mode, manage its symbol glossary, or build a custom PDF cheat sheet.
                </p>
              </div>
              <div className="home-toolbar">
                <input
                  type="search"
                  data-testid="home-search-input"
                  className="home-search-input"
                  value={homeSearch}
                  onChange={(e) => setHomeSearch(e.target.value)}
                  placeholder="Search study sets or topics..."
                  aria-label="Search study sets"
                />
                <button
                  type="button"
                  data-testid="home-create-set-btn"
                  className="btn-primary home-create-cta"
                  onClick={() => setShowHomeCreateSet(!showHomeCreateSet)}
                >
                  + Create New Set
                </button>
              </div>
            </div>

            {showHomeCreateSet && (
              <div className="home-create-card" role="region" aria-label="Create New Study Set">
                <div className="home-create-fields">
                  <div className="input-group">
                    <label htmlFor="home-create-name">Set Title *</label>
                    <input
                      id="home-create-name"
                      data-testid="home-create-name-input"
                      type="text"
                      value={homeNewSetName}
                      onChange={(e) => setHomeNewSetName(e.target.value)}
                      placeholder="e.g. Compressible Flow Exam 2"
                      autoFocus
                    />
                  </div>
                  <div className="input-group">
                    <label htmlFor="home-create-category">Subject / Category</label>
                    <input
                      id="home-create-category"
                      data-testid="home-create-category-input"
                      type="text"
                      value={homeNewSetCategory}
                      onChange={(e) => setHomeNewSetCategory(e.target.value)}
                      placeholder="e.g. Aerospace Engineering"
                    />
                  </div>
                </div>
                <div className="home-create-actions">
                  <button
                    type="button"
                    data-testid="home-create-cancel-btn"
                    className="btn-secondary"
                    onClick={() => setShowHomeCreateSet(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    data-testid="home-create-submit-btn"
                    className="btn-primary"
                    disabled={!homeNewSetName.trim()}
                    onClick={handleHomeCreateSetSubmit}
                  >
                    Create Set
                  </button>
                </div>
              </div>
            )}

            <div className="home-section">
              <div className="home-section-header">
                <h2 className="home-section-title">My Study Sets ({filteredHomeSets.length})</h2>
              </div>

              {filteredHomeSets.length === 0 ? (
                <div className="home-empty-state">
                  No saved sets match "{homeSearch}". Clear the search or create a new set.
                </div>
              ) : (
                <div className="home-sets-grid">
                  {filteredHomeSets.map((set, idx) => {
                    const setProgress = loadProgressMap(set.id);
                    const stats = computeMasteryStats(set.cards, setProgress);
                    const total = set.cards.length;
                    const pctMastered = total > 0 ? Math.round(((stats.mastered + stats.proficient) / total) * 100) : 0;
                    const glossaryCount = Object.keys(set.glossary || {}).length;
                    const isCurrent = set.id === activeSetId;

                    return (
                      <article
                        key={set.id}
                        className={`home-set-card ${isCurrent ? 'active-set' : ''}`}
                      >
                        <div className="home-set-card-top">
                          <span className="deck-tag">{set.category}</span>
                          <div className="home-set-badges">
                            <span className="home-stat-pill">{total} cards</span>
                            <span className="home-stat-pill">{glossaryCount} terms</span>
                          </div>
                        </div>

                        <h3 className="home-set-title">{set.name}</h3>

                        <div className="home-set-progress">
                          <div className="home-progress-track">
                            <div
                              className="home-progress-fill"
                              style={{ width: `${pctMastered}%` }}
                            />
                          </div>
                          <span className="home-progress-label">
                            {stats.mastered + stats.proficient} mastered · {stats.unseen} unseen
                          </span>
                        </div>

                        <div className="home-set-actions">
                          <button
                            type="button"
                            data-testid={`home-set-learn-${idx}`}
                            className="home-action-primary"
                            onClick={() => handleOpenSetInMode(set.id, 'learn')}
                          >
                            Learn
                          </button>
                          <button
                            type="button"
                            data-testid={`home-set-study-${idx}`}
                            className="home-action-btn"
                            onClick={() => handleOpenSetInMode(set.id, 'study')}
                          >
                            Flashcards
                          </button>
                          <button
                            type="button"
                            data-testid={`home-set-glossary-${idx}`}
                            className="home-action-btn"
                            onClick={() => {
                              handleSelectSetId(set.id);
                              setShowGlossaryModal(true);
                            }}
                          >
                            Glossary
                          </button>
                          <button
                            type="button"
                            data-testid={`home-set-pdf-${idx}`}
                            className="home-action-btn"
                            onClick={() => {
                              handleSelectSetId(set.id);
                              setShowExportStudio(true);
                            }}
                          >
                            PDF Sheet
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="home-section">
              <div className="home-section-header">
                <h2 className="home-section-title">Explore Starter Library</h2>
                <span className="home-section-subtitle">
                  Curated STEM formula packs - each starts with its own isolated glossary
                </span>
              </div>

              <div className="home-starter-grid">
                {filteredStarterDecks.map((starter, idx) => {
                  const alreadyAdded = existingSetIds.has(starter.id);
                  return (
                    <article key={starter.id} className="home-starter-card">
                      <div className="home-set-card-top">
                        <span className="deck-tag">{starter.category}</span>
                        <span className="home-stat-pill">{starter.cards.length} cards</span>
                      </div>
                      <h3 className="home-starter-title">{starter.title}</h3>
                      <p className="home-starter-desc">{starter.description}</p>
                      <button
                        type="button"
                        data-testid={`home-starter-btn-${idx}`}
                        className={alreadyAdded ? 'home-action-btn home-starter-cta' : 'home-action-primary home-starter-cta'}
                        onClick={() => {
                          if (!alreadyAdded) {
                            handleImportStarterDeck(starter.id);
                          } else {
                            handleSelectSetId(starter.id);
                          }
                          setMode('learn');
                        }}
                      >
                        {alreadyAdded ? 'Open & Study' : '+ Add & Study'}
                      </button>
                    </article>
                  );
                })}
              </div>
            </div>
          </section>
        ) : (
          <div className="study-workspace">
            {/* Compact Single-Row Study Context Bar */}
            <section className="study-set-bar" aria-label="Active study set controls">
              <div className="study-set-left">
                <button
                  type="button"
                  data-testid="back-to-home-btn"
                  className="back-home-btn"
                  onClick={() => setMode('home')}
                >
                  Back to Sets
                </button>

                <div className="study-set-identity">
                  <span className="study-set-name">{activeSet?.name || 'Study Set'}</span>
                  <span className="deck-picker-count">{fullDeck.length}</span>
                </div>

                {categories.length > 1 && (
                  <select
                    data-testid="deck-category-filter"
                    className="deck-category-select"
                    aria-label="Filter by topic category"
                    value={categoryFilter}
                    onChange={(e) => {
                      setCategoryFilter(e.target.value);
                      setCurrentIndex(0);
                      resetCardSessionUi();
                    }}
                  >
                    <option value="all">All Topics ({fullDeck.length})</option>
                    {categories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="study-set-right">
                <button
                  type="button"
                  data-testid="session-terms-mode-toggle"
                  className={`terms-mode-pill mode-${effectiveTermsMode}`}
                  title="Cycle variable & term definition visibility mode for this session"
                  onClick={() => {
                    const modes: TermDefinitionsSetting[] = [
                      'on-request',
                      'after-answer',
                      'hint-before-answer',
                      'off',
                    ];
                    const nextMode = modes[(modes.indexOf(effectiveTermsMode) + 1) % modes.length];
                    setSessionTermsMode(nextMode);
                    showToastNotification(TERMS_MODE_LABELS[nextMode]);
                  }}
                >
                  <span className="terms-mode-dot" aria-hidden="true" />
                  <span>{TERMS_MODE_LABELS[effectiveTermsMode]}</span>
                </button>

                <button
                  type="button"
                  data-testid="nav-glossary-btn"
                  className="study-tool-btn"
                  onClick={() => setShowGlossaryModal(true)}
                  aria-label="Deck Glossary"
                >
                  Deck Glossary
                </button>

                {mode === 'study' && currentCard && (
                  <>
                    <button
                      type="button"
                      data-testid="study-edit-btn"
                      className="study-tool-btn"
                      onClick={() => {
                        setEditingCard(currentCard);
                        setShowCardCreator(true);
                      }}
                    >
                      Edit Card
                    </button>
                    <button
                      type="button"
                      data-testid="study-delete-btn"
                      className="study-tool-btn danger"
                      onClick={() => handleDeleteCard(currentCard.id)}
                    >
                      Delete Card
                    </button>
                  </>
                )}
              </div>
            </section>

            {deck.length === 0 ? (
              <section className="flashcard" style={{ textAlign: 'center', padding: '44px 20px', justifyContent: 'center' }}>
                <h2 className="card-title">This study set has no cards yet</h2>
                <p className="card-prompt" style={{ marginBottom: '24px' }}>
                  {categoryFilter !== 'all'
                    ? 'No cards match this topic filter. Reset the topic filter or add a new card.'
                    : 'Add equations or terms to start practicing in Learn or Flashcards mode.'}
                </p>
                <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    data-testid="empty-add-card-btn"
                    className="btn-primary"
                    style={{ flex: 'none', minWidth: '180px' }}
                    onClick={() => {
                      setEditingCard(undefined);
                      setShowCardCreator(true);
                    }}
                  >
                    Add Your First Card
                  </button>
                </div>
              </section>
            ) : (
              <>
                <section className="deck-meta" aria-label="Session status and progress">
                  <div className="deck-meta-tags">
                    <span className="deck-tag">{currentCard.category}</span>
                    {mode === 'learn' && (
                      <span className="session-score-inline">
                        Session Score: {score.correct} / {score.total}
                      </span>
                    )}
                  </div>
                  <span className="card-counter">
                    Card {safeIndex + 1} of {deck.length}
                  </span>
                </section>

                <div
                  className="progress-bar-container"
                  role="progressbar"
                  aria-valuenow={Math.round(progressPercent)}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label="Session progress"
                >
                  <div className="progress-bar-fill" style={{ width: `${progressPercent}%` }} />
                </div>

                {mode === 'analytics' ? (
                  <AnalyticsView
                    stats={analyticsStats}
                    totalSessions={score.total > 0 ? 1 : 0}
                    streakDays={1}
                  />
                ) : mode === 'study' ? (
                  <section className="flashcard-wrapper" aria-label="Flashcard Viewer">
                    <FlashcardViewer
                      card={currentCard}
                      isFlipped={isFlipped}
                      onFlip={() => setIsFlipped(!isFlipped)}
                      setGlossary={activeSet?.glossary}
                      termDefinitionsMode={effectiveTermsMode}
                      onEditTerms={() => {
                        setEditingCard(currentCard);
                        setShowCardCreator(true);
                      }}
                    />

                    <div className="study-bottom-bar study-bottom-centered">
                      <button
                        type="button"
                        data-testid="study-prev-btn"
                        className="btn-secondary"
                        onClick={handlePrev}
                        aria-label="Previous card"
                      >
                        Previous
                      </button>
                      <button
                        type="button"
                        data-testid="study-flip-btn"
                        className="btn-primary"
                        onClick={() => setIsFlipped(!isFlipped)}
                        aria-label="Flip Card"
                      >
                        Flip Card
                      </button>
                      <button
                        type="button"
                        data-testid="study-next-btn"
                        className="btn-secondary"
                        onClick={handleNext}
                        aria-label="Next card"
                      >
                        Next
                      </button>
                    </div>
                  </section>
                ) : (
                  <section className="learn-panel" aria-label="Learn Interactive Mode">
                    <article className="flashcard learn-question-card" style={{ minHeight: 'auto', cursor: 'default' }}>
                      <div className="card-body" style={{ alignItems: 'flex-start', textAlign: 'left', width: '100%' }}>
                        <div className="learn-card-stage-row">
                          <span className={`stage-badge stage-${activeLearnStage}`}>
                            {activeLearnStage === 'mc'
                              ? 'Step 1 of 2 - Multiple Choice'
                              : 'Step 2 of 2 - Write Equation'}
                          </span>
                          <button
                            type="button"
                            data-testid="learn-switch-write-btn"
                            className="stage-switch-btn"
                            onClick={() => {
                              setLearnStageOverride(activeLearnStage === 'mc' ? 'write' : 'mc');
                              setVerdict(null);
                              setSelectedMcIdx(null);
                            }}
                          >
                            {activeLearnStage === 'mc' ? 'Switch to Write Mode' : 'Switch to Multiple Choice'}
                          </button>
                        </div>

                        <h2 className="card-title">
                          <MathText text={currentCard.title} />
                        </h2>
                        <p className="card-prompt" style={{ maxWidth: '100%' }}>
                          <MathText text={currentCard.prompt} />
                        </p>

                        {effectiveTermsMode === 'hint-before-answer' && (
                          <div style={{ marginTop: '12px', width: '100%', minWidth: 0 }}>
                            <button
                              type="button"
                              data-testid="learn-terms-hint-btn"
                              className="toolbar-btn"
                              style={{ fontSize: '12px', padding: '4px 10px', height: '32px', minHeight: '32px', marginBottom: '6px' }}
                              onClick={() => setShowLearnTermsHint(!showLearnTermsHint)}
                            >
                              {showLearnTermsHint ? 'Hide Variable Hints' : 'Peek Variables & Definitions'}
                            </button>
                            {showLearnTermsHint && (
                              <InteractiveEquation
                                latex={currentCard.latexAnswer}
                                cardTerms={currentCard.terms}
                                setGlossary={activeSet?.glossary}
                                hideSymbolsInitially={true}
                              />
                            )}
                          </div>
                        )}
                      </div>
                    </article>

                    {showHint && currentCard.hint && (
                      <aside className="hint-box" role="note" aria-label="Hint">
                        <strong>Hint: </strong>
                        <MathText text={currentCard.hint} />
                      </aside>
                    )}

                    {activeLearnStage === 'mc' && mcOptions.length > 0 ? (
                      <div className="mc-stage-container" aria-label="Multiple Choice Formula Options">
                        <div className="mc-stage-header">
                          <span className="input-label">Choose the matching formula</span>
                          <span className="input-helper">Master recognition before writing from recall</span>
                        </div>
                        <div className="mc-options-grid">
                          {mcOptions.map((opt, idx) => {
                            const isPicked = selectedMcIdx === idx;
                            const isTarget =
                              opt.id === currentCard.id || opt.latexAnswer === currentCard.latexAnswer;
                            let optionStateClass = '';
                            if (verdict) {
                              if (isTarget) optionStateClass = 'mc-correct';
                              else if (isPicked) optionStateClass = 'mc-incorrect';
                            } else if (isPicked) {
                              optionStateClass = 'mc-selected';
                            }

                            return (
                              <button
                                key={opt.id}
                                type="button"
                                data-testid={`learn-mc-option-${idx}`}
                                className={`mc-option-btn ${optionStateClass}`}
                                disabled={!!verdict}
                                onClick={() => handleSelectMcOption(idx)}
                              >
                                <span className="mc-option-letter">{String.fromCharCode(65 + idx)}</span>
                                <div className="mc-option-math">
                                  <MathDisplay latex={opt.latexAnswer} display={false} />
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <div className="input-container">
                        <label htmlFor="math-answer-input" className="input-label">
                          Write Equation (LaTeX / ASCII)
                        </label>
                        <MathLiveField
                          data-testid="learn-answer-input"
                          value={userAnswer}
                          onChange={setUserAnswer}
                          placeholder="e.g. PV = nRT"
                          className="math-input"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              handleCheckAnswer();
                            }
                          }}
                        />

                        <VirtualMathToolbar onInsert={handleInsertSnippet} />

                        <div className="preview-card" aria-label="Equation preview">
                          {userAnswer.trim() ? (
                            <MathDisplay latex={userAnswer} display={false} />
                          ) : (
                            <span className="preview-placeholder">Live equation preview appears here</span>
                          )}
                        </div>
                      </div>
                    )}

                    {verdict && (
                      <div
                        className={`verdict-card ${verdict.correct ? 'correct' : 'incorrect'}`}
                        role="alert"
                      >
                        <div className="verdict-header">
                          {verdict.via === 'indeterminate'
                            ? 'Inconclusive equivalence'
                            : verdict.correct
                            ? 'Correct'
                            : 'Not quite right'}
                        </div>
                        <div className="verdict-detail">
                          {verdict.correct ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                              <span>
                                {verdict.message || (
                                  <>
                                    Verified via <strong>{verdict.via}</strong> equivalence
                                    {verdict.via === 'structural' && ' (algebraic AST / solution match)'}.
                                  </>
                                )}
                              </span>
                              {effectiveTermsMode !== 'off' && (
                                <div className="verdict-compare-box">
                                  <strong>Formula & Variables:</strong>
                                  <InteractiveEquation
                                    latex={currentCard.latexAnswer}
                                    cardTerms={currentCard.terms}
                                    setGlossary={activeSet?.glossary}
                                    autoShowTerms={effectiveTermsMode === 'after-answer'}
                                    onEditCardTerms={() => {
                                      setEditingCard(currentCard);
                                      setShowCardCreator(true);
                                    }}
                                  />
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="verdict-compare">
                              {verdict.message && (
                                <div className="verdict-message" style={{ marginBottom: '4px', fontSize: '0.9em', color: 'var(--text-secondary)' }}>
                                  {verdict.message}
                                </div>
                              )}
                              <div className="verdict-compare-box">
                                <strong>Expected Answer:</strong>
                                {effectiveTermsMode !== 'off' ? (
                                  <InteractiveEquation
                                    latex={currentCard.latexAnswer}
                                    cardTerms={currentCard.terms}
                                    setGlossary={activeSet?.glossary}
                                    autoShowTerms={effectiveTermsMode === 'after-answer'}
                                    onEditCardTerms={() => {
                                      setEditingCard(currentCard);
                                      setShowCardCreator(true);
                                    }}
                                  />
                                ) : (
                                  <div className="card-math-hero">
                                    <MathDisplay latex={currentCard.latexAnswer} display={false} />
                                  </div>
                                )}
                              </div>
                              {activeLearnStage === 'write' && userAnswer && (
                                <div className="verdict-compare-box">
                                  <strong>Your Input:</strong>
                                  <div className="card-math-hero">
                                    <MathDisplay latex={userAnswer} display={false} />
                                  </div>
                                </div>
                              )}
                              {currentCard.explanation && (
                                <div className="card-explanation">
                                  <strong>Note: </strong>
                                  <MathText text={currentCard.explanation} />
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        <div className="nav-controls" style={{ marginTop: '10px', marginBottom: 0 }}>
                          {activeLearnStage === 'mc' && verdict.correct && (
                            <button
                              type="button"
                              data-testid="learn-advance-write-btn"
                              className="btn-secondary"
                              onClick={handleAdvanceToWrite}
                            >
                              Now Write This Formula
                            </button>
                          )}
                          <button
                            type="button"
                            data-testid="verdict-continue-btn"
                            className="btn-primary"
                            onClick={handleNext}
                          >
                            {verdict.correct ? 'Next Card' : 'Continue'}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Single Unified Bottom Action Bar */}
                    <div className="study-bottom-bar">
                      <div className="study-bottom-group">
                        <button
                          type="button"
                          data-testid="learn-prev-btn"
                          className="btn-secondary compact-nav-btn"
                          onClick={handlePrev}
                        >
                          Previous
                        </button>
                        <button
                          type="button"
                          data-testid="learn-next-btn"
                          className="btn-secondary compact-nav-btn"
                          onClick={handleNext}
                        >
                          Next
                        </button>
                      </div>

                      {!verdict && (
                        <div className="study-bottom-group">
                          {currentCard.hint && (
                            <button
                              type="button"
                              data-testid="learn-hint-btn"
                              className="btn-secondary compact-nav-btn"
                              onClick={() => setShowHint(!showHint)}
                            >
                              {showHint ? 'Hide Hint' : 'Hint'}
                            </button>
                          )}
                          <button
                            type="button"
                            data-testid="learn-reveal-btn"
                            className="btn-secondary compact-nav-btn"
                            onClick={handleShowAnswer}
                          >
                            Reveal Answer
                          </button>
                          {activeLearnStage === 'write' && (
                            <button
                              type="button"
                              data-testid="learn-check-btn"
                              className="btn-primary compact-nav-btn"
                              disabled={!userAnswer.trim()}
                              onClick={handleCheckAnswer}
                            >
                              Check Answer
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </section>
                )}
              </>
            )}
          </div>
        )}
      </main>

      {toast && (
        <aside className="toast-container" role="status" aria-live="polite">
          <span>{toast.message}</span>
          {toast.onUndo && (
            <button
              type="button"
              data-testid="toast-undo-btn"
              className="toast-btn"
              onClick={() => {
                toast.onUndo?.();
                setToast(null);
              }}
            >
              Undo
            </button>
          )}
        </aside>
      )}

      {showCardCreator && (
        <CardCreatorModal
          initialCard={editingCard}
          setGlossary={activeSet?.glossary}
          deckName={activeSet?.name}
          onSave={handleSaveCard}
          onBulkAdd={handleBulkAddCards}
          onApplyTermToSetGlossary={handleApplyTermToSetGlossary}
          onClose={() => {
            setShowCardCreator(false);
            setEditingCard(undefined);
          }}
        />
      )}

      {showSetSelector && (
        <SetSelectorModal
          sets={sets}
          activeSetId={activeSetId}
          onSelectSet={handleSelectSetId}
          onCreateSet={handleCreateSet}
          onImportStarterDeck={handleImportStarterDeck}
          onClose={() => setShowSetSelector(false)}
        />
      )}

      {showGlossaryModal && activeSet && (
        <SetGlossaryModal
          key={activeSet.id}
          activeSet={activeSet}
          onSaveGlossary={handleSaveSetGlossary}
          onApplyDefinitionToCards={handleApplyGlossaryDefinitionToCards}
          onClose={() => setShowGlossaryModal(false)}
        />
      )}

      {showSettings && (
        <SettingsModal
          currentSettings={settings}
          onSave={(newSettings) => setSettings(newSettings)}
          onClose={() => setShowSettings(false)}
        />
      )}

      {showExportStudio && activeSet && (
        <ExportStudioModal
          activeSet={activeSet}
          onClose={() => setShowExportStudio(false)}
          onEditCard={(cardId) => {
            const card = fullDeck.find((c) => c.id === cardId);
            if (card) {
              setEditingCard(card);
              setShowCardCreator(true);
            }
          }}
        />
      )}
    </>
  );
};

export default App;
