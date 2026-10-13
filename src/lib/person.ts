import { randomUUID } from "node:crypto";
import type { AstroCookies } from "astro";
import { createPerson, type Person, personByToken } from "./db";

// A person is whoever holds the cookie. Nobody signs up: the first time
// someone writes, they get a row and a token. Reading creates nothing.
const COOKIE = "person";

export function currentPerson(cookies: AstroCookies): Person | undefined {
  const token = cookies.get(COOKIE)?.value;
  return token ? personByToken(token) : undefined;
}

export function ensurePerson(cookies: AstroCookies, secure: boolean): Person {
  const existing = currentPerson(cookies);
  if (existing) return existing;
  const token = randomUUID();
  cookies.set(COOKIE, token, { path: "/", httpOnly: true, sameSite: "lax", secure, maxAge: 60 * 60 * 24 * 365 });
  return createPerson(token);
}
