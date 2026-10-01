import type { BoardSize, Direction, GameEvent, NumberTile, Tile } from './types';

export const DIRECTIONS: Direction[] = ['up', 'down', 'left', 'right'];

/** Cell k of line i, counting k from the edge the swipe moves towards. */
const LINE: Record<Direction, (i: number, k: number, last: number) => [number, number]> = {
  left: (i, k) => [i, k],
  right: (i, k, last) => [i, last - k],
  up: (i, k) => [k, i],
  down: (i, k, last) => [last - k, i],
};

/** The value two touching tiles merge into, or 0 when they don't merge. */
export function mergedValue(a: Tile, b: Tile): number {
  if (a.kind === 'stone' || b.kind === 'stone') return 0;
  if (a.kind === 'number' && b.kind === 'number') return a.value === b.value ? a.value * 2 : 0;
  if (a.kind === 'number') return a.value * 2;
  if (b.kind === 'number') return b.value * 2;
  return 0;
}

/** Tiles of each line in order from its leading edge, for the given direction. */
export function lines(tiles: Tile[], size: BoardSize, dir: Direction): Tile[][] {
  const at = new Map(tiles.map((t) => [t.row * size + t.col, t]));
  return Array.from({ length: size }, (_, i) =>
    Array.from({ length: size }, (_, k) => {
      const [row, col] = LINE[dir](i, k, size - 1);
      return at.get(row * size + col);
    }).filter((t) => t !== undefined),
  );
}

export interface Slid {
  tiles: Tile[];
  events: GameEvent[];
  nextTileId: number;
  gained: number;
}

/** Slides and merges every line. Returns null when nothing changes. */
export function slide(tiles: Tile[], size: BoardSize, dir: Direction, nextTileId: number): Slid | null {
  const out: Tile[] = [];
  const merges: GameEvent[] = [];
  let id = nextTileId;
  let gained = 0;

  for (let i = 0; i < size; i++) {
    let free = 0;
    let prev: { tile: Tile; index: number; merged: boolean } | null = null;
    for (let k = 0; k < size; k++) {
      const [row, col] = LINE[dir](i, k, size - 1);
      const tile = tiles.find((t) => t.row === row && t.col === col);
      if (!tile) continue;
      if (tile.kind === 'stone') {
        out.push(tile);
        free = k + 1;
        prev = null;
        continue;
      }
      const value = prev && !prev.merged ? mergedValue(prev.tile, tile) : 0;
      if (prev && value) {
        const target = out[prev.index];
        const merged: NumberTile = { id: id++, row: target.row, col: target.col, kind: 'number', value };
        out[prev.index] = merged;
        merges.push({ kind: 'merge', tile: merged, sources: [prev.tile, tile] });
        gained += value;
        prev.merged = true;
      } else {
        const [r, c] = LINE[dir](i, free++, size - 1);
        out.push({ ...tile, row: r, col: c });
        prev = { tile, index: out.length - 1, merged: false };
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
