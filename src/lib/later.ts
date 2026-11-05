import { WORRY_AFTER_DAYS } from "./limits";
import { addDays, localDate } from "./summary";

// When a worry comes back: WORRY_AFTER_DAYS Sydney days after it was written. Plain dates
// ("2026-10-28") compare as strings. Pure, so the spec can test the dates
// without moving the server's clock.
export const weekLater = (iso: string | number) => addDays(localDate(iso), WORRY_AFTER_DAYS);
export const isDue = (openFrom: string, today: string) => openFrom <= today;
