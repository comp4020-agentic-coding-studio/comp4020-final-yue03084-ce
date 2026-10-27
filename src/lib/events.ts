import { EventEmitter } from "node:events";
import { type PublicEnough, restingKinds, restingNow } from "./db";

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
  // how many people are on a break now, and what each is doing (for the
  // meadow): a number and a list of kinds, never who
  resting: [{ count: number; kinds: string[] }];
}
export const bus = new EventEmitter<Events>();
bus.setMaxListeners(0);

// Tell every open page who's resting now: the count and what each is doing,
// never who. Every route that starts or ends a break calls this.
export function emitResting(): number {
  const count = restingNow();
  bus.emit("resting", { count, kinds: restingKinds() });
  return count;
}
