export type {
  BoardSize, Direction, Game, GameEvent, NumberTile, Outcome, Pace, Position, Power, PowerState, Setup, Style, Tile, Wild,
} from './types';
export { BLITZ_MS, BOARD_SIZES, POWERS, SIZES } from './sizes';
export { DEFAULT_SETUP, newGame, spendTime } from './newGame';
export { move } from './move';
export { keepGoing, pickRefill, smash, swap, undo } from './powers';
export { spawnOdds } from './spawn';
export { canUsePower, gameEnd, isWon } from './end';
export { isCount, isExactObject, isGame, isSetup, isTileValue } from './validate';
