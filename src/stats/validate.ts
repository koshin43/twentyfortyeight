import { isCount, isExactObject, isTileValue } from '../game';
import { isWonRecord, SET_KEYS, type GameRecord, type Stats } from './stats';

const isRecord = (value: unknown): value is GameRecord =>
  isExactObject(value, ['score', 'bestTile', 'endedAt']) && isCount(value.score) && isTileValue(value.bestTile) && isCount(value.endedAt);

export function isStats(value: unknown): value is Stats {
  if (!isExactObject(value, SET_KEYS)) return false;
  return SET_KEYS.every((key) => {
    const set = value[key];
    if (!isExactObject(set, ['played', 'wins', 'bestTile', 'top'])) return false;
    const { played, wins, bestTile, top } = set;
    if (!isCount(played) || !isCount(wins) || wins > played) return false;
    if (played === 0 ? bestTile !== 0 : !isTileValue(bestTile)) return false;
    if (!Array.isArray(top) || top.length > Math.min(played, 10) || !top.every(isRecord)) return false;
    const ordered = top.every((r, i) => i === 0 || r.score < top[i - 1].score || (r.score === top[i - 1].score && r.endedAt >= top[i - 1].endedAt));
    return ordered && wins >= top.filter((r) => isWonRecord(key, r)).length && top.every((r) => r.bestTile <= (bestTile as number));
  });
}
