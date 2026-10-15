import { useRef, type CSSProperties, type ReactNode } from 'react';
import { SIZE, type Direction, type Game, type GameEvent, type Tile } from '../game';
import css from './Board.module.css';

const MIN_SWIPE_PX = 24;

interface Props {
  game: Game;
  /** The last action's events and a counter that changes with every action. */
  events: GameEvent[];
  seq: number;
  onSwipe: (dir: Direction) => void;
  children?: ReactNode;
}

type Look = { from?: [number, number]; anim?: string };

/** How each tile enters this render, from the engine's events. */
function looks(events: GameEvent[]): Map<number, Look> {
  const map = new Map<number, Look>();
  for (const e of events) {
    if (e.kind === 'slide') map.set(e.id, { from: e.from });
    if (e.kind === 'merge') map.set(e.tile.id, { anim: css.pop });
    if (e.kind === 'spawn') map.set(e.tile.id, { anim: css.grow });
  }
  return map;
}

/** Tiles merged away in this action, drawn sliding into their merge cell before they vanish. */
function ghosts(events: GameEvent[]): { tile: Tile; from: [number, number] }[] {
  return events.flatMap((e) =>
    e.kind === 'merge' ? e.sources.map((s) => ({ tile: { ...s, row: e.tile.row, col: e.tile.col }, from: [s.row, s.col] as [number, number] })) : [],
  );
}

function place(t: Tile, from?: [number, number]): CSSProperties {
  return { '--r': t.row, '--c': t.col, '--fr': from?.[0] ?? t.row, '--fc': from?.[1] ?? t.col } as CSSProperties;
}

export function Board({ game, events, seq, onSwipe, children }: Props) {
  const start = useRef<{ x: number; y: number; id: number } | null>(null);
  const seen = looks(events);

  return (
    <div className={css.frame}>
      <div
        className={css.board}
        style={{ '--size': SIZE } as CSSProperties}
        aria-label="Board"
        role="region"
        onPointerDown={(e) => (start.current = { x: e.clientX, y: e.clientY, id: e.pointerId })}
        onPointerCancel={() => (start.current = null)}
        onPointerUp={(e) => {
          const s = start.current;
          start.current = null;
          if (!s || s.id !== e.pointerId) return;
          const dx = e.clientX - s.x;
          const dy = e.clientY - s.y;
          if (Math.max(Math.abs(dx), Math.abs(dy)) >= MIN_SWIPE_PX) {
            onSwipe(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up');
          }
        }}
      >
        {Array.from({ length: SIZE * SIZE }, (_, i) => (
          <div key={i} className={css.cell} />
        ))}
        {ghosts(events).map(({ tile, from }) => (
          <div
            key={`ghost:${tile.id}:${seq}`}
            className={`${css.tile} ${css.slide} ${css.merged}`}
            style={place(tile, from)}
            data-tile={tile.value}
            data-digits={String(tile.value).length}
            aria-hidden
          >
            <span className={css.face}>{tile.value}</span>
          </div>
        ))}
        {game.tiles.map((t) => {
          const look = seen.get(t.id);
          return (
            <div
              key={`${t.id}:${seq}`}
              className={`${css.tile} ${look?.from ? css.slide : ''}`}
              style={place(t, look?.from)}
              data-tile={t.value}
              data-digits={String(t.value).length}
              role="img"
              aria-label={`${t.value}, row ${t.row + 1}, column ${t.col + 1}`}
            >
              <span className={`${css.face} ${look?.anim ?? ''}`}>{t.value}</span>
            </div>
          );
        })}
        {children}
      </div>
    </div>
  );
}
