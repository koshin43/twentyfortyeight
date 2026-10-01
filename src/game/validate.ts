import { BLITZ_MS, BOARD_SIZES, POWERS, SIZES } from './sizes';
import type { BoardSize, Game, Position, Setup, Style } from './types';

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

function isOneOf<T>(value: unknown, options: readonly T[]): value is T {
  return options.includes(value as T);
}

export function isSetup(value: unknown): value is Setup {
  return (
    isExactObject(value, ['size', 'style', 'pace', 'draft']) &&
    isOneOf(value.size, BOARD_SIZES) &&
    isOneOf(value.style, ['classic', 'wild']) &&
    isOneOf(value.pace, ['endless', 'blitz']) &&
    Array.isArray(value.draft) &&
    value.draft.length === 2 &&
    value.draft.every((p) => isOneOf(p, POWERS)) &&
    value.draft[0] !== value.draft[1]
  );
}

/** The position fields of a game or Undo snapshot whose keys were already checked. */
function isPosition(value: Record<string, unknown>, size: BoardSize, style: Style): value is Record<string, unknown> & Position {
  const { tiles, nextTileId } = value;
  if (!isCount(nextTileId) || !isCount(value.score) || !isCount(value.random, 0xffffffff)) return false;
  if (!Array.isArray(tiles)) return false;
  const base = ['id', 'row', 'col', 'kind'];
  const valid = tiles.every(
    (t) =>
      (isExactObject(t, [...base, 'value']) && t.kind === 'number' && isTileValue(t.value)) ||
      (isExactObject(t, base) && t.kind === 'joker' && style === 'wild') ||
      (isExactObject(t, [...base, 'countdown']) && t.kind === 'stone' && style === 'wild' && isCount(t.countdown, 10) && t.countdown >= 1),
  );
  if (!valid) return false;
  const typed = tiles as Position['tiles'];
  const cells = new Set(typed.map((t) => t.row * size + t.col));
  const ids = new Set(typed.map((t) => t.id));
  return (
    typed.every((t) => isCount(t.row, size - 1) && isCount(t.col, size - 1) && isCount(t.id, nextTileId - 1)) &&
    cells.size === typed.length &&
    ids.size === typed.length &&
    typed.filter((t) => t.kind === 'joker').length <= 1 &&
    typed.filter((t) => t.kind === 'stone').length <= 1
  );
}

const POSITION_KEYS = ['tiles', 'nextTileId', 'score', 'random'];

export function isGame(value: unknown): value is Game {
  if (!isExactObject(value, [...POSITION_KEYS, 'size', 'style', 'pace', 'bestTile', 'winSeen', 'wild', 'blitzMsLeft'])) return false;
  const { size, style, pace, bestTile, winSeen, wild, blitzMsLeft } = value;
  if (!isOneOf(size, BOARD_SIZES) || !isOneOf(style, ['classic', 'wild'] as const) || !isOneOf(pace, ['endless', 'blitz'])) return false;
  if (!isPosition(value, size, style) || !isTileValue(bestTile)) return false;
  if (value.tiles.some((t) => t.kind === 'number' && t.value > bestTile)) return false;
  if (typeof winSeen !== 'boolean' || (winSeen && (pace === 'blitz' || bestTile < SIZES[size].winTile))) return false;
  if (pace === 'blitz' ? !isCount(blitzMsLeft, BLITZ_MS) : blitzMsLeft !== null) return false;
  if (style === 'classic') return wild === null;

  if (!isExactObject(wild, ['powers', 'refillWaiting', 'undo']) || typeof wild.refillWaiting !== 'boolean') return false;
  if (wild.undo !== null && !(isExactObject(wild.undo, POSITION_KEYS) && isPosition(wild.undo, size, style))) return false;
  const { powers } = wild;
  if (!isExactObject(powers, POWERS)) return false;
  const states = POWERS.map((p) => powers[p]);
  const valid = states.every(
    (s) =>
      (isExactObject(s, ['status']) && isOneOf(s.status, ['ready', 'notDrafted', 'bonus'])) ||
      (isExactObject(s, ['status', 'movesLeft']) &&
        s.status === 'recharging' &&
        isCount(s.movesLeft, SIZES[size].recharge) &&
        s.movesLeft >= 1),
  );
  return valid && states.filter((s) => isOneOf((s as { status: unknown }).status, ['notDrafted', 'bonus'])).length === 1;
}
