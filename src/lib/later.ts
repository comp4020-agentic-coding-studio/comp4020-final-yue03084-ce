import { WORRY_AFTER_DAYS } from "./limits";
import { addDays, localDate } from "./summary";

// When a worry comes back: WORRY_AFTER_DAYS Sydney days after it was written. Plain dates
// ("2026-10-28") compare as strings. Pure, so the spec can test the dates
// without moving the server's clock.
export const weekLater = (iso: string | number) => addDays(localDate(iso), WORRY_AFTER_DAYS);
export const isDue = (openFrom: string, today: string) => openFrom <= today;

// Whether a record asks how its worries look now: when one of them is past
// its week and its reminder on You is still up. The same rule as the
// reminder, so the two come and go together; writing the line, or putting
// the reminder away, settles it until a newer worry's week comes.
export const asksNow = (worries: readonly { openFrom: string; dismissedAt: string | null }[], today: string) =>
  worries.some((w) => w.dismissedAt === null && isDue(w.openFrom, today));
