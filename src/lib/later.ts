import { WORRY_AFTER_DAYS } from "./limits";
import { addDays, localDate } from "./summary";

// When the things kept for later come back: a drawer note on the next Sydney
// day, a worry WORRY_AFTER_DAYS Sydney days after its enough. Plain dates
// ("2026-10-28") compare as strings. Pure, so the spec can test the dates
// without moving the server's clock.
export const dayAfter = (iso: string | number) => addDays(localDate(iso), 1);
export const weekLater = (iso: string | number) => addDays(localDate(iso), WORRY_AFTER_DAYS);
export const isDue = (openFrom: string, today: string) => openFrom <= today;

// The drawer's heading on Mine, from the days its notes were written (the day
// before each came back): "from yesterday" only when every note was written
// yesterday, the weekday when they were all written on one day this past week,
// and just "In your drawer" for anything older or a mix of days.
export const drawerHeading = (openFroms: string[], today: string) => {
  const written = new Set(openFroms.map((day) => addDays(day, -1)));
  if (written.size !== 1) return "In your drawer";
  const [day] = written;
  if (day === addDays(today, -1)) return "In your drawer from yesterday";
  if (day >= addDays(today, -6) && day < today) {
    const weekday = new Date(`${day}T12:00:00Z`).toLocaleDateString("en-AU", { weekday: "long", timeZone: "UTC" });
    return `In your drawer from ${weekday}`;
  }
  return "In your drawer";
};
