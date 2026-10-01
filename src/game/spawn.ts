import { nextRandom } from './random';
import { SIZES } from './sizes';
import { lines, mergedValue } from './slide';
import type { Game, Position, Tile } from './types';

const SPECIAL_CHANCE = 0.15;
const FOUR_CHANCE = 0.1;
const STONE_MIN_BEST_TILE = 128;
const STONE_COUNTDOWN = 10;

/** Empty cells plus pairs that would merge on a swipe. */
export function room(game: Game): number {
  let merges = 0;
  for (const dir of ['left', 'up'] as const) {
    for (const line of lines(game.tiles, game.size, dir)) {
      for (let k = 1; k < line.length; k++) if (mergedValue(line[k - 1], line[k])) merges++;
    }
  }
  return game.size * game.size - game.tiles.length + merges;
}

/** Chance that the next spawned tile is a Joker or a stone. */
export function spawnOdds(game: Game): { joker: number; stone: number } {
  if (game.style === 'classic') return { joker: 0, stone: 0 };
  const n = SIZES[game.size].rowWorth;
  const r = room(game);
  const joker = r <= n ? SPECIAL_CHANCE : r < 2 * n ? (SPECIAL_CHANCE * (2 * n - r)) / n : 0;
  const stone = r >= 4 * n ? SPECIAL_CHANCE : r > 2 * n ? (SPECIAL_CHANCE * (r - 2 * n)) / (2 * n) : 0;
  const has = (kind: Tile['kind']) => game.tiles.some((t) => t.kind === kind);
  return {
    joker: has('joker') ? 0 : joker,
    stone: has('stone') || game.bestTile < STONE_MIN_BEST_TILE ? 0 : stone,
  };
}

/** Places one new tile in a random empty cell, drawing from the position's generator. */
export function spawn(position: Position, size: number, odds: { joker: number; stone: number }): { position: Position; tile: Tile } {
  let random = position.random;
  const draw = () => {
    const [x, next] = nextRandom(random);
    random = next;
    return x;
  };
  const special = draw();
  const id = position.nextTileId;
  const empty: [number, number][] = [];
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      if (!position.tiles.some((t) => t.row === row && t.col === col)) empty.push([row, col]);
    }
  }
  const tile: Tile =
    special < odds.joker
      ? { id, row: 0, col: 0, kind: 'joker' }
      : special < odds.joker + odds.stone
        ? { id, row: 0, col: 0, kind: 'stone', countdown: STONE_COUNTDOWN }
        : { id, row: 0, col: 0, kind: 'number', value: draw() < FOUR_CHANCE ? 4 : 2 };
  [tile.row, tile.col] = empty[Math.floor(draw() * empty.length)];
  return { position: { tiles: [...position.tiles, tile], nextTileId: id + 1, score: position.score, random }, tile };
}
