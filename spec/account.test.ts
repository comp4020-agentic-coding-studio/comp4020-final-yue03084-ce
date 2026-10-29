import { describe, expect, inject, it } from "vitest";
import { LOGIN_ATTEMPTS, PASSWORD_MIN } from "../src/lib/limits.ts";

// Accounts, against the running app (writing needs one): registering keeps the person
// you already are, signing in elsewhere is that same person, the username is
// never public, logins are rate-limited, and an account doesn't widen what
// anyone may change.
const baseUrl = inject("baseUrl");

// One browser: a cookie jar of one cookie, sending what a browser would on a
// same-origin form POST (see spec/enough.test.ts).
function browser() {
  let cookie = "";
  const send = async (path: string, init: RequestInit = {}) => {
    const headers = new Headers(init.headers);
    if (cookie) headers.set("cookie", cookie);
    if (init.method === "POST") headers.set("sec-fetch-site", "same-origin");
    const res = await fetch(new URL(path, baseUrl), { ...init, headers, redirect: "manual" });
    const set = res.headers.get("set-cookie");
    if (set) cookie = set.split(";")[0];
    return res;
  };
  const post = (path: string, fields: Record<string, string>) =>
    send(path, { method: "POST", body: new URLSearchParams(fields) });
  return {
    get: async (path: string) => (await send(path)).text(),
    declare: (fields: Record<string, string>) => post("/enough/", fields),
    remove: (enough: string) => post("/delete/", { enough }),
    register: (username: string, password: string) => post("/account/", { action: "register", username, password }),
    login: (username: string, password: string) => post("/account/", { action: "login", username, password }),
    logout: () => post("/account/", { action: "logout" }),
  };
}

const marker = () => `t${Math.random().toString(36).slice(2, 10)}`;
// usernames are letters, digits, _ and - only
const newName = () => `u_${Math.random().toString(36).slice(2, 12)}`;
const PASSWORD = "a-long-enough-password";

async function readStream(start: () => Promise<unknown>, ms: number): Promise<string> {
  const controller = new AbortController();
  const res = await fetch(new URL("/api/events", baseUrl), { signal: controller.signal });
  const reader = res.body?.getReader();
  if (!reader) throw new Error("no response body");
  const decoder = new TextDecoder();
  let received = "";
  const timer = setTimeout(() => controller.abort(), ms);
  const reading = (async () => {
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        received += decoder.decode(value, { stream: true });
      }
    } catch {
      // aborted: time's up
    }
  })();
  await start();
  await reading;
  clearTimeout(timer);
  return received;
}

describe("accounts", () => {
  it("registering lets you write; what you write is yours", async () => {
    const tag = marker();
    const me = browser();
    const res = await me.register(newName(), PASSWORD);
    expect(res.status).toBe(303);
    await me.declare({ description: `after account ${tag}`, notes: `<p>private ${tag}</p>` });
    const mine = await me.get("/mine/all/");
    expect(mine).toContain(`after account ${tag}`);
    expect(mine).toContain(`private ${tag}`);
  });

  it("signing in from a fresh browser is the same person, with the same Mine", async () => {
    const tag = marker();
    const username = newName();
    const first = browser();
    await first.register(username, PASSWORD);
    await first.declare({ description: `elsewhere ${tag}` });

    const second = browser();
    const res = await second.login(username.toUpperCase(), PASSWORD);
    expect(res.status).toBe(303);
    const mine = await second.get("/mine/all/");
    expect(mine).toContain(`elsewhere ${tag}`);
    // the visible text: the username sits in its own <strong>
    expect(mine.replace(/<[^>]+>/g, "")).toContain(`Signed in as ${username}`);
  });

  it("gives the same refusal for an unknown username and a wrong password", async () => {
    const username = newName();
    await browser().register(username, PASSWORD);
    const wrong = await browser().login(username, "not-the-password");
    const unknown = await browser().login(newName(), PASSWORD);
    expect(wrong.status).toBe(400);
    expect(unknown.status).toBe(400);
    const message = (html: string) => /role="alert"[^>]*>\s*([^<]*)/.exec(html)?.[1].trim();
    expect(message(await wrong.text())).toBe(message(await unknown.text()));
  });

  it("refuses a username that's taken in any case, and a short password", async () => {
    const username = newName();
    await browser().register(username, PASSWORD);
    expect((await browser().register(username.toUpperCase(), PASSWORD)).status).toBe(400);
    expect((await browser().register(newName(), "x".repeat(PASSWORD_MIN - 1))).status).toBe(400);
  });

  it("never shows the username or password to anyone else, on the feed or the stream", async () => {
    const tag = marker();
    const username = newName();
    const me = browser();
    await me.register(username, PASSWORD);
    const received = await readStream(() => me.declare({ description: `shared ${tag}`, shared: "on" }), 2_000);
    expect(received).toContain(`shared ${tag}`);
    const feed = await browser().get("/");
    for (const secret of [username, PASSWORD]) {
      expect(received).not.toContain(secret);
      expect(feed).not.toContain(secret);
    }
  });

  it("after logging out, this browser's Mine is empty", async () => {
    const tag = marker();
    const username = newName();
    const first = browser();
    await first.register(username, PASSWORD);
    await first.declare({ description: `mine only ${tag}` });

    const second = browser();
    await second.login(username, PASSWORD);
    expect(await second.get("/mine/all/")).toContain(`mine only ${tag}`);
    await second.logout();
    expect(await second.get("/mine/all/")).not.toContain(`mine only ${tag}`);
    // and the session is gone, not just the cookie: the first browser is unaffected
    expect(await first.get("/mine/all/")).toContain(`mine only ${tag}`);
  });

  it(`refuses for a while after ${LOGIN_ATTEMPTS} failed logins, even with the right password`, async () => {
    const username = newName();
    await browser().register(username, PASSWORD);
    for (let i = 0; i < LOGIN_ATTEMPTS; i++) await browser().login(username, `wrong-${i}-password`);
    const blocked = await browser().login(username, PASSWORD);
    expect(blocked.status).toBe(400);
    expect(await blocked.text()).toContain("Too many tries");
  });

  it("an account doesn't let anyone delete someone else's enough", async () => {
    const tag = marker();
    const author = browser();
    await author.register(newName(), PASSWORD);
    await author.declare({ description: `not yours ${tag}`, shared: "on" });
    const id = new RegExp(`data-enough="(\\d+)"[\\s\\S]*?not yours ${tag}`).exec(await author.get("/mine/all/"))?.[1] ?? "";

    const other = browser();
    await other.register(newName(), PASSWORD);
    await other.remove(id);
    expect(await browser().get("/")).toContain(`not yours ${tag}`);
  });
});
