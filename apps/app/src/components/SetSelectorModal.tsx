import React, { useState, useEffect } from 'react';
import { getAvailableStarterDecks, type FlashcardSet } from '../data/storage.ts';

export interface SetSelectorModalProps {
  sets: FlashcardSet[];
  activeSetId: string;
  onSelectSet: (setId: string) => void;
  onCreateSet: (name: string, category: string) => void;
  onImportStarterDeck?: (deckId: string) => void;
  onClose: () => void;
}

export const SetSelectorModal: React.FC<SetSelectorModalProps> = ({
  sets,
  activeSetId,
  onSelectSet,
  onCreateSet,
  onImportStarterDeck,
  onClose,
}) => {
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState('');

  const starterDecks = getAvailableStarterDecks();
  const existingIds = new Set(sets.map((s) => s.id));

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleCreate = (): void => {
    if (!newName.trim()) return;
    onCreateSet(newName.trim(), newCategory.trim() || 'General');
    setIsCreating(false);
    setNewName('');
    setNewCategory('');
  };

  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="set-selector-dialog-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-content" style={{ maxWidth: '640px' }}>
        <div className="modal-header">
          <div>
            <h2 id="set-selector-dialog-title" className="modal-title">
              {isCreating ? 'Create New Deck' : 'Your Flashcard Decks'}
            </h2>
            <span className="settings-desc">
              {isCreating
                ? 'Starts with an isolated deck glossary.'
                : 'Each deck maintains its own card collection and isolated glossary.'}
            </span>
          </div>
          <button
            type="button"
            data-testid="set-selector-close-btn"
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Close dialog"
          >
            x
          </button>
        </div>

        {!isCreating ? (
          <>
            <div className="set-list" role="listbox" aria-label="Deck List">
              {sets.map((set, idx) => {
                const glossaryCount = Object.keys(set.glossary || {}).length;
                return (
                  <div
                    key={set.id}
                    data-testid={`set-selector-item-${idx}`}
                    className={`set-item ${set.id === activeSetId ? 'active' : ''}`}
                    onClick={() => {
                      onSelectSet(set.id);
                      onClose();
                    }}
                    role="option"
                    aria-selected={set.id === activeSetId}
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onSelectSet(set.id);
                        onClose();
                      }
                    }}
                  >
                    <div>
                      <div className="set-name">{set.name}</div>
                      <div style={{ display: 'flex', gap: '6px', marginTop: '4px', flexWrap: 'wrap' }}>
                        <span className="deck-tag">{set.category}</span>
                        <span className="deck-tag" style={{ opacity: 0.85 }}>
                          {glossaryCount} glossary symbols
                        </span>
                      </div>
                    </div>
                    <div className="set-count">{set.cards.length} cards</div>
                  </div>
                );
              })}
            </div>

            {onImportStarterDeck && starterDecks.length > 0 && (
              <div className="settings-section" style={{ marginTop: '4px' }}>
                <span className="settings-section-title">Curated Starter Library</span>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '8px' }}>
                  {starterDecks.map((deck, idx) => {
                    const alreadyAdded = existingIds.has(deck.id);
                    return (
                      <div
                        key={deck.id}
                        style={{
                          padding: '10px 12px',
                          background: 'var(--bg-card-secondary)',
                          border: '1px solid var(--border)',
                          borderRadius: '10px',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: '8px',
                        }}
                      >
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                            {deck.title}
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                            {deck.cards.length} cards
                          </div>
                        </div>
                        <button
                          type="button"
                          data-testid={`starter-deck-import-${idx}`}
                          className={alreadyAdded ? 'btn-secondary' : 'btn-primary'}
                          style={{ flex: 'none', minHeight: '32px', height: '32px', fontSize: '12px', padding: '0 10px' }}
                          onClick={() => {
                            onImportStarterDeck(deck.id);
                            onClose();
                          }}
                        >
                          {alreadyAdded ? 'Open' : 'Add'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="modal-actions" style={{ justifyContent: 'space-between' }}>
              <button
                type="button"
                data-testid="set-selector-cancel-btn"
                className="btn-secondary"
                onClick={onClose}
              >
                Close
              </button>
              <button
                type="button"
                data-testid="set-selector-new-btn"
                className="btn-primary"
                onClick={() => setIsCreating(true)}
              >
                + New Deck
              </button>
            </div>
          </>
        ) : (
          <div className="modal-form">
            <div className="input-group">
              <label htmlFor="set-name">Deck Name</label>
              <input
                id="set-name"
                data-testid="set-create-name-input"
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Physics 101"
                autoFocus
              />
            </div>
            <div className="input-group" style={{ marginTop: '12px' }}>
              <label htmlFor="set-category">Category (Optional)</label>
              <input
                id="set-category"
                data-testid="set-create-category-input"
                type="text"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                placeholder="e.g. Science"
              />
            </div>
            <div className="modal-actions" style={{ marginTop: '20px' }}>
              <button
                type="button"
                data-testid="set-create-back-btn"
                className="btn-secondary"
                onClick={() => setIsCreating(false)}
              >
                Back
              </button>
              <button
                type="button"
                data-testid="set-create-submit-btn"
                className="btn-primary"
                onClick={handleCreate}
                disabled={!newName.trim()}
              >
                Create Deck
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
