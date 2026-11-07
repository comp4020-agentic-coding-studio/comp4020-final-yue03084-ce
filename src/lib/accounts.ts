import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import { and, count, desc, eq, inArray, ne, or } from "drizzle-orm";
import { db, type Outcome } from "./db";
import { LOGIN_ATTEMPTS, LOGIN_WINDOW_MINUTES, PASSWORD_MIN, USERNAME_MAX, USERNAME_MIN } from "./limits";
import {
  breaks,
  comments,
  drawerNotes,
  lookBacks,
  enoughs,
  outfits,
  type Person,
  people,
  replies,
  reports,
  scenes,
  sessions,
  urges,
  workSessions,
  workStretches,
  worries,
} from "./schema";

// Optional accounts. Registering adds a username and password to the person
// this browser already is, so everything they wrote stays theirs; logging in
// elsewhere gives that browser a session token for the same person. The
// username is only ever shown back to its owner, never on the feed.

const USERNAME = new RegExp(`^[A-Za-z0-9_-]{${USERNAME_MIN},${USERNAME_MAX}}$`);

// One message for an unknown username and a wrong password, so the page never
// says which usernames exist.
const REFUSED = "That username and password don't match.";

// scrypt with a random 16-byte salt, stored as scrypt$salt$hash (hex)
function hash(password: string): string {
  const salt = randomBytes(16);
  return `scrypt$${salt.toString("hex")}$${scryptSync(password, salt, 64).toString("hex")}`;
}

function matches(password: string, stored: string): boolean {
  const [scheme, salt, expected] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !expected) return false;
  const want = Buffer.from(expected, "hex");
  const got = scryptSync(password, Buffer.from(salt, "hex"), want.length);
  return timingSafeEqual(got, want);
}

export function register(person: Person, rawUsername: string, password: string): Outcome<Person> {
  if (person.username) return { ok: false, reason: "You already have an account in this browser." };
  const username = rawUsername.trim();
  if (!USERNAME.test(username)) {
    return { ok: false, reason: `A username is ${USERNAME_MIN}–${USERNAME_MAX} letters, numbers, _ or -.` };
  }
  if (password.length < PASSWORD_MIN) {
    return { ok: false, reason: `Use a password of at least ${PASSWORD_MIN} characters.` };
  }
  const key = username.toLowerCase();
  if (db.select().from(people).where(eq(people.username, key)).get()) {
    return { ok: false, reason: "That username is taken. Try another." };
  }
  const updated = db
    .update(people)
    .set({ username: key, passwordHash: hash(password) })
    .where(eq(people.id, person.id))
    .returning()
    .get();
  return { ok: true, value: updated };
}

// Failed logins per username, kept in memory: the app runs on one machine
// (fly.toml), and a restart forgetting them is fine.
const failures = new Map<string, number[]>();

function recentFailures(key: string, now: number): number[] {
  const since = now - LOGIN_WINDOW_MINUTES * 60_000;
  const kept = (failures.get(key) ?? []).filter((t) => t > since);
  failures.set(key, kept);
  return kept;
}

// Check a username and password; on a match, issue a session token for that
// person. The caller sets it as the browser's cookie.
// `device` is a few words naming the browser (deviceName), kept for the
// owner's list of where they're signed in.
export function logIn(
  rawUsername: string,
  password: string,
  device: string | null = null,
  now = Date.now(),
): Outcome<{ person: Person; token: string }> {
  const key = rawUsername.trim().toLowerCase();
  if (recentFailures(key, now).length >= LOGIN_ATTEMPTS) {
    return {
      ok: false,
      reason: `Too many tries for that username. Take a break and try again in ${LOGIN_WINDOW_MINUTES} minutes.`,
    };
  }
  const person = key ? db.select().from(people).where(eq(people.username, key)).get() : undefined;
  if (!person?.passwordHash || !matches(password, person.passwordHash)) {
    failures.set(key, [...recentFailures(key, now), now]);
    return { ok: false, reason: REFUSED };
  }
  failures.delete(key);
  return { ok: true, value: { person, token: newSession(person.id, device) } };
}

export function newSession(personId: number, device: string | null): string {
  const token = randomUUID();
  db.insert(sessions).values({ personId, token, device }).run();
  return token;
}

// "Firefox on macOS": the browser and system from a user agent, and nothing
// more (no version, no model), so the list of where you're signed in reads
// like other sites' and holds nothing that could single a machine out.
export function deviceName(userAgent: string | null): string {
  const ua = userAgent ?? "";
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /Firefox\//.test(ua)
      ? "Firefox"
      : /Chrome\//.test(ua)
        ? "Chrome"
        : /Safari\//.test(ua)
          ? "Safari"
          : "A browser";
  const system = /iPhone|iPad/.test(ua)
    ? "iOS"
    : /Android/.test(ua)
      ? "Android"
      : /Mac OS X/.test(ua)
        ? "macOS"
        : /Windows/.test(ua)
          ? "Windows"
          : /Linux/.test(ua)
            ? "Linux"
            : "";
  return system ? `${browser} on ${system}` : browser;
}

// Logging out forgets this browser's session (an original token is left as
// it is: it belongs to the browser that made the person).
export function logOut(token: string): void {
  db.delete(sessions).where(eq(sessions.token, token)).run();
}

// A recovery code: three groups of four from letters and digits that can't
// be misread (no 0/o, 1/l/i). Shown to its owner once; only its hash is kept.
const CODE_INKS = "abcdefghjkmnpqrstuvwxyz23456789";
const newCode = () =>
  [0, 1, 2]
    .map(() => [...randomBytes(4)].map((b) => CODE_INKS[b % CODE_INKS.length]).join(""))
    .join("-");
// what someone typed, as it was made: lower case, no spaces, dashes put back
const tidyCode = (typed: string) => {
  const bare = typed.toLowerCase().replace(/[^a-z0-9]/g, "");
  return bare.length === 12 ? `${bare.slice(0, 4)}-${bare.slice(4, 8)}-${bare.slice(8)}` : bare;
};

// Make a new recovery code for a signed-in person, replacing any old one.
// The caller shows it once.
export function newRecoveryCode(personId: number): string {
  const code = newCode();
  db.update(people).set({ recoveryHash: hash(code) }).where(eq(people.id, personId)).run();
  return code;
}

export const hasRecoveryCode = (person: Person) => Boolean(person.recoveryHash);

// Forgot the password: the username and recovery code set a new one. The
// code is spent, every other session ends, and a new code is made for next
// time. Tries count against the same limit as logging in.
export function recover(
  rawUsername: string,
  code: string,
  password: string,
  device: string | null = null,
  now = Date.now(),
): Outcome<{ person: Person; token: string; code: string }> {
  const key = rawUsername.trim().toLowerCase();
  if (recentFailures(key, now).length >= LOGIN_ATTEMPTS) {
    return {
      ok: false,
      reason: `Too many tries for that username. Take a break and try again in ${LOGIN_WINDOW_MINUTES} minutes.`,
    };
  }
  const person = key ? db.select().from(people).where(eq(people.username, key)).get() : undefined;
  if (!person?.recoveryHash || !matches(tidyCode(code), person.recoveryHash)) {
    failures.set(key, [...recentFailures(key, now), now]);
    return { ok: false, reason: "That username and recovery code don't match." };
  }
  if (password.length < PASSWORD_MIN) {
    return { ok: false, reason: `Use a password of at least ${PASSWORD_MIN} characters.` };
  }
  failures.delete(key);
  db.update(people).set({ passwordHash: hash(password) }).where(eq(people.id, person.id)).run();
  endSessions(person.id, null);
  return { ok: true, value: { person, token: newSession(person.id, device), code: newRecoveryCode(person.id) } };
}

// The current password, for changing it or deleting the account: wrong tries
// count against the same limit as logging in.
function rightPassword(person: Person, password: string, now: number): Outcome<null> {
  const key = person.username ?? "";
  if (recentFailures(key, now).length >= LOGIN_ATTEMPTS) {
    return { ok: false, reason: `Too many tries. Take a break and try again in ${LOGIN_WINDOW_MINUTES} minutes.` };
  }
  if (!person.passwordHash || !matches(password, person.passwordHash)) {
    failures.set(key, [...recentFailures(key, now), now]);
    return { ok: false, reason: "That isn't your current password." };
  }
  return { ok: true, value: null };
}

// Change the password, knowing the current one. Every other browser is
// signed out; this one stays, perhaps on a new token (endSessions), which
// the caller sets as its cookie.
export function changePassword(
  person: Person,
  current: string,
  next: string,
  keepToken: string | null,
  now = Date.now(),
): Outcome<string | null> {
  const checked = rightPassword(person, current, now);
  if (!checked.ok) return checked;
  if (next.length < PASSWORD_MIN) return { ok: false, reason: `Use a password of at least ${PASSWORD_MIN} characters.` };
  db.update(people).set({ passwordHash: hash(next) }).where(eq(people.id, person.id)).run();
  return { ok: true, value: endSessions(person.id, keepToken) };
}

export interface Device {
  id: number;
  device: string | null;
  createdAt: string;
  here: boolean;
}

// Where someone is signed in: each session, newest first, with whether it's
// this browser. The browser that made the person (people.token) isn't a
// session and can't be listed; signing out everywhere else retires its token.
export function devicesOf(personId: number, thisToken: string | null): Device[] {
  return db
    .select({ id: sessions.id, device: sessions.device, createdAt: sessions.createdAt, token: sessions.token })
    .from(sessions)
    .where(eq(sessions.personId, personId))
    .orderBy(desc(sessions.id))
    .all()
    .map(({ token, ...rest }) => ({ ...rest, here: token === thisToken }));
}

// Sign out every browser but this one. If this browser is still on the
// person's original token, it moves to a session first, so the original can
// be retired along with the rest.
export function endSessions(personId: number, keepToken: string | null): string | null {
  const person = db.select().from(people).where(eq(people.id, personId)).get();
  if (!person) return null;
  let keep = keepToken;
  if (keep && keep === person.token) keep = newSession(personId, null);
  db.delete(sessions)
    .where(keep ? and(eq(sessions.personId, personId), ne(sessions.token, keep)) : eq(sessions.personId, personId))
    .run();
  db.update(people).set({ token: randomUUID() }).where(eq(people.id, personId)).run();
  return keep;
}

// Sign out one other browser, by its session id (only one of this person's).
export function endSession(personId: number, sessionId: number): void {
  db.delete(sessions).where(and(eq(sessions.id, sessionId), eq(sessions.personId, personId))).run();
}

// Delete an account and everything it holds: every enough (with the comments,
// replies and notes on it, as deleting one does), every comment, reply and
// report it made, its breaks, work, picture and outfit, and its sessions.
// Asks for the password. Returns which of its enoughs were on the feed, so
// open pages can take them away.
export function deleteAccount(person: Person, password: string, now = Date.now()): Outcome<{ shared: number[] }> {
  const checked = rightPassword(person, password, now);
  if (!checked.ok) return checked;
  const id = person.id;
  const own = db.select({ id: enoughs.id, shared: enoughs.shared }).from(enoughs).where(eq(enoughs.personId, id)).all();
  const ownIds = own.map((e) => e.id);
  db.transaction((tx) => {
    // comments on their enoughs, and their comments anywhere, with reports on either
    const gone = tx
      .select({ id: comments.id })
      .from(comments)
      .where(ownIds.length ? or(eq(comments.personId, id), inArray(comments.enoughId, ownIds)) : eq(comments.personId, id))
      .all()
      .map((c) => c.id);
    tx.delete(reports).where(gone.length ? or(eq(reports.personId, id), inArray(reports.commentId, gone)) : eq(reports.personId, id)).run();
    if (gone.length) tx.delete(comments).where(inArray(comments.id, gone)).run();
    tx.delete(replies).where(ownIds.length ? or(eq(replies.personId, id), inArray(replies.enoughId, ownIds)) : eq(replies.personId, id)).run();
    tx.delete(urges).where(eq(urges.personId, id)).run();
    tx.delete(drawerNotes).where(eq(drawerNotes.personId, id)).run();
    tx.delete(worries).where(eq(worries.personId, id)).run();
    tx.delete(lookBacks).where(eq(lookBacks.personId, id)).run();
    tx.delete(breaks).where(eq(breaks.personId, id)).run();
    const work = tx.select({ id: workSessions.id }).from(workSessions).where(eq(workSessions.personId, id)).all().map((w) => w.id);
    if (work.length) tx.delete(workStretches).where(inArray(workStretches.sessionId, work)).run();
    tx.delete(workSessions).where(eq(workSessions.personId, id)).run();
    tx.delete(scenes).where(eq(scenes.personId, id)).run();
    tx.delete(outfits).where(eq(outfits.personId, id)).run();
    tx.delete(enoughs).where(eq(enoughs.personId, id)).run();
    tx.delete(sessions).where(eq(sessions.personId, id)).run();
    tx.delete(people).where(eq(people.id, id)).run();
  });
  return { ok: true, value: { shared: own.filter((e) => e.shared).map((e) => e.id) } };
}

// Whether a person without an account has written anything, so the login page
// can warn that switching to an account leaves it behind in this browser.
export function hasRecords(person: Person): boolean {
  return (db.select({ n: count() }).from(enoughs).where(eq(enoughs.personId, person.id)).get()?.n ?? 0) > 0;
}
