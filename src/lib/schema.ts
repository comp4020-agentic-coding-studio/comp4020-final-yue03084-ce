import { sql } from "drizzle-orm";
import { integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

const createdAt = () =>
  text("created_at")
    .notNull()
    .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`);

// Anyone who has written something. No account needed: the token lives in a
// cookie, and the public name is derived from the id (displayName in db.ts).
// An account is optional: username and password_hash are added to this same
// row, so registering never makes a new person. The username is only ever
// shown to its owner. It's stored lower-cased, so uniqueness ignores case.
export const people = sqliteTable("people", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  token: text("token").notNull().unique(),
  username: text("username").unique(),
  passwordHash: text("password_hash"),
  createdAt: createdAt(),
});

// A signed-in browser: logging in issues a fresh token here and sets it as the
// browser's person cookie; logging out deletes it. A person's original token
// (people.token) keeps working for the browser that first made them.
export const sessions = sqliteTable("sessions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  personId: integer("person_id")
    .notNull()
    .references(() => people.id),
  token: text("token").notNull().unique(),
  createdAt: createdAt(),
});

// One "enough": the description is the only part that can ever be public, and
// only when shared is true. hours, spans, feeling and notes are the owner's alone.
export const enoughs = sqliteTable("enoughs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  personId: integer("person_id")
    .notNull()
    .references(() => people.id),
  description: text("description").notNull(),
  shared: integer("shared", { mode: "boolean" }).notNull(),
  hours: real("hours"),
  // the stretches coloured in on the time bar, "540-690,840-900" (see spans.ts);
  // when present, hours is their total
  spans: text("spans"),
  // the crayon the time bar was coloured with, a NOTE_COLOURS key
  crayon: text("crayon"),
  feeling: text("feeling"),
  notes: text("notes"),
  createdAt: createdAt(),
});

// A preset reply to a shared enough. One of each preset per person per enough.
export const replies = sqliteTable(
  "replies",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    enoughId: integer("enough_id")
      .notNull()
      .references(() => enoughs.id),
    personId: integer("person_id")
      .notNull()
      .references(() => people.id),
    preset: text("preset").notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("replies_once").on(t.enoughId, t.personId, t.preset)],
);

// A one-line comment on a shared enough. Public, unless enough people report
// it (REPORTS_TO_HIDE), when hidden is set and nobody sees it any more.
export const comments = sqliteTable("comments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  enoughId: integer("enough_id")
    .notNull()
    .references(() => enoughs.id),
  personId: integer("person_id")
    .notNull()
    .references(() => people.id),
  text: text("text").notNull(),
  hidden: integer("hidden", { mode: "boolean" }).notNull().default(false),
  createdAt: createdAt(),
});

// One person's report of one comment; reporting twice counts once.
export const reports = sqliteTable(
  "reports",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    commentId: integer("comment_id")
      .notNull()
      .references(() => comments.id),
    personId: integer("person_id")
      .notNull()
      .references(() => people.id),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("reports_once").on(t.commentId, t.personId)],
);

// A break: someone stepped away to do something else. Public as "someone is
// resting" and, if it followed a shared enough, as what they went to do; never
// how long it lasted. endedAt is null while it's going.
export const breaks = sqliteTable("breaks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  personId: integer("person_id")
    .notNull()
    .references(() => people.id),
  enoughId: integer("enough_id").references(() => enoughs.id),
  kind: text("kind").notNull(),
  startedAt: createdAt(),
  endedAt: text("ended_at"),
});

// Each time someone wanted to go back and check an enough, and what they did:
// let it go, or check anyway. Only ever shown to them.
export const urges = sqliteTable("urges", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  enoughId: integer("enough_id")
    .notNull()
    .references(() => enoughs.id),
  personId: integer("person_id")
    .notNull()
    .references(() => people.id),
  choice: text("choice").notNull(),
  createdAt: createdAt(),
});

export type Person = typeof people.$inferSelect;
export type Enough = typeof enoughs.$inferSelect;
