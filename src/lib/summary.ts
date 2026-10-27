import { DAY_MINUTES, FEELINGS, SLOT_MINUTES } from "./limits";
import { hoursIn, parseSpans } from "./spans";

// The look back on Mine: one day, week or month of a person's own enoughs,
// added up for them alone. Never a streak, never compared with anyone, and
// never set against the period before (CLAUDE.md: "No streaks, rankings or
// public totals"). Days are Sydney days, as every date on the site is.
export const TIME_ZONE = "Australia/Sydney";
export const PERIODS = { day: "Day", week: "Week", month: "Month" } as const;
export type Period = keyof typeof PERIODS;
export const isPeriod = (key: string): key is Period => Object.hasOwn(PERIODS, key);
export const DEFAULT_PERIOD: Period = "week";

// "2026-10-21", the local date an instant falls on
export const localDate = (iso: string | number) =>
  new Date(iso).toLocaleDateString("en-CA", { timeZone: TIME_ZONE });

// Date arithmetic on plain dates, done at noon UTC so no offset can tip it
// into the next or previous day.
const asDate = (day: string) => new Date(`${day}T12:00:00Z`);
const asDay = (d: Date) => d.toISOString().slice(0, 10);
export const addDays = (day: string, n: number) => {
  const d = asDate(day);
  d.setUTCDate(d.getUTCDate() + n);
  return asDay(d);
};

// The first and last local dates of the period `back` steps before the one
// `today` is in. Weeks start on Monday.
export function periodRange(period: Period, back: number, today: string): { from: string; to: string } {
  if (period === "day") {
    const day = addDays(today, -back);
    return { from: day, to: day };
  }
  if (period === "week") {
    const monday = addDays(today, -((asDate(today).getUTCDay() + 6) % 7) - 7 * back);
    return { from: monday, to: addDays(monday, 6) };
  }
  const d = asDate(`${today.slice(0, 7)}-01`);
  d.setUTCMonth(d.getUTCMonth() - back);
  const from = asDay(d);
  d.setUTCMonth(d.getUTCMonth() + 1);
  d.setUTCDate(0);
  return { from, to: asDay(d) };
}

// "Tuesday 21 October 2026", "Week of 20 October 2026", "October 2026"
export function periodLabel(period: Period, range: { from: string }): string {
  const d = asDate(range.from);
  const opts = (o: Intl.DateTimeFormatOptions) => d.toLocaleDateString("en-AU", { timeZone: "UTC", ...o });
  if (period === "day") return opts({ weekday: "long", day: "numeric", month: "long", year: "numeric" });
  if (period === "week") return `Week of ${opts({ day: "numeric", month: "long", year: "numeric" })}`;
  return opts({ month: "long", year: "numeric" });
}

export interface SummaryEnough {
  id: number;
  description: string;
  createdAt: string;
  hours: number | null;
  spans: string | null;
  feeling: string | null;
}
export interface SummaryUrge {
  choice: string;
  createdAt: string;
}

export interface Summary {
  enoughs: SummaryEnough[];
  // how many times each feeling was picked, in FEELINGS order, then the ones left blank
  feelings: { feeling: string; n: number }[];
  unsaid: number;
  // times they wanted to check something again in the period, and how many of those they let go
  urges: { wanted: number; letGo: number };
  // hours put in, from the spans or the typed hours
  hours: number;
  // for each half-hour of the day, how many of the period's enoughs had it coloured in
  slots: number[];
}

export function summarise(
  enoughs: readonly SummaryEnough[],
  urges: readonly SummaryUrge[],
  range: { from: string; to: string },
): Summary {
  const inRange = (iso: string) => {
    const day = localDate(iso);
    return day >= range.from && day <= range.to;
  };
  const these = enoughs.filter((e) => inRange(e.createdAt));
  const feelings = FEELINGS.map((feeling) => ({ feeling, n: these.filter((e) => e.feeling === feeling).length }));
  const slots = Array.from({ length: DAY_MINUTES / SLOT_MINUTES }, () => 0);
  let hours = 0;
  for (const e of these) {
    const spans = e.spans ? (parseSpans(e.spans) ?? []) : [];
    if (spans.length) {
      hours += hoursIn(spans);
      for (const s of spans) for (let m = s.from; m < s.to; m += SLOT_MINUTES) slots[m / SLOT_MINUTES]++;
    } else if (e.hours !== null) hours += e.hours;
  }
  const urged = urges.filter((u) => inRange(u.createdAt));
  return {
    enoughs: these,
    feelings,
    unsaid: these.filter((e) => !e.feeling).length,
    urges: { wanted: urged.length, letGo: urged.filter((u) => u.choice === "let_go").length },
    hours,
    slots,
  };
}
