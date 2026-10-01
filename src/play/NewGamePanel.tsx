import { useState } from 'react';
import { BOARD_SIZES, gameEnd, POWERS, type Game, type Pace, type Power, type Setup, type Style } from '../game';
import { formatNumber } from '../stats';
import css from './NewGamePanel.module.css';

interface Props {
  setup: Setup;
  game: Game;
  onStart: (setup: Setup) => void;
  onClose: () => void;
}

const POWER_NAMES: Record<Power, string> = { smash: '🔨 Smash', swap: '⇄ Swap', undo: '↶ Undo' };

function Segment<T extends string | number>({ name, options, value, label, onChange }: {
  name: string;
  options: T[];
  value: T;
  label: (option: T) => string;
  onChange: (option: T) => void;
}) {
  return (
    <fieldset className={css.segment}>
      <legend>{name}</legend>
      <div>
        {options.map((option) => (
          <label key={option}>
            <input type="radio" name={name} checked={value === option} onChange={() => onChange(option)} />
            {label(option)}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** Bottom panel for choosing the next game's setup. Mounted only while open. */
export function NewGamePanel({ setup, game, onStart, onClose }: Props) {
  const [size, setSize] = useState(setup.size);
  const [style, setStyle] = useState(setup.style);
  const [pace, setPace] = useState(setup.pace);
  const [picks, setPicks] = useState<Power[]>(setup.draft);
  const unfinished = gameEnd(game) === null;
  const ready = style === 'classic' || picks.length === 2;

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
        <Segment name="Board" options={BOARD_SIZES} value={size} label={(s) => `${s}×${s}`} onChange={setSize} />
        <Segment<Style> name="Style" options={['classic', 'wild']} value={style} label={(s) => (s === 'classic' ? 'Classic' : 'Wild')} onChange={setStyle} />
        <Segment<Pace> name="Pace" options={['endless', 'blitz']} value={pace} label={(p) => (p === 'endless' ? 'Endless' : 'Blitz')} onChange={setPace} />
        {style === 'wild' && (
          <fieldset className={css.draft}>
            <legend>Pick 2 powers</legend>
            <div>
              {POWERS.map((p) => (
                <label key={p}>
                  <input
                    type="checkbox"
                    checked={picks.includes(p)}
                    onChange={() => setPicks(picks.includes(p) ? picks.filter((x) => x !== p) : [...picks, p])}
                  />
                  {POWER_NAMES[p]}
                </label>
              ))}
            </div>
          </fieldset>
        )}
        {unfinished && (
          <p className={css.warning}>
            Your current game ends here.
            {game.score > 0 && ` Its ${formatNumber(game.score)} points will be recorded.`}
          </p>
        )}
        <button
          className={css.start}
          disabled={!ready}
          onClick={() => onStart({ size, style, pace, draft: picks.length === 2 ? [picks[0], picks[1]] : setup.draft })}
        >
          Start
        </button>
      </div>
    </dialog>
  );
}
