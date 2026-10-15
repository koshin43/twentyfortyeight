import { describe, expect, it } from 'vitest';
import { gameEnd, isGame, move, SIZE, type Direction, type Game, type Tile } from '.';

const SEED = 1;
/** A generator state whose first spawn is a 4 in the first empty cell. */
const FOUR_SEED = 7;

/** Rows of space-separated cells: `_` empty or a number. */
function game(text: string, rest: Partial<Game> = {}): Game {
  const tiles: Tile[] = [];
  text.trim().split('\n').forEach((line, row) =>
    line.trim().split(/\s+/).forEach((cell, col) => {
      if (cell !== '_') tiles.push({ id: tiles.length, row, col, value: Number(cell) });
    }),
  );
  return {
    tiles,
    nextTileId: tiles.length,
    score: 0,
    random: SEED,
    pace: 'endless',
    bestTile: Math.max(2, ...tiles.map((t) => t.value)),
    winSeen: false,
    blitzMsLeft: null,
    ...rest,
  };
}

function show(g: Game, skip?: Tile): string {
  return Array.from({ length: SIZE }, (_, row) =>
    Array.from({ length: SIZE }, (_, col) => {
      const t = g.tiles.find((t) => t.row === row && t.col === col && t.id !== skip?.id);
      return t ? String(t.value) : '_';
    }).join(' '),
  ).join('\n');
}

/** The board after a move without its new tile, plus the score. */
function slid(g: Game, dir: Direction) {
  const out = move(g, dir);
  if (!out) return null;
  const spawned = out.events.find((e) => e.kind === 'spawn')!;
  return { board: show(out.game, spawned.kind === 'spawn' ? spawned.tile : undefined), score: out.game.score };
}

describe('slide geometry', () => {
  it('slides an asymmetric board every direction', () => {
    const g = game(`
      2 _ 4 4
      _ 8 _ 8
      2 2 2 _
      4 _ _ 16`);
    expect({
      left: slid(g, 'left'),
      right: slid(g, 'right'),
      up: slid(g, 'up'),
      down: slid(g, 'down'),
    }).toEqual({
      left: { board: '2 8 _ _\n16 _ _ _\n4 2 _ _\n4 16 _ _', score: 28 },
      right: { board: '_ _ 2 8\n_ _ _ 16\n_ _ 2 4\n_ _ 4 16', score: 28 },
      up: { board: '4 8 4 4\n4 2 2 8\n_ _ _ 16\n_ _ _ _', score: 4 },
      down: { board: '_ _ _ _\n_ _ _ 4\n4 8 4 8\n4 2 2 16', score: 4 },
    });
  });
});

describe('line table', () => {
  const blank = '\n_ _ _ _\n_ _ _ _\n_ _ _ _';
  it.each([
    ['2 2 2 2', '4 4 _ _', 8, '_ _ 4 4', 8],
    ['2 2 2 _', '4 2 _ _', 4, '_ _ 2 4', 4],
    ['4 4 8 _', '8 8 _ _', 8, '_ _ 8 8', 8],
    ['2 _ _ 2', '4 _ _ _', 4, '_ _ _ 4', 4],
    ['2 4 _ _', null, 0, '_ _ 2 4', 0],
  ])('%s', (row, left, leftScore, right, rightScore) => {
    const g = game(row + blank);
    expect(slid(g, 'left')).toEqual(left && { board: left + blank, score: leftScore });
    expect(slid(g, 'right')).toEqual(right && { board: right + blank, score: rightScore });
  });
});

describe('spawn', () => {
  it('counts a spawned 4 toward the best tile, keeping the game valid', () => {
    const out = move(game('2 _ _ _\n_ _ _ _\n_ _ _ _\n_ _ _ _', { random: FOUR_SEED }), 'right')!;
    expect(show(out.game)).toBe('4 _ _ 2\n_ _ _ _\n_ _ _ _\n_ _ _ _');
    expect([out.game.bestTile, isGame(out.game)]).toEqual([4, true]);
  });
});

describe('game end', () => {
  it.each([
    ['one merge left', '2 4 2 4\n4 2 4 2\n2 4 2 4\n4 2 4 4', null],
    ['no merge', '2 4 2 4\n4 2 4 2\n2 4 2 4\n4 2 4 2', 'over'],
  ])('%s', (_, board, end) => expect(gameEnd(game(board))).toBe(end));

  it('reports both the win and the end when one move does both', () => {
    const out = move(game('1024 1024 8 16\n4 2 4 8\n2 4 2 4\n4 2 4 2'), 'left')!;
    expect(out.events.map((e) => e.kind)).toEqual(['move', 'slide', 'slide', 'merge', 'spawn', 'bestTile', 'win', 'end']);
  });
});

describe('validation', () => {
  const valid = game('2 4 _ _\n_ _ _ _\n_ _ _ _\n_ _ _ 8', { pace: 'blitz', blitzMsLeft: 90_000 });
  const tile = (g: Game, i: number) => g.tiles[i] as unknown as Record<string, unknown>;

  it('accepts the unchanged game', () => expect(isGame(structuredClone(valid))).toBe(true));

  it.each<[string, (g: Game) => void]>([
    ['a tile out of bounds', (g) => (tile(g, 0).col = 4)],
    ['two tiles in one cell', (g) => (tile(g, 1).col = 0)],
    ['a duplicate id', (g) => (tile(g, 1).id = 0)],
    ['an id at nextTileId', (g) => (tile(g, 1).id = g.nextTileId)],
    ['a value of 3', (g) => (tile(g, 0).value = 3)],
    ['bestTile below a tile', (g) => (g.bestTile = 4)],
    ['winSeen in Blitz', (g) => ((g.bestTile = 2048), (g.winSeen = true))],
    ['blitzMsLeft above 180,000', (g) => (g.blitzMsLeft = 180_001)],
    ['an unknown field', (g) => Object.assign(g, { extra: 1 })],
  ])('rejects %s', (_, change) => {
    const g = structuredClone(valid);
    change(g);
    expect(isGame(g)).toBe(false);
  });
});
