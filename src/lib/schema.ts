import { sql } from "drizzle-orm";
import { integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

const createdAt = () =>
  text("created_at")
    .notNull()
    .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`);

// Anyone who has written something. No account needed: the token lives in a
// cookie, and the public name is derived from the id (displayName in names.ts).
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
  // taken from the Enough alarm's "Okay, go and rest" (the Collection counts
  // these); false for every break before this was recorded
  fromAlarm: integer("from_alarm", { mode: "boolean" }).notNull().default(false),
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

// A stretch of time someone says they're working, from Mine. Private: only
// ever shown to its owner. tz is the browser's offset from UTC in minutes
// (local = UTC + tz); dayKey is the local date the day's tower belongs to. The
// alarm is an interval (minutes after starting or coming back) or a clock time
// (minutes after local midnight); alarmAt is when it next goes off. On a break
// the session is paused (pausedAt, pauseKind) with no open stretch.
export const workSessions = sqliteTable("work_sessions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  personId: integer("person_id")
    .notNull()
    .references(() => people.id),
  startedAt: text("started_at").notNull(),
  endedAt: text("ended_at"),
  tz: integer("tz").notNull(),
  dayKey: text("day_key").notNull(),
  alarmKind: text("alarm_kind"),
  alarmValue: integer("alarm_value"),
  alarmAt: text("alarm_at"),
  snoozes: integer("snoozes").notNull().default(0),
  pausedAt: text("paused_at"),
  pauseKind: text("pause_kind"),
});

// The working parts of a session, between breaks. sleepyFrom is when the
// little one starts getting sleepy in this stretch (the alarm moment; null if
// it won't), and carry is how sleepy it already was when the stretch began,
// in minutes past the alarm, after a short rest (see worktime.ts).
export const workStretches = sqliteTable("work_stretches", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  sessionId: integer("session_id")
    .notNull()
    .references(() => workSessions.id),
  startedAt: text("started_at").notNull(),
  endedAt: text("ended_at"),
  sleepyFrom: text("sleepy_from"),
  carry: real("carry").notNull().default(0),
});

export type Person = typeof people.$inferSelect;
export type Enough = typeof enoughs.$inferSelect;

// What a person keeps in the little one's picture: one row each, written only
// through /scene/ by its owner and read only for their own Working on it.
// Never on the feed or the stream. Keys from SCENE_THINGS and WEATHERS.
export const scenes = sqliteTable("scenes", {
  personId: integer("person_id")
    .primaryKey()
    .references(() => people.id),
  thing: text("thing").notNull(),
  weather: text("weather").notNull(),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
});

// A note someone put in the drawer instead of checking an enough again, for
// tomorrow: shown only on its owner's Mine, from openFrom (the next Sydney
// day, "2026-10-28") until they put it away (dismissedAt). Never on the feed,
// the stream or in a log.
export const drawerNotes = sqliteTable("drawer_notes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  personId: integer("person_id")
    .notNull()
    .references(() => people.id),
  enoughId: integer("enough_id")
    .notNull()
    .references(() => enoughs.id),
  text: text("text").notNull(),
  openFrom: text("open_from").notNull(),
  dismissedAt: text("dismissed_at"),
  createdAt: createdAt(),
});

// One worry written when calling something enough, for its owner a week on:
// shown on their Mine from openFrom (WORRY_AFTER_DAYS Sydney days after)
// until put away. Kept apart from enoughs so no query of the feed can reach it.
export const worries = sqliteTable("worries", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  personId: integer("person_id")
    .notNull()
    .references(() => people.id),
  enoughId: integer("enough_id")
    .notNull()
    .unique()
    .references(() => enoughs.id),
  text: text("text").notNull(),
  openFrom: text("open_from").notNull(),
  dismissedAt: text("dismissed_at"),
  createdAt: createdAt(),
});

// What a person has chosen from their Collection to show with their little
// one: one item key (COLLECTION in limits.ts) or null per slot. Written only
// through /outfit/ by its owner, and only with things they've unlocked. Worn
// on their own Working on it and, while they're on a break, on the meadow,
// where it's drawn with no hint of whose it is or how it came.
export const outfits = sqliteTable("outfits", {
  personId: integer("person_id")
    .primaryKey()
    .references(() => people.id),
  head: text("head"),
  neck: text("neck"),
  held: text("held"),
  companion: text("companion"),
  ground: text("ground"),
  sky: text("sky"),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
});
