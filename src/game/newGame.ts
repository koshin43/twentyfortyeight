import { BLITZ_MS } from './pace';
import { spawn } from './spawn';
import type { Game, Pace } from './types';

export function newGame(pace: Pace, seed: number): Game {
  let game: Game = {
    tiles: [],
    nextTileId: 0,
    score: 0,
    random: seed >>> 0,
    pace,
    bestTile: 2,
    winSeen: false,
    blitzMsLeft: pace === 'blitz' ? BLITZ_MS : null,
  };
  for (let i = 0; i < 2; i++) game = spawn(game).game;
  return { ...game, bestTile: Math.max(...game.tiles.map((t) => t.value)) };
}
