import { useEffect, useEffectEvent, useState } from 'react';
import {
  BLITZ_MS, gameEnd, isWon, keepGoing, move, newGame, spendTime, type Direction, type GameEvent, type Outcome, type Pace,
} from '../game';
import { loadSave, writeSave, type Part, type Save } from '../save';
import { bestScore, formatNumber, isNewBest, paceName, recordGame, StatsScreen } from '../stats';
import { Board } from './Board';
import { EndOverlay, WinBanner, WinOverlay } from './BoardOverlay';
import { playFeedback } from './feedback';
import { NewGamePanel } from './NewGamePanel';
import { newSeed } from './seed';
import css from './GameScreen.module.css';

const KEYS: Record<string, Direction> = {
  ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
  w: 'up', s: 'down', a: 'left', d: 'right', W: 'up', S: 'down', A: 'left', D: 'right',
};

const PART_NAMES: Record<Part, string> = {
  sound: 'your sound setting',
  game: 'your game',
  stats: 'your stats',
};

const WIN_BANNER_MS = 2000;
const CLOCK_REFRESH_MS = 250;
/** Blitz moves hit hardest in the last 30 seconds. */
const RUSH_MS = 30_000;

function clock(ms: number): string {
  const seconds = Math.ceil(ms / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

export function GameScreen() {
  const [loaded] = useState(() => loadSave(newSeed()));
  const [save, setSave] = useState(loaded.save);
  const [notice, setNotice] = useState(loaded.reset);
  const [runningSince, setRunningSince] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [dialog, setDialog] = useState<'newGame' | 'stats' | null>(null);
  const [shown, setShown] = useState<{ events: GameEvent[]; seq: number }>({ events: [], seq: 0 });
  const [banner, setBanner] = useState(false);

  const { game, stats, sound } = save;
  const set = stats[game.pace];
  const end = gameEnd(game);
  const blitz = game.pace === 'blitz';
  const winOverlay = !end && !blitz && isWon(game) && !game.winSeen;
  const blocked = end !== null || winOverlay || dialog !== null;

  useEffect(() => writeSave(save), [save]);

  /** Commits an action's outcome, records the game if it just ended, and plays its feedback. */
  function apply(outcome: Outcome, t: number): Save {
    const ended = outcome.events.some((e) => e.kind === 'end');
    const next = { ...save, game: outcome.game, stats: ended ? recordGame(stats, outcome.game, t) : stats };
    setSave(next);
    setRunningSince(blitz && !ended ? t : null);
    setNow(t);
    setShown((s) => ({ events: outcome.events, seq: s.seq + 1 }));
    if (blitz && outcome.events.some((e) => e.kind === 'win')) setBanner(true);
    if (sound) playFeedback(outcome.events);
    return next;
  }

  /** Stops the Blitz clock, keeping the time left in the game. */
  function pause(): Save {
    if (runningSince === null) return save;
    const t = Date.now();
    const spent = spendTime(game, t - runningSince);
    if (spent.events.length > 0) return apply(spent, t);
    const next = { ...save, game: spent.game };
    setSave(next);
    setRunningSince(null);
    return next;
  }

  /** Plays a swipe with the clock's time spent first. Starts or resumes a Blitz clock. */
  function swipe(dir: Direction) {
    if (blocked) return;
    const t = Date.now();
    const spent = runningSince === null ? null : spendTime(game, t - runningSince);
    if (spent && spent.events.length > 0) {
      apply(spent, t);
      return;
    }
    const outcome = move(spent?.game ?? game, dir);
    if (outcome) apply(outcome, t);
  }

  function openDialog(which: 'newGame' | 'stats') {
    pause();
    setDialog(which);
  }

  function start(pace: Pace) {
    const abandoned = end === null && game.score > 0;
    setSave({ sound, game: newGame(pace, newSeed()), stats: abandoned ? recordGame(stats, game, Date.now()) : stats });
    setRunningSince(null);
    setShown((s) => ({ events: [], seq: s.seq + 1 }));
    setBanner(false);
    setDialog(null);
  }

  const onKey = useEffectEvent((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      setDialog(null);
      return;
    }
    const dir = KEYS[e.key];
    if (!dir || e.ctrlKey || e.metaKey || e.altKey || dialog) return;
    e.preventDefault();
    swipe(dir);
  });

  const onVisibility = useEffectEvent(() => {
    if (document.visibilityState === 'hidden') writeSave(pause());
  });

  const onTick = useEffectEvent(() => {
    const t = Date.now();
    if (runningSince !== null && t - runningSince >= game.blitzMsLeft!) apply(spendTime(game, t - runningSince), t);
    else setNow(t);
  });

  useEffect(() => {
    const key = (e: KeyboardEvent) => onKey(e);
    const visibility = () => onVisibility();
    window.addEventListener('keydown', key);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      window.removeEventListener('keydown', key);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, []);

  useEffect(() => {
    if (runningSince === null) return;
    const id = setInterval(() => onTick(), CLOCK_REFRESH_MS);
    return () => clearInterval(id);
  }, [runningSince]);

  useEffect(() => {
    if (!banner) return;
    const id = setTimeout(() => setBanner(false), WIN_BANNER_MS);
    return () => clearTimeout(id);
  }, [banner]);

  const msLeft = game.blitzMsLeft === null ? null : runningSince === null ? game.blitzMsLeft : Math.max(0, game.blitzMsLeft - Math.max(0, now - runningSince));
  const gain = shown.events.reduce((sum, e) => sum + (e.kind === 'merge' ? e.tile.value : 0), 0);
  const paused = runningSince === null && end === null && game.blitzMsLeft !== null && game.blitzMsLeft < BLITZ_MS;

  return (
    <main className={css.screen}>
      {notice.length > 0 && (
        <div className={css.notice} role="alert">
          <span>Some saved data couldn&apos;t be read and was reset: {notice.map((p) => PART_NAMES[p]).join(', ')}</span>
          <button aria-label="Dismiss" onClick={() => setNotice([])}>✕</button>
        </div>
      )}

      <header className={css.row}>
        <h1 className={css.title}>2048</h1>
        <div className={css.box} role="group" aria-label="Score">
          <small>SCORE</small>
          <b>{formatNumber(game.score)}</b>
          {blitz && gain > 0 && (
            <span key={shown.seq} className={css.gain} aria-hidden>+{formatNumber(gain)}</span>
          )}
        </div>
        <div className={css.box} role="group" aria-label="Best">
          <small>BEST</small>
          <b>{formatNumber(Math.max(bestScore(set) ?? 0, game.score))}</b>
        </div>
      </header>

      <div className={css.row}>
        <p className={css.pace}>{paceName(game.pace)}</p>
        {msLeft !== null && (
          <div className={`${css.box} ${css.time}`} role="group" aria-label="Time">
            <small>{paused ? 'PAUSED' : 'TIME'}</small>
            <b>{clock(msLeft)}</b>
          </div>
        )}
      </div>

      <div className={css.row}>
        <button className={css.newGame} onClick={() => openDialog('newGame')}>New Game</button>
        <button className={css.icon} aria-label="Stats" onClick={() => openDialog('stats')}>📊</button>
        <button className={css.icon} aria-label="Sound" aria-pressed={sound} onClick={() => setSave({ ...save, sound: !sound })}>
          {sound ? '🔊' : '🔇'}
        </button>
      </div>

      <Board
        game={game}
        events={shown.events}
        seq={shown.seq}
        blitz={blitz}
        rush={msLeft !== null && msLeft <= RUSH_MS}
        onSwipe={swipe}
      >
        {banner && !end && <WinBanner />}
        {winOverlay && (
          <WinOverlay onKeepGoing={() => setSave({ ...save, game: keepGoing(game) })} onNewGame={() => openDialog('newGame')} />
        )}
        {end && <EndOverlay game={game} timeUp={end === 'timeUp'} newBest={isNewBest(set, game.score)} onNewGame={() => openDialog('newGame')} />}
      </Board>

      {dialog === 'newGame' && <NewGamePanel game={game} onStart={start} onClose={() => setDialog(null)} />}
      {dialog === 'stats' && <StatsScreen stats={stats} current={game.pace} onClose={() => setDialog(null)} />}
    </main>
  );
}
