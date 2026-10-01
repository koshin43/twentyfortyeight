import { describe, expect, it } from 'vitest';
import {
  canUsePower, gameEnd, isGame, isWon, move, pickRefill, smash, spawnOdds, swap, undo,
  type BoardSize, type Direction, type Game, type Power, type PowerState, type Tile,
} from '.';

const SEED = 1;
const ready: PowerState = { status: 'ready' };
const notDrafted: PowerState = { status: 'notDrafted' };
const bonus: PowerState = { status: 'bonus' };
const recharging = (movesLeft: number): PowerState => ({ status: 'recharging', movesLeft });

/** Rows of space-separated cells: `_` empty, a number, `★` Joker, `■3` stone with countdown 3. */
function game(
  text: string,
  { powers, refillWaiting = false, ...rest }: Partial<Game> & { powers?: Partial<Record<Power, PowerState>>; refillWaiting?: boolean } = {},
): Game {
  const rows = text.trim().split('\n').map((line) => line.trim().split(/\s+/));
  const tiles: Tile[] = [];
  rows.forEach((cells, row) =>
    cells.forEach((cell, col) => {
      const id = tiles.length;
      if (cell === '★') tiles.push({ id, row, col, kind: 'joker' });
      else if (cell.startsWith('■')) tiles.push({ id, row, col, kind: 'stone', countdown: Number(cell.slice(1)) });
      else if (cell !== '_') tiles.push({ id, row, col, kind: 'number', value: Number(cell) });
    }),
  );
  const style = rest.style ?? 'wild';
  return {
    tiles,
    nextTileId: tiles.length,
    score: 0,
    random: SEED,
    size: rows.length as BoardSize,
    style,
    pace: 'endless',
    bestTile: Math.max(2, ...tiles.map((t) => (t.kind === 'number' ? t.value : 0))),
    winSeen: false,
    wild: style === 'wild' ? { powers: { smash: ready, swap: ready, undo: notDrafted, ...powers }, refillWaiting, undo: null } : null,
    blitzMsLeft: null,
    ...rest,
  };
}

function show(g: Game, skip?: Tile): string {
  return Array.from({ length: g.size }, (_, row) =>
    Array.from({ length: g.size }, (_, col) => {
      const t = g.tiles.find((t) => t.row === row && t.col === col && t.id !== skip?.id);
      return !t ? '_' : t.kind === 'joker' ? '★' : t.kind === 'stone' ? `■${t.countdown}` : String(t.value);
    }).join(' '),
  ).join('\n');
}

const tidy = (text: string) => text.trim().split('\n').map((l) => l.trim().split(/\s+/).join(' ')).join('\n');

/** The board after a move without its new tile, plus the score. */
function slid(g: Game, dir: Direction) {
  const out = move(g, dir);
  if (!out) return null;
  const spawned = out.events.find((e) => e.kind === 'spawn')!;
  return { board: show(out.game, spawned.kind === 'spawn' ? spawned.tile : undefined), score: out.game.score };
}

const kinds = (g: Game | null, dir: Direction) => move(g!, dir)!.events.map((e) => e.kind);

describe('slide geometry', () => {
  it.each([
    {
      board: `
        2 _ 4 _ 4
        _ 8 _ _ 8
        2 2 2 _ _
        _ _ _ 16 _
        4 _ _ _ 2`,
      left: ['2 8 _ _ _\n16 _ _ _ _\n4 2 _ _ _\n16 _ _ _ _\n4 2 _ _ _', 28],
      right: ['_ _ _ 2 8\n_ _ _ _ 16\n_ _ _ 2 4\n_ _ _ _ 16\n_ _ _ 4 2', 28],
      up: ['4 8 4 16 4\n4 2 2 _ 8\n_ _ _ _ 2\n_ _ _ _ _\n_ _ _ _ _', 4],
      down: ['_ _ _ _ _\n_ _ _ _ _\n_ _ _ _ 4\n4 8 4 _ 8\n4 2 2 16 2', 4],
    },
    {
      board: `
        2 2 4
        _ 4 _
        8 _ 8`,
      left: ['4 4 _\n4 _ _\n16 _ _', 20],
      right: ['_ 4 4\n_ _ 4\n_ _ 16', 20],
      up: ['2 2 4\n8 4 8\n_ _ _', 0],
      down: ['_ _ _\n2 2 4\n8 4 8', 0],
    },
  ])('slides every direction on $board', ({ board, ...expected }) => {
    for (const dir of ['left', 'right', 'up', 'down'] as const) {
      const [text, score] = expected[dir] as [string, number];
      expect(slid(game(board, { style: 'classic' }), dir), dir).toEqual({ board: text, score });
    }
  });
});

describe('line table', () => {
  const blank = '\n_ _ _ _\n_ _ _ _\n_ _ _ _';
  it.each([
    ['2 2 2 2', '4 4 _ _', 8, '_ _ 4 4', 8],
    ['2 2 2 _', '4 2 _ _', 4, '_ _ 2 4', 4],
    ['4 4 8 _', '8 8 _ _', 8, '_ _ 8 8', 8],
    ['2 _ _ 2', '4 _ _ _', 4, '_ _ _ 4', 4],
    ['★ 2 2 _', '4 2 _ _', 4, '_ _ ★ 4', 4],
    ['2 ★ 2 _', '4 2 _ _', 4, '_ _ 2 4', 4],
    ['_ 2 ■5 2', '2 _ ■4 2', 0, null, 0],
    ['2 2 ■5 2', '4 _ ■4 2', 4, '_ 4 ■4 2', 4],
  ])('%s', (row, left, leftScore, right, rightScore) => {
    const g = game(row + blank);
    expect(slid(g, 'left')).toEqual({ board: left + blank, score: leftScore });
    expect(slid(g, 'right')).toEqual(right && { board: right + blank, score: rightScore });
  });
});

describe('move order', () => {
  it('lets a merge that makes 128 bring a stone in the same move, which starts at 10', () => {
    const g = game('64 64 _ _ _\n_ _ _ _ _\n_ _ _ _ _\n_ _ _ _ _\n_ _ _ _ _', { random: STONE_SEED });
    const out = move(g, 'left')!;
    expect(show(out.game)).toBe(tidy(STONE_BOARD));
    expect(out.events.map((e) => e.kind)).toEqual(['move', 'merge', 'bestTile', 'spawn']);
  });

  it('crumbles a stone at 1 before the spawn, freeing its cell for the new tile', () => {
    const g = game('2 2 ■1 4\n8 16 32 64\n64 32 16 8\n8 16 32 64', { random: CRUMBLE_SEED });
    const out = move(g, 'left')!;
    expect(show(out.game)).toBe(tidy(CRUMBLE_BOARD));
    expect(out.events.map((e) => e.kind)).toEqual(['move', 'merge', 'crumble', 'spawn']);
  });

  it('counts a spawned 4 toward the best tile, keeping the game valid', () => {
    const out = move(game('2 _ _\n_ _ _\n_ _ _', { style: 'classic' }), 'right')!;
    expect(show(out.game)).toBe(tidy('_ _ 2\n_ _ 4\n_ _ _'));
    expect([out.game.bestTile, isGame(out.game)]).toEqual([4, true]);
  });
});

const STONE_SEED = 7;
const STONE_BOARD = `
  128 _ ■10 _ _
  _ _ _ _ _
  _ _ _ _ _
  _ _ _ _ _
  _ _ _ _ _`;
const CRUMBLE_SEED = 1;
const CRUMBLE_BOARD = `
  4 _ 4 4
  8 16 32 64
  64 32 16 8
  8 16 32 64`;

describe('spawn odds', () => {
  it.each([
    ['room 4 with a 2 2 2 run', '2 2 2 4\n4 8 16 2\n2 4 8 16\n_ _ 32 64', {}, 0.15, 0],
    ['room 6 with a gapped pair and a stone-split pair', '2 ■5 2 _\n4 _ _ 4\n8 16 32 64\n128 _ _ 1024', {}, 0.075, 0],
    ['room 8', '2 4 2 4\n4 2 4 2\n_ _ _ _\n_ _ _ _', { bestTile: 128 }, 0, 0],
    ['room 12 with a Joker pair', '★ 2 _ _\n_ 4 _ _\n_ _ _ 128\n_ _ _ 8', {}, 0, 0.075],
    ['room 16 from 2 2 2 runs', '2 2 2 _\n2 2 _ _\n_ _ _ _\n_ _ _ _', { bestTile: 128 }, 0, 0.15],
    ['a Joker on the board', '2 2 2 4\n4 8 16 2\n2 4 8 16\n_ _ 32 ★', {}, 0, 0],
    ['a stone on the board', '2 2 2 _\n2 2 _ _\n_ _ _ _\n_ _ _ ■5', { bestTile: 128 }, 0, 0],
    ['a best tile of 64', '2 2 2 _\n2 2 _ _\n_ _ _ _\n_ _ _ _', { bestTile: 64 }, 0, 0],
  ])('%s', (_, board, extra, joker, stone) => {
    const odds = spawnOdds(game(board, extra));
    expect(odds.joker).toBeCloseTo(joker);
    expect(odds.stone).toBeCloseTo(stone);
  });
});

describe('powers', () => {
  it('smash refuses the last non-stone tile but removes a stone; swap refuses stones', () => {
    const g = game('2 _ _\n_ ■4 _\n_ _ _');
    expect(smash(g, 0)).toBeNull();
    expect(show(smash(g, 1)!.game)).toBe('2 _ _\n_ _ _\n_ _ _');
    expect(canUsePower(g, 'swap')).toBe(false);

    const two = game('2 _ 4\n_ ■4 _\n_ _ _');
    expect(swap(two, 0, 2)).toBeNull();
    expect(show(swap(two, 0, 1)!.game)).toBe('4 _ 2\n_ ■4 _\n_ _ _');
  });

  it('undo restores tiles, countdowns, score and generator, so the replayed swipe spawns the same tile', () => {
    const g = game('2 2 _ ■3\n_ _ _ _\n_ 4 _ _\n_ _ _ _', { score: 10, powers: { undo: ready, swap: notDrafted } });
    const first = move(g, 'left')!;
    const back = undo(first.game)!.game;
    expect([show(back), back.score, back.random]).toEqual([show(g), 10, SEED]);
    expect(move(back, 'left')!.events).toEqual(first.events.map((e) => (e.kind === 'merge' ? { ...e, tile: { ...e.tile } } : e)));
    expect(show(move(back, 'left')!.game)).toBe(show(first.game));
  });

  it('undo keeps the best tile, the win and the refill, and is gone after a power or an undo', () => {
    const g = game('256 256 _\n_ _ _\n_ _ _', { powers: { smash: recharging(5), swap: notDrafted, undo: ready } });
    const won = move(g, 'left')!;
    expect(won.events.map((e) => e.kind)).toEqual(['move', 'merge', 'bestTile', 'win', 'refill', 'spawn']);
    const back = undo(won.game)!.game;
    expect(show(back)).toBe('256 256 _\n_ _ _\n_ _ _');
    expect([back.bestTile, isWon(back), back.wild!.refillWaiting]).toEqual([512, true, true]);
    expect(canUsePower(pickRefill(back, 'undo'), 'undo')).toBe(false);

    const smashed = smash(won.game, won.game.tiles[0].id)!.game;
    expect(canUsePower({ ...smashed, wild: { ...smashed.wild!, powers: { ...smashed.wild!.powers, undo: ready } } }, 'undo')).toBe(false);
  });

  it('recharges only on moves, from the full count to ready; a bonus returns to not drafted', () => {
    const g = game('2 _ _\n4 _ _\n8 _ _', { powers: { smash: ready, swap: bonus, undo: notDrafted } });
    const smashed = smash(g, 0)!.game;
    expect(smashed.wild!.powers.smash).toEqual(recharging(50));
    expect(move(smashed, 'left')).toBeNull();
    const swapped = swap(smashed, 1, 2)!.game;
    expect(swapped.wild!.powers).toEqual({ smash: recharging(50), swap: notDrafted, undo: notDrafted });
    expect(move(swapped, 'right')!.game.wild!.powers.smash).toEqual(recharging(49));

    const almost = game('2 _ _\n_ _ _\n_ _ _', { powers: { smash: recharging(1) } });
    expect(move(almost, 'right')!.game.wild!.powers.smash).toEqual(ready);
  });

  it('keeps one refill waiting, wastes the rest, and spends it on the picked power', () => {
    const powers = { smash: recharging(9), swap: ready, undo: notDrafted };
    expect(kinds(game('256 256 _\n_ _ _\n_ _ _', { powers }), 'left')).toContain('refill');
    const waiting = game('512 512 _\n_ _ _\n_ _ _', { powers, refillWaiting: true });
    const next = move(waiting, 'left')!;
    expect([next.events.some((e) => e.kind === 'refill'), next.game.wild!.refillWaiting]).toEqual([false, true]);
    expect(kinds(game('256 256 _\n_ _ _\n_ _ _', { powers: { smash: ready, swap: ready, undo: bonus } }), 'left')).not.toContain('refill');

    expect(pickRefill(waiting, 'smash').wild).toMatchObject({ powers: { smash: ready }, refillWaiting: false });
    expect(pickRefill(waiting, 'undo').wild).toMatchObject({ powers: { undo: bonus }, refillWaiting: false });
  });
});

describe('game end', () => {
  const stuck = '2 4 2\n4 2 4\n2 4 2';
  it.each([
    ['classic, one merge left', game('2 4 2\n4 2 4\n2 4 4', { style: 'classic' }), null],
    ['classic, no merge', game(stuck, { style: 'classic' }), 'over'],
    ['wild, ready smash', game(stuck, { powers: { smash: ready, swap: recharging(3), undo: notDrafted } }), null],
    ['wild, bonus swap', game(stuck, { powers: { smash: recharging(3), swap: bonus, undo: recharging(3) } }), null],
    ['wild, waiting refill', game(stuck, { powers: { smash: recharging(3), swap: recharging(3), undo: notDrafted }, refillWaiting: true }), null],
    ['wild, only undo with nothing to undo', game(stuck, { powers: { smash: recharging(3), swap: notDrafted, undo: ready } }), 'over'],
  ])('%s', (_, g, end) => expect(gameEnd(g)).toBe(end));

  it('reports both the win and the end when one move does both', () => {
    expect(kinds(game('256 256 8\n16 32 64\n4 8 16', { style: 'classic' }), 'left')).toEqual([
      'move', 'slide', 'merge', 'bestTile', 'win', 'spawn', 'end',
    ]);
  });
});

describe('validation', () => {
  const valid = game('2 4 ★ _\n_ ■3 _ _\n_ _ _ _\n_ _ _ 8', {
    pace: 'blitz',
    blitzMsLeft: 90_000,
    powers: { smash: recharging(20), swap: ready, undo: notDrafted },
  });
  const tile = (g: Game, i: number) => g.tiles[i] as Record<string, unknown>;

  it('accepts the unchanged game', () => expect(isGame(structuredClone(valid))).toBe(true));

  it.each<[string, (g: Game) => void]>([
    ['a tile out of bounds', (g) => (tile(g, 0).col = 4)],
    ['two tiles in one cell', (g) => (tile(g, 1).col = 0)],
    ['a duplicate id', (g) => (tile(g, 1).id = 0)],
    ['an id at nextTileId', (g) => (tile(g, 1).id = g.nextTileId)],
    ['a value of 3', (g) => (tile(g, 0).value = 3)],
    ['classic with a Joker', (g) => ((g.style = 'classic'), (g.wild = null))],
    ['two stones', (g) => g.tiles.push({ id: g.nextTileId++, row: 3, col: 0, kind: 'stone', countdown: 2 })],
    ['a stone countdown of 0', (g) => (tile(g, 3).countdown = 0)],
    ['a stone countdown of 11', (g) => (tile(g, 3).countdown = 11)],
    ['bestTile below a tile', (g) => (g.bestTile = 4)],
    ['two not-drafted powers', (g) => (g.wild!.powers.swap = notDrafted)],
    ['movesLeft of 0', (g) => (g.wild!.powers.smash = recharging(0))],
    ['movesLeft above the recharge count', (g) => (g.wild!.powers.smash = recharging(151))],
    ['winSeen in Blitz', (g) => ((g.bestTile = 2048), (g.winSeen = true))],
    ['blitzMsLeft above 180,000', (g) => (g.blitzMsLeft = 180_001)],
    ['an unknown field', (g) => Object.assign(g, { extra: 1 })],
  ])('rejects %s', (_, change) => {
    const g = structuredClone(valid);
    change(g);
    expect(isGame(g)).toBe(false);
  });
});
