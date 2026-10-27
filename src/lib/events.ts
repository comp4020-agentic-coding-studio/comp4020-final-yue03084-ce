import { EventEmitter } from "node:events";
import { type PublicEnough, restingNow } from "./db";
import { type MeadowOne, meadowNow } from "./outfit";

// One process, one bus: every open SSE connection subscribes here. This only
// works because the app runs on exactly one machine (see fly.toml); a second
// machine would have its own bus and its clients would miss events.
//
// Only PublicEnough ever goes on the bus, so nothing private can reach a
// stream: an unshared enough is never emitted at all.
interface Events {
  enough: [PublicEnough];
  reply: [PublicEnough];
  // a shared enough its owner deleted: only the id goes out
  removed: [{ id: number }];
  // how many people are on a break now, and for the meadow, one little one
  // each: what it's doing and what it wears from its Collection. Never who.
  resting: [{ count: number; ones: MeadowOne[] }];
}
export const bus = new EventEmitter<Events>();
bus.setMaxListeners(0);

// Tell every open page who's resting now: the count and the little ones,
// never who. Every route that starts or ends a break, or changes what a
// little one wears, calls this.
export function emitResting(): number {
  const count = restingNow();
  bus.emit("resting", { count, ones: meadowNow() });
  return count;
}
