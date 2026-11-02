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
    account: (fields: Record<string, string>) => post("/account/", fields),
    comment: (enough: string, text: string) => post("/comment/", { enough, text }),
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

// The account page (2026-11-02): your own little one's head and username in
// the nav's corner, a password you can change, a recovery code instead of
// email, where you're signed in, and deleting it all.
describe("the account page", () => {
  const codeOn = (html: string) => /data-code[^>]*>\s*([a-z0-9-]+)\s*</.exec(html)?.[1] ?? "";
  const enoughOn = (html: string, tag: string) =>
    new RegExp(`data-enough="(\\d+)"[\\s\\S]*?${tag}`).exec(html)?.[1] ?? "";

  it("shows your username in the nav's corner only to you", async () => {
    const username = newName();
    const me = browser();
    await me.register(username, PASSWORD);
    for (const path of ["/", "/mine/", "/account/"]) {
      expect(await me.get(path), path).toMatch(new RegExp(`class="me-name"[^>]*>${username}<`));
    }
    const other = browser();
    await other.register(newName(), PASSWORD);
    expect(await other.get("/")).not.toContain(username);
    expect(await browser().get("/")).toContain('class="me-signin"');
  });

  it("changing the password needs the current one, and signs out every other browser", async () => {
    const tag = marker();
    const username = newName();
    const here = browser();
    await here.register(username, PASSWORD);
    await here.declare({ description: `kept ${tag}` });
    const elsewhere = browser();
    await elsewhere.login(username, PASSWORD);

    const wrong = await here.account({ action: "password", current: "not-the-password", new: "a-new-long-password" });
    expect(wrong.status).toBe(400);
    expect(await elsewhere.get("/mine/all/")).toContain(`kept ${tag}`);

    const short = await here.account({ action: "password", current: PASSWORD, new: "x".repeat(PASSWORD_MIN - 1) });
    expect(short.status).toBe(400);

    expect((await here.account({ action: "password", current: PASSWORD, new: "a-new-long-password" })).status).toBe(200);
    // this browser stays signed in (it made the account, so it moved to a session)
    expect(await here.get("/mine/all/")).toContain(`kept ${tag}`);
    // the other is out, and the old password no longer works
    expect(await elsewhere.get("/mine/all/")).not.toContain(`kept ${tag}`);
    expect((await browser().login(username, PASSWORD)).status).toBe(400);
    expect((await browser().login(username, "a-new-long-password")).status).toBe(303);
  });

  it("a recovery code sets a new password once, signs out everywhere, and gives a new code", async () => {
    const tag = marker();
    const username = newName();
    const me = browser();
    await me.register(username, PASSWORD);
    await me.declare({ description: `recovered ${tag}` });
    const code = codeOn(await (await me.account({ action: "code" })).text());
    expect(code).toMatch(/^[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}$/);
    // shown once: reloading the page doesn't show it again
    expect(codeOn(await me.get("/account/"))).toBe("");

    // a wrong code changes nothing
    const wrong = await browser().account({ action: "recover", username, code: "aaaa-bbbb-cccc", password: "a-recovered-password" });
    expect(wrong.status).toBe(400);
    expect((await browser().login(username, PASSWORD)).status).toBe(303);

    // typed in capitals and without dashes still matches
    const fresh = browser();
    const res = await fresh.account({
      action: "recover",
      username: username.toUpperCase(),
      code: code.toUpperCase().replace(/-/g, " "),
      password: "a-recovered-password",
    });
    expect(res.status).toBe(200);
    const next = codeOn(await res.text());
    expect(next).not.toBe("");
    expect(next).not.toBe(code);
    expect(await fresh.get("/mine/all/")).toContain(`recovered ${tag}`);
    // the browser that made the account is signed out
    expect(await me.get("/mine/all/")).not.toContain(`recovered ${tag}`);
    expect((await browser().login(username, "a-recovered-password")).status).toBe(303);
    // the old code is spent
    const again = await browser().account({ action: "recover", username, code, password: "yet-another-password" });
    expect(again.status).toBe(400);
  });

  it("lists where you're signed in, and signs the others out", async () => {
    const tag = marker();
    const username = newName();
    const me = browser();
    await me.register(username, PASSWORD);
    await me.declare({ description: `devices ${tag}` });
    const phone = browser();
    await phone.login(username, PASSWORD);
    const listed = await phone.get("/account/");
    expect(listed).toContain("this browser");
    expect(listed.match(/<li>/g)?.length ?? 0).toBeGreaterThanOrEqual(1);

    await phone.account({ action: "signout-others" });
    expect(await phone.get("/mine/all/")).toContain(`devices ${tag}`);
    expect(await me.get("/mine/all/")).not.toContain(`devices ${tag}`);
  });

  it("deleting the account needs the password, then takes everything, the feed's too", async () => {
    const tag = marker();
    const username = newName();
    const leaving = browser();
    await leaving.register(username, PASSWORD);
    await leaving.declare({ description: `leaving ${tag}`, shared: "on" });

    const staying = browser();
    await staying.register(newName(), PASSWORD);
    await staying.declare({ description: `staying ${tag}`, shared: "on" });
    const theirs = enoughOn(await staying.get("/mine/all/"), `staying ${tag}`);
    await leaving.comment(theirs, `bye ${tag}`);
    expect(await browser().get("/")).toContain(`bye ${tag}`);

    expect((await leaving.account({ action: "delete", password: "not-the-password" })).status).toBe(400);
    expect(await browser().get("/")).toContain(`leaving ${tag}`);

    const res = await leaving.account({ action: "delete", password: PASSWORD });
    expect(res.status).toBe(303);
    const feed = await browser().get("/");
    expect(feed).not.toContain(`leaving ${tag}`);
    expect(feed).not.toContain(`bye ${tag}`);
    expect(feed).toContain(`staying ${tag}`);
    expect((await browser().login(username, PASSWORD)).status).toBe(400);
    // the username is free again
    expect((await browser().register(username, PASSWORD)).status).toBe(303);
  });

  it("refuses every account change from someone signed out, and changes nothing", async () => {
    const username = newName();
    await browser().register(username, PASSWORD);
    const reader = browser();
    for (const fields of <Record<string, string>[]>[
      { action: "password", current: PASSWORD, new: "a-new-long-password" },
      { action: "code" },
      { action: "signout-others" },
      { action: "signout-one", session: "1" },
      { action: "delete", password: PASSWORD },
    ]) {
      const res = await reader.account(fields);
      expect(res.status, fields.action).toBe(303);
      expect(res.headers.get("location"), fields.action).toContain("/account/");
    }
    expect((await browser().login(username, PASSWORD)).status).toBe(303);
  });
});
