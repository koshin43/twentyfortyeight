import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BoardSize, Game, Power, PowerState, Setup, Tile } from '../game';
import { playFeedback } from '../play/feedback';
import { emptyStats, type GameRecord, type SetKey, type SetStats, type Stats } from '../stats';
import { App } from './App';

vi.mock('../play/feedback', () => ({ playFeedback: vi.fn() }));

const SETUP: Setup = { size: 4, style: 'classic', pace: 'endless', draft: ['smash', 'swap'] };
const OLD = Date.UTC(2025, 9, 12, 12);

/** Rows of space-separated cells: `_` empty, a number, `★` Joker, `■3` stone with countdown 3. */
function game(text: string, extra: Partial<Game> & { powers?: Partial<Record<Power, PowerState>>; refillWaiting?: boolean } = {}): Game {
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
  const { powers, refillWaiting = false, ...rest } = extra;
  const style = rest.style ?? 'classic';
  const pace = rest.pace ?? 'endless';
  const ready: PowerState = { status: 'ready' };
  return {
    tiles,
    nextTileId: tiles.length,
    score: 0,
    random: 7,
    size: rows.length as BoardSize,
    style,
    pace,
    bestTile: Math.max(2, ...tiles.map((t) => (t.kind === 'number' ? t.value : 0))),
    winSeen: false,
    wild: style === 'wild' ? { powers: { smash: ready, swap: ready, undo: { status: 'notDrafted' }, ...powers }, refillWaiting, undo: null } : null,
    blitzMsLeft: pace === 'blitz' ? 180_000 : null,
    ...rest,
  };
}

function stats(sets: Partial<Record<SetKey, SetStats>> = {}): Stats {
  return { ...emptyStats(), ...sets };
}

function store(save: { setup?: Setup; sound?: boolean; game: Game; stats?: Stats }) {
  localStorage.setItem('2048', JSON.stringify({ setup: SETUP, sound: true, stats: stats(), ...save }));
}

const saved = () => JSON.parse(localStorage.getItem('2048')!);

/** The board as the player sees it, read from the tiles' accessible names. */
function board(size: number): string {
  const grid = Array.from({ length: size }, () => Array<string>(size).fill('_'));
  for (const tile of within(screen.getByRole('region', { name: 'Board' })).queryAllByRole('img')) {
    const [, name, row, col] = tile.getAttribute('aria-label')!.match(/^(.+), row (\d), column (\d)$/)!;
    grid[Number(row) - 1][Number(col) - 1] = name === 'Joker' ? '★' : name.startsWith('Stone') ? `■${name.slice(6)}` : name;
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
    expect(screen.getByText('4×4 · Classic · Endless')).toBeTruthy();
    expect(tileCount()).toBe(2);
    expect(screen.queryByRole('alert')).toBeNull();
    first.unmount();

    store({ game: game('2 _ _ 2\n_ _ _ _\n_ _ _ _\n_ _ _ 4', { score: 40 }) });
    const view = render(<App />);
    await user.keyboard('{ArrowLeft}');
    expect(board(4)).toMatch(/^4 _ _ _\n/);
    expect(box('Score')).toBe('SCORE44');
    expect(tileCount()).toBe(3);

    const beforeShortDrag = board(4);
    await drag(user, 10, 5);
    expect(board(4)).toBe(beforeShortDrag);
    await drag(user, 80, 10);
    expect(board(4)).toMatch(/^_ _ _ 4\n/);

    await user.click(button('Sound'));
    const shown = [board(4), box('Score'), box('Best')];
    view.unmount();

    render(<App />);
    expect([board(4), box('Score'), box('Best')]).toEqual(shown);
    expect(button('Sound').getAttribute('aria-pressed')).toBe('false');
    expect(playFeedback).toHaveBeenCalled();
    vi.mocked(playFeedback).mockClear();
    await user.keyboard('{ArrowLeft}');
    expect(board(4)).not.toBe(shown[0]);
    expect(playFeedback).not.toHaveBeenCalled();
  });
});

describe('corrupt save', () => {
  const valid = {
    setup: { size: 3, style: 'wild', pace: 'blitz', draft: ['swap', 'undo'] } as Setup,
    sound: false,
    game: game('2 4 _ _\n_ _ _ _\n_ _ _ _\n_ _ _ 8', { score: 12 }),
    stats: stats({ '4-classic-endless': { played: 1, wins: 0, bestTile: 256, top: [record(900)] } }),
  };

  it.each([
    ['setup', 'your new game choices', { ...valid, setup: { ...valid.setup, draft: ['swap', 'swap'] } }],
    ['sound', 'your sound setting', { ...valid, sound: 'off' }],
    ['game', 'your game', { ...valid, game: { ...valid.game, tiles: [valid.game.tiles[0], { ...valid.game.tiles[1], col: 0 }] } }],
    ['stats', 'your stats', { ...valid, stats: { ...valid.stats, '4-classic-endless': { played: 1, wins: 2, bestTile: 256, top: [] } } }],
  ] as const)('resets only a broken %s', (part, named, save) => {
    localStorage.setItem('2048', JSON.stringify(save));
    render(<App />);
    expect(screen.getByRole('alert').textContent).toContain(`was reset: ${named}`);
    const after = saved();
    const defaults = { setup: SETUP, sound: true, stats: stats() };
    for (const key of ['setup', 'sound', 'game', 'stats'] as const) {
      if (key !== part) expect(after[key], key).toEqual(valid[key]);
      else if (key === 'game') expect(after.game.tiles).toHaveLength(2);
      else expect(after[key], key).toEqual(defaults[key]);
    }
  });

  it('resets everything when the save is not JSON', () => {
    localStorage.setItem('2048', '{"setup":');
    render(<App />);
    expect(screen.getByRole('alert').textContent).toContain('was reset: your new game choices, your sound setting, your game, your stats');
    expect(saved()).toMatchObject({ setup: SETUP, sound: true, stats: stats() });
    expect(tileCount()).toBe(2);
  });
});

describe('recorded exactly once', () => {
  const lastMove = game('256 256 8 16\n4 2 4 8\n2 4 2 4\n4 2 4 2', { score: 1000 });
  const tenth = 1512;
  const full: SetStats = {
    played: 10,
    wins: 0,
    bestTile: 512,
    top: Array.from({ length: 10 }, (_, i) => record(tenth + (9 - i) * 100, 512, OLD + i)),
  };

  it('records the ending once, keeps the earlier tie in the top 10, and records nothing more', async () => {
    const user = userEvent.setup();
    store({ game: lastMove, stats: stats({ '4-classic-endless': full }) });
    const view = render(<App />);
    await user.keyboard('{ArrowLeft}');
    const ended = screen.getByRole('dialog', { name: 'Game ended' });
    expect(ended.textContent).toContain('Game Over');
    expect(ended.textContent).toContain('Score 1,512');
    expect(ended.textContent).not.toContain('New best!');

    await user.click(button('Stats'));
    const detail = screen.getByRole('region', { name: 'Selected set' });
    expect(detail.textContent).toContain('Played11');
    const rows = within(detail).getAllByRole('listitem');
    expect(rows).toHaveLength(10);
    expect(rows[9].textContent).toBe('101,512512' + '12 Oct 2025');
    view.unmount();

    render(<App />);
    expect(screen.getByRole('dialog', { name: 'Game ended' })).toBeTruthy();
    expect(saved().stats['4-classic-endless'].played).toBe(11);
    await user.click(within(screen.getByRole('dialog', { name: 'Game ended' })).getByRole('button', { name: 'New Game' }));
    expect(screen.queryByText(/Your current game ends here/)).toBeNull();
    await user.click(button('Start'));
    expect(saved().stats['4-classic-endless'].played).toBe(11);
  });

  it('shows New best! when the set had no games', async () => {
    const user = userEvent.setup();
    store({ game: lastMove });
    render(<App />);
    await user.keyboard('{ArrowLeft}');
    expect(screen.getByRole('dialog', { name: 'Game ended' }).textContent).toContain('New best!');
  });
});

describe('new game panel', () => {
  const setup: Setup = { size: 3, style: 'wild', pace: 'blitz', draft: ['swap', 'undo'] };
  const current = game('2 _ _ _\n_ _ _ _\n_ _ 4 _\n_ _ _ _', { score: 1284 });
  const radio = (name: string) => screen.getByRole('radio', { name }) as HTMLInputElement;
  const check = (name: RegExp) => screen.getByRole('checkbox', { name }) as HTMLInputElement;

  it('opens prefilled, blocks the board, closes without changes, and starts the chosen setup', async () => {
    const user = userEvent.setup();
    store({ setup, game: current });
    render(<App />);
    const before = board(4);

    await user.click(button('New Game'));
    expect([radio('3×3').checked, radio('Wild').checked, radio('Blitz').checked]).toEqual([true, true, true]);
    expect([check(/Smash/).checked, check(/Swap/).checked, check(/Undo/).checked]).toEqual([false, true, true]);
    expect(screen.getByText(/Your current game ends here/).textContent).toContain('Its 1,284 points will be recorded.');
    await user.keyboard('{ArrowLeft}{ArrowUp}');
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('button', { name: 'Start' })).toBeNull();
    expect([board(4), box('Score')]).toEqual([before, 'SCORE1,284']);

    await user.click(button('New Game'));
    await user.click(button('Close'));
    expect(screen.queryByRole('button', { name: 'Start' })).toBeNull();
    expect(board(4)).toBe(before);

    await user.click(button('New Game'));
    await user.click(radio('3×3'));
    await user.click(radio('Wild'));
    await user.click(radio('Blitz'));
    await user.click(check(/Undo/));
    expect((button('Start') as HTMLButtonElement).disabled).toBe(true);
    await user.click(check(/Smash/));
    await user.click(check(/Undo/));
    expect((button('Start') as HTMLButtonElement).disabled).toBe(true);
    await user.click(check(/Swap/));
    expect((button('Start') as HTMLButtonElement).disabled).toBe(false);
    await user.click(button('Start'));

    expect(screen.getByText('3×3 · Wild · Blitz')).toBeTruthy();
    expect(saved().stats['4-classic-endless']).toMatchObject({ played: 1, top: [{ score: 1284 }] });
    expect(saved().setup).toEqual({ size: 3, style: 'wild', pace: 'blitz', draft: ['smash', 'undo'] });

    await user.click(button('New Game'));
    expect([radio('3×3').checked, radio('Wild').checked, radio('Blitz').checked]).toEqual([true, true, true]);
    expect([check(/Smash/).checked, check(/Swap/).checked, check(/Undo/).checked]).toEqual([true, false, true]);
    expect(screen.getByText('Your current game ends here.')).toBeTruthy();
    await user.click(button('Start'));
    expect(saved().stats['3-wild-blitz'].played).toBe(0);
  });
});

describe('powers on screen', () => {
  const board4 = '2 _ _ _\n_ 4 _ _\n_ _ 8 _\n_ _ _ 16';
  const smashButton = () => button(/Smash/);

  it('targets, cancels, smashes a tile and spends a refill', async () => {
    const user = userEvent.setup();
    store({ game: game(board4, { style: 'wild' }) });
    const view = render(<App />);

    await user.click(smashButton());
    expect(smashButton().getAttribute('aria-pressed')).toBe('true');
    await user.keyboard('{Escape}');
    expect(smashButton().getAttribute('aria-pressed')).toBe('false');
    await user.click(smashButton());
    await user.click(smashButton());
    expect(smashButton().getAttribute('aria-pressed')).toBe('false');

    await user.click(smashButton());
    await user.keyboard('{ArrowUp}');
    expect(smashButton().getAttribute('aria-pressed')).toBe('false');
    expect(board(4)).toMatch(/^2 4 8 16\n/);

    await user.click(smashButton());
    await user.click(screen.getByRole('img', { name: '16, row 1, column 4' }));
    expect(board(4)).toMatch(/^2 4 8 _\n/);
    expect(smashButton().textContent).toContain('150');
    view.unmount();

    store({ game: game(board4, { style: 'wild', powers: { smash: { status: 'recharging', movesLeft: 40 } }, refillWaiting: true }) });
    render(<App />);
    expect(screen.getByText('Refill: tap a glowing power')).toBeTruthy();
    const undoButton = button(/Undo/) as HTMLButtonElement;
    expect([undoButton.disabled, (smashButton() as HTMLButtonElement).disabled]).toEqual([false, false]);
    await user.click(undoButton);
    expect(screen.queryByText('Refill: tap a glowing power')).toBeNull();
    expect(saved().game.wild.powers).toEqual({ smash: { status: 'recharging', movesLeft: 40 }, swap: { status: 'ready' }, undo: { status: 'bonus' } });
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
    store({ game: blitz({ tiles: [{ id: 0, row: 0, col: 0, kind: 'number', value: 1024 }, { id: 1, row: 0, col: 1, kind: 'number', value: 1024 }], nextTileId: 2, bestTile: 1024, blitzMsLeft: 5000 }) });
    render(<App />);
    press('ArrowLeft');
    expect(screen.getByRole('status').textContent).toBe('You made 2048!');
    wait(1000);
    expect(box('Time')).toBe('TIME0:04');
    wait(1500);
    expect(screen.queryByRole('status')).toBeNull();
    wait(2500);
    expect(screen.getByRole('dialog', { name: 'Game ended' }).textContent).toContain("Time's Up");
    expect(saved().stats['4-classic-blitz']).toMatchObject({ played: 1, wins: 1, top: [{ score: 2048 }] });
  });
});

describe('stats screen', () => {
  it('shows every set, opens on the current one, and details the selected set', async () => {
    const user = userEvent.setup();
    store({
      game: game('2 _ _ _\n_ _ _ _\n_ _ _ _\n_ _ _ 2'),
      stats: stats({
        '4-classic-endless': { played: 37, wins: 9, bestTile: 2048, top: [record(20_410, 2048), record(14_208, 1024)] },
        '3-wild-endless': { played: 1, wins: 1, bestTile: 512, top: [record(4050, 512)] },
      }),
    });
    render(<App />);
    await user.click(button('Stats'));

    expect(button('4×4 · Classic · Endless').textContent).toBe('20,4102048');
    expect(button('3×3 · Wild · Endless').textContent).toBe('4,050512');
    expect(button('5×5 · Wild · Endless').textContent).toBe('—');
    const detail = () => screen.getByRole('region', { name: 'Selected set' });
    expect(within(detail()).getByRole('heading', { level: 3, name: '4×4 · Classic · Endless' })).toBeTruthy();
    expect(detail().textContent).toContain('Wins9 · 24%');
    expect(within(detail()).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      '120,410✓204812 Oct 2025',
      '214,208102412 Oct 2025',
    ]);

    await user.click(button('3×3 · Wild · Endless'));
    expect(detail().textContent).toContain('Played1');
    expect(detail().textContent).toContain('Wins1 · 100%');
    expect(within(detail()).getAllByRole('listitem')[0].textContent).toContain('✓');

    await user.click(screen.getByRole('radio', { name: 'Blitz' }));
    expect(detail().textContent).toContain('3×3 · Wild · Blitz');
    expect(detail().textContent).toContain('No games yet');
  });
});
