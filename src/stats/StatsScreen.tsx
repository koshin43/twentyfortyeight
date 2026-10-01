import { useState } from 'react';
import { BOARD_SIZES } from '../game';
import { formatDate, formatNumber } from './format';
import { bestScore, isWonRecord, PACES, parseSetKey, setKey, setName, STYLES, type SetKey, type Stats } from './stats';
import css from './StatsScreen.module.css';

interface Props {
  stats: Stats;
  current: SetKey;
  onClose: () => void;
}

const capitalised = (word: string) => word[0].toUpperCase() + word.slice(1);

/** Full-screen dialog over the game. Mounted only while open. */
export function StatsScreen({ stats, current, onClose }: Props) {
  const [selected, setSelected] = useState<SetKey>(current);
  const shown = parseSetKey(selected);
  const set = stats[selected];
  const [now] = useState(Date.now);

  return (
    <dialog
      ref={(el) => { if (el && !el.open) el.showModal(); }}
      className={css.screen}
      aria-label="Stats"
      onCancel={(e) => e.preventDefault()}
      onClose={onClose}
    >
      <header className={css.top}>
        <h2>Stats</h2>
        <button className={css.close} aria-label="Close" onClick={onClose}>✕</button>
      </header>

      <fieldset className={css.segment}>
        <legend className={css.hidden}>Pace</legend>
        {PACES.map((p) => (
          <label key={p}>
            <input
              type="radio"
              name="stats-pace"
              checked={shown.pace === p}
              onChange={() => setSelected(setKey({ ...shown, pace: p }))}
            />
            {capitalised(p)}
          </label>
        ))}
      </fieldset>

      <table className={css.grid}>
        <thead>
          <tr>
            <td />
            {BOARD_SIZES.map((s) => <th key={s} scope="col">{s}×{s}</th>)}
          </tr>
        </thead>
        <tbody>
          {STYLES.map((st) => (
            <tr key={st}>
              <th scope="row">{capitalised(st)}</th>
              {BOARD_SIZES.map((s) => {
                const key = setKey({ size: s, style: st, pace: shown.pace });
                const best = bestScore(stats[key]);
                return (
                  <td key={s}>
                    <button
                      className={css.cell}
                      aria-pressed={key === selected}
                      aria-label={setName({ size: s, style: st, pace: shown.pace })}
                      onClick={() => setSelected(key)}
                    >
                      {best === null ? '—' : formatNumber(best)}
                      {stats[key].played > 0 && <small>{stats[key].bestTile}</small>}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      <section className={css.detail} aria-label="Selected set">
        <h3>{setName(shown)}</h3>
        {set.played === 0 ? (
          <p>No games yet</p>
        ) : (
          <>
            <dl className={css.boxes}>
              <div><dt>Played</dt><dd>{formatNumber(set.played)}</dd></div>
              <div><dt>Wins</dt><dd>{formatNumber(set.wins)} · {Math.round((set.wins / set.played) * 100)}%</dd></div>
            </dl>
            <h3>Top 10</h3>
            <ol className={css.top10}>
              {set.top.map((r, i) => (
                <li key={i}>
                  <span className={css.rank}>{i + 1}</span>
                  <span className={css.score}>{formatNumber(r.score)}</span>
                  <span className={css.won}>{isWonRecord(selected, r) ? '✓' : ''}</span>
                  <span className={css.chip} data-tile={r.bestTile}>{r.bestTile}</span>
                  <span className={css.date}>{formatDate(r.endedAt, now)}</span>
                </li>
              ))}
            </ol>
          </>
        )}
      </section>
    </dialog>
  );
}
