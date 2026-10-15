import { useState } from 'react';
import { gameEnd, PACES, type Game, type Pace } from '../game';
import { formatNumber, paceName } from '../stats';
import css from './NewGamePanel.module.css';

interface Props {
  game: Game;
  onStart: (pace: Pace) => void;
  onClose: () => void;
}

/** Bottom panel for choosing the next game's pace. Mounted only while open. */
export function NewGamePanel({ game, onStart, onClose }: Props) {
  const [pace, setPace] = useState(game.pace);
  const unfinished = gameEnd(game) === null;

  return (
    <dialog
      ref={(el) => { if (el && !el.open) el.showModal(); }}
      className={css.panel}
      aria-labelledby="new-game-title"
      onCancel={(e) => e.preventDefault()}
      onClose={onClose}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className={css.sheet}>
        <header className={css.top}>
          <h2 id="new-game-title">New Game</h2>
          <button className={css.close} aria-label="Close" onClick={onClose}>✕</button>
        </header>
        <fieldset className={css.segment}>
          <legend>Pace</legend>
          <div>
            {PACES.map((p) => (
              <label key={p}>
                <input type="radio" name="pace" checked={pace === p} onChange={() => setPace(p)} />
                <span>{paceName(p)}</span>
              </label>
            ))}
          </div>
        </fieldset>
        {unfinished && (
          <p className={css.warning}>
            Your current game ends here.
            {game.score > 0 && ` Its ${formatNumber(game.score)} points will be recorded.`}
          </p>
        )}
        <button className={css.start} onClick={() => onStart(pace)}>
          Start
        </button>
      </div>
    </dialog>
  );
}
