// The name a shared thing goes by on the feed: a colour and a small thing
// ("Sage pebble"), made from that enough's (or comment's) own id. Each one
// gets its own, so nobody can tell that two were written by the same person,
// or count how often someone stops; the same thing keeps its name. 16 × 16
// names, then the same names again with II, III and so on. Enoughs and
// comments are numbered apart, so the two can share a name by chance.
const NAME_COLOURS = ["Sage", "Rust", "Plum", "Slate", "Moss", "Ochre", "Fern", "Clay", "Teal", "Wheat", "Coral", "Ink", "Pine", "Rose", "Ash", "Honey"];
const NAME_THINGS = ["pebble", "kite", "acorn", "lantern", "feather", "shell", "button", "leaf", "spoon", "cloud", "pine cone", "teacup", "thimble", "marble", "ribbon", "moth"];
const ROMAN = ["", " II", " III", " IV", " V", " VI", " VII", " VIII", " IX", " X"];
export function displayName(id: number): string {
  const i = Math.max(0, id - 1);
  const per = NAME_COLOURS.length * NAME_THINGS.length;
  // step the colour each time, the thing each time round the colours, so
  // neighbouring ids share neither word
  const colour = NAME_COLOURS[i % NAME_COLOURS.length];
  const thing = NAME_THINGS[(i + Math.floor(i / NAME_COLOURS.length)) % NAME_THINGS.length];
  const round = Math.floor(i / per);
  return `${colour} ${thing}${ROMAN[round] ?? ` ${round + 1}`}`;
}
