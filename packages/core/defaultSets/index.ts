import { ALGEBRA_DECK } from './algebra.js';
import { TRIGONOMETRY_DECK } from './trigonometry.js';
import { CALCULUS_DECK } from './calculus.js';
import { LINEAR_ALGEBRA_DECK } from './linear-algebra.js';
import { PHYSICS_DECK } from './physics.js';
import type { StarterDeck } from './types.js';

export * from './types.js';
export { ALGEBRA_DECK } from './algebra.js';
export { TRIGONOMETRY_DECK } from './trigonometry.js';
export { CALCULUS_DECK } from './calculus.js';
export { LINEAR_ALGEBRA_DECK } from './linear-algebra.js';
export { PHYSICS_DECK } from './physics.js';
export * from './cfd/index.js';

export const STARTER_DECKS: Record<string, StarterDeck> = {
  algebra: ALGEBRA_DECK,
  trigonometry: TRIGONOMETRY_DECK,
  calculus: CALCULUS_DECK,
  'linear-algebra': LINEAR_ALGEBRA_DECK,
  physics: PHYSICS_DECK,
};

export function getStarterDeck(id: string): StarterDeck | undefined {
  return STARTER_DECKS[id];
}
