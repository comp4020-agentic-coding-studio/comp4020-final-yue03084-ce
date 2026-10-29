import { type ChildProcess, spawn } from "node:child_process";
import { existsSync, mkdtempSync } from "node:fs";
import { type AddressInfo, createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Two things the shared test server can't show, so this file boots its own
// copy of the built app (dist/server/entry.mjs, which `pnpm check` builds
// first, in CI too) with its own throwaway DATA_DIR, reads what it prints,
// and stops and starts it again on the same data:
// - the log never holds what anyone wrote, or a username or password
//   (CLAUDE.md: "Logs say who did what, never what they wrote"); on
//   2026-10-21 this was checked once by hand, and now it's checked every run
// - what someone did is still there after a restart (the brief: "Persists
//   … across sessions, restarts and redeploys")
const ENTRY = "./dist/server/entry.mjs";
const DATA_DIR = mkdtempSync(join(tmpdir(), "spec-lasting-"));
let server: ChildProcess | undefined;
let baseUrl = "";
let output = "";

const freePort = () =>
  new Promise<number>((resolve) => {
    const probe = createServer();
    probe.listen(0, () => {
      const { port } = probe.address() as AddressInfo;
      probe.close(() => resolve(port));
    });
  });

async function start() {
  const port = await freePort();
  server = spawn("node", [ENTRY], {
    env: { ...process.env, HOST: "127.0.0.1", PORT: String(port), DATA_DIR },
    stdio: ["ignore", "pipe", "pipe"],
  });
  server.stdout?.on("data", (chunk) => (output += chunk));
  server.stderr?.on("data", (chunk) => (output += chunk));
  baseUrl = `http://127.0.0.1:${port}`;
  for (let attempt = 0; attempt < 150; attempt++) {
    try {
      await fetch(baseUrl);
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 200));
    }
  }
  throw new Error(`the app didn't start at ${baseUrl}`);
}

async function stop() {
  if (!server) return;
  const exited = new Promise((r) => server?.once("exit", r));
  server.kill();
  await exited;
  server = undefined;
}

// a browser: one cookie, and the header a browser sends with its own form posts
function browser() {
  let cookie = "";
  const send = async (path: string, fields?: Record<string, string>) => {
    const headers = new Headers();
    if (cookie) headers.set("cookie", cookie);
    if (fields) headers.set("sec-fetch-site", "same-origin");
    const res = await fetch(new URL(path, baseUrl), {
      method: fields ? "POST" : "GET",
      body: fields ? new URLSearchParams(fields) : undefined,
      headers,
      redirect: "manual",
    });
    const set = res.headers.get("set-cookie");
    if (set) cookie = set.split(";")[0];
    return res;
  };
  return { send, get: async (path: string) => (await send(path)).text() };
}

// Values that nothing else in a log line could contain (no timestamp, id or
// hex), so finding one means it leaked. CLAUDE.md: "A spec that checks a
// private value never reaches the stream must use a value no timestamp or
// id could contain".
const tag = `qz${Math.random().toString(36).replace(/[^a-z]/g, "").slice(0, 8)}`;
const secret = {
  username: `user${tag}`,
  password: `pass${tag}word`,
  description: `describe ${tag}`,
  notes: `notes ${tag}`,
  worry: `worry ${tag}`,
  comment: `say ${tag}`.slice(0, 30),
  drawer: `drawer ${tag}`,
};

const enoughId = (html: string, text: string) => {
  const card = html.split('data-enough="').find((c) => c.includes(text));
  return card?.match(/^(\d+)/)?.[1] ?? "";
};

beforeAll(async () => {
  if (!existsSync(ENTRY)) throw new Error(`${ENTRY} not found: run \`pnpm check\`, which builds first`);
  await start();
}, 60_000);

afterAll(stop);

describe("what lasts and what's logged", () => {
  const writer = browser();
  const other = browser();

  it("does everything private once, and the log holds none of it", async () => {
    expect((await writer.send("/account/", { action: "register", username: secret.username, password: secret.password })).status).toBe(303);
    expect((await other.send("/account/", { action: "register", username: `other${tag}`, password: secret.password })).status).toBe(303);
    // a wrong password, so a refusal is logged too
    await browser().send("/account/", { action: "login", username: secret.username, password: `wrong${tag}` });

    expect(
      (
        await writer.send("/enough/", {
          description: secret.description,
          shared: "on",
          notes: `<p>${secret.notes}</p>`,
          spans: "540-660",
          crayon: "clay",
          feeling: "Just enough",
          worry: secret.worry,
          next: "tea",
        })
      ).status,
    ).toBe(303);
    const id = enoughId(await writer.get("/mine/all/"), secret.description);
    expect(id).not.toBe("");
    await other.send("/comment/", { enough: id, text: secret.comment });
    await other.send("/reply/", { enough: id, preset: "seen" });
    await writer.send("/urge/", { enough: id, choice: "tomorrow", note: secret.drawer });
    await writer.send("/break/", { end: "1" });

    // the log did record the actions, by block number...
    expect(output).toMatch(/enough_called block=\d+/);
    expect(output).toMatch(/comment_added block=\d+/);
    // ...and nothing anyone wrote, nor who they are
    for (const [field, value] of Object.entries(secret)) {
      expect(output.includes(value), `${field} reached the log`).toBe(false);
    }
    expect(output).not.toContain(tag);
  });

  it("keeps what was written through a restart", async () => {
    await stop();
    await start();
    // the shared enough and its comment, for anyone
    const feed = await browser().get("/");
    expect(feed).toContain(secret.description);
    expect(feed).toContain(secret.comment);
    // signing in again after the restart finds the account and its private record
    const back = browser();
    expect((await back.send("/account/", { action: "login", username: secret.username, password: secret.password })).status).toBe(303);
    const mine = await back.get("/mine/all/");
    expect(mine).toContain(secret.description);
    expect(mine).toContain(secret.notes);
    // and still nothing private in anything printed since
    for (const [field, value] of Object.entries(secret)) {
      expect(output.includes(value), `${field} reached the log`).toBe(false);
    }
  }, 60_000);
});
