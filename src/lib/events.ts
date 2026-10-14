import { EventEmitter } from "node:events";
import type { PublicEnough } from "./db";

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
  // how many people are on a break now: a number, never who
  resting: [{ count: number }];
}
export const bus = new EventEmitter<Events>();
bus.setMaxListeners(0);
