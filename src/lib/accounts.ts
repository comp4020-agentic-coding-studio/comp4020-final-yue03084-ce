import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import { count, eq } from "drizzle-orm";
import { db, type Outcome } from "./db";
import { LOGIN_ATTEMPTS, LOGIN_WINDOW_MINUTES, PASSWORD_MIN, USERNAME_MAX, USERNAME_MIN } from "./limits";
import { enoughs, type Person, people, sessions } from "./schema";

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
export function logIn(rawUsername: string, password: string, now = Date.now()): Outcome<{ person: Person; token: string }> {
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
  const token = randomUUID();
  db.insert(sessions).values({ personId: person.id, token }).run();
  return { ok: true, value: { person, token } };
}

// Logging out forgets this browser's session (an original token is left as
// it is: it belongs to the browser that made the person).
export function logOut(token: string): void {
  db.delete(sessions).where(eq(sessions.token, token)).run();
}

// Whether a person without an account has written anything, so the login page
// can warn that switching to an account leaves it behind in this browser.
export function hasRecords(person: Person): boolean {
  return (db.select({ n: count() }).from(enoughs).where(eq(enoughs.personId, person.id)).get()?.n ?? 0) > 0;
}
