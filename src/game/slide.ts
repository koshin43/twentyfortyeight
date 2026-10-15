import { SIZE } from './board';
import type { Direction, GameEvent, Tile } from './types';

export const DIRECTIONS: Direction[] = ['up', 'down', 'left', 'right'];

const LAST = SIZE - 1;

/** Cell k of line i, counting k from the edge the swipe moves towards. */
const LINE: Record<Direction, (i: number, k: number) => [number, number]> = {
  left: (i, k) => [i, k],
  right: (i, k) => [i, LAST - k],
  up: (i, k) => [k, i],
  down: (i, k) => [LAST - k, i],
};

export interface Slid {
  tiles: Tile[];
  events: GameEvent[];
  nextTileId: number;
  gained: number;
}

/** Slides and merges every line. Returns null when nothing changes. */
export function slide(tiles: Tile[], dir: Direction, nextTileId: number): Slid | null {
  const out: Tile[] = [];
  const merges: GameEvent[] = [];
  let id = nextTileId;
  let gained = 0;

  for (let i = 0; i < SIZE; i++) {
    let free = 0;
    let prev: { tile: Tile; index: number } | null = null;
    for (let k = 0; k < SIZE; k++) {
      const [row, col] = LINE[dir](i, k);
      const tile = tiles.find((t) => t.row === row && t.col === col);
      if (!tile) continue;
      if (prev && prev.tile.value === tile.value) {
        const target = out[prev.index];
        const merged: Tile = { id: id++, row: target.row, col: target.col, value: tile.value * 2 };
        out[prev.index] = merged;
        merges.push({ kind: 'merge', tile: merged, sources: [prev.tile, tile] });
        gained += merged.value;
        prev = null;
      } else {
        const [r, c] = LINE[dir](i, free++);
        out.push({ ...tile, row: r, col: c });
        prev = { tile, index: out.length - 1 };
      }
    }
  }

  const slides: GameEvent[] = [];
  for (const t of out) {
    const before = tiles.find((b) => b.id === t.id);
    if (before && (before.row !== t.row || before.col !== t.col)) {
      slides.push({ kind: 'slide', id: t.id, from: [before.row, before.col], to: [t.row, t.col] });
    }
  }
  if (slides.length === 0 && merges.length === 0) return null;
  return { tiles: out, events: [...slides, ...merges], nextTileId: id, gained };
}
