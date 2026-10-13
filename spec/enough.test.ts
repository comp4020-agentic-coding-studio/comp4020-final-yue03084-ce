import { describe, expect, inject, it } from "vitest";
import { DESCRIPTION_MAX, NOTES_MAX } from "../src/lib/limits.ts";

// The product rules that can be checked, against the running app: a shared
// enough reaches every open page live, and nothing private (an unshared
// enough, or the hours, feeling and notes of any enough) ever reaches anyone
// but its owner (CLAUDE.md: "Effort and check records are private").
const baseUrl = inject("baseUrl");

// One browser: a cookie jar of one cookie. Astro refuses a cross-site form
// POST (CSRF); a browser marks its own with Sec-Fetch-Site, a bare fetch
// doesn't, so this sends what a browser would.
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
  return {
    get: async (path: string) => (await send(path)).text(),
    declare: (fields: Record<string, string>) =>
      send("/enough/", { method: "POST", body: new URLSearchParams(fields) }),
  };
}

// Reads the stream until `until` appears or the time runs out, returning all
// it saw. Used both ways: to see an event arrive, and to see one never does.
async function readStream(start: () => Promise<unknown>, until: string, ms: number): Promise<string> {
  const controller = new AbortController();
  const res = await fetch(new URL("/api/events", baseUrl), { signal: controller.signal });
  const reader = res.body?.getReader();
  if (!reader) throw new Error("no response body");
  const decoder = new TextDecoder();
  let received = "";
  const timer = setTimeout(() => controller.abort(), ms);
  const reading = (async () => {
    try {
      while (!received.includes(until)) {
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
  controller.abort();
  return received;
}

const marker = () => `t${Math.random().toString(36).slice(2, 10)}`;

describe("a shared enough", () => {
  it("reaches another open page within about a second, with no reload", async () => {
    const tag = marker();
    const author = browser();
    const t0 = Date.now();
    const received = await readStream(
      () => author.declare({ description: `report ${tag}`, shared: "on" }),
      tag,
      3_000,
    );
    expect(received).toContain("event: enough");
    expect(received).toContain(`report ${tag}`);
    expect(Date.now() - t0).toBeLessThan(1_500);
  });

  it("is still on the feed for someone else after a reload", async () => {
    const tag = marker();
    await browser().declare({ description: `letter ${tag}`, shared: "on" });
    expect(await browser().get("/")).toContain(`letter ${tag}`);
  });
});

describe("what stays private", () => {
  it("an unshared enough reaches nobody else, on the feed or the stream", async () => {
    const tag = marker();
    const author = browser();
    const received = await readStream(() => author.declare({ description: `draft ${tag}` }), tag, 1_500);
    expect(received).not.toContain(tag);
    expect(await browser().get("/")).not.toContain(tag);
    expect(await author.get("/mine/")).toContain(`draft ${tag}`);
  });

  it("hours, feeling and notes reach only their owner, even when shared", async () => {
    const tag = marker();
    const notes = `checked every citation ${tag}`;
    const author = browser();
    const received = await readStream(
      () =>
        author.declare({
          description: `essay ${tag}`,
          shared: "on",
          hours: "7.5",
          feeling: "More than I thought",
          notes,
        }),
      `essay ${tag}`,
      3_000,
    );
    expect(received).toContain(`essay ${tag}`);
    for (const secret of [notes, "7.5", "More than I thought"]) expect(received).not.toContain(secret);

    const someoneElse = browser();
    for (const page of ["/", "/mine/"]) {
      const html = await someoneElse.get(page);
      expect(html).not.toContain(notes);
    }
    const own = await author.get("/mine/");
    expect(own).toContain(notes);
    expect(own).toContain("7.5");
  });
});

describe("limits", () => {
  it(`refuses a description over ${DESCRIPTION_MAX} characters`, async () => {
    const tag = marker();
    const res = await browser().declare({ description: `${tag}${"x".repeat(DESCRIPTION_MAX)}`, shared: "on" });
    expect(res.status).toBe(400);
    expect(await browser().get("/")).not.toContain(tag);
  });

  it(`refuses notes over ${NOTES_MAX} characters`, async () => {
    const tag = marker();
    const res = await browser().declare({ description: `long ${tag}`, notes: `<p>${"x".repeat(NOTES_MAX)}</p>` });
    expect(res.status).toBe(400);
  });
});

// The notes editor sends HTML. The server keeps the formatting the editor can
// make and drops anything else, so the owner's own page never runs a script.
describe("formatted notes", () => {
  it("keep bold, italic, lists and a palette colour, and lose everything else", async () => {
    const tag = marker();
    const author = browser();
    await author.declare({
      description: `formatted ${tag}`,
      notes: [
        `<p><strong>bold ${tag}</strong> <em>italic</em> <span class="c-sage">sage</span></p>`,
        "<ol><li>first</li></ol><ul><li>point</li></ul>",
        `<script>alert(1)</script><p><img src=x onerror="alert(2)"><span style="color:red" class="c-neon">x</span><a href="javascript:alert(3)">link</a></p>`,
      ].join(""),
    });
    const html = await author.get("/mine/");
    expect(html).toContain(`<strong>bold ${tag}</strong>`);
    expect(html).toContain("<em>italic</em>");
    expect(html).toContain('<span class="c-sage">sage</span>');
    expect(html).toContain("<ol><li>first</li></ol>");
    expect(html).toContain("<ul><li>point</li></ul>");
    for (const gone of ["alert(1)", "onerror", "color:red", "c-neon", "javascript:"]) expect(html).not.toContain(gone);
  });
});
