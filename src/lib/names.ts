// The public name: derived from the id, so it never says who someone is but
// does let people tell each other apart. A colour and a small thing ("Sage
// pebble"), fixed for each person, rather than a number from the database:
// 16 × 16 names, each id its own, and after 256 the same names again with
// II, III and so on.
const NAME_COLOURS = ["Sage", "Rust", "Plum", "Slate", "Moss", "Ochre", "Fern", "Clay", "Teal", "Wheat", "Coral", "Ink", "Pine", "Rose", "Ash", "Honey"];
const NAME_THINGS = ["pebble", "kite", "acorn", "lantern", "feather", "shell", "button", "leaf", "spoon", "cloud", "pine cone", "teacup", "thimble", "marble", "ribbon", "moth"];
const ROMAN = ["", " II", " III", " IV", " V", " VI", " VII", " VIII", " IX", " X"];
export function displayName(personId: number): string {
  const i = Math.max(0, personId - 1);
  const per = NAME_COLOURS.length * NAME_THINGS.length;
  // step the colour each time, the thing each time round the colours, so
  // neighbouring ids share neither word
  const colour = NAME_COLOURS[i % NAME_COLOURS.length];
  const thing = NAME_THINGS[(i + Math.floor(i / NAME_COLOURS.length)) % NAME_THINGS.length];
  const round = Math.floor(i / per);
  return `${colour} ${thing}${ROMAN[round] ?? ` ${round + 1}`}`;
}
