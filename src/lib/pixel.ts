// The little one's pixel world: one palette, drawn as characters, and a
// renderer that turns a grid of characters into SVG squares. Each character
// is one colour; "." is empty. The colours live here once, for every time of
// day; the page reads them as CSS variables, so a frame never holds a hex.

// The day's colours, warm. Each part has its own outline, one shade darker,
// never black.
export const PALETTE = {
  // hair, its outline and a highlight
  o: "#5a3526",
  h: "#9a5b3a",
  H: "#c4875a",
  // skin, its shadow and outline; eyes, cheeks, mouth
  s: "#f7d6b4",
  S: "#e6b48e",
  k: "#b0715a",
  e: "#3f2b2b",
  c: "#ee9a8c",
  m: "#b05a4c",
  // shirt and its shade; apron and its shade; trousers; boots
  t: "#87a374",
  T: "#5f7a52",
  a: "#f6ecd8",
  A: "#d8c3a0",
  p: "#7a5a42",
  b: "#4a352a",
  // the world: sky, far hills, grass, soil
  y: "#cfe3e6",
  Y: "#e9efe0",
  l: "#a9c18e",
  g: "#8fb06c",
  G: "#6f9152",
  d: "#a87c56",
  D: "#86603f",
  // the sun (the moon at night) and the stars, which only show at night
  u: "#fbe3a1",
  w: "#cfe3e6",
  // the blocks: four colours, each with a light top and a dark side
  "1": "#9fb48f",
  "2": "#d9a3a0",
  "3": "#a3b6c4",
  "4": "#d4ad82",
} as const;
export type Ink = keyof typeof PALETTE;

// The other times of day only change what changes: the sky and the light on
// everything. Evening is warmer; night is dim and blue.
export const SKIES = {
  day: {},
  dusk: {
    u: "#f2a066",
    w: "#f2c49b",
    y: "#f2c49b",
    Y: "#f7dcb6",
    l: "#b7a37c",
    g: "#93a067",
    G: "#72804e",
  },
  night: {
    o: "#3a2a2c",
    h: "#6a4637",
    H: "#86604a",
    s: "#c9b3a4",
    S: "#ad927f",
    k: "#7e5a4b",
    c: "#b98380",
    t: "#5f7562",
    T: "#45584a",
    a: "#c8c3b8",
    A: "#a59d8e",
    p: "#55443c",
    b: "#33282a",
    y: "#2c3550",
    Y: "#3a4462",
    l: "#4f6050",
    g: "#45594a",
    G: "#36473b",
    d: "#5e4c3f",
    D: "#4a3c33",
    u: "#efe6c8",
    w: "#e8e0c2",
    "1": "#6f7f66",
    "2": "#9a7774",
    "3": "#76848f",
    "4": "#977c5e",
  },
} as const satisfies Record<string, Partial<Record<Ink, string>>>;
export type Sky = keyof typeof SKIES;

// Which sky a local hour gets.
export const skyFor = (hour: number): Sky => (hour >= 7 && hour < 17 ? "day" : hour >= 17 && hour < 19 ? "dusk" : "night");

// The CSS that colours every square: a variable per ink for each sky, and a
// class per ink that reads it. Scoped to the figure.
export function paletteCss(scope: string): string {
  const vars = (inks: Partial<Record<Ink, string>>) =>
    Object.entries(inks)
      .map(([k, v]) => `--px-${code(k)}:${v};`)
      .join("");
  const lines = [`${scope}{${vars(PALETTE)}}`];
  for (const [sky, inks] of Object.entries(SKIES)) {
    if (Object.keys(inks).length) lines.push(`${scope}[data-sky="${sky}"]{${vars(inks)}}`);
  }
  for (const k of Object.keys(PALETTE)) lines.push(`${scope} .px-${code(k)}{fill:var(--px-${code(k)})}`);
  return lines.join("\n");
}

// Class names shouldn't lean on case, so an upper-case ink gets a suffix:
// "h" and "H" become "h" and "h2". Digits stay as they are, after a "b".
const code = (ink: string) => (/[A-Z]/.test(ink) ? `${ink.toLowerCase()}2` : /[0-9]/.test(ink) ? `b${ink}` : ink);

// A grid of characters as SVG squares, one rect per horizontal run of one
// ink, offset by (x, y). Unknown characters are a mistake in the drawing.
export function gridRects(rows: readonly string[], x = 0, y = 0): string {
  let out = "";
  rows.forEach((row, r) => {
    let c = 0;
    while (c < row.length) {
      const ink = row[c];
      let end = c + 1;
      while (end < row.length && row[end] === ink) end++;
      if (ink !== ".") {
        if (!(ink in PALETTE)) throw new Error(`no ink "${ink}" in the palette`);
        out += `<rect class="px-${code(ink)}" x="${x + c}" y="${y + r}" width="${end - c}" height="1"/>`;
      }
      c = end;
    }
  });
  return out;
}
