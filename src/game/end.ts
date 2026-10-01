import { POWERS, SIZES } from './sizes';
import { DIRECTIONS, slide } from './slide';
import type { BoardSize, Game, Outcome, Power } from './types';

export function isWon(game: Game): boolean {
  return game.bestTile >= SIZES[game.size].winTile;
}

/** Milestones reached: the win tile, then each doubling of it. */
export function refillsEarned(size: BoardSize, bestTile: number): number {
  const { winTile } = SIZES[size];
  return bestTile < winTile ? 0 : Math.log2(bestTile / winTile) + 1;
}

export function isStuck(game: Game): boolean {
  return DIRECTIONS.every((dir) => slide(game.tiles, game.size, dir, game.nextTileId) === null);
}

export function canUsePower(game: Game, power: Power): boolean {
  const status = game.wild?.powers[power].status;
  if (status !== 'ready' && status !== 'bonus') return false;
  if (power === 'swap') return game.tiles.filter((t) => t.kind !== 'stone').length >= 2;
  if (power === 'undo') return game.wild?.undo !== null;
  return true;
}

export function gameEnd(game: Game): 'over' | 'timeUp' | null {
  if (game.blitzMsLeft === 0) return 'timeUp';
  if (!isStuck(game)) return null;
  if (game.wild && (game.wild.refillWaiting || POWERS.some((p) => canUsePower(game, p)))) return null;
  return 'over';
}

/** Adds the end event when the action left the game over. */
export function withEnd(outcome: Outcome): Outcome {
  return gameEnd(outcome.game) === 'over' ? { ...outcome, events: [...outcome.events, { kind: 'end' }] } : outcome;
}
