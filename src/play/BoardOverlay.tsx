import { SIZES, type Game } from '../game';
import { formatNumber } from '../stats';
import css from './BoardOverlay.module.css';

export function WinOverlay({ game, onKeepGoing, onNewGame }: { game: Game; onKeepGoing: () => void; onNewGame: () => void }) {
  return (
    <div className={`${css.overlay} ${css.win}`} role="dialog" aria-label="You won">
      <h2>You made {SIZES[game.size].winTile}!</h2>
      <div className={css.actions}>
        <button onClick={onKeepGoing}>Keep Going</button>
        <button onClick={onNewGame}>New Game</button>
      </div>
    </div>
  );
}

export function EndOverlay({ game, timeUp, newBest, onNewGame }: { game: Game; timeUp: boolean; newBest: boolean; onNewGame: () => void }) {
  return (
    <div className={`${css.overlay} ${css.end}`} role="dialog" aria-label="Game ended">
      <h2>{timeUp ? "Time's Up" : 'Game Over'}</h2>
      <p>Score {formatNumber(game.score)}</p>
      <p>Best tile {game.bestTile}</p>
      {newBest && <p className={css.newBest}>New best!</p>}
      <div className={css.actions}>
        <button onClick={onNewGame}>New Game</button>
      </div>
    </div>
  );
}

export function WinBanner({ game }: { game: Game }) {
  return <div className={css.banner} role="status">You made {SIZES[game.size].winTile}!</div>;
}
