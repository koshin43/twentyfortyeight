import { BLITZ_MS } from './sizes';
import { spawn } from './spawn';
import type { Game, Outcome, Position, Setup } from './types';

export const DEFAULT_SETUP: Setup = { size: 4, style: 'classic', pace: 'endless', draft: ['smash', 'swap'] };

export function newGame(setup: Setup, seed: number): Game {
  let position: Position = { tiles: [], nextTileId: 0, score: 0, random: seed >>> 0 };
  for (let i = 0; i < 2; i++) position = spawn(position, setup.size, { joker: 0, stone: 0 }).position;
  return {
    ...position,
    size: setup.size,
    style: setup.style,
    pace: setup.pace,
    bestTile: Math.max(...position.tiles.map((t) => (t.kind === 'number' ? t.value : 0))),
    winSeen: false,
    wild:
      setup.style === 'wild'
        ? {
            powers: {
              smash: { status: setup.draft.includes('smash') ? 'ready' : 'notDrafted' },
              swap: { status: setup.draft.includes('swap') ? 'ready' : 'notDrafted' },
              undo: { status: setup.draft.includes('undo') ? 'ready' : 'notDrafted' },
            },
            refillWaiting: false,
            undo: null,
          }
        : null,
    blitzMsLeft: setup.pace === 'blitz' ? BLITZ_MS : null,
  };
}

/** Runs the Blitz clock down by elapsed milliseconds. Reaching 0:00 ends the game. */
export function spendTime(game: Game, ms: number): Outcome {
  const blitzMsLeft = Math.max(0, game.blitzMsLeft! - ms);
  return { game: { ...game, blitzMsLeft }, events: blitzMsLeft === 0 ? [{ kind: 'end' }] : [] };
}
