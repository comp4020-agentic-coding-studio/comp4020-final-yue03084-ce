// The little one's frames, drawn as character grids (inks in pixel.ts). Each
// actor is a set of named frames of the same size; the page draws every frame
// once and the script shows one at a time. A pet (a tabby cat) will be a
// second actor here, with its own frames, drawn the same way.
import { gridRects } from "./pixel";

export interface Actor {
  width: number;
  height: number;
  frames: Record<string, readonly string[]>;
}

type Rows = readonly string[];

// Lay `top` over `base` at (x, y); "." in `top` lets the base show through.
const over = (base: Rows, x: number, y: number, top: Rows): string[] =>
  base.map((row, r) => {
    const o = top[r - y];
    if (!o) return row;
    return [...row].map((ch, c) => (o[c - x] && o[c - x] !== "." ? o[c - x] : ch)).join("");
  });
// Move some rows one pixel right (the head leaning forward when it's tired).
const lean = (rows: Rows) => rows.map((r) => `.${r.slice(0, -1)}`);
const blank = (n: number) => Array.from({ length: n }, () => "................");
// two empty pixels either side, so every frame has room for arms out wide
const pad = (rows: Rows) => rows.map((r) => (r.length === 20 ? r : `..${r}..`));

// The little one: 16×24 (in a 20-wide frame), a big head on a small body, a tuft of hair on top
// and an apron. Facing you when it stands; turned to the right when it walks
// or works (the page mirrors it to face left).
const TUFT = {
  up: ["........oo......", ".......oHo......", ".......o........"],
  droop: ["................", "........oo......", "........oHoo...."],
  flat: ["................", "................", "........oooHo..."],
};
const HAIR = [
  "....oooooooo....",
  "..oohhhhhhhhoo..",
  ".ohhHHhhhhhhhho.",
  ".ohHHhhhhhhhhho.",
  ".ohhhhhhhhhhhho.",
  ".ohhhshhhhshhho.",
];
// eyes are two rows of ten between the hair at the sides; "k" is an eyelid
const EYES: Record<string, readonly string[]> = {
  open: ["sesssssses", "sesssssses"],
  half: ["skssssssks", "sesssssses"],
  low: ["ssssssssss", "skssssssks"],
  shut: ["ssssssssss", "seessssees"],
  sideOpen: ["ssesssssse", "ssesssssse"],
  sideHalf: ["sskssssssk", "ssesssssse"],
  sideLow: ["ssssssssss", "sskssssssk"],
};
// the mouth row, cheeks either side; a yawn is a dark open mouth
const MOUTH = { front: "csssmmsssc", side: "scsssmmssc", yawn: "cssseesssc" };
const face = (eyes: readonly [string, string] | readonly string[], mouth: string) => [
  ".ohssssssssssho.",
  `.oh${eyes[0]}ho.`,
  `.oh${eyes[1]}ho.`,
  `.oh${mouth}ho.`,
  "..okssssssssko..",
];
const NECK = "......kSSk......";
const SHIRT = ["....TttaattT....", "...TttaaaattT..."];
const HANDS = { down: "...sTaaaaaaTs...", front: "....TaaaaaaTss..", none: "....TaaaaaaT...." };
const APRON = ["....AaaaaaaA....", "....AaaaaaaA....", "....AAAAAAAA...."];
const LEGS = {
  stand: [".....pp..pp.....", ".....pp..pp.....", "....ooo..ooo...."],
  leftUp: [".....pp..pp.....", ".....ooo.pp.....", ".........ooo...."],
  rightUp: [".....pp..pp.....", ".....pp..ooo....", "....ooo........."],
};

// How tired it looks, in three steps: fresh; drooping eyelids and a bent
// tuft; eyes nearly shut, the tuft flat, the head leaning forward.
type Tier = 0 | 1 | 2;
const tuftAt = (t: Tier) => (t === 0 ? TUFT.up : t === 1 ? TUFT.droop : TUFT.flat);
const eyesAt = (t: Tier, side: boolean) =>
  side ? (t === 0 ? EYES.sideOpen : t === 1 ? EYES.sideHalf : EYES.sideLow) : t === 0 ? EYES.open : t === 1 ? EYES.half : EYES.low;
const head = (t: Tier, side: boolean, eyes = eyesAt(t, side), mouth = side ? MOUTH.side : MOUTH.front) => {
  const rows = [...tuftAt(t), ...HAIR, ...face(eyes, mouth)];
  return side && t === 2 ? lean(rows) : rows;
};

const standing = (t: Tier, eyes?: readonly string[], mouth?: string) => [
  ...head(t, false, eyes, mouth),
  NECK,
  ...SHIRT,
  HANDS.down,
  ...APRON,
  ...LEGS.stand,
];
const walking = (t: Tier, legs: Rows, hands: string) => [...head(t, true), NECK, ...SHIRT, hands, ...APRON, ...legs];
// bending down to the pile or the tower, hands out in front
const crouching = (t: Tier) => [
  ...blank(4),
  ...head(t, true),
  NECK,
  "....TttaattTss..",
  "...TaaaaaaaT....",
  "...AaaaaaaaA....",
  "...ppAAAAAApp...",
  "...oo......oo...",
];
// sitting on the grass, legs out in front
const SIT_BODY = ["....TttaattT....", "...sTaaaaaaTs...", "....AaaaaaaApppo", "....AAAAAAAApppo"];
const sitting = (t: Tier, eyes?: readonly string[], mouth?: string) => [
  ...blank(5),
  ...head(t, true, eyes ?? eyesAt(t, true), mouth),
  NECK,
  ...SIT_BODY,
];

// a cup held at the chest, with a puff of steam that sways
const cupDown = (steam: 0 | 1) => over(sitting(0), 13, 18, [steam ? "..a" : ".a.", steam ? ".a." : "..a", "aaA", "aaA"]);
// a sip: the cup up at the mouth, eyes shut
const cupUp = over(sitting(0, EYES.shut), 11, 16, ["aaA", "aaA"]);

// a stretch: little arms raised from the shoulders, hands up by its face
// (the frame is two pixels wider each side for them), then a yawn
const stretching = (yawn: boolean) => {
  const base = standing(0, yawn ? EYES.shut : EYES.open, yawn ? MOUTH.yawn : MOUTH.front).map((r) =>
    r === HANDS.down ? HANDS.none : r,
  );
  return over(pad(base), 0, 12, [
    ".ss..............ss.",
    "..t..............t..",
    "..tt............tt..",
    "....tt........tt....",
  ]);
};

// asleep sitting up, head nodding forward; two frames for breathing
const napping = (down: boolean) => {
  const rows = sitting(2, EYES.shut);
  if (!down) return rows;
  // the head and tuft drop a pixel onto the neck
  const top = rows.slice(5, 19);
  return [...blank(6), ...top, ...SIT_BODY];
};

// tending the tower between bricks: a little wooden mallet held out in
// front, raised, then knocked against the tower's side (it stands facing the
// tower). The head is light wood with a darker underside, so it reads
// against the bricks.
const MALLET_UP = [
  ".................ddd",
  ".................DDD",
  "..................p.",
  "..................p.",
  ".................p..",
  "..............Tssp..",
];
const MALLET_DOWN = ["..................dd", "..............Tsspdd", "..................DD"];
const tapping = (t: Tier, down: boolean) =>
  over(pad(walking(t, LEGS.stand, HANDS.none)), 0, down ? 15 : 10, down ? MALLET_DOWN : MALLET_UP);

const frames: Record<string, Rows> = {
  blink: standing(0, EYES.shut),
  rub: over(standing(1, EYES.shut), 9, 10, ["SSs", "SSs", ".s."]),
  yawn: standing(2, EYES.shut, MOUTH.yawn),
  tea1: cupDown(0),
  tea2: cupDown(1),
  sip: cupUp,
  stretch1: stretching(false),
  stretch2: stretching(true),
  nap1: napping(false),
  nap2: napping(true),
};
const tiers: Tier[] = [0, 1, 2];
for (const t of tiers) {
  const s = t === 0 ? "" : `~${t}`;
  frames[`stand${s}`] = standing(t);
  frames[`walk1${s}`] = walking(t, LEGS.leftUp, HANDS.down);
  frames[`walk2${s}`] = walking(t, LEGS.stand, HANDS.down);
  frames[`walk3${s}`] = walking(t, LEGS.rightUp, HANDS.down);
  frames[`walk4${s}`] = walking(t, LEGS.stand, HANDS.down);
  frames[`carry1${s}`] = walking(t, LEGS.leftUp, HANDS.front);
  frames[`carry2${s}`] = walking(t, LEGS.stand, HANDS.front);
  frames[`carry3${s}`] = walking(t, LEGS.rightUp, HANDS.front);
  frames[`carry4${s}`] = walking(t, LEGS.stand, HANDS.front);
  frames[`crouch${s}`] = crouching(t);
  frames[`sit${s}`] = sitting(t);
  frames[`tap1${s}`] = tapping(t, false);
  frames[`tap2${s}`] = tapping(t, true);
}
// every frame must be exactly 20×24 once padded, or the drawing has a mistake in it
for (const [name, rows] of Object.entries(frames)) {
  frames[name] = pad(rows);
  if (frames[name].length !== 24 || frames[name].some((r) => r.length !== 20)) throw new Error(`frame "${name}" isn't 20×24`);
}

export const KEEPER: Actor = { width: 20, height: 24, frames };

// the order the walking frames play in
export const WALK = ["walk1", "walk2", "walk3", "walk4"] as const;
export const CARRY = ["carry1", "carry2", "carry3", "carry4"] as const;

// A block for the tower: a light top (a checker of cream over the colour),
// a darker bottom and right edge (a checker of brown), w×h pixels.
export function blockRows(w: number, h: number, ink: string): string[] {
  return Array.from({ length: h }, (_, r) =>
    Array.from({ length: w }, (_, c) => {
      if (r === 0 && h > 2) return c % 2 === 0 ? "a" : ink;
      if (r === h - 1 || c === w - 1) return (r + c) % 2 === 0 ? "p" : ink;
      return ink;
    }).join(""),
  );
}
// A small brick for a long stretch's tower: solid colour, too small for the
// checkered light and shade, with one dark pixel in its lower right corner so
// bricks side by side still read as separate bricks.
export function brickRows(w: number, h: number, ink: string): string[] {
  if (w >= 8) return blockRows(w, h, ink);
  return Array.from({ length: h }, (_, r) => (r === h - 1 ? `${ink.repeat(w - 1)}p` : ink.repeat(w)));
}
// A standing lamp, 7×16: a shade, the bulb under it, a pole and a foot.
export const LAMP = [
  "..fff..",
  ".fffff.",
  "fffffff",
  "FFFFFFF",
  "..iii..",
  "...n...",
  "...n...",
  "...n...",
  "...n...",
  "...n...",
  "...n...",
  "...n...",
  "...n...",
  "...N...",
  ".nnnnn.",
  "NNNNNNN",
];
// the shade with the bulb off-ish, for a flicker
export const LAMP_DIM = LAMP.map((r) => r.replace(/i/g, "F"));

// The pool of light: rings of pixels around (0, 0), each a solid band (the
// page makes the outer ones fainter), with only the outermost ring dithered
// in a checker so the edge of the light breaks up instead of ending in a
// line. Each ring is its own group so the script can show fewer of them.
export function glowRings(rings: number, step: number): string[][] {
  const out: string[][] = [];
  for (let k = 0; k < rings; k++) {
    const inner = k * step;
    const outer = (k + 1) * step;
    const pts: string[] = [];
    for (let y = -outer; y <= outer; y++) {
      for (let x = -outer; x <= outer; x++) {
        const d = Math.hypot(x, y * 1.3);
        if (d < inner || d >= outer) continue;
        if (k === rings - 1 && (x + y) % 2 !== 0) continue;
        pts.push(`${x},${y}`);
      }
    }
    out.push(pts);
  }
  return out;
}

// A little potted plant, 11×14, in three moods: perked up; drooping (leaves
// hanging, the tip bowed); and sleepy (leaves down by the pot). Never wilted
// or brown: sleepy, not sad.
const POT = ["..RRRRRRR..", "..rrrrrrr..", "...rrrrr...", "...rrrrr...", "....RRR...."];
export const PLANT = {
  up: [
    ".....v.....",
    "....vqv....",
    ".v..vqv..v.",
    "vqv..q..vqv",
    ".vqv.q.vqv.",
    "..vqvqvqv..",
    "....vqv....",
    ".....q.....",
    ".....Q.....",
    ...POT,
  ],
  droop: [
    "...........",
    "......vv...",
    ".....vqqv..",
    ".....q..v..",
    "..vvvq.vvv.",
    ".vqqvqvqqv.",
    ".v...q...v.",
    ".....q.....",
    ".....Q.....",
    ...POT,
  ],
  sleepy: [
    "...........",
    "...........",
    "...........",
    ".......vv..",
    "......vqqv.",
    ".....q...v.",
    "..vvvq.....",
    ".vqq.qvvv..",
    "vq...Qqqqv.",
    "v.RRRRRRRv.",
    "..rrrrrrr..",
    "...rrrrr...",
    "...rrrrr...",
    "....RRR....",
  ],
};
for (const [name, rows] of Object.entries(PLANT)) {
  if (rows.length !== 14 || rows.some((r) => r.length !== 11)) throw new Error(`plant "${name}" isn't 11×14`);
}
// a watering can, 9×6, set down after watering
export const CAN = ["..XX.....", ".X..X....", "xxxxxx..X", "xxxxxxXX.", "xxxxxx...", ".XXXX...."];

// An umbrella for rain, 27×13: a wide wine-red canopy with a highlight on
// the left and a scalloped edge, and a handle running down to where its hand
// would be. The page lays it over whatever frame the little one is in.
export const UMBRELLA = [
  ".............nn............",
  "..........WWEEEEWW.........",
  "........WEECCEEEEEEW.......",
  "......WECCCEEEEEEEEEEW.....",
  "....WECCEEEEEEEEEEEEEEEW...",
  "...WECEEEEEEEEEEEEEEEEEEW..",
  "..WECEEEEEEEEEEEEEEEEEEEEW.",
  ".WEEEEEEEEEEEEEEEEEEEEEEEEW",
  "WWEEEWWEEEWWEEnWWEEEWWEEEWW",
  "W...W...W....n...W...W...W.",
  ".............n.............",
  ".............n.............",
  ".............n.............",
];

// a little "z", three by three, rising off a nap
export const ZED = ["ooo", ".o.", "ooo"];

// The Collection (COLLECTION in limits.ts): things that come from stopping.
// What's worn is drawn once and laid on any frame at the frame's own head or
// neck, found by looking for them in the drawing: the top of the hair is its
// row of eight outline pixels, the neck its "kSSk". So a hat sits on the hair
// whether the little one stands, walks, crouches, sits, leans when sleepy or
// nods off; there's no table of offsets to keep in step with the frames.
type At = { x: number; y: number };
export function anchorsOf(rows: Rows): { hair: At | null; neck: At | null } {
  let hair: At | null = null;
  let neck: At | null = null;
  for (let y = 0; y < rows.length; y++) {
    const h = rows[y].indexOf("oooooooo");
    if (!hair && h >= 0) hair = { x: h, y };
    const n = rows[y].indexOf("kSSk");
    if (!neck && n >= 0) neck = { x: n, y };
  }
  // nodding off, the head drops onto the neck: the scarf goes just above the
  // shirt's collar instead
  if (!neck) {
    const y = rows.findIndex((r) => r.includes("TttaattT"));
    if (y > 0) neck = { x: rows[y].indexOf("TttaattT") + 2, y: y - 1 };
  }
  return { hair, neck };
}

// Each wearable: its drawing, which anchor it hangs from, and where its
// top-left goes from there.
export const WEARABLES = {
  // a wide straw brim over the hair, a wine band, a knot of straw on top
  strawhat: {
    at: "hair",
    dx: -5,
    dy: -3,
    rows: [
      ".........KK.......",
      "......KKKKKK......",
      ".....KKKKKKKK.....",
      ".....EEEEEEEE.....",
      "KKKKKKKKKKKKKKKKKK",
      ".LLLLLLLLLLLLLLLL.",
    ],
  },
  // a ring of leaves round the top of the head, with pink, white and yellow flowers
  flowercrown: {
    at: "hair",
    dx: -2,
    dy: 0,
    rows: ["..c..Z..U...", ".qcqqZqqUqcq", "..q......q.."],
  },
  // wound once round the neck, an end hanging down the front
  scarf: {
    at: "neck",
    dx: -1,
    dy: 0,
    rows: ["ECEEEE", "...EW.", "...W.."],
  },
} as const satisfies Record<string, { at: "hair" | "neck"; dx: number; dy: number; rows: Rows }>;
export type Wearable = keyof typeof WEARABLES;
export const isWearable = (key: string): key is Wearable => Object.hasOwn(WEARABLES, key);

// Where a wearable goes on one frame, or null if that frame has no head to put it on.
export function wornAt(frame: Rows, item: Wearable): { x: number; y: number; rows: Rows } | null {
  const w = WEARABLES[item];
  const anchor = anchorsOf(frame)[w.at];
  return anchor && { x: anchor.x + w.dx, y: anchor.y + w.dy, rows: w.rows };
}

// One frame of the little one as SVG, with the wearables laid on it, each in
// its own group (data-w) so a page can show only the ones a little one wears.
export function frameSvg(name: string, items: readonly Wearable[] = []): string {
  const rows = KEEPER.frames[name];
  const worn = items
    .map((item) => {
      const at = wornAt(rows, item);
      return at ? `<g data-w="${item}">${gridRects(at.rows, at.x, at.y)}</g>` : "";
    })
    .join("");
  return `<g data-f="${name}">${gridRects(rows)}${worn}</g>`;
}

// a little lantern, 5×7, set down beside it: brass frame, a warm light inside
export const LANTERN = [".nnn.", "n...n", ".NNN.", "NijiN", "NjijN", "NijiN", ".NNN."];

// The tabby cat, 10×7, sitting and facing you, its tail curled up behind; in
// the second frame the tail's tip flicks.
export const TABBY = {
  sit: ["F...F.....", "fFfFf.....", "fefef.....", ".fcf....F.", ".afFfFf.F.", ".aafFfFfF.", ".ff..f.ff."],
  flick: ["F...F.....", "fFfFf.....", "fefef....F", ".fcf....F.", ".afFfFf.F.", ".aafFfFfF.", ".ff..f.ff."],
};

// A picnic blanket, 22×2, laid on the grass under it on the meadow: a wine
// and cream check.
export const PICNIC = ["EaEaEaEaEaEaEaEaEaEaEa", "aEaEaEaEaEaEaEaEaEaEaE"];

// A kite, 7×11, high above it on the meadow: a diamond in the blocks' colours
// and a tail with two little bows.
export const KITE = [
  "...2...",
  "..223..",
  ".22233.",
  "2222333",
  ".44111.",
  "..441..",
  "...4...",
  "...E...",
  "..E.E..",
  "....E..",
  "...E.E.",
];

// A sunflower in a pot, 11×20, in three moods like the plant: perked up;
// drooping (the head bowed, the leaves hanging); and sleepy (the head hung
// right down, the leaves by the pot). Never wilted: sleepy, not sad.
export const SUNFLOWER = {
  up: [
    "....UUU....",
    "..UUUUUUU..",
    ".UUVDDDVUU.",
    ".UUDpDpDUU.",
    ".UUDDpDDUU.",
    ".UUVDDDVUU.",
    "..UUUUUUU..",
    "....UUU....",
    ".....q.....",
    "..vv.q.....",
    ".vqqvq.....",
    ".....q.vv..",
    ".....qvqqv.",
    ".....q.....",
    ".....Q.....",
    ...POT,
  ],
  droop: [
    "...........",
    "...........",
    "......UUU..",
    "....UUUUUU.",
    "...UVDDDVUU",
    "...UDpDpDUU",
    "...UUDDDVU.",
    "....UUUUU..",
    "......q....",
    ".....q.....",
    "..vv.q.....",
    ".v..vq.....",
    ".....q.vv..",
    ".....qv..v.",
    ".....Q.....",
    ...POT,
  ],
  sleepy: [
    "...........",
    "...........",
    "...........",
    "...........",
    "...........",
    ".....qqq...",
    ".....q..q..",
    ".....q.qVq.",
    ".....qUUUUU",
    ".....qVUUUV",
    ".....q.UUU.",
    ".....q..U..",
    "..vv.q.vv..",
    ".v..vqv..v.",
    "v....Q....v",
    ...POT,
  ],
};
for (const [name, rows] of Object.entries(SUNFLOWER)) {
  if (rows.length !== 20 || rows.some((r) => r.length !== 11)) throw new Error(`sunflower "${name}" isn't 11×20`);
}
