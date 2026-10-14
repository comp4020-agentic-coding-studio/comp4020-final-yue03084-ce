import { DAY_MINUTES, SLOT_MINUTES } from "./limits";

// The stretches of the day someone coloured in on the time bar, as minutes
// since midnight. The total hours stored beside them are always worked out
// here, from the spans, so the two can't disagree.
export interface Span {
  from: number;
  to: number;
}

// The form sends "540-690,840-900". Anything that isn't whole slots inside one
// day is refused rather than guessed at; overlapping or touching spans are
// merged.
export function parseSpans(text: string): Span[] | null {
  if (text.trim() === "") return [];
  const spans: Span[] = [];
  for (const part of text.split(",")) {
    const match = /^(\d{1,4})-(\d{1,4})$/.exec(part.trim());
    if (!match) return null;
    const from = Number(match[1]);
    const to = Number(match[2]);
    if (from % SLOT_MINUTES || to % SLOT_MINUTES || from < 0 || to > DAY_MINUTES || from >= to) return null;
    spans.push({ from, to });
  }
  spans.sort((a, b) => a.from - b.from);
  const merged: Span[] = [];
  for (const s of spans) {
    const last = merged.at(-1);
    if (last && s.from <= last.to) last.to = Math.max(last.to, s.to);
    else merged.push({ ...s });
  }
  return merged;
}

export const spansText = (spans: Span[]) => spans.map((s) => `${s.from}-${s.to}`).join(",");

export const hoursIn = (spans: Span[]) => spans.reduce((sum, s) => sum + (s.to - s.from), 0) / 60;

const clock = (minutes: number) => `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, "0")}`;
export const describeSpan = (s: Span) => `${clock(s.from)}–${clock(s.to)}`;

// "about 3½ hours": the bar is roughly, so the words are too
export function roughly(hours: number): string {
  const whole = Math.floor(hours);
  const half = hours - whole >= 0.5;
  if (whole === 0 && half) return "about half an hour";
  const n = `${whole}${half ? "½" : ""}`;
  return `about ${n} ${whole === 1 && !half ? "hour" : "hours"}`;
}
