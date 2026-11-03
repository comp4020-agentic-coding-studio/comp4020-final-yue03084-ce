// Who just sat down on the meadow, so the page can float them in on a
// parachute. The server never says who anyone is: it sends the little ones in
// the order they went on their break (restingPeople in db.ts), so someone who
// leaves drops out of the list and someone new joins at the end. Comparing
// what each one is doing before and after is enough: whatever in the new list
// can't be matched, in order, against the old one has just arrived. Changing
// an outfit changes nothing here, and two people doing the same thing may
// look like one staying, which only costs a parachute.
//
// `before` is null when the page has just opened: whoever is already resting
// was there first, and nobody floats in.
export function arrivals(before: readonly string[] | null, after: readonly string[]): number[] {
  if (before === null) return [];
  let i = 0;
  let k = 0;
  // the longest start of `after` that's still in `before`, in order
  for (; k < after.length; k++) {
    while (i < before.length && before[i] !== after[k]) i++;
    if (i === before.length) break;
    i++;
  }
  return after.map((_, n) => n).slice(k);
}
