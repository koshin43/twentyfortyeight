import { canUsePower, POWERS, type Game, type Power } from '../game';
import css from './PowerBar.module.css';

const LOOK: Record<Power, { icon: string; name: string }> = {
  smash: { icon: '🔨', name: 'Smash' },
  swap: { icon: '⇄', name: 'Swap' },
  undo: { icon: '↶', name: 'Undo' },
};

interface Props {
  game: Game;
  targeting: Power | null;
  onPower: (power: Power) => void;
}

/** Whether a power can take the waiting refill. */
export const takesRefill = (game: Game, power: Power) =>
  game.wild!.refillWaiting && ['recharging', 'notDrafted'].includes(game.wild!.powers[power].status);

export function PowerBar({ game, targeting, onPower }: Props) {
  const wild = game.wild!;
  return (
    <div className={css.bar}>
      <div className={css.powers}>
        {POWERS.map((power) => {
          const state = wild.powers[power];
          const glow = takesRefill(game, power);
          return (
            <button
              key={power}
              className={css.power}
              data-status={state.status}
              data-glow={glow || undefined}
              aria-pressed={targeting === power}
              disabled={!glow && !canUsePower(game, power)}
              onClick={() => onPower(power)}
            >
              <span aria-hidden>{LOOK[power].icon}</span>
              <span className={css.name}>{LOOK[power].name}</span>
              {state.status === 'recharging' && <span className={css.badge}>{state.movesLeft}</span>}
              {state.status === 'bonus' && <span className={css.badge} aria-label="bonus">↻</span>}
            </button>
          );
        })}
      </div>
      {wild.refillWaiting && <p className={css.message}>Refill: tap a glowing power</p>}
    </div>
  );
}
