import { DEFAULT_SETUP, isGame, isSetup, newGame, type Game, type Setup } from '../game';
import { emptyStats, isStats, type Stats } from '../stats';

export interface Save {
  setup: Setup;
  sound: boolean;
  game: Game;
  stats: Stats;
}

export type Part = keyof Save;

const KEY = '2048';
const PARTS: Part[] = ['setup', 'sound', 'game', 'stats'];

const isPart: Record<Part, (value: unknown) => boolean> = {
  setup: isSetup,
  sound: (value) => typeof value === 'boolean',
  game: isGame,
  stats: isStats,
};

/**
 * Reads the save, replacing each part that fails validation. `reset` names the replaced parts.
 * `seed` seeds the new game when there is no valid one.
 */
export function loadSave(seed: number): { save: Save; reset: Part[] } {
  let raw: string | null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    raw = null;
  }
  let data: Record<string, unknown> = {};
  let unreadable = false;
  if (raw !== null) {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed) && Object.keys(parsed).every((k) => PARTS.includes(k as Part))) {
        data = parsed as Record<string, unknown>;
      } else {
        unreadable = true;
      }
    } catch {
      unreadable = true;
    }
  }
  const reset = raw === null ? [] : PARTS.filter((part) => unreadable || !isPart[part](data[part]));
  const keep = <P extends Part>(part: P, fallback: () => Save[P]): Save[P] =>
    reset.includes(part) || raw === null ? fallback() : (data[part] as Save[P]);
  const setup = keep('setup', () => DEFAULT_SETUP);
  return {
    save: {
      setup,
      sound: keep('sound', () => true),
      game: keep('game', () => newGame(setup, seed)),
      stats: keep('stats', emptyStats),
    },
    reset,
  };
}

/** Writes the whole save in one write. An invalid save is a bug and throws. */
export function writeSave(save: Save): void {
  const bad = PARTS.filter((part) => !isPart[part](save[part]));
  if (bad.length > 0) throw new Error(`Refusing to save invalid ${bad.join(', ')}`);
  try {
    localStorage.setItem(KEY, JSON.stringify(save));
  } catch (error) {
    console.error('Could not save', error);
  }
}
