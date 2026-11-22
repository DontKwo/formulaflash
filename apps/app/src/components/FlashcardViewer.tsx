import React from 'react';
import type { FlashcardItem } from '../data/sample-deck.ts';
import type { TermDefinition } from '@formulaflash/core';
import { InteractiveEquation } from './InteractiveEquation.tsx';
import { MathDisplay, MathText } from './MathDisplay.tsx';

export interface FlashcardViewerProps {
  card: FlashcardItem;
  isFlipped: boolean;
  onFlip: () => void;
  setGlossary?: Record<string, TermDefinition>;
  termDefinitionsMode?: 'off' | 'on-request' | 'after-answer' | 'hint-before-answer';
  onEditTerms?: () => void;
}

export const FlashcardViewer: React.FC<FlashcardViewerProps> = ({
  card,
  isFlipped,
  onFlip,
  setGlossary,
  termDefinitionsMode = 'on-request',
  onEditTerms,
}) => {
  const showTerms = termDefinitionsMode !== 'off';

  return (
    <div
      className="flashcard-viewer-container"
      style={{ perspective: '1000px', width: '100%', maxWidth: '100%', marginBottom: '20px' }}
    >
      <div
        className="flashcard-inner"
        data-testid="flashcard-card-inner"
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: '100%',
          minHeight: '280px',
          transition: 'transform 0.45s cubic-bezier(0.22, 1, 0.36, 1)',
          transformStyle: 'preserve-3d',
          transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
          cursor: 'pointer',
        }}
        onClick={onFlip}
        role="button"
        tabIndex={0}
        aria-label={
          isFlipped
            ? 'Card back showing equation. Tap to flip to question.'
            : 'Card front showing question. Tap to flip for equation.'
        }
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onFlip();
          }
        }}
      >
        {/* Front of Card */}
        <div
          className="flashcard-face flashcard-front flashcard"
          aria-hidden={isFlipped}
          style={{
            position: isFlipped ? 'absolute' : 'relative',
            width: '100%',
            height: '100%',
            backfaceVisibility: 'hidden',
            visibility: isFlipped ? 'hidden' : 'visible',
          }}
        >
          <div className="card-body">
            <h2 className="card-title">
              <MathText text={card.title} />
            </h2>
            <p className="card-prompt">
              <MathText text={card.prompt} />
            </p>

            {termDefinitionsMode === 'hint-before-answer' && (
              <div
                style={{ marginTop: '16px', width: '100%', minWidth: 0 }}
                onClick={(e) => e.stopPropagation()}
              >
                <InteractiveEquation
                  latex={card.latexAnswer}
                  cardTerms={card.terms}
                  setGlossary={setGlossary}
                  hideSymbolsInitially={true}
                  onEditCardTerms={onEditTerms}
                />
              </div>
            )}

            <div style={{ marginTop: '20px' }}>
              <span className="card-flip-prompt">Tap card to flip for equation</span>
            </div>
          </div>
        </div>

        {/* Back of Card */}
        <div
          className="flashcard-face flashcard-back flashcard"
          aria-hidden={!isFlipped}
          style={{
            position: isFlipped ? 'relative' : 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            backfaceVisibility: 'hidden',
            transform: 'rotateY(180deg)',
            visibility: isFlipped ? 'visible' : 'hidden',
          }}
          onClick={(e) => {
            if ((e.target as HTMLElement).closest('button, input, textarea, .interactive-equation-container, .card-math-hero')) {
              e.stopPropagation();
            }
          }}
        >
          <div className="card-body">
            <span className="deck-tag" style={{ marginBottom: '8px' }}>
              Target Equation
            </span>

            {showTerms ? (
              <div style={{ width: '100%', minWidth: 0 }}>
                <InteractiveEquation
                  latex={card.latexAnswer}
                  cardTerms={card.terms}
                  setGlossary={setGlossary}
                  autoShowTerms={termDefinitionsMode === 'after-answer'}
                  onEditCardTerms={onEditTerms}
                />
              </div>
            ) : (
              <div className="card-math-hero">
                <MathDisplay latex={card.latexAnswer} display={true} />
              </div>
            )}

            {card.explanation && (
              <div className="card-explanation" style={{ marginTop: '12px' }}>
                <strong>Explanation: </strong>
                <MathText text={card.explanation} />
              </div>
            )}

            <div style={{ marginTop: '16px' }}>
              <span className="card-flip-prompt">Tap background to flip back</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
