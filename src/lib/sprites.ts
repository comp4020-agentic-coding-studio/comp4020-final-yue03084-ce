// The little one's frames, drawn as character grids (inks in pixel.ts). Each
// actor is a set of named frames of the same size; the page draws every frame
// once and the script shows one at a time. A pet (a tabby cat) will be a
// second actor here, with its own frames, drawn the same way.

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

// a little "z", three by three, rising off a nap
export const ZED = ["ooo", ".o.", "ooo"];
