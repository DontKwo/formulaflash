import React, { useState, useMemo } from 'react';
import type { TermDefinition } from '@formulaflash/core';
import {
  detectFormulaTerms,
  resolveCardTerm,
  normalizeSymbolKey,
} from '@formulaflash/core';
import { MathDisplay, MathText } from './MathDisplay.tsx';

export interface InteractiveEquationProps {
  latex: string;
  cardTerms?: TermDefinition[];
  setGlossary?: Record<string, TermDefinition>;
  hideSymbolsInitially?: boolean;
  autoShowTerms?: boolean;
  onEditCardTerms?: () => void;
}

export const InteractiveEquation: React.FC<InteractiveEquationProps> = ({
  latex,
  cardTerms,
  setGlossary,
  hideSymbolsInitially = false,
  autoShowTerms = false,
  onEditCardTerms,
}) => {
  const [activeSymbol, setActiveSymbol] = useState<string | null>(null);
  const [showTermsPanel, setShowTermsPanel] = useState(autoShowTerms || hideSymbolsInitially);
  const [symbolsRevealed, setSymbolsRevealed] = useState(!hideSymbolsInitially);

  const detectedSymbols = useMemo(() => {
    return detectFormulaTerms(latex);
  }, [latex]);

  const resolvedTerms = useMemo(() => {
    return detectedSymbols.map((sym) => {
      const resolved = resolveCardTerm(sym, cardTerms, setGlossary);
      return {
        symbol: sym,
        term: resolved || { symbol: sym },
        isDefined: !!resolved?.definition?.trim(),
      };
    });
  }, [detectedSymbols, cardTerms, setGlossary]);

  const activeResolved = useMemo(() => {
    if (!activeSymbol) return null;
    return (
      resolvedTerms.find((r) => normalizeSymbolKey(r.symbol) === normalizeSymbolKey(activeSymbol)) ||
      null
    );
  }, [activeSymbol, resolvedTerms]);

  if (!latex.trim()) return null;

  if (resolvedTerms.length === 0) {
    return (
      <div className="card-math-hero">
        <MathDisplay latex={latex} display={true} />
      </div>
    );
  }

  return (
    <div className="interactive-equation-container">
      {symbolsRevealed ? (
        <div className="interactive-equation-inner">
          <div className="card-math-hero">
            <MathDisplay latex={latex} display={true} />
          </div>

          <div
            className="symbol-chips-bar"
            role="toolbar"
            aria-label="Equation symbols"
          >
            {resolvedTerms.map(({ symbol, term, isDefined }, idx) => {
              const isSelected = activeSymbol === symbol;
              return (
                <button
                  key={idx}
                  type="button"
                  data-testid={`term-symbol-chip-${idx}`}
                  className={`symbol-chip ${isSelected ? 'active' : ''} ${!isDefined ? 'undefined-chip' : ''}`}
                  onClick={() => {
                    setActiveSymbol(activeSymbol === symbol ? null : symbol);
                    setShowTermsPanel(true);
                  }}
                  aria-label={`${symbol}: ${term.name || (isDefined ? 'defined' : 'undefined')}`}
                >
                  <MathDisplay latex={symbol} display={false} />
                  {term.name && (
                    <span className="symbol-chip-label">
                      <MathText text={term.shortName || term.name} />
                    </span>
                  )}
                  {!isDefined && (
                    <span style={{ marginLeft: '4px', fontSize: '11px', color: 'var(--error)' }}>
                      ?
                    </span>
                  )}
                </button>
              );
            })}

            <button
              type="button"
              data-testid="interactive-terms-toggle-btn"
              className={`symbol-chip symbol-chip-toggle ${showTermsPanel ? 'active' : ''}`}
              onClick={() => setShowTermsPanel(!showTermsPanel)}
              aria-expanded={showTermsPanel}
            >
              {showTermsPanel ? 'Hide Variables' : `Variables (${resolvedTerms.length})`}
            </button>
          </div>
        </div>
      ) : (
        <div style={{ padding: '12px', textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
            <span className="deck-tag">Variables & Definitions (Symbols Hidden)</span>
            <button
              type="button"
              data-testid="interactive-reveal-symbols-btn"
              className="toolbar-btn"
              style={{ fontSize: '12px', padding: '4px 10px', height: '32px' }}
              onClick={() => setSymbolsRevealed(true)}
            >
              Reveal Symbols
            </button>
          </div>
        </div>
      )}

      {activeResolved && (
        <aside
          className="term-popover"
          data-testid="term-popover-card"
          role="region"
          aria-label={`Definition for ${activeResolved.symbol}`}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flexWrap: 'wrap' }}>
              {symbolsRevealed && (
                <span style={{ fontSize: '20px', fontWeight: 700 }}>
                  <MathDisplay latex={activeResolved.symbol} display={false} />
                </span>
              )}
              <div>
                <strong style={{ fontSize: '15px' }}>
                  <MathText
                    text={
                      activeResolved.term.name ||
                      (activeResolved.isDefined ? 'Named Term' : 'Undefined Symbol')
                    }
                  />
                </strong>
                {activeResolved.term.units && (
                  <span className="deck-tag" style={{ marginLeft: '8px', fontSize: '11px' }}>
                    [<MathText text={activeResolved.term.units} />]
                  </span>
                )}
              </div>
            </div>
            <button
              type="button"
              data-testid="term-popover-close-btn"
              className="modal-close-btn"
              style={{ minHeight: '32px', height: '32px', minWidth: '32px', width: '32px' }}
              onClick={() => setActiveSymbol(null)}
              aria-label="Close definition"
            >
              x
            </button>
          </div>

          <p style={{ margin: '8px 0 0 0', fontSize: '14px', lineHeight: 1.5, color: 'var(--text-primary)' }}>
            {activeResolved.term.definition ? (
              <MathText text={activeResolved.term.definition} />
            ) : (
              <span style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                No definition set for this symbol in this deck yet.{' '}
                {onEditCardTerms && (
                  <button
                    type="button"
                    data-testid="term-popover-define-btn"
                    className="btn-secondary"
                    style={{ fontSize: '11px', padding: '2px 8px', minHeight: '26px', height: '26px', flex: 'none' }}
                    onClick={onEditCardTerms}
                  >
                    Define Now
                  </button>
                )}
              </span>
            )}
          </p>

          {activeResolved.term.note && (
            <div style={{ marginTop: '6px', fontSize: '12px', color: 'var(--text-secondary)' }}>
              Note: <MathText text={activeResolved.term.note} />
            </div>
          )}
        </aside>
      )}

      {showTermsPanel && (
        <section
          className="terms-list-panel"
          data-testid="terms-list-panel"
          aria-label="Term definitions list"
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <span className="settings-section-title" style={{ marginBottom: 0 }}>
              Variables & Parameters
            </span>
            {onEditCardTerms && (
              <button
                type="button"
                data-testid="terms-panel-edit-btn"
                className="btn-secondary"
                style={{ fontSize: '12px', padding: '4px 10px', minHeight: '30px', height: '30px', flex: 'none' }}
                onClick={onEditCardTerms}
              >
                Edit Terms
              </button>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {resolvedTerms.map(({ symbol, term, isDefined }, idx) => {
              const isSelected = activeSymbol === symbol;
              return (
                <div
                  key={idx}
                  data-testid={`term-panel-row-${idx}`}
                  className={`term-panel-row ${isSelected ? 'active' : ''}`}
                  onClick={() => setActiveSymbol(isSelected ? null : symbol)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setActiveSymbol(isSelected ? null : symbol);
                    }
                  }}
                >
                  {symbolsRevealed && (
                    <div className="term-panel-symbol">
                      <MathDisplay latex={symbol} display={false} />
                    </div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                      <strong style={{ fontSize: '13px', color: 'var(--text-primary)' }}>
                        <MathText text={term.name || (isDefined ? 'Named Term' : 'Undefined')} />
                      </strong>
                      {term.units && (
                        <span className="deck-tag" style={{ fontSize: '10px', padding: '2px 6px' }}>
                          <MathText text={term.units} />
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                      <MathText text={term.definition || 'No definition set'} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
};
