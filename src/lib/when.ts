import { localDate, TIME_ZONE } from "./summary";

// When something was put down, as the feed says it: "12 min ago", "3 hours
// ago", "Yesterday", "Mon", then "21 Oct". Days are Sydney days, as every
// date on the site is. The full date and time go in the title. Pure, given
// `now`, so the server and the page's script say the same thing and the spec
// can test it without moving the clock.
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

// whole days between two local dates ("2026-10-29" - "2026-10-27" = 2)
const daysBetween = (later: string, earlier: string) =>
  Math.round((Date.parse(`${later}T12:00:00Z`) - Date.parse(`${earlier}T12:00:00Z`)) / DAY);

export function relativeWhen(iso: string, now: number = Date.now()): string {
  const then = Date.parse(iso);
  const ago = Math.max(0, now - then);
  if (ago < HOUR) return ago < MINUTE ? "Just now" : `${Math.floor(ago / MINUTE)} min ago`;
  const days = daysBetween(localDate(now), localDate(then));
  if (days === 0) {
    const hours = Math.floor(ago / HOUR);
    return hours === 1 ? "1 hour ago" : `${hours} hours ago`;
  }
  if (days === 1) return "Yesterday";
  if (days < 7) return new Date(then).toLocaleDateString("en-AU", { timeZone: TIME_ZONE, weekday: "short" });
  return new Date(then).toLocaleDateString("en-AU", { timeZone: TIME_ZONE, day: "numeric", month: "short" });
}

// "28 Oct 2026, 3:04 pm", for the title
export const fullWhen = (iso: string) =>
  new Date(iso).toLocaleString("en-AU", { timeZone: TIME_ZONE, dateStyle: "medium", timeStyle: "short" });
