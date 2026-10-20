import { randomUUID } from "node:crypto";
import type { AstroCookies } from "astro";
import { createPerson, type Person, personByToken } from "./db";

// A person is whoever holds the cookie. Nobody has to sign up: the first time
// someone writes, they get a row and a token. Reading creates nothing. Logging
// in (accounts.ts) swaps the cookie for a session token of the same person.
const COOKIE = "person";
const cookieOptions = (secure: boolean) =>
  ({ path: "/", httpOnly: true, sameSite: "lax", secure, maxAge: 60 * 60 * 24 * 365 }) as const;

export function currentPerson(cookies: AstroCookies): Person | undefined {
  const token = cookies.get(COOKIE)?.value;
  return token ? personByToken(token) : undefined;
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
