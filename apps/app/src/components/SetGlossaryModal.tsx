import React, { useState, useMemo, useEffect } from 'react';
import type { TermDefinition } from '@formulaflash/core';
import { normalizeSymbolKey, getSuggestionsForSymbol, detectFormulaTerms } from '@formulaflash/core';
import { MathDisplay, MathText } from './MathDisplay.tsx';
import type { FlashcardSet } from '../data/storage.ts';

export interface SetGlossaryModalProps {
  activeSet: FlashcardSet;
  onSaveGlossary: (glossary: Record<string, TermDefinition>) => void;
  onApplyDefinitionToCards: (symbol: string, term: TermDefinition) => void;
  onClose: () => void;
}

export const SetGlossaryModal: React.FC<SetGlossaryModalProps> = ({
  activeSet,
  onSaveGlossary,
  onApplyDefinitionToCards,
  onClose,
}) => {
  const [glossary, setGlossary] = useState<Record<string, TermDefinition>>(() => activeSet.glossary || {});
  const [searchQuery, setSearchQuery] = useState('');
  const [filterUndefinedOnly, setFilterUndefinedOnly] = useState(false);
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);

  useEffect(() => {
    setGlossary(activeSet.glossary || {});
    setSelectedSymbol(null);
  }, [activeSet.id, activeSet.glossary]);

  const setSymbolStats = useMemo(() => {
    const counts = new Map<string, { symbol: string; count: number; cards: string[] }>();

    for (const card of activeSet.cards) {
      const cardSymbols = new Set<string>();
      if (card.terms && card.terms.length > 0) {
        for (const t of card.terms) {
          cardSymbols.add(t.symbol);
        }
      } else if (card.latexAnswer) {
        for (const sym of detectFormulaTerms(card.latexAnswer)) {
          cardSymbols.add(sym);
        }
      }

      const seenKeys = new Set<string>();
      for (const sym of cardSymbols) {
        const k = normalizeSymbolKey(sym);
        if (seenKeys.has(k)) continue;
        seenKeys.add(k);
        const existing = counts.get(k) || { symbol: sym, count: 0, cards: [] };
        existing.count += 1;
        existing.cards.push(card.title);
        counts.set(k, existing);
      }
    }

    for (const [key, term] of Object.entries(glossary)) {
      const k = normalizeSymbolKey(key);
      if (!counts.has(k)) {
        counts.set(k, { symbol: term.symbol, count: 0, cards: [] });
      }
    }

    return Array.from(counts.values());
  }, [activeSet.cards, glossary]);

  const filteredSymbols = useMemo(() => {
    return setSymbolStats.filter((item) => {
      const term = glossary[normalizeSymbolKey(item.symbol)];
      const hasDef = !!term?.definition?.trim();
      if (filterUndefinedOnly && hasDef) return false;

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        item.symbol.toLowerCase().includes(q) ||
        (term?.name && term.name.toLowerCase().includes(q)) ||
        (term?.shortName && term.shortName.toLowerCase().includes(q)) ||
        (term?.definition && term.definition.toLowerCase().includes(q))
      );
    });
  }, [setSymbolStats, glossary, searchQuery, filterUndefinedOnly]);

  const activeTerm = selectedSymbol ? glossary[normalizeSymbolKey(selectedSymbol)] || { symbol: selectedSymbol } : null;

  const handleUpdateTerm = (updated: TermDefinition): void => {
    const key = normalizeSymbolKey(updated.symbol);
    const next = { ...glossary, [key]: updated };
    setGlossary(next);
    onSaveGlossary(next);
  };

  const handleDeleteTerm = (sym: string): void => {
    const key = normalizeSymbolKey(sym);
    const next = { ...glossary };
    delete next[key];
    setGlossary(next);
    onSaveGlossary(next);
    if (selectedSymbol === sym) setSelectedSymbol(null);
  };

  const suggestions = activeTerm ? getSuggestionsForSymbol(activeTerm.symbol) : [];

  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="set-glossary-dialog-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-content" style={{ maxWidth: '860px', width: '95vw', maxHeight: '90vh' }}>
        <div className="modal-header">
          <div>
            <h2 id="set-glossary-dialog-title" className="modal-title">
              Deck Glossary: {activeSet.name}
            </h2>
            <span className="settings-desc">
              Per-deck symbol glossary isolated to this deck. Changes apply only to "{activeSet.name}".
            </span>
          </div>
          <button
            type="button"
            data-testid="glossary-close-btn"
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Close glossary modal"
          >
            x
          </button>
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', margin: '4px 0' }}>
          <input
            type="text"
            data-testid="glossary-search-input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search symbols or definitions in this deck..."
            style={{ flex: 1 }}
          />
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
            <input
              type="checkbox"
              data-testid="glossary-undefined-filter"
              checked={filterUndefinedOnly}
              onChange={(e) => setFilterUndefinedOnly(e.target.checked)}
            />
            Undefined only
          </label>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: selectedSymbol ? '1fr 1fr' : '1fr', gap: '16px', overflowY: 'auto', maxHeight: '55vh' }}>
          <div className="set-list" role="listbox" aria-label="Deck Symbols" style={{ maxHeight: 'none', overflowY: 'visible' }}>
            {filteredSymbols.length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                No symbols defined for this deck yet.
              </div>
            ) : (
              filteredSymbols.slice(0, 120).map((item, idx) => {
                const term = glossary[normalizeSymbolKey(item.symbol)];
                const isSelected = selectedSymbol === item.symbol;
                return (
                  <div
                    key={item.symbol}
                    data-testid={`glossary-item-${idx}`}
                    className={`set-item ${isSelected ? 'active' : ''}`}
                    onClick={() => setSelectedSymbol(item.symbol)}
                    style={{ cursor: 'pointer', padding: '10px 14px' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                      <div style={{ minWidth: '40px', fontSize: '18px', fontWeight: 600 }}>
                        <MathDisplay latex={item.symbol} display={false} />
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: '14px' }}>
                          {term?.name ? (
                            <MathText text={term.name} />
                          ) : (
                            <span style={{ color: 'var(--error)' }}>Undefined symbol</span>
                          )}
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          <MathText text={term?.definition || 'Click to add definition'} />
                        </div>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <span className="deck-tag" style={{ fontSize: '11px' }}>
                        {item.count} cards
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {selectedSymbol && activeTerm && (
            <div className="modal-form" style={{ padding: '16px', backgroundColor: 'var(--bg-card-secondary)', border: '1px solid var(--border)', borderRadius: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>Edit Symbol:</span>
                  <MathDisplay latex={activeTerm.symbol} display={false} />
                </h3>
                <button
                  type="button"
                  data-testid="glossary-delete-term-btn"
                  className="btn-danger"
                  style={{ minHeight: '30px', height: '30px', padding: '0 8px', fontSize: '12px', flex: 'none' }}
                  onClick={() => handleDeleteTerm(activeTerm.symbol)}
                >
                  Delete
                </button>
              </div>

              {suggestions.length > 0 && (
                <div style={{ marginTop: '8px' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Quick fill:</span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '4px' }}>
                    {suggestions.map((sugg, i) => (
                      <button
                        key={i}
                        type="button"
                        data-testid={`glossary-suggestion-${i}`}
                        className="toolbar-btn"
                        style={{ fontSize: '12px', padding: '4px 8px', height: 'auto', minHeight: '30px' }}
                        onClick={() =>
                          handleUpdateTerm({
                            ...activeTerm,
                            symbol: activeTerm.symbol,
                            name: sugg.name,
                            definition: sugg.definition,
                            units: sugg.units,
                          })
                        }
                      >
                        {sugg.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="input-group" style={{ marginTop: '10px' }}>
                <label>Name / Label</label>
                <input
                  type="text"
                  data-testid="glossary-name-input"
                  value={activeTerm.name || ''}
                  onChange={(e) => handleUpdateTerm({ ...activeTerm, name: e.target.value })}
                  placeholder="e.g. Kinematic Viscosity"
                />
              </div>

              <div className="input-group" style={{ marginTop: '8px' }}>
                <label>Definition</label>
                <textarea
                  data-testid="glossary-definition-input"
                  value={activeTerm.definition || ''}
                  onChange={(e) => handleUpdateTerm({ ...activeTerm, definition: e.target.value })}
                  placeholder="Comprehensive definition..."
                  rows={2}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '8px' }}>
                <div className="input-group">
                  <label>Short Label (Cheat Sheet)</label>
                  <input
                    type="text"
                    data-testid="glossary-short-name-input"
                    value={activeTerm.shortName || ''}
                    onChange={(e) => handleUpdateTerm({ ...activeTerm, shortName: e.target.value })}
                    placeholder="e.g. Kin visc"
                  />
                </div>
                <div className="input-group">
                  <label>Units</label>
                  <input
                    type="text"
                    data-testid="glossary-units-input"
                    value={activeTerm.units || ''}
                    onChange={(e) => handleUpdateTerm({ ...activeTerm, units: e.target.value })}
                    placeholder="e.g. m^2/s"
                  />
                </div>
              </div>

              <div className="input-group" style={{ marginTop: '8px' }}>
                <label>Short Definition (Cheat Sheet)</label>
                <input
                  type="text"
                  data-testid="glossary-short-definition-input"
                  value={activeTerm.shortDefinition || ''}
                  onChange={(e) => handleUpdateTerm({ ...activeTerm, shortDefinition: e.target.value })}
                  placeholder="Concise 3-6 word cheat sheet version"
                />
              </div>

              <div style={{ marginTop: '12px', display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  data-testid="glossary-copy-to-cards-btn"
                  className="btn-secondary"
                  style={{ fontSize: '12px', padding: '6px 12px', minHeight: '36px' }}
                  onClick={() => onApplyDefinitionToCards(activeTerm.symbol, activeTerm)}
                >
                  Apply to Cards in This Deck
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="modal-actions" style={{ marginTop: '8px', justifyContent: 'flex-end' }}>
          <button
            type="button"
            data-testid="glossary-done-btn"
            className="btn-primary"
            style={{ flex: 'none', minWidth: '120px' }}
            onClick={onClose}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
