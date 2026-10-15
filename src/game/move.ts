import { WIN_TILE } from './board';
import { isStuck } from './end';
import { slide } from './slide';
import { spawn } from './spawn';
import type { Direction, Game, GameEvent, Outcome } from './types';

/** One swipe. Returns null when it changes nothing, which is not a move. */
export function move(game: Game, dir: Direction): Outcome | null {
  const slid = slide(game.tiles, dir, game.nextTileId);
  if (!slid) return null;
  const spawned = spawn({ ...game, tiles: slid.tiles, nextTileId: slid.nextTileId, score: game.score + slid.gained });
  const bestTile = Math.max(game.bestTile, ...spawned.game.tiles.map((t) => t.value));
  const next: Game = { ...spawned.game, bestTile };

  const events: GameEvent[] = [{ kind: 'move' }, ...slid.events, { kind: 'spawn', tile: spawned.tile }];
  if (bestTile > game.bestTile) events.push({ kind: 'bestTile', value: bestTile });
  if (game.bestTile < WIN_TILE && bestTile >= WIN_TILE) events.push({ kind: 'win' });
  if (isStuck(next)) events.push({ kind: 'end' });
  return { game: next, events };
}
