import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Game, Tile } from '../game';
import { playFeedback } from '../play/feedback';
import { emptyStats, type GameRecord, type Stats } from '../stats';
import { App } from './App';

vi.mock('../play/feedback', () => ({ playFeedback: vi.fn() }));

const OLD = Date.UTC(2025, 9, 12, 12);

/** Rows of space-separated cells: `_` empty or a number. */
function game(text: string, extra: Partial<Game> = {}): Game {
  const tiles: Tile[] = [];
  text.trim().split('\n').forEach((line, row) =>
    line.trim().split(/\s+/).forEach((cell, col) => {
      if (cell !== '_') tiles.push({ id: tiles.length, row, col, value: Number(cell) });
    }),
  );
  const pace = extra.pace ?? 'endless';
  return {
    tiles,
    nextTileId: tiles.length,
    score: 0,
    // Its first two spawns are 2s in the bottom rows.
    random: 103,
    pace,
    bestTile: Math.max(2, ...tiles.map((t) => t.value)),
    winSeen: false,
    blitzMsLeft: pace === 'blitz' ? 180_000 : null,
    ...extra,
  };
}

function stats(sets: Partial<Stats> = {}): Stats {
  return { ...emptyStats(), ...sets };
}

function store(save: { sound?: boolean; game: Game; stats?: Stats }) {
  localStorage.setItem('2048', JSON.stringify({ sound: true, stats: stats(), ...save }));
}

const saved = () => JSON.parse(localStorage.getItem('2048')!);

/** The board as the player sees it, read from the tiles' accessible names. */
function board(): string {
  const grid = Array.from({ length: 4 }, () => Array<string>(4).fill('_'));
  for (const tile of within(screen.getByRole('region', { name: 'Board' })).queryAllByRole('img')) {
    const [, value, row, col] = tile.getAttribute('aria-label')!.match(/^(\d+), row (\d), column (\d)$/)!;
    grid[Number(row) - 1][Number(col) - 1] = value;
  }
  return grid.map((r) => r.join(' ')).join('\n');
}

const tileCount = () => within(screen.getByRole('region', { name: 'Board' })).queryAllByRole('img').length;
const box = (name: string) => screen.getByRole('group', { name }).textContent;
const button = (name: string | RegExp) => screen.getByRole('button', { name });

async function drag(user: ReturnType<typeof userEvent.setup>, dx: number, dy: number) {
  const target = screen.getByRole('region', { name: 'Board' });
  await user.pointer([
    { keys: '[MouseLeft>]', target, coords: { clientX: 100, clientY: 100 } },
    { coords: { clientX: 100 + dx, clientY: 100 + dy } },
    { keys: '[/MouseLeft]' },
  ]);
}

function record(score: number, bestTile = 256, endedAt = OLD): GameRecord {
  return { score, bestTile, endedAt };
}

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
    this.removeAttribute('open');
  };
});

beforeEach(() => {
  localStorage.clear();
  vi.mocked(playFeedback).mockClear();
  vi.spyOn(crypto, 'getRandomValues').mockImplementation((array) => {
    (array as Uint32Array)[0] = 99;
    return array;
  });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('resume exactly', () => {
  it('starts with the default game, plays keys and drags, and comes back exactly as left', async () => {
    const user = userEvent.setup();
    const first = render(<App />);
    expect(screen.getByText('Endless')).toBeTruthy();
    expect(tileCount()).toBe(2);
    expect(screen.queryByRole('alert')).toBeNull();
    first.unmount();

    store({ game: game('2 _ _ 2\n_ _ _ _\n_ _ _ _\n_ _ _ 4', { score: 40 }) });
    const view = render(<App />);
    await user.keyboard('{ArrowLeft}');
    expect(board()).toMatch(/^4 _ _ _\n/);
    expect(box('Score')).toBe('SCORE44');
    expect(tileCount()).toBe(3);

    const beforeShortDrag = board();
    await drag(user, 10, 5);
    expect(board()).toBe(beforeShortDrag);
    await drag(user, 80, 10);
    expect(board()).toMatch(/^_ _ _ 4\n/);

    await user.click(button('Sound'));
    const shown = [board(), box('Score'), box('Best')];
    view.unmount();

    render(<App />);
    expect([board(), box('Score'), box('Best')]).toEqual(shown);
    expect(button('Sound').getAttribute('aria-pressed')).toBe('false');
    expect(playFeedback).toHaveBeenCalled();
    vi.mocked(playFeedback).mockClear();
    await user.keyboard('{ArrowLeft}');
    expect(board()).not.toBe(shown[0]);
    expect(playFeedback).not.toHaveBeenCalled();
  });
});

describe('corrupt save', () => {
  const valid = {
    sound: false,
    game: game('2 4 _ _\n_ _ _ _\n_ _ _ _\n_ _ _ 8', { score: 12 }),
    stats: stats({ endless: { played: 1, wins: 0, bestTile: 256, top: [record(900)] } }),
  };

  it.each([
    ['sound', 'your sound setting', { ...valid, sound: 'off' }],
    ['game', 'your game', { ...valid, game: { ...valid.game, tiles: [valid.game.tiles[0], { ...valid.game.tiles[1], col: 0 }] } }],
    ['stats', 'your stats', { ...valid, stats: { ...valid.stats, endless: { played: 1, wins: 2, bestTile: 256, top: [] } } }],
  ] as const)('resets only a broken %s', (part, named, save) => {
    localStorage.setItem('2048', JSON.stringify(save));
    render(<App />);
    expect(screen.getByRole('alert').textContent).toContain(`was reset: ${named}`);
    const after = saved();
    const defaults = { sound: true, stats: stats() };
    for (const key of ['sound', 'game', 'stats'] as const) {
      if (key !== part) expect(after[key], key).toEqual(valid[key]);
      else if (key === 'game') expect(after.game).toMatchObject({ pace: 'endless', score: 0, tiles: [{}, {}] });
      else expect(after[key], key).toEqual(defaults[key]);
    }
  });

  it.each([
    ['not JSON', '{"sound":'],
    ['has an unknown part', JSON.stringify({ ...valid, setup: { pace: 'endless' } })],
  ])('resets everything when the save is %s', (_, raw) => {
    localStorage.setItem('2048', raw);
    render(<App />);
    expect(screen.getByRole('alert').textContent).toContain('was reset: your sound setting, your game, your stats');
    expect(saved()).toMatchObject({ sound: true, stats: stats() });
    expect(tileCount()).toBe(2);
  });
});

describe('recorded exactly once', () => {
  const lastMove = game('256 256 8 16\n4 2 4 8\n2 4 2 4\n4 2 4 2', { score: 1000 });
  const tenth = 1512;
  const full = {
    played: 10,
    wins: 0,
    bestTile: 512,
    top: Array.from({ length: 10 }, (_, i) => record(tenth + (9 - i) * 100, 512, OLD + i)),
  };

  it('records the ending once, keeps the earlier tie in the top 10, and records nothing more', async () => {
    const user = userEvent.setup();
    store({ game: lastMove, stats: stats({ endless: full }) });
    const view = render(<App />);
    await user.keyboard('{ArrowLeft}');
    const ended = screen.getByRole('dialog', { name: 'Game ended' });
    expect(ended.textContent).toContain('Game Over');
    expect(ended.textContent).toContain('Score 1,512');
    expect(ended.textContent).not.toContain('New best!');

    await user.click(button('Stats'));
    const detail = screen.getByRole('region', { name: 'Selected pace' });
    expect(detail.textContent).toContain('Played11');
    const rows = within(detail).getAllByRole('listitem');
    expect(rows).toHaveLength(10);
    expect(rows[9].textContent).toBe('101,512512' + '12 Oct 2025');
    view.unmount();

    render(<App />);
    expect(screen.getByRole('dialog', { name: 'Game ended' })).toBeTruthy();
    expect(saved().stats.endless.played).toBe(11);
    await user.click(within(screen.getByRole('dialog', { name: 'Game ended' })).getByRole('button', { name: 'New Game' }));
    expect(screen.queryByText(/Your current game ends here/)).toBeNull();
    await user.click(button('Start'));
    expect(saved().stats.endless.played).toBe(11);
  });

  it('shows New best! when the pace had no games', async () => {
    const user = userEvent.setup();
    store({ game: lastMove });
    render(<App />);
    await user.keyboard('{ArrowLeft}');
    expect(screen.getByRole('dialog', { name: 'Game ended' }).textContent).toContain('New best!');
  });
});

describe('new game panel', () => {
  const current = game('2 _ _ _\n_ _ _ _\n_ _ 4 _\n_ _ _ _', { pace: 'blitz', score: 1284 });
  const radio = (name: string) => screen.getByRole('radio', { name }) as HTMLInputElement;

  it('opens on the current pace, blocks the board, closes without changes, and starts the chosen pace', async () => {
    const user = userEvent.setup();
    store({ game: current });
    render(<App />);
    const before = board();

    await user.click(button('New Game'));
    expect([radio('Endless').checked, radio('Blitz').checked]).toEqual([false, true]);
    expect(screen.getByText(/Your current game ends here/).textContent).toContain('Its 1,284 points will be recorded.');
    await user.keyboard('{ArrowLeft}{ArrowUp}');
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('button', { name: 'Start' })).toBeNull();
    expect([board(), box('Score')]).toEqual([before, 'SCORE1,284']);

    await user.click(button('New Game'));
    await user.click(button('Close'));
    expect(screen.queryByRole('button', { name: 'Start' })).toBeNull();
    expect(board()).toBe(before);

    await user.click(button('New Game'));
    await user.click(radio('Endless'));
    await user.click(button('Start'));

    expect(screen.getByText('Endless')).toBeTruthy();
    expect(screen.queryByRole('group', { name: 'Time' })).toBeNull();
    expect(saved().stats).toMatchObject({ blitz: { played: 1, top: [{ score: 1284 }] }, endless: { played: 0 } });

    await user.click(button('New Game'));
    expect([radio('Endless').checked, radio('Blitz').checked]).toEqual([true, false]);
    expect(screen.getByText('Your current game ends here.')).toBeTruthy();
    await user.click(button('Start'));
    expect(saved().stats.endless.played).toBe(0);
  });
});

describe('blitz clock', () => {
  const blitz = (extra: Partial<Game> = {}) => game('2 _ _ _\n4 _ _ _\n_ _ _ _\n_ _ _ _', { pace: 'blitz', ...extra });

  function hide(hidden: boolean) {
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue(hidden ? 'hidden' : 'visible');
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
  }

  // user-event awaits real timeouts, so the faked clock is driven with plain events.
  const wait = (ms: number) => act(() => vi.advanceTimersByTime(ms));
  const press = (key: string) => fireEvent.keyDown(window, { key });

  it('starts on the first swipe, pauses for Stats and hiding, and resumes paused after a remount', async () => {
    vi.useFakeTimers();
    store({ game: blitz() });
    const view = render(<App />);
    wait(5000);
    expect(box('Time')).toBe('TIME3:00');

    press('ArrowRight');
    wait(10_000);
    expect(box('Time')).toBe('TIME2:50');

    fireEvent.click(button('Stats'));
    wait(10_000);
    press('Escape');
    expect(box('Time')).toBe('PAUSED2:50');

    press('ArrowLeft');
    wait(5000);
    expect(box('Time')).toBe('TIME2:45');

    hide(true);
    expect(box('Time')).toBe('PAUSED2:45');
    expect(saved().game.blitzMsLeft).toBe(165_000);
    wait(10_000);
    hide(false);
    expect(box('Time')).toBe('PAUSED2:45');
    view.unmount();

    render(<App />);
    expect(box('Time')).toBe('PAUSED2:45');
  });

  it('keeps running through the win banner and ends with Time’s Up, recording the game', async () => {
    vi.useFakeTimers();
    store({ game: blitz({ tiles: [{ id: 0, row: 0, col: 0, value: 1024 }, { id: 1, row: 0, col: 1, value: 1024 }], nextTileId: 2, bestTile: 1024, blitzMsLeft: 5000 }) });
    render(<App />);
    press('ArrowLeft');
    expect(screen.getByRole('status').textContent).toBe('You made 2048!');
    wait(1000);
    expect(box('Time')).toBe('TIME0:04');
    wait(1500);
    expect(screen.queryByRole('status')).toBeNull();
    wait(2500);
    expect(screen.getByRole('dialog', { name: 'Game ended' }).textContent).toContain("Time's Up");
    expect(saved().stats.blitz).toMatchObject({ played: 1, wins: 1, top: [{ score: 2048 }] });
  });
});

describe('stats screen', () => {
  it('shows both paces, opens on the current one, and details the selected pace', async () => {
    const user = userEvent.setup();
    store({
      game: game('2 _ _ _\n_ _ _ _\n_ _ _ _\n_ _ _ 2', { pace: 'blitz' }),
      stats: stats({ endless: { played: 37, wins: 9, bestTile: 2048, top: [record(20_410, 2048), record(14_208, 1024)] } }),
    });
    render(<App />);
    await user.click(button('Stats'));

    expect(button(/^Endless/).textContent).toBe('Endless20,4102048');
    expect(button(/^Blitz/).textContent).toBe('Blitz—');
    const detail = () => screen.getByRole('region', { name: 'Selected pace' });
    expect(within(detail()).getByRole('heading', { level: 3, name: 'Blitz' })).toBeTruthy();
    expect(detail().textContent).toContain('No games yet');

    await user.click(button(/^Endless/));
    expect(detail().textContent).toContain('Played37');
    expect(detail().textContent).toContain('Wins9 · 24%');
    expect(within(detail()).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      '120,410✓204812 Oct 2025',
      '214,208102412 Oct 2025',
    ]);
  });
});
