export type BoardSize = 3 | 4 | 5;
export type Style = 'classic' | 'wild';
export type Pace = 'endless' | 'blitz';
export type Power = 'smash' | 'swap' | 'undo';
export type Direction = 'up' | 'down' | 'left' | 'right';

export interface Setup {
  size: BoardSize;
  style: Style;
  pace: Pace;
  draft: [Power, Power];
}

export type NumberTile = { id: number; row: number; col: number; kind: 'number'; value: number };
export type JokerTile = { id: number; row: number; col: number; kind: 'joker' };
export type StoneTile = { id: number; row: number; col: number; kind: 'stone'; countdown: number };
export type Tile = NumberTile | JokerTile | StoneTile;

export interface Position {
  tiles: Tile[];
  nextTileId: number;
  score: number;
  random: number;
}

export interface Game extends Position {
  size: BoardSize;
  style: Style;
  pace: Pace;
  bestTile: number;
  winSeen: boolean;
  wild: Wild | null;
  blitzMsLeft: number | null;
}

export type PowerState =
  | { status: 'ready' }
  | { status: 'recharging'; movesLeft: number }
  | { status: 'notDrafted' }
  | { status: 'bonus' };

export interface Wild {
  powers: Record<Power, PowerState>;
  refillWaiting: boolean;
  undo: Position | null;
}

/** What happened during one action, in order. The only source for animation, sound and vibration. */
export type GameEvent =
  | { kind: 'move' }
  | { kind: 'slide'; id: number; from: [number, number]; to: [number, number] }
  | { kind: 'merge'; tile: NumberTile; sources: [Tile, Tile] }
  | { kind: 'crumble'; tile: StoneTile }
  | { kind: 'spawn'; tile: Tile }
  | { kind: 'smash'; tile: Tile }
  | { kind: 'power'; power: Power }
  | { kind: 'bestTile'; value: number }
  | { kind: 'refill' }
  | { kind: 'win' }
  | { kind: 'end' };

export interface Outcome {
  game: Game;
  events: GameEvent[];
}
