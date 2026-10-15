export type Pace = 'endless' | 'blitz';
export type Direction = 'up' | 'down' | 'left' | 'right';

export interface Tile {
  id: number;
  row: number;
  col: number;
  value: number;
}

export interface Game {
  tiles: Tile[];
  nextTileId: number;
  score: number;
  random: number;
  pace: Pace;
  bestTile: number;
  winSeen: boolean;
  blitzMsLeft: number | null;
}

/** What happened during one action, in order. The only source for animation, sound and vibration. */
export type GameEvent =
  | { kind: 'move'; dir: Direction }
  | { kind: 'slide'; id: number; from: [number, number]; to: [number, number] }
  | { kind: 'merge'; tile: Tile; sources: [Tile, Tile] }
  | { kind: 'spawn'; tile: Tile }
  | { kind: 'bestTile'; value: number }
  | { kind: 'win' }
  | { kind: 'end' };

export interface Outcome {
  game: Game;
  events: GameEvent[];
}
