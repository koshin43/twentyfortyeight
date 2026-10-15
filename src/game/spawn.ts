import { SIZE } from './board';
import { nextRandom } from './random';
import type { Game, Tile } from './types';

const FOUR_CHANCE = 0.1;

/** Places one new 2 or 4 in a random empty cell, drawing from the game's generator. */
export function spawn(game: Game): { game: Game; tile: Tile } {
  const [four, afterFour] = nextRandom(game.random);
  const [pick, random] = nextRandom(afterFour);
  const empty: [number, number][] = [];
  for (let row = 0; row < SIZE; row++) {
    for (let col = 0; col < SIZE; col++) {
      if (!game.tiles.some((t) => t.row === row && t.col === col)) empty.push([row, col]);
    }
  }
  const [row, col] = empty[Math.floor(pick * empty.length)];
  const tile: Tile = { id: game.nextTileId, row, col, value: four < FOUR_CHANCE ? 4 : 2 };
  return { game: { ...game, tiles: [...game.tiles, tile], nextTileId: tile.id + 1, random }, tile };
}
