import { WIN_TILE } from './board';
import { DIRECTIONS, slide } from './slide';
import type { Game } from './types';

export function isWon(game: Game): boolean {
  return game.bestTile >= WIN_TILE;
}

export function keepGoing(game: Game): Game {
  return { ...game, winSeen: true };
}

export function isStuck(game: Game): boolean {
  return DIRECTIONS.every((dir) => slide(game.tiles, dir, game.nextTileId) === null);
}

export function gameEnd(game: Game): 'over' | 'timeUp' | null {
  if (game.blitzMsLeft === 0) return 'timeUp';
  return isStuck(game) ? 'over' : null;
}
