import { WORRY_AFTER_DAYS } from "./limits";
import { addDays, localDate } from "./summary";

// When the things kept for later come back: a drawer note on the next Sydney
// day, a worry WORRY_AFTER_DAYS Sydney days after its enough. Plain dates
// ("2026-10-28") compare as strings. Pure, so the spec can test the dates
// without moving the server's clock.
export const dayAfter = (iso: string | number) => addDays(localDate(iso), 1);
export const weekLater = (iso: string | number) => addDays(localDate(iso), WORRY_AFTER_DAYS);
export const isDue = (openFrom: string, today: string) => openFrom <= today;
