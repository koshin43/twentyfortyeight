import type { BoardSize, Power } from './types';

export const SIZES: Record<BoardSize, { winTile: number; recharge: number; rowWorth: number }> = {
  3: { winTile: 512, recharge: 50, rowWorth: 3 },
  4: { winTile: 2048, recharge: 150, rowWorth: 4 },
  5: { winTile: 8192, recharge: 300, rowWorth: 5 },
};

export const BOARD_SIZES: BoardSize[] = [3, 4, 5];
export const POWERS: Power[] = ['smash', 'swap', 'undo'];
export const BLITZ_MS = 180_000;
