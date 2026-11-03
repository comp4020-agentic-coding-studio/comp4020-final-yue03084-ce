// Who just sat down on the meadow, so the page can float them in on a
// parachute. The server never says who anyone is, but it keeps the little
// ones in the order they went on their break (restingPeople in db.ts):
// changing what you're doing keeps your place, leaving drops you out, and
// someone new joins at the end. Each going or coming sends its own update, so
// if the line is longer than last time, the extra ones at the end are new;
// otherwise nobody is (someone left, changed what they're doing, or changed
// what they wear).
//
// `before` is null when the page has just opened: whoever is already resting
// was there first, and nobody floats in.
export function arrivals(before: readonly unknown[] | null, after: readonly unknown[]): number[] {
  if (before === null) return [];
  return after.map((_, n) => n).slice(Math.min(before.length, after.length));
}
