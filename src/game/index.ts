export type { Direction, Game, GameEvent, Outcome, Pace, Tile } from './types';
export { SIZE, WIN_TILE } from './board';
export { BLITZ_MS, PACES, spendTime } from './pace';
export { newGame } from './newGame';
export { move } from './move';
export { gameEnd, isWon, keepGoing } from './end';
export { isCount, isExactObject, isGame, isTileValue } from './validate';
