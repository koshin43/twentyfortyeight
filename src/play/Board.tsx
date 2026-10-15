import { useRef, type CSSProperties, type ReactNode } from 'react';
import { SIZE, type Direction, type Game, type GameEvent, type Tile } from '../game';
import css from './Board.module.css';

const MIN_SWIPE_PX = 24;

/** Board kick in pixels, in the swipe direction. */
const KICK = { soft: 3, hard: 7 };
const HARD_MERGE_VALUE = 128;
const HARD_MERGE_COUNT = 3;
const RUSH_EXTRA_SPARKS = 3;

const STEP: Record<Direction, [number, number]> = { left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1] };

interface Props {
  game: Game;
  /** The last action's events and a counter that changes with every action. */
  events: GameEvent[];
  seq: number;
  /** Blitz moves hit harder, and harder still in the rush. */
  blitz: boolean;
  rush: boolean;
  onSwipe: (dir: Direction) => void;
  children?: ReactNode;
}

type Look = { from?: [number, number]; anim?: string };

/** How each tile enters this render, from the engine's events. */
function looks(events: GameEvent[], blitz: boolean): Map<number, Look> {
  const map = new Map<number, Look>();
  for (const e of events) {
    if (e.kind === 'slide') map.set(e.id, { from: e.from, anim: blitz ? css.thud : undefined });
    if (e.kind === 'merge') map.set(e.tile.id, { anim: blitz ? css.punch : css.pop });
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

/** The board's kick for a move: its direction and strength. */
function kick(dir: Direction | undefined, events: GameEvent[]): CSSProperties {
  const merges = events.flatMap((e) => (e.kind === 'merge' ? [e.tile.value] : []));
  const [kx, ky] = dir ? STEP[dir] : [0, 0];
  const hard = merges.length >= HARD_MERGE_COUNT || merges.some((v) => v >= HARD_MERGE_VALUE);
  return { '--kx': kx, '--ky': ky, '--kick': `${hard ? KICK.hard : KICK.soft}px` } as CSSProperties;
}

/** A merge's spark count and reach (in cells), both growing with the tile's value. */
function burst(value: number, rush: boolean): { sparks: number; reach: number } {
  const power = Math.log2(value);
  return { sparks: Math.min(12, 4 + Math.floor(power / 2)) + (rush ? RUSH_EXTRA_SPARKS : 0), reach: 0.45 + power * 0.06 };
}

function place(t: Tile, from?: [number, number]): CSSProperties {
  return { '--r': t.row, '--c': t.col, '--fr': from?.[0] ?? t.row, '--fc': from?.[1] ?? t.col } as CSSProperties;
}

export function Board({ game, events, seq, blitz, rush, onSwipe, children }: Props) {
  const start = useRef<{ x: number; y: number; id: number } | null>(null);
  const seen = looks(events, blitz);
  const dir = events.find((e) => e.kind === 'move')?.dir;

  return (
    <div className={css.frame}>
      <div
        className={css.board}
        style={{ '--size': SIZE, ...kick(dir, events) } as CSSProperties}
        data-blitz={blitz || undefined}
        data-rush={rush || undefined}
        data-dir={dir}
        data-kick={seq % 2}
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
              className={`${css.tile} ${look?.from ? css.slide : ''} ${look?.anim === css.punch ? css.lift : ''}`}
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
        {blitz &&
          events.map((e) => {
            if (e.kind !== 'merge') return null;
            const { sparks, reach } = burst(e.tile.value, rush);
            return (
              <div
                key={`burst:${e.tile.id}:${seq}`}
                className={`${css.tile} ${css.burst}`}
                style={{ ...place(e.tile), '--reach': reach } as CSSProperties}
                data-tile={e.tile.value}
                aria-hidden
              >
                <span className={css.ring} />
                {Array.from({ length: sparks }, (_, i) => (
                  <span
                    key={i}
                    className={css.spark}
                    style={{ '--a': `${(360 / sparks) * i + ((e.tile.id * 47) % 30)}deg`, '--far': i % 2 ? 1 : 0.7 } as CSSProperties}
                  />
                ))}
              </div>
            );
          })}
        {children}
      </div>
    </div>
  );
}
