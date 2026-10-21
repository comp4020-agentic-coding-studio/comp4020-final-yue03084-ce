import {
  BLOCK_EVERY_MINUTES,
  BLOCK_FACTOR,
  DIMMEST_GLOW,
  GLOW_FACTOR,
  DAY_MINUTES,
  RECOVER_MINUTES,
  SLOT_MINUTES,
  SLOW_EVERY_MINUTES,
  SLOWEST_SPEED,
  SMALLEST_BLOCK,
  SPEED_FACTOR,
  TOWER_MAX,
  YAWN_AFTER_MINUTES,
} from "./limits";
import type { Span } from "./spans";

// The arithmetic of a work session, with no database: what time it is for the
// person (their browser's offset), when the alarm goes off, how sleepy the
// little one is, and the crayon spans a session pre-fills. Used by the server
// and, for the live animation, by the browser.

const MINUTE = 60_000;

// local wall-clock minutes since midnight, and the local date, for an instant;
// tz is minutes ahead of UTC (Canberra in summer: 660)
export const localMinutes = (ms: number, tz: number) => {
  const d = new Date(ms + tz * MINUTE);
  return d.getUTCHours() * 60 + d.getUTCMinutes();
};
export const localDay = (ms: number, tz: number) => new Date(ms + tz * MINUTE).toISOString().slice(0, 10);

export type Alarm = { kind: "interval"; minutes: number } | { kind: "clock"; minute: number };

// When the alarm next goes off for a stretch beginning at `from`: an interval
// counts from then; a clock time is the next time the clock reads it, unless
// it already went off once in this session (then it doesn't repeat).
export function nextAlarm(alarm: Alarm | null, from: number, tz: number, clockAlreadyRang: boolean): number | null {
  if (!alarm) return null;
  if (alarm.kind === "interval") return from + alarm.minutes * MINUTE;
  if (clockAlreadyRang) return null;
  const now = localMinutes(from, tz);
  let ahead = alarm.minute - now;
  if (ahead < 0) ahead += DAY_MINUTES;
  return from + ahead * MINUTE;
}

// How tired the little one is, from minutes past the alarm (the metaphor in
// limits.ts): speed, block size and the lamp's glow fall by a factor every
// SLOW_EVERY_MINUTES, each with a floor; it yawns past YAWN_AFTER_MINUTES.
// Before the alarm, fresh.
export interface Tiredness {
  sleepy: boolean;
  speed: number;
  block: number;
  glow: number;
  yawning: boolean;
}
export function tiredness(minutesPast: number): Tiredness {
  if (minutesPast <= 0) return { sleepy: false, speed: 1, block: 1, glow: 1, yawning: false };
  const steps = Math.floor(minutesPast / SLOW_EVERY_MINUTES);
  return {
    sleepy: true,
    speed: Math.max(SLOWEST_SPEED, SPEED_FACTOR ** steps),
    block: Math.max(SMALLEST_BLOCK, BLOCK_FACTOR ** steps),
    glow: Math.max(DIMMEST_GLOW, GLOW_FACTOR ** steps),
    yawning: minutesPast >= YAWN_AFTER_MINUTES,
  };
}

// After a rest of `restMinutes`, how much of the sleepiness is left: none
// after RECOVER_MINUTES, otherwise the share not yet rested away.
export const carriedAfterRest = (minutesPast: number, restMinutes: number) =>
  Math.max(0, minutesPast) * Math.max(0, 1 - restMinutes / RECOVER_MINUTES);

// How many blocks the day's tower has, from the minutes worked today (never
// shown as a number; it only sets how tall the drawing is).
export const towerBlocks = (workedMinutes: number) =>
  Math.min(TOWER_MAX, Math.floor(workedMinutes / BLOCK_EVERY_MINUTES));

// The crayon spans for some stretches of work, in local time: each stretch
// rounded to the nearest SLOT_MINUTES (at least one slot), clipped to one day.
// A stretch that crosses midnight keeps the part on the day it ends.
export function spansFor(stretches: { from: number; to: number }[], tz: number): Span[] {
  const out: Span[] = [];
  for (const s of stretches) {
    const day = localDay(s.to, tz);
    let from = localDay(s.from, tz) === day ? localMinutes(s.from, tz) : 0;
    let to = localMinutes(s.to, tz);
    if (to === 0 && s.to > s.from) to = DAY_MINUTES;
    from = Math.round(from / SLOT_MINUTES) * SLOT_MINUTES;
    to = Math.round(to / SLOT_MINUTES) * SLOT_MINUTES;
    if (to <= from) to = from + SLOT_MINUTES;
    if (to > DAY_MINUTES) {
      to = DAY_MINUTES;
      from = Math.min(from, DAY_MINUTES - SLOT_MINUTES);
    }
    out.push({ from, to });
  }
  out.sort((a, b) => a.from - b.from);
  const merged: Span[] = [];
  for (const s of out) {
    const last = merged.at(-1);
    if (last && s.from <= last.to) last.to = Math.max(last.to, s.to);
    else merged.push({ ...s });
  }
  return merged;
}
