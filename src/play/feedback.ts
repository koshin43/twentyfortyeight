import type { GameEvent } from '../game';

/** A generated sound: notes played one after another, plus an optional vibration in ms. */
interface Cue {
  notes: number[];
  step: number;
  length: number;
  wave: OscillatorType;
  volume: number;
  vibrate?: number;
}

const SHORT = 30;
const LONG = 250;

const CUES = {
  move: { notes: [180], step: 0, length: 0.04, wave: 'triangle', volume: 0.05 },
  chime: { notes: [988, 1319], step: 0.09, length: 0.35, wave: 'sine', volume: 0.12, vibrate: SHORT },
  fanfare: { notes: [523, 659, 784, 1047, 784, 1047], step: 0.13, length: 0.22, wave: 'square', volume: 0.06, vibrate: LONG },
  falling: { notes: [440, 349, 262], step: 0.2, length: 0.3, wave: 'triangle', volume: 0.12, vibrate: LONG },
} satisfies Record<string, Cue>;

/** A merge pop rises with the tile's value. */
const pop = (value: number): Cue => ({ notes: [200 * 1.12 ** Math.log2(value)], step: 0, length: 0.09, wave: 'sine', volume: 0.12 });

function cuesFor(events: GameEvent[]): Cue[] {
  const cues: Cue[] = [];
  let topMerge = 0;
  for (const e of events) {
    if (e.kind === 'move') cues.push(CUES.move);
    else if (e.kind === 'merge') topMerge = Math.max(topMerge, e.tile.value);
    else if (e.kind === 'bestTile' && e.value >= 128) cues.push(CUES.chime);
    else if (e.kind === 'win') cues.push(CUES.fanfare);
    else if (e.kind === 'end') cues.push(CUES.falling);
  }
  if (topMerge) cues.push(pop(topMerge));
  return cues;
}

let audio: AudioContext | null = null;

/** Plays the sounds and vibration for what just happened. */
export function playFeedback(events: GameEvent[]): void {
  const cues = cuesFor(events);
  if (cues.length === 0) return;
  audio ??= new AudioContext();
  if (audio.state === 'suspended') void audio.resume();
  const start = audio.currentTime;
  for (const cue of cues) {
    cue.notes.forEach((freq, i) => {
      const at = start + i * cue.step;
      const osc = audio!.createOscillator();
      const gain = audio!.createGain();
      osc.type = cue.wave;
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(cue.volume, at);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + cue.length);
      osc.connect(gain).connect(audio!.destination);
      osc.start(at);
      osc.stop(at + cue.length);
    });
  }
  const vibrate = Math.max(0, ...cues.map((c) => c.vibrate ?? 0));
  if (vibrate && 'vibrate' in navigator) navigator.vibrate(vibrate);
}
