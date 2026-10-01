import { BOARD_SIZES, SIZES, type BoardSize, type Game, type Pace, type Style } from '../game';

export type SetKey = `${BoardSize}-${Style}-${Pace}`;

export interface GameRecord {
  score: number;
  bestTile: number;
  endedAt: number;
}

export interface SetStats {
  played: number;
  wins: number;
  bestTile: number;
  top: GameRecord[];
}

export type Stats = Record<SetKey, SetStats>;

export type SetOf = { size: BoardSize; style: Style; pace: Pace };

export const STYLES: Style[] = ['classic', 'wild'];
export const PACES: Pace[] = ['endless', 'blitz'];
export const SET_KEYS: SetKey[] = BOARD_SIZES.flatMap((size) =>
  STYLES.flatMap((style) => PACES.map((pace): SetKey => `${size}-${style}-${pace}`)),
);
const TOP = 10;

export const setKey = ({ size, style, pace }: SetOf): SetKey => `${size}-${style}-${pace}`;

const capitalised = (word: string) => word[0].toUpperCase() + word.slice(1);
export const setName = ({ size, style, pace }: SetOf) => `${size}×${size} · ${capitalised(style)} · ${capitalised(pace)}`;

export function parseSetKey(key: SetKey): SetOf {
  const [size, style, pace] = key.split('-');
  return { size: Number(size) as BoardSize, style: style as Style, pace: pace as Pace };
}

export const isWonRecord = (key: SetKey, record: GameRecord) => record.bestTile >= SIZES[parseSetKey(key).size].winTile;

export function emptyStats(): Stats {
  const stats = {} as Stats;
  for (const key of SET_KEYS) stats[key] = { played: 0, wins: 0, bestTile: 0, top: [] };
  return stats;
}

/** Adds a finished or abandoned game to its set. Ties keep the earlier game higher. */
export function recordGame(stats: Stats, game: Game, endedAt: number): Stats {
  const key = setKey(game);
  const set = stats[key];
  const record: GameRecord = { score: game.score, bestTile: game.bestTile, endedAt };
  const at = set.top.findIndex((r) => r.score < record.score);
  const top = at === -1 ? [...set.top, record] : [...set.top.slice(0, at), record, ...set.top.slice(at)];
  return {
    ...stats,
    [key]: {
      played: set.played + 1,
      wins: set.wins + (isWonRecord(key, record) ? 1 : 0),
      bestTile: Math.max(set.bestTile, record.bestTile),
      top: top.slice(0, TOP),
    },
  };
}

export const bestScore = (set: SetStats): number | null => set.top[0]?.score ?? null;

/** Whether a game just recorded with this score beat the set's previous best score. */
export function isNewBest(set: SetStats, score: number): boolean {
  return set.top[0]?.score === score && !(set.top[1] && set.top[1].score >= score);
}
