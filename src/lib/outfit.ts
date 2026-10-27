import { and, count, eq } from "drizzle-orm";
import { type Counts, NO_OUTFIT, type Outfit, wearing, wearsList } from "./collection";
import { db, restingPeople } from "./db";
import { type BreakKind, type CollectionItem, isCollectionItem, OUTFIT_SLOTS } from "./limits";
import { breaks, enoughs, outfits, urges, workSessions } from "./schema";
import { localDate } from "./summary";

// A person's Collection, read from what they've already done: how many times
// they've stopped in each way (counts), and what they've chosen to show
// (outfits). Both are theirs alone; only wearing() of the outfit ever goes
// further, onto the meadow, without who.

export function countsFor(personId: number): Counts {
  const n = (rows: { n: number } | undefined) => rows?.n ?? 0;
  const breaksTaken = n(db.select({ n: count() }).from(breaks).where(eq(breaks.personId, personId)).get());
  const alarmRests = n(
    db
      .select({ n: count() })
      .from(breaks)
      .where(and(eq(breaks.personId, personId), eq(breaks.fromAlarm, true)))
      .get(),
  );
  const letGo = n(
    db
      .select({ n: count() })
      .from(urges)
      .where(and(eq(urges.personId, personId), eq(urges.choice, "let_go")))
      .get(),
  );
  // any day they did anything here, added up: never in a row, never reset
  const days = new Set(
    [
      ...db.select({ at: enoughs.createdAt }).from(enoughs).where(eq(enoughs.personId, personId)).all(),
      ...db.select({ at: breaks.startedAt }).from(breaks).where(eq(breaks.personId, personId)).all(),
      ...db.select({ at: urges.createdAt }).from(urges).where(eq(urges.personId, personId)).all(),
      ...db.select({ at: workSessions.startedAt }).from(workSessions).where(eq(workSessions.personId, personId)).all(),
    ].map((r) => localDate(r.at)),
  ).size;
  return { breaks: breaksTaken, letGo, alarmRests, days };
}

// What they chose, as stored (checked against what they have by wearing()).
export function chosenOutfit(personId: number): Outfit {
  const row = db.select().from(outfits).where(eq(outfits.personId, personId)).get();
  const out: Outfit = { ...NO_OUTFIT };
  if (!row) return out;
  for (const slot of OUTFIT_SLOTS) {
    const key = row[slot];
    if (key && isCollectionItem(key)) out[slot] = key;
  }
  return out;
}

// What their little one shows now: what they chose that's still theirs.
export const outfitOf = (personId: number, counts = countsFor(personId)): Outfit =>
  wearing(chosenOutfit(personId), counts);

export function setOutfit(personId: number, outfit: Outfit): void {
  const updatedAt = new Date().toISOString();
  db.insert(outfits)
    .values({ personId, ...outfit, updatedAt })
    .onConflictDoUpdate({ target: outfits.personId, set: { ...outfit, updatedAt } })
    .run();
}

// One little one on the meadow: what its person went to do and the item keys
// it shows. Built field by field: never a person id, block number, username,
// time or how long, and nothing about how anything was unlocked.
export interface MeadowOne {
  kind: BreakKind;
  wears: CollectionItem[];
}

export const meadowNow = (): MeadowOne[] =>
  restingPeople().map(({ personId, kind }) => ({ kind, wears: wearsList(outfitOf(personId)) }));
