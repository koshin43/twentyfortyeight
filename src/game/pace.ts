import type { Game, Outcome, Pace } from './types';

export const PACES: Pace[] = ['endless', 'blitz'];
export const BLITZ_MS = 180_000;

/** Runs the Blitz clock down by elapsed milliseconds. Reaching 0:00 ends the game. */
export function spendTime(game: Game, ms: number): Outcome {
  const blitzMsLeft = Math.max(0, game.blitzMsLeft! - ms);
  return { game: { ...game, blitzMsLeft }, events: blitzMsLeft === 0 ? [{ kind: 'end' }] : [] };
}
