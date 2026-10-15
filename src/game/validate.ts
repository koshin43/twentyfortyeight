import { SIZE, WIN_TILE } from './board';
import { BLITZ_MS, PACES } from './pace';
import type { Game, Tile } from './types';

/** A plain object with exactly these keys. */
export function isExactObject(value: unknown, keys: string[]): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const own = Object.keys(value);
  return own.length === keys.length && keys.every((k) => own.includes(k));
}

export function isCount(value: unknown, max = Number.MAX_SAFE_INTEGER): value is number {
  return Number.isInteger(value) && (value as number) >= 0 && (value as number) <= max;
}

export function isTileValue(value: unknown): value is number {
  return isCount(value) && value >= 2 && (value & (value - 1)) === 0;
}

export function isGame(value: unknown): value is Game {
  if (!isExactObject(value, ['tiles', 'nextTileId', 'score', 'random', 'pace', 'bestTile', 'winSeen', 'blitzMsLeft'])) return false;
  const { tiles, nextTileId, score, random, pace, bestTile, winSeen, blitzMsLeft } = value;
  if (!isCount(nextTileId) || !isCount(score) || !isCount(random, 0xffffffff) || !isTileValue(bestTile)) return false;
  if (!PACES.includes(pace as Game['pace'])) return false;
  if (pace === 'blitz' ? !isCount(blitzMsLeft, BLITZ_MS) : blitzMsLeft !== null) return false;
  if (typeof winSeen !== 'boolean' || (winSeen && (pace === 'blitz' || bestTile < WIN_TILE))) return false;
  if (!Array.isArray(tiles)) return false;
  const valid = tiles.every(
    (t) =>
      isExactObject(t, ['id', 'row', 'col', 'value']) &&
      isCount(t.id, nextTileId - 1) &&
      isCount(t.row, SIZE - 1) &&
      isCount(t.col, SIZE - 1) &&
      isTileValue(t.value) &&
      t.value <= bestTile,
  );
  const typed = tiles as Tile[];
  return valid && new Set(typed.map((t) => t.row * SIZE + t.col)).size === typed.length && new Set(typed.map((t) => t.id)).size === typed.length;
}
