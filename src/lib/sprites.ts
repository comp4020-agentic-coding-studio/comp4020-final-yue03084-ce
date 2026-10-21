// The little one's frames, drawn as character grids (inks in pixel.ts). Each
// actor is a set of named frames of the same size; the page draws every frame
// once and the script shows one at a time. A pet (a tabby cat) will be a
// second actor here, with its own frames, drawn the same way.

export interface Actor {
  width: number;
  height: number;
  frames: Record<string, readonly string[]>;
}

// The little one: about 16×24, a big head on a small body, a tuft of hair on
// top and an apron. Facing you when it stands; turned a little to the right
// when it walks (the page mirrors it to walk left).
const tuft = ["........oo......", ".......oHo......", ".......o........"];
const hair = [
  "....oooooooo....",
  "..oohhhhhhhhoo..",
  ".ohhHHhhhhhhhho.",
  ".ohHHhhhhhhhhho.",
  ".ohhhhhhhhhhhho.",
  ".ohhhshhhhshhho.",
];
const face = (eyes: [string, string], cheeks: string) => [
  ".ohssssssssssho.",
  `.oh${eyes[0]}ho.`,
  `.oh${eyes[1]}ho.`,
  `.oh${cheeks}ho.`,
  "..okssssssssko..",
];
const body = [
  "......kSSk......",
  "....TttaattT....",
  "...TttaaaattT...",
  "...sTaaaaaaTs...",
  "....AaaaaaaA....",
  "....AaaaaaaA....",
  "....AAAAAAAA....",
];
const legs = {
  stand: [".....pp..pp.....", ".....pp..pp.....", "....bbb..bbb...."],
  leftUp: [".....pp..pp.....", ".....bbb.pp.....", ".........bbb...."],
  rightUp: [".....pp..pp.....", ".....pp..bbb....", "....bbb........."],
};

const open: [string, string] = ["sesssssses", "sesssssses"];
const shut: [string, string] = ["ssssssssss", "seessssees"];
const turned: [string, string] = ["ssesssssse", "ssesssssse"];

const front = (eyes: [string, string], feet: readonly string[]) => [
  ...tuft,
  ...hair,
  ...face(eyes, "csssmmsssc"),
  ...body,
  ...feet,
];
const side = (feet: readonly string[]) => [...tuft, ...hair, ...face(turned, "scsssmmssc"), ...body, ...feet];

export const KEEPER: Actor = {
  width: 16,
  height: 24,
  frames: {
    stand: front(open, legs.stand),
    blink: front(shut, legs.stand),
    walk1: side(legs.leftUp),
    walk2: side(legs.stand),
    walk3: side(legs.rightUp),
    walk4: side(legs.stand),
  },
};

// the order the walking frames play in
export const WALK = ["walk1", "walk2", "walk3", "walk4"] as const;
