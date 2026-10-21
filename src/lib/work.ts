import { and, asc, eq, isNotNull, isNull } from "drizzle-orm";
import { db, type Outcome } from "./db";
import { ALARM_MAX_MINUTES, BREAK_KINDS, type BreakKind, DAY_MINUTES, SNOOZE_MINUTES, TOWER_PLAN_MINUTES } from "./limits";
import { workSessions, workStretches } from "./schema";
import type { Span } from "./spans";
import {
  type Alarm,
  carriedAfterRest,
  localDay,
  nextAlarm,
  spansFor,
  tiredness,
  type Tiredness,
} from "./worktime";

// Work sessions: "Start working" on Mine, the little one, and the Enough
// alarm. Everything here is one person's own and is only ever rendered for
// them; nothing goes on the feed or the stream (CLAUDE.md: "Effort and check
// records are private").

const MINUTE = 60_000;
const iso = (ms: number) => new Date(ms).toISOString();
const ms = (s: string) => Date.parse(s);

export type WorkSession = typeof workSessions.$inferSelect;
type Stretch = typeof workStretches.$inferSelect;

export function openSession(personId: number): WorkSession | undefined {
  return db
    .select()
    .from(workSessions)
    .where(and(eq(workSessions.personId, personId), isNull(workSessions.endedAt)))
    .get();
}

const stretchesOf = (sessionId: number): Stretch[] =>
  db.select().from(workStretches).where(eq(workStretches.sessionId, sessionId)).orderBy(asc(workStretches.id)).all();

function alarmOf(s: WorkSession): Alarm | null {
  if (s.alarmKind === "interval" && s.alarmValue !== null) return { kind: "interval", minutes: s.alarmValue };
  if (s.alarmKind === "clock" && s.alarmValue !== null) return { kind: "clock", minute: s.alarmValue };
  return null;
}

// The alarm as the form sends it: kind "interval" with minutes, kind "clock"
// with HH:MM, or none. Anything else means no alarm rather than a guess.
export function parseAlarm(kind: string, minutes: string, clock: string): Alarm | null {
  if (kind === "interval") {
    const m = Number(minutes);
    return Number.isInteger(m) && m > 0 && m <= ALARM_MAX_MINUTES ? { kind: "interval", minutes: m } : null;
  }
  if (kind === "clock") {
    const match = /^(\d{1,2}):(\d{2})$/.exec(clock.trim());
    if (!match) return null;
    const minute = Number(match[1]) * 60 + Number(match[2]);
    return Number(match[1]) < 24 && Number(match[2]) < 60 && minute < DAY_MINUTES ? { kind: "clock", minute } : null;
  }
  return null;
}

// The browser's offset from UTC in minutes, as sent; out of range means UTC.
export const parseTz = (text: string) => {
  const tz = Number(text);
  return Number.isInteger(tz) && Math.abs(tz) <= 14 * 60 ? tz : 0;
};

// Start working. One open session per person: starting while one is open
// changes nothing.
export function startWork(personId: number, tz: number, alarm: Alarm | null, now = Date.now()): Outcome<WorkSession> {
  const already = openSession(personId);
  if (already) return { ok: false, reason: "You're already working." };
  const alarmAt = nextAlarm(alarm, now, tz, false);
  const session = db
    .insert(workSessions)
    .values({
      personId,
      startedAt: iso(now),
      tz,
      dayKey: localDay(now, tz),
      alarmKind: alarm?.kind ?? null,
      alarmValue: alarm ? (alarm.kind === "interval" ? alarm.minutes : alarm.minute) : null,
      alarmAt: alarmAt === null ? null : iso(alarmAt),
    })
    .returning()
    .get();
  db.insert(workStretches)
    .values({ sessionId: session.id, startedAt: iso(now), sleepyFrom: alarmAt === null ? null : iso(alarmAt) })
    .run();
  return { ok: true, value: session };
}

// "Give me 10 more minutes": the alarm asks again in SNOOZE_MINUTES, and the
// snooze is counted (the owner's alone). The little one keeps getting sleepier
// from the first alarm; snoozing doesn't wake it.
export function snooze(personId: number, now = Date.now()): Outcome<WorkSession> {
  const s = openSession(personId);
  if (!s || s.pausedAt) return { ok: false, reason: "You're not working right now." };
  const updated = db
    .update(workSessions)
    .set({ alarmAt: iso(now + SNOOZE_MINUTES * MINUTE), snoozes: s.snoozes + 1 })
    .where(eq(workSessions.id, s.id))
    .returning()
    .get();
  return { ok: true, value: updated };
}

// minutes past the alarm, at `at`, for a stretch
const minutesPast = (st: Stretch, at: number) =>
  st.sleepyFrom === null ? Math.max(0, st.carry) : st.carry + Math.max(0, (at - ms(st.sleepyFrom)) / MINUTE);

// Taking a break while working pauses the session: the open stretch ends, and
// how sleepy it was is kept for when they come back. Called from startBreak.
export function pauseWork(personId: number, kind: BreakKind, now = Date.now()): void {
  const s = openSession(personId);
  if (!s || s.pausedAt) return;
  db.update(workStretches)
    .set({ endedAt: iso(now) })
    .where(and(eq(workStretches.sessionId, s.id), isNull(workStretches.endedAt)))
    .run();
  db.update(workSessions).set({ pausedAt: iso(now), pauseKind: kind }).where(eq(workSessions.id, s.id)).run();
}

// Coming back resumes it: a new stretch, sleepiness carried over by how long
// they rested, and the alarm again: an interval counts from now, a clock time
// that already went off doesn't repeat. Called from endBreak.
export function resumeWork(personId: number, now = Date.now()): void {
  const s = openSession(personId);
  if (!s || !s.pausedAt) return;
  const last = stretchesOf(s.id).at(-1);
  const restMinutes = (now - ms(s.pausedAt)) / MINUTE;
  const past = last ? minutesPast(last, ms(last.endedAt ?? s.pausedAt)) : 0;
  const carry = carriedAfterRest(past, restMinutes);
  const alarm = alarmOf(s);
  const clockRang = alarm?.kind === "clock" && s.alarmAt !== null && ms(s.alarmAt) <= now;
  const alarmAt = nextAlarm(alarm, now, s.tz, clockRang || (alarm?.kind === "clock" && s.alarmAt === null));
  // carry > 0 means it's still a bit sleepy: it gets sleepier from now on
  const sleepyFrom = carry > 0 ? now : alarmAt;
  db.insert(workStretches)
    .values({ sessionId: s.id, startedAt: iso(now), sleepyFrom: sleepyFrom === null ? null : iso(sleepyFrom), carry })
    .run();
  db.update(workSessions)
    .set({ pausedAt: null, pauseKind: null, alarmAt: alarmAt === null ? null : iso(alarmAt) })
    .where(eq(workSessions.id, s.id))
    .run();
}

// Finishing ends the session and its stretch; the spans it pre-fills come
// from finishedSpans.
export function finishWork(personId: number, now = Date.now()): Outcome<WorkSession> {
  const s = openSession(personId);
  if (!s) return { ok: false, reason: "You're not working right now." };
  db.update(workStretches)
    .set({ endedAt: iso(now) })
    .where(and(eq(workStretches.sessionId, s.id), isNull(workStretches.endedAt)))
    .run();
  const ended = db
    .update(workSessions)
    .set({ endedAt: iso(now), pausedAt: null, pauseKind: null, alarmAt: null })
    .where(eq(workSessions.id, s.id))
    .returning()
    .get();
  return { ok: true, value: ended };
}

// The crayon spans a finished session pre-fills on Call it enough: its
// working stretches, breaks left out, in the owner's local time. Someone
// else's session, or one still going, gives nothing.
export function finishedSpans(personId: number, sessionId: number): { spans: Span[] } | null {
  const s = db
    .select()
    .from(workSessions)
    .where(and(eq(workSessions.id, sessionId), eq(workSessions.personId, personId), isNotNull(workSessions.endedAt)))
    .get();
  if (!s) return null;
  const parts = stretchesOf(s.id)
    .filter((st) => st.endedAt !== null)
    .map((st) => ({ from: ms(st.startedAt), to: ms(st.endedAt as string) }));
  return { spans: spansFor(parts, s.tz) };
}

// What Mine draws for the little one right now, and what its script needs to
// keep it moving: whether it's working or resting, how tired, the alarm, and
// how tall the day's tower is (a drawing, never a number).
export interface WorkView {
  state: "working" | "resting";
  restKind: BreakKind | null;
  restLabel: string | null;
  tiredness: Tiredness;
  // for the live script: when the open stretch started getting sleepy, and how
  // sleepy it already was then (null sleepyFrom: it won't, there's no alarm)
  sleepyFrom: string | null;
  carry: number;
  alarmAt: string | null;
  snoozes: number;
  // this session's tower: the minutes it's planned for (to the alarm), and
  // the minutes worked so far, breaks left out
  towerMinutes: number;
  worked: number;
  startedAt: string;
  alarmLabel: string | null;
}

export function workView(personId: number, now = Date.now()): WorkView | null {
  const s = openSession(personId);
  if (!s) return null;
  const stretches = stretchesOf(s.id);
  const open = stretches.find((st) => st.endedAt === null);
  const last = open ?? stretches.at(-1);
  const past = last ? minutesPast(last, open ? now : ms(last.endedAt as string)) : 0;
  // this session's tower (a new one each time you start): the minutes worked
  // in it so far, and the minutes it's planned for, to the alarm
  let worked = 0;
  for (const st of stretches) worked += ((st.endedAt ? ms(st.endedAt) : now) - ms(st.startedAt)) / MINUTE;
  const alarm = alarmOf(s);
  const started = ms(s.startedAt);
  const towerMinutes = !alarm
    ? TOWER_PLAN_MINUTES
    : alarm.kind === "interval"
      ? alarm.minutes
      : Math.max(1, ((nextAlarm(alarm, started, s.tz, false) ?? started) - started) / MINUTE);
  const clock = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
  return {
    state: s.pausedAt ? "resting" : "working",
    restKind: (s.pauseKind as BreakKind | null) ?? null,
    restLabel: s.pauseKind ? (BREAK_KINDS[s.pauseKind as BreakKind]?.label ?? null) : null,
    tiredness: s.pausedAt ? tiredness(0) : tiredness(past),
    sleepyFrom: open?.sleepyFrom ?? null,
    carry: open?.carry ?? 0,
    alarmAt: s.pausedAt ? null : s.alarmAt,
    snoozes: s.snoozes,
    towerMinutes,
    worked,
    startedAt: s.startedAt,
    alarmLabel: !alarm ? null : alarm.kind === "interval" ? `after ${alarm.minutes} minutes` : `at ${clock(alarm.minute)}`,
  };
}
