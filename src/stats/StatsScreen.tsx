import { useState } from 'react';
import { PACES, type Pace } from '../game';
import { formatDate, formatNumber } from './format';
import { bestScore, isWonRecord, paceName, type Stats } from './stats';
import css from './StatsScreen.module.css';

interface Props {
  stats: Stats;
  current: Pace;
  onClose: () => void;
}

/** Full-screen dialog over the game. Mounted only while open. */
export function StatsScreen({ stats, current, onClose }: Props) {
  const [selected, setSelected] = useState<Pace>(current);
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

      <div className={css.grid}>
        {PACES.map((pace) => {
          const best = bestScore(stats[pace]);
          return (
            <button key={pace} className={css.cell} aria-pressed={pace === selected} onClick={() => setSelected(pace)}>
              <small>{paceName(pace)}</small>
              {best === null ? '—' : formatNumber(best)}
              {stats[pace].played > 0 && <small>{stats[pace].bestTile}</small>}
            </button>
          );
        })}
      </div>

      <section className={css.detail} aria-label="Selected pace">
        <h3>{paceName(selected)}</h3>
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
                  <span className={css.won}>{isWonRecord(r) ? '✓' : ''}</span>
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
