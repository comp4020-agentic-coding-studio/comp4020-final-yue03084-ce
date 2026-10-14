import { mkdirSync } from "node:fs";
import Database from "better-sqlite3";
import { and, count, desc, eq, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { DESCRIPTION_MAX, FEELINGS, isNoteColour, NOTES_MAX, type PresetKey, REPLY_MAX, REPORTS_TO_HIDE } from "./limits";
import { cleanNotes } from "./notes";
import { hoursIn, parseSpans, spansText } from "./spans";
import { comments, type Enough, enoughs, type Person, people, replies, reports } from "./schema";

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
  comments: PublicComment[];
}

// A comment as anyone sees it: hidden ones never appear.
export interface PublicComment {
  id: number;
  name: string;
  text: string;
  createdAt: string;
}

function visibleComments(ids: number[]): Map<number, PublicComment[]> {
  const out = new Map<number, PublicComment[]>();
  if (ids.length === 0) return out;
  const rows = db
    .select()
    .from(comments)
    .where(and(inArray(comments.enoughId, ids), eq(comments.hidden, false)))
    .orderBy(comments.id)
    .all();
  for (const row of rows) {
    const list = out.get(row.enoughId) ?? [];
    list.push({ id: row.id, name: displayName(row.personId), text: row.text, createdAt: row.createdAt });
    out.set(row.enoughId, list);
  }
  return out;
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

const toPublic = (
  row: Enough,
  counts: Partial<Record<PresetKey, number>> = {},
  said: PublicComment[] = [],
): PublicEnough => ({
  id: row.id,
  name: displayName(row.personId),
  description: row.description,
  createdAt: row.createdAt,
  replies: counts,
  comments: said,
});

// The feed: shared enoughs only, newest first.
export function sharedFeed(limit = 50): PublicEnough[] {
  const rows = db.select().from(enoughs).where(eq(enoughs.shared, true)).orderBy(desc(enoughs.id)).limit(limit).all();
  const ids = rows.map((r) => r.id);
  const counts = replyCounts(ids);
  const said = visibleComments(ids);
  return rows.map((row) => toPublic(row, counts.get(row.id), said.get(row.id)));
}

export function publicEnough(id: number): PublicEnough | undefined {
  const row = db
    .select()
    .from(enoughs)
    .where(and(eq(enoughs.id, id), eq(enoughs.shared, true)))
    .get();
  return row && toPublic(row, replyCounts([row.id]).get(row.id), visibleComments([row.id]).get(row.id));
}

// Everything one person has written, private fields included: only ever
// rendered for that person.
export function mine(
  personId: number,
): (Enough & { replies: Partial<Record<PresetKey, number>>; comments: PublicComment[] })[] {
  const rows = db.select().from(enoughs).where(eq(enoughs.personId, personId)).orderBy(desc(enoughs.id)).all();
  const ids = rows.map((r) => r.id);
  const counts = replyCounts(ids);
  const said = visibleComments(ids);
  return rows.map((row) => ({ ...row, replies: counts.get(row.id) ?? {}, comments: said.get(row.id) ?? [] }));
}

export interface EnoughInput {
  description: string;
  shared: boolean;
  hours: string;
  spans: string;
  crayon: string;
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
  // coloured-in spans win; the typed hours are for when the bar can't run
  const spans = parseSpans(input.spans);
  if (spans === null) return { ok: false, reason: "Those times didn't make sense. Try colouring them in again." };
  const hours = spans.length > 0 ? hoursIn(spans) : input.hours.trim() === "" ? null : Number(input.hours);
  if (hours !== null && !(Number.isFinite(hours) && hours >= 0 && hours <= 1000)) {
    return { ok: false, reason: "Hours should be a number, like 2 or 1.5." };
  }
  // a crayon only means something alongside coloured-in time
  const crayon = spans.length > 0 && isNoteColour(input.crayon) ? input.crayon : null;
  const feeling = (FEELINGS as readonly string[]).includes(input.feeling) ? input.feeling : null;
  if (input.notes.length > NOTES_MAX) return { ok: false, reason: "Those notes are too long to keep." };
  const notes = cleanNotes(input.notes) || null;
  const value = db
    .insert(enoughs)
    .values({ personId, description, shared: input.shared, hours, spans: spans.length > 0 ? spansText(spans) : null, crayon, feeling, notes })
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

// Delete one of your own enoughs, with the replies it got. Only its owner can:
// the row has to match both the id and the person. Returns whether it was
// shared, so the caller knows whether anyone else needs telling.
export function deleteEnough(personId: number, enoughId: number): Outcome<{ wasShared: boolean }> {
  const row = db
    .select()
    .from(enoughs)
    .where(and(eq(enoughs.id, enoughId), eq(enoughs.personId, personId)))
    .get();
  if (!row) return { ok: false, reason: "That isn't one of yours." };
  db.transaction((tx) => {
    const theirComments = tx.select({ id: comments.id }).from(comments).where(eq(comments.enoughId, enoughId)).all();
    if (theirComments.length > 0) {
      tx.delete(reports).where(inArray(reports.commentId, theirComments.map((c) => c.id))).run();
    }
    tx.delete(comments).where(eq(comments.enoughId, enoughId)).run();
    tx.delete(replies).where(eq(replies.enoughId, enoughId)).run();
    tx.delete(enoughs).where(eq(enoughs.id, enoughId)).run();
  });
  return { ok: true, value: { wasShared: row.shared } };
}

// A one-line comment on a shared enough, up to REPLY_MAX characters.
export function comment(personId: number, enoughId: number, input: string): Outcome<PublicEnough> {
  const text = input.trim().replace(/\s+/g, " ");
  if (text === "") return { ok: false, reason: "Write a few words first." };
  if ([...text].length > REPLY_MAX) return { ok: false, reason: `Keep it to ${REPLY_MAX} characters or fewer.` };
  if (!publicEnough(enoughId)) return { ok: false, reason: "That one isn't shared." };
  db.insert(comments).values({ enoughId, personId, text }).run();
  const updated = publicEnough(enoughId);
  return updated ? { ok: true, value: updated } : { ok: false, reason: "That one isn't shared." };
}

// Report a comment. Each person counts once, and not on their own comment;
// at REPORTS_TO_HIDE reports it's hidden from everyone. Returns the enough as
// it now stands, so the caller can tell the open feeds.
export function report(personId: number, commentId: number): Outcome<PublicEnough> {
  const row = db.select().from(comments).where(eq(comments.id, commentId)).get();
  if (!row || row.hidden) return { ok: false, reason: "That comment isn't there." };
  if (row.personId === personId) return { ok: false, reason: "That's your own comment." };
  db.insert(reports).values({ commentId, personId }).onConflictDoNothing().run();
  const n = db.select({ n: count() }).from(reports).where(eq(reports.commentId, commentId)).get()?.n ?? 0;
  if (n >= REPORTS_TO_HIDE) db.update(comments).set({ hidden: true }).where(eq(comments.id, commentId)).run();
  const updated = publicEnough(row.enoughId);
  return updated ? { ok: true, value: updated } : { ok: false, reason: "That one isn't shared." };
}
