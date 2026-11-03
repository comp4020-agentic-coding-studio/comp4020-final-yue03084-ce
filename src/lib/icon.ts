// The site's icon, for a phone's home screen and the browser tab: the little
// one from the chest up, in the day's palette on its own sky. Drawn from the
// same standing frame as everywhere else (sprites.ts), so it never needs
// redrawing by hand, and written out as a PNG here with nothing but zlib,
// since an installed app's icon has to be a picture file, not an SVG with CSS.
import { deflateSync } from "node:zlib";
import { PALETTE, type Ink } from "./pixel";
import { KEEPER } from "./sprites";

// the sizes a page asks for: Apple's home screen, and the two a manifest needs
export const ICON_SIZES = [180, 192, 512] as const;
export type IconSize = (typeof ICON_SIZES)[number];
export const isIconSize = (n: number): n is IconSize => (ICON_SIZES as readonly number[]).includes(n);

// 24×24: the frame's top 20 rows (tuft to apron), with sky above and either side
const SIDE = 24;
export function iconRows(): string[] {
  const body = KEEPER.frames.stand.slice(0, 20).map((r) => `..${r}..`);
  return [...Array.from({ length: SIDE - body.length }, () => ".".repeat(SIDE)), ...body];
}

const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

// Each pixel of the drawing as a square of `size / 24`, the sky where it's
// empty. The last few pixels of a size that isn't a multiple of 24 are sky too.
export function iconPng(size: IconSize): Buffer {
  const rows = iconRows();
  const scale = Math.floor(size / SIDE);
  const pad = Math.floor((size - scale * SIDE) / 2);
  const sky = rgb(PALETTE.y);
  // each row of the image: a filter byte (0, none), then RGB per pixel
  const raw = Buffer.alloc(size * (1 + size * 3));
  for (let py = 0; py < size; py++) {
    const line = py * (1 + size * 3);
    for (let px = 0; px < size; px++) {
      const r = Math.floor((py - pad) / scale);
      const c = Math.floor((px - pad) / scale);
      const ink = rows[r]?.[c];
      const colour = ink && ink !== "." ? rgb(PALETTE[ink as Ink]) : sky;
      raw.set(colour, line + 1 + px * 3);
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header.set([8, 2, 0, 0, 0], 8); // 8 bits, truecolour, no interlace
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function chunk(type: string, data: Buffer): Buffer {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0);
  head.write(type, 4, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])), 0);
  return Buffer.concat([head, data, crc]);
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
