import { mkdirSync } from "node:fs";
import Database from "better-sqlite3";
import { and, count, desc, eq, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { DESCRIPTION_MAX, FEELINGS, NOTES_MAX, type PresetKey } from "./limits";
import { cleanNotes } from "./notes";
import { type Enough, enoughs, type Person, people, replies } from "./schema";

// One SQLite file is the app's whole persistent state. In production
// DATA_DIR is the machine's volume (/data), which is how state survives a
// restart and a redeploy; locally it defaults to an untracked .data/.
const dir = process.env.DATA_DIR ?? "./.data";
mkdirSync(dir, { recursive: true });

const client = new Database(`${dir}/enough.db`);
client.pragma("journal_mode = WAL");
client.pragma("foreign_keys = ON");

export const db = drizzle(client);

// Migrations run at boot, on whatever machine holds the volume. The flow:
// edit src/lib/schema.ts, `pnpm db:generate`, commit what it writes to drizzle/.
migrate(db, { migrationsFolder: "./drizzle" });

export type { Enough, Person };

// The public name: derived from the id, so it never says who someone is but
// does let people tell each other apart.
export const displayName = (personId: number) => `A block #${personId}`;

export function personByToken(token: string): Person | undefined {
  return db.select().from(people).where(eq(people.token, token)).get();
}

export function createPerson(token: string): Person {
  return db.insert(people).values({ token }).returning().get();
}

// What anyone else may see of an enough. Built field by field, never by
// spreading the row, so a private field added to the schema later can't leak
// (CLAUDE.md: "Effort and check records are private").
export interface PublicEnough {
  id: number;
  name: string;
  description: string;
  createdAt: string;
  replies: Partial<Record<PresetKey, number>>;
}

function replyCounts(ids: number[]): Map<number, Partial<Record<PresetKey, number>>> {
  const counts = new Map<number, Partial<Record<PresetKey, number>>>();
  if (ids.length === 0) return counts;
  const rows = db
    .select({ enoughId: replies.enoughId, preset: replies.preset, n: count() })
    .from(replies)
    .where(inArray(replies.enoughId, ids))
    .groupBy(replies.enoughId, replies.preset)
    .all();
  for (const row of rows) {
    const entry = counts.get(row.enoughId) ?? {};
    entry[row.preset as PresetKey] = row.n;
    counts.set(row.enoughId, entry);
  }
  return counts;
}

const toPublic = (row: Enough, counts: Partial<Record<PresetKey, number>> = {}): PublicEnough => ({
  id: row.id,
  name: displayName(row.personId),
  description: row.description,
  createdAt: row.createdAt,
  replies: counts,
});

// The feed: shared enoughs only, newest first.
export function sharedFeed(limit = 50): PublicEnough[] {
  const rows = db.select().from(enoughs).where(eq(enoughs.shared, true)).orderBy(desc(enoughs.id)).limit(limit).all();
  const counts = replyCounts(rows.map((r) => r.id));
  return rows.map((row) => toPublic(row, counts.get(row.id)));
}

export function publicEnough(id: number): PublicEnough | undefined {
  const row = db
    .select()
    .from(enoughs)
    .where(and(eq(enoughs.id, id), eq(enoughs.shared, true)))
    .get();
  return row && toPublic(row, replyCounts([row.id]).get(row.id));
}

// Everything one person has written, private fields included: only ever
// rendered for that person.
export function mine(personId: number): (Enough & { replies: Partial<Record<PresetKey, number>> })[] {
  const rows = db.select().from(enoughs).where(eq(enoughs.personId, personId)).orderBy(desc(enoughs.id)).all();
  const counts = replyCounts(rows.map((r) => r.id));
  return rows.map((row) => ({ ...row, replies: counts.get(row.id) ?? {} }));
}

export interface EnoughInput {
  description: string;
  shared: boolean;
  hours: string;
  feeling: string;
  notes: string;
}

export type Outcome<T> = { ok: true; value: T } | { ok: false; reason: string };

export function declareEnough(personId: number, input: EnoughInput): Outcome<Enough> {
  const description = input.description.trim();
  if (description === "") return { ok: false, reason: "Say in a line what the thing was." };
  if ([...description].length > DESCRIPTION_MAX) {
    return { ok: false, reason: `Keep it to ${DESCRIPTION_MAX} characters or fewer.` };
  }
  const hours = input.hours.trim() === "" ? null : Number(input.hours);
  if (hours !== null && !(Number.isFinite(hours) && hours >= 0 && hours <= 1000)) {
    return { ok: false, reason: "Hours should be a number, like 2 or 1.5." };
  }
  const feeling = (FEELINGS as readonly string[]).includes(input.feeling) ? input.feeling : null;
  if (input.notes.length > NOTES_MAX) return { ok: false, reason: "Those notes are too long to keep." };
  const notes = cleanNotes(input.notes) || null;
  const value = db
    .insert(enoughs)
    .values({ personId, description, shared: input.shared, hours, feeling, notes })
    .returning()
    .get();
  return { ok: true, value };
}

// A preset reply, to a shared enough only. Replying twice with the same
// preset changes nothing.
export function reply(personId: number, enoughId: number, preset: PresetKey): Outcome<PublicEnough> {
  if (!publicEnough(enoughId)) return { ok: false, reason: "That one isn't shared." };
  db.insert(replies).values({ enoughId, personId, preset }).onConflictDoNothing().run();
  const updated = publicEnough(enoughId);
  return updated ? { ok: true, value: updated } : { ok: false, reason: "That one isn't shared." };
}
