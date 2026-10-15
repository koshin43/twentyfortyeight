import { WIN_TILE, type Game, type Pace } from '../game';

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

export type Stats = Record<Pace, SetStats>;

const TOP = 10;

export const paceName = (pace: Pace) => (pace === 'endless' ? 'Endless' : 'Blitz');

export const isWonRecord = (record: GameRecord) => record.bestTile >= WIN_TILE;

const emptySet = (): SetStats => ({ played: 0, wins: 0, bestTile: 0, top: [] });

export const emptyStats = (): Stats => ({ endless: emptySet(), blitz: emptySet() });

/** Adds a finished or abandoned game to its pace. Ties keep the earlier game higher. */
export function recordGame(stats: Stats, game: Game, endedAt: number): Stats {
  const set = stats[game.pace];
  const record: GameRecord = { score: game.score, bestTile: game.bestTile, endedAt };
  const at = set.top.findIndex((r) => r.score < record.score);
  const top = at === -1 ? [...set.top, record] : [...set.top.slice(0, at), record, ...set.top.slice(at)];
  return {
    ...stats,
    [game.pace]: {
      played: set.played + 1,
      wins: set.wins + (isWonRecord(record) ? 1 : 0),
      bestTile: Math.max(set.bestTile, record.bestTile),
      top: top.slice(0, TOP),
    },
  };
}

export const bestScore = (set: SetStats): number | null => set.top[0]?.score ?? null;

/** Whether a game just recorded with this score beat the pace's previous best score. */
export function isNewBest(set: SetStats, score: number): boolean {
  return set.top[0]?.score === score && !(set.top[1] && set.top[1].score >= score);
}
