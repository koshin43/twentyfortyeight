import { refillsEarned, withEnd } from './end';
import { POWERS, SIZES } from './sizes';
import { slide } from './slide';
import { spawn, spawnOdds } from './spawn';
import type { Direction, Game, GameEvent, Outcome, PowerState, Tile, Wild } from './types';

/** One swipe. Returns null when it changes nothing, which is not a move. */
export function move(game: Game, dir: Direction): Outcome | null {
  const slid = slide(game.tiles, game.size, dir, game.nextTileId);
  if (!slid) return null;
  const events: GameEvent[] = [{ kind: 'move' }, ...slid.events];

  const tiles: Tile[] = [];
  for (const t of slid.tiles) {
    if (t.kind !== 'stone') tiles.push(t);
    else if (t.countdown > 1) tiles.push({ ...t, countdown: t.countdown - 1 });
    else events.push({ kind: 'crumble', tile: t });
  }

  let wild: Wild | null = game.wild && {
    powers: recharge(game.wild.powers),
    refillWaiting: game.wild.refillWaiting,
    undo: { tiles: game.tiles, nextTileId: game.nextTileId, score: game.score, random: game.random },
  };

  const bestTile = Math.max(game.bestTile, ...tiles.map((t) => (t.kind === 'number' ? t.value : 0)));
  if (bestTile > game.bestTile) events.push({ kind: 'bestTile', value: bestTile });
  const { winTile } = SIZES[game.size];
  if (game.bestTile < winTile && bestTile >= winTile) events.push({ kind: 'win' });
  if (
    wild &&
    !wild.refillWaiting &&
    refillsEarned(game.size, bestTile) > refillsEarned(game.size, game.bestTile) &&
    POWERS.some((p) => wild!.powers[p].status === 'recharging' || wild!.powers[p].status === 'notDrafted')
  ) {
    wild = { ...wild, refillWaiting: true };
    events.push({ kind: 'refill' });
  }

  const moved: Game = { ...game, tiles, nextTileId: slid.nextTileId, score: game.score + slid.gained, bestTile, wild };
  const { tile, position } = spawn(moved, game.size, spawnOdds(moved));
  events.push({ kind: 'spawn', tile });
  const spawnedBest = tile.kind === 'number' ? Math.max(bestTile, tile.value) : bestTile;
  return withEnd({ game: { ...moved, ...position, bestTile: spawnedBest }, events });
}

function recharge(powers: Wild['powers']): Wild['powers'] {
  const tick = (s: PowerState): PowerState =>
    s.status !== 'recharging' ? s : s.movesLeft > 1 ? { status: 'recharging', movesLeft: s.movesLeft - 1 } : { status: 'ready' };
  return { smash: tick(powers.smash), swap: tick(powers.swap), undo: tick(powers.undo) };
}
