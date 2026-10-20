import { randomUUID } from "node:crypto";
import type { AstroCookies } from "astro";
import { createPerson, type Person, personByToken } from "./db";

// A person is whoever holds the cookie. Anyone can read the feed without one;
// writing anything (calling something enough, replying, commenting, reporting,
// a break, a recheck, deleting) needs an account: signedInPerson below, checked
// by every write route on the server. Registering (accounts.ts) makes the
// person and gives them a cookie; logging in elsewhere gives a session token
// for the same person.
const COOKIE = "person";
const cookieOptions = (secure: boolean) =>
  ({ path: "/", httpOnly: true, sameSite: "lax", secure, maxAge: 60 * 60 * 24 * 365 }) as const;

export function currentPerson(cookies: AstroCookies): Person | undefined {
  const token = cookies.get(COOKIE)?.value;
  return token ? personByToken(token) : undefined;
}

// The person behind this cookie, only if they have an account. Every write
// route checks this; without it the route refuses (CLAUDE.md: "Writing needs
// an account").
export function signedInPerson(cookies: AstroCookies): Person | undefined {
  const person = currentPerson(cookies);
  return person?.username ? person : undefined;
}

export function ensurePerson(cookies: AstroCookies, secure: boolean): Person {
  const existing = currentPerson(cookies);
  if (existing) return existing;
  const token = randomUUID();
  cookies.set(COOKIE, token, cookieOptions(secure));
  return createPerson(token);
}

export const cookieToken = (cookies: AstroCookies) => cookies.get(COOKIE)?.value;

export function setPersonCookie(cookies: AstroCookies, token: string, secure: boolean): void {
  cookies.set(COOKIE, token, cookieOptions(secure));
}

export function clearPersonCookie(cookies: AstroCookies): void {
  cookies.delete(COOKIE, { path: "/" });
}
