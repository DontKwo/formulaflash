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
import { AnalyticsView } from './components/AnalyticsView.tsx';
import {
  loadSets,
  saveSet,
  saveCard,
  deleteCard,
  saveSetGlossary,
  importStarterDeck,
  type FlashcardSet,
} from './data/storage.ts';
import type { FlashcardItem } from './data/sample-deck.ts';

type AppMode = 'study' | 'learn' | 'analytics';
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

export const App: React.FC = () => {
  const [sets, setSets] = useState<FlashcardSet[]>(() => loadSets());
  const [activeSetId, setActiveSetId] = useState<string>(() => loadSets()[0]?.id || 'cfd-complete-reference');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [mode, setMode] = useState<AppMode>('learn');
  const [isFlipped, setIsFlipped] = useState(false);

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

  const analyticsStats = useMemo(() => {
    let mastered = 0;
    let proficient = 0;
    let familiar = 0;
    let unseen = 0;
    for (const c of deck) {
      const lvl = progressMap[c.id]?.level ?? 0;
      if (lvl === 3) mastered++;
      else if (lvl === 2) proficient++;
      else if (lvl === 1) familiar++;
      else unseen++;
    }
    return { mastered, proficient, familiar, unseen };
  }, [deck, progressMap]);

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
    showToastNotification(`Created deck "${name}"`);
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
      showToastNotification(`Added starter deck "${created.name}"`);
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

    showToastNotification(`Card deleted`, () => {
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
      {/* Tier 1: Primary App Chrome (Brand + Mode Switcher + Global Settings) */}
      <header className="app-header" role="banner">
        <div className="brand">
          <span className="brand-emblem" aria-hidden="true">f(x)</span>
          <div className="brand-copy">
            <h1 className="brand-title">Formula Flash</h1>
            <span className="brand-subtitle">Symbolic Recall & Cheat Sheet Studio</span>
          </div>
        </div>

        <div className="mode-toggle" role="tablist" aria-label="Study modes">
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
            Cards
          </button>
          <button
            type="button"
            role="tab"
            data-testid="mode-tab-analytics"
            aria-selected={mode === 'analytics'}
            className={`mode-tab ${mode === 'analytics' ? 'active' : ''}`}
            onClick={() => setMode('analytics')}
          >
            Analytics
          </button>
        </div>

        <button
          type="button"
          data-testid="nav-settings-btn"
          className="header-btn header-settings-btn"
          onClick={() => setShowSettings(true)}
          aria-label="Settings"
        >
          Settings
        </button>
      </header>

      {/* Tier 2: Conscious Deck Context Bar (Deck Selector + Topic Filter | Glossary, PDF, + Card) */}
      <section className="deck-context-bar" aria-label="Deck workspace controls">
        <div className="deck-context-left">
          <button
            type="button"
            data-testid="nav-decks-btn"
            className="deck-picker-btn"
            onClick={() => setShowSetSelector(true)}
            aria-label="Select Deck"
          >
            <span className="deck-picker-label">Deck</span>
            <span className="deck-picker-name">{activeSet?.name || 'Select Deck'}</span>
            <span className="deck-picker-count">{fullDeck.length}</span>
          </button>

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

        <nav className="deck-context-actions" aria-label="Deck actions">
          <button
            type="button"
            data-testid="nav-glossary-btn"
            className="header-btn"
            onClick={() => setShowGlossaryModal(true)}
            aria-label="Deck Glossary"
          >
            Deck Glossary
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
        </nav>
      </section>

      <main className="app-main">
        {deck.length === 0 ? (
          <section className="flashcard" style={{ textAlign: 'center', padding: '44px 20px', justifyContent: 'center' }}>
            <h2 className="card-title">This deck view is empty</h2>
            <p className="card-prompt" style={{ marginBottom: '24px' }}>
              {categoryFilter !== 'all'
                ? 'No cards match this topic filter. Reset the topic filter or add a new card.'
                : 'Add equations or terms to start practicing in Learn or Flashcard mode.'}
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
            <section className="deck-meta" aria-label="Session status and options">
              <div className="deck-meta-tags">
                <span className="deck-tag">{currentCard.category}</span>
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
                <div className="nav-controls" style={{ marginTop: '16px' }}>
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

                <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', marginTop: '12px' }}>
                  <button
                    type="button"
                    data-testid="study-edit-btn"
                    className="btn-secondary"
                    style={{ flex: 'none', height: '40px', minHeight: '40px', fontSize: '13px' }}
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
                    className="btn-danger"
                    style={{ flex: 'none', height: '40px', minHeight: '40px', fontSize: '13px' }}
                    onClick={() => handleDeleteCard(currentCard.id)}
                  >
                    Delete Card
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
                      <span className="input-label">Select the matching equation</span>
                      <span className="input-helper">Master multiple choice first before writing from recall</span>
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

                {verdict ? (
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
                ) : (
                  <div className="nav-controls">
                    {currentCard.hint && (
                      <button
                        type="button"
                        data-testid="learn-hint-btn"
                        className="btn-secondary"
                        onClick={() => setShowHint(!showHint)}
                      >
                        {showHint ? 'Hide Hint' : 'Hint'}
                      </button>
                    )}
                    <button
                      type="button"
                      data-testid="learn-reveal-btn"
                      className="btn-secondary"
                      onClick={handleShowAnswer}
                    >
                      Reveal Answer
                    </button>
                    {activeLearnStage === 'write' && (
                      <button
                        type="button"
                        data-testid="learn-check-btn"
                        className="btn-primary"
                        disabled={!userAnswer.trim()}
                        onClick={handleCheckAnswer}
                      >
                        Check Answer
                      </button>
                    )}
                  </div>
                )}

                <div className="nav-controls" style={{ marginTop: '4px' }}>
                  <button
                    type="button"
                    data-testid="learn-prev-btn"
                    className="btn-secondary"
                    onClick={handlePrev}
                  >
                    Previous
                  </button>
                  <div className="session-score-pill">
                    Score: {score.correct} / {score.total}
                  </div>
                  <button
                    type="button"
                    data-testid="learn-next-btn"
                    className="btn-secondary"
                    onClick={handleNext}
                  >
                    Next
                  </button>
                </div>
              </section>
            )}
          </>
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
