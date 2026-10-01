import { useRef, type CSSProperties, type ReactNode } from 'react';
import type { Direction, Game, GameEvent, Tile } from '../game';
import css from './Board.module.css';

const MIN_SWIPE_PX = 24;

interface Props {
  game: Game;
  /** The last action's events and a counter that changes with every action. */
  events: GameEvent[];
  seq: number;
  picking: boolean;
  selected: number | null;
  onSwipe: (dir: Direction) => void;
  onPick: (id: number) => void;
  children?: ReactNode;
}

const label = (t: Tile) => (t.kind === 'joker' ? '★' : t.kind === 'stone' ? String(t.countdown) : String(t.value));
const name = (t: Tile) => (t.kind === 'joker' ? 'Joker' : t.kind === 'stone' ? `Stone ${t.countdown}` : String(t.value));
const shade = (t: Tile) => (t.kind === 'number' ? t.value : t.kind);

type Look = { from?: [number, number]; anim?: string };

/** How each tile enters this render, from the engine's events. */
function looks(events: GameEvent[]): Map<number, Look> {
  const map = new Map<number, Look>();
  for (const e of events) {
    if (e.kind === 'slide') map.set(e.id, { from: e.from });
    if (e.kind === 'merge') map.set(e.tile.id, { anim: css.pop });
    if (e.kind === 'spawn') map.set(e.tile.id, { anim: e.tile.kind === 'stone' ? css.drop : css.grow });
  }
  return map;
}

/** Tiles that left the board in this action, drawn once more while they animate away. */
function ghosts(events: GameEvent[]): { tile: Tile; from?: [number, number]; anim: string }[] {
  return events.flatMap((e) =>
    e.kind === 'merge'
      ? e.sources.map((s) => ({ tile: { ...s, row: e.tile.row, col: e.tile.col }, from: [s.row, s.col] as [number, number], anim: css.merged }))
      : e.kind === 'crumble' || e.kind === 'smash'
        ? [{ tile: e.tile, anim: css.crumble }]
        : [],
  );
}

function place(t: Tile, from?: [number, number]): CSSProperties {
  return { '--r': t.row, '--c': t.col, '--fr': from?.[0] ?? t.row, '--fc': from?.[1] ?? t.col } as CSSProperties;
}

export function Board({ game, events, seq, picking, selected, onSwipe, onPick, children }: Props) {
  const start = useRef<{ x: number; y: number; id: number; tile: number | null } | null>(null);
  const seen = looks(events);

  return (
    <div className={css.frame}>
      <div
        className={css.board}
        style={{ '--size': game.size } as CSSProperties}
        aria-label="Board"
        role="region"
        data-picking={picking || undefined}
        onPointerDown={(e) => {
          const tile = (e.target as HTMLElement).closest<HTMLElement>('[data-id]');
          start.current = { x: e.clientX, y: e.clientY, id: e.pointerId, tile: tile ? Number(tile.dataset.id) : null };
        }}
        onPointerCancel={() => (start.current = null)}
        onPointerUp={(e) => {
          const s = start.current;
          start.current = null;
          if (!s || s.id !== e.pointerId) return;
          const dx = e.clientX - s.x;
          const dy = e.clientY - s.y;
          if (Math.max(Math.abs(dx), Math.abs(dy)) >= MIN_SWIPE_PX) {
            onSwipe(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up');
          } else if (picking && s.tile !== null) {
            onPick(s.tile);
          }
        }}
      >
        {Array.from({ length: game.size * game.size }, (_, i) => (
          <div key={i} className={css.cell} />
        ))}
        {ghosts(events).map(({ tile, from, anim }) => (
          <div
            key={`ghost:${tile.id}:${seq}`}
            className={`${css.tile} ${from ? css.slide : ''} ${anim}`}
            style={place(tile, from)}
            data-tile={shade(tile)}
            data-digits={label(tile).length}
            aria-hidden
          >
            <span className={css.face}>{label(tile)}</span>
          </div>
        ))}
        {game.tiles.map((t) => {
          const look = seen.get(t.id);
          return (
            <div
              key={`${t.id}:${seq}`}
              className={`${css.tile} ${look?.from ? css.slide : ''} ${t.kind === 'stone' ? css.stone : ''}`}
              style={place(t, look?.from)}
              data-id={t.id}
              data-tile={shade(t)}
              data-digits={label(t).length}
              data-selected={t.id === selected || undefined}
              role="img"
              aria-label={`${name(t)}, row ${t.row + 1}, column ${t.col + 1}`}
            >
              <span className={`${css.face} ${look?.anim ?? ''}`}>{label(t)}</span>
            </div>
          );
        })}
        {children}
      </div>
    </div>
  );
}
