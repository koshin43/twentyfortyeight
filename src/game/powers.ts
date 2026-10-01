import { withEnd } from './end';
import { SIZES } from './sizes';
import type { Game, Outcome, Power, Wild } from './types';

/** The power after use: drafted powers recharge, a bonus returns to not drafted. Clears Undo. */
function spend(game: Game, power: Power): Wild {
  const wild = game.wild!;
  const used = wild.powers[power].status === 'bonus'
    ? { status: 'notDrafted' as const }
    : { status: 'recharging' as const, movesLeft: SIZES[game.size].recharge };
  return { ...wild, powers: { ...wild.powers, [power]: used }, undo: null };
}

/** Removes a tile, Joker or stone. Refuses the last non-stone tile. */
export function smash(game: Game, id: number): Outcome | null {
  const tile = game.tiles.find((t) => t.id === id)!;
  if (tile.kind !== 'stone' && game.tiles.filter((t) => t.kind !== 'stone').length === 1) return null;
  return withEnd({
    game: { ...game, tiles: game.tiles.filter((t) => t.id !== id), wild: spend(game, 'smash') },
    events: [{ kind: 'power', power: 'smash' }, { kind: 'smash', tile }],
  });
}

/** Exchanges the cells of two different non-stone tiles. */
export function swap(game: Game, a: number, b: number): Outcome | null {
  const ta = game.tiles.find((t) => t.id === a)!;
  const tb = game.tiles.find((t) => t.id === b)!;
  if (a === b || ta.kind === 'stone' || tb.kind === 'stone') return null;
  const tiles = game.tiles.map((t) =>
    t.id === a ? { ...t, row: tb.row, col: tb.col } : t.id === b ? { ...t, row: ta.row, col: ta.col } : t,
  );
  return withEnd({
    game: { ...game, tiles, wild: spend(game, 'swap') },
    events: [
      { kind: 'power', power: 'swap' },
      { kind: 'slide', id: a, from: [ta.row, ta.col], to: [tb.row, tb.col] },
      { kind: 'slide', id: b, from: [tb.row, tb.col], to: [ta.row, ta.col] },
    ],
  });
}

/** Restores the position from before the last move. */
export function undo(game: Game): Outcome | null {
  const snapshot = game.wild!.undo;
  if (!snapshot) return null;
  return { game: { ...game, ...snapshot, wild: spend(game, 'undo') }, events: [{ kind: 'power', power: 'undo' }] };
}

/** Spends the waiting refill on a recharging power (ready) or the not-drafted one (bonus). */
export function pickRefill(game: Game, power: Power): Game {
  const wild = game.wild!;
  const state = wild.powers[power].status === 'notDrafted' ? { status: 'bonus' as const } : { status: 'ready' as const };
  return { ...game, wild: { ...wild, powers: { ...wild.powers, [power]: state }, refillWaiting: false } };
}

export function keepGoing(game: Game): Game {
  return { ...game, winSeen: true };
}
