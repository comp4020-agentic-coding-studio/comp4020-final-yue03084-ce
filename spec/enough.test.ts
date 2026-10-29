import { describe, expect, inject, it } from "vitest";
import { mkdtempSync, readdirSync, readFileSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { dayAfter, drawerHeading, isDue, weekLater } from "../src/lib/later.ts";
import { BREAK_KINDS, DESCRIPTION_MAX, DRAWER_MAX, PASSWORD_MIN, NOTES_MAX, REPLY_MAX, REPORTS_TO_HIDE, WORRY_AFTER_DAYS, WORRY_MAX } from "../src/lib/limits.ts";
import { periodLabel, periodRange, summarise } from "../src/lib/summary.ts";

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
    send,
    get: async (path: string) => (await send(path)).text(),
    declare: (fields: Record<string, string>) =>
      send("/enough/", { method: "POST", body: new URLSearchParams(fields) }),
    remove: (enough: string) => send("/delete/", { method: "POST", body: new URLSearchParams({ enough }) }),
    comment: (enough: string, text: string) =>
      send("/comment/", { method: "POST", body: new URLSearchParams({ enough, text }) }),
    report: (comment: string) => send("/report/", { method: "POST", body: new URLSearchParams({ comment }) }),
    rest: (fields: Record<string, string>) => send("/break/", { method: "POST", body: new URLSearchParams(fields) }),
    urge: (enough: string, choice: string, note = "") =>
      send("/urge/", { method: "POST", body: new URLSearchParams({ enough, choice, note }) }),
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

// Writing needs an account (CLAUDE.md: "Writing needs an account"), so a
// browser that writes registers first. browser() alone is a reader.
let accounts = 0;
async function signedIn() {
  const b = browser();
  const res = await b.send("/account/", {
    method: "POST",
    body: new URLSearchParams({
      action: "register",
      username: `s${Date.now().toString(36)}${(accounts++).toString(36)}${Math.random().toString(36).slice(2, 6)}`,
      password: "a-long-enough-password",
    }),
  });
  if (res.status !== 303) throw new Error(`couldn't register a test account: ${res.status}`);
  return b;
}

const marker = () => `t${Math.random().toString(36).slice(2, 10)}`;

// Every page under src/pages that takes a POST, as the path it's served at
// ("src/pages/put-away.ts" is "/put-away/"; "mine/all.astro" is "/mine/all/").
function writeRoutes(): string[] {
  const root = join(process.cwd(), "src/pages");
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const file = join(dir, name);
      if (statSync(file).isDirectory()) walk(file);
      else if (/\.(ts|astro)$/.test(name) && /export const POST\b|request\.method === "POST"/.test(readFileSync(file, "utf8"))) {
        const route = relative(root, file).replace(/\.(ts|astro)$/, "").replace(/(^|\/)index$/, "");
        out.push(`/${route}${route ? "/" : ""}`);
      }
    }
  };
  walk(root);
  return out.sort();
}

describe("a shared enough", () => {
  it("reaches another open page within about a second, with no reload", async () => {
    const tag = marker();
    const author = await signedIn();
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
    await (await signedIn()).declare({ description: `letter ${tag}`, shared: "on" });
    expect(await browser().get("/")).toContain(`letter ${tag}`);
  });
});

describe("what stays private", () => {
  // each shared enough and comment has a name of its own, so nobody can
  // tell two are by the same person, or count how often someone stops
  it("gives each shared enough its own name, even two by the same person", async () => {
    const tag = marker();
    const author = await signedIn();
    await author.declare({ description: `first ${tag}`, shared: "on" });
    await author.declare({ description: `second ${tag}`, shared: "on" });
    const feed = await browser().get("/");
    // the name on the card holding `text`, read card by card
    const nameOf = (text: string) => {
      const card = feed.split('<li class="card"').find((c) => c.includes(text)) ?? "";
      return /class="who">([^<]+)</.exec(card)?.[1] ?? "";
    };
    const first = nameOf(`first ${tag}`);
    const second = nameOf(`second ${tag}`);
    expect(first).toMatch(/^[A-Z][a-z]+ [a-z]/);
    expect(second).toMatch(/^[A-Z][a-z]+ [a-z]/);
    expect(first).not.toBe(second);
  });

  it("an unshared enough reaches nobody else, on the feed or the stream", async () => {
    const tag = marker();
    const author = await signedIn();
    const received = await readStream(() => author.declare({ description: `draft ${tag}` }), tag, 1_500);
    expect(received).not.toContain(tag);
    expect(await browser().get("/")).not.toContain(tag);
    expect(await author.get("/mine/all/")).toContain(`draft ${tag}`);
  });

  it("hours, feeling and notes reach only their owner, even when shared", async () => {
    const tag = marker();
    const notes = `checked every citation ${tag}`;
    const author = await signedIn();
    const received = await readStream(
      () =>
        author.declare({
          description: `essay ${tag}`,
          shared: "on",
          hours: "973.25",
          feeling: "More than I thought",
          notes,
        }),
      `essay ${tag}`,
      3_000,
    );
    expect(received).toContain(`essay ${tag}`);
    // the hours are a number no timestamp or id contains, and the card on the
    // stream must have no hours field at all. (With "7.5" this failed once when
    // a createdAt of …27.579Z happened to contain it; nothing had leaked.)
    for (const secret of [notes, "973.25", "More than I thought"]) expect(received).not.toContain(secret);
    expect(received).not.toMatch(/"(hours|spans|feeling|notes)"/);

    const someoneElse = browser();
    for (const page of ["/", "/mine/", "/mine/all/"]) {
      const html = await someoneElse.get(page);
      expect(html).not.toContain(notes);
    }
    const own = await author.get("/mine/all/");
    expect(own).toContain(notes);
    expect(own).toContain("973.25");
  });
});

describe("limits", () => {
  // what the page says and lets you type is the same number the server
  // enforces: each field's maxlength and its "(up to N characters)" read the
  // constant (CLAUDE.md: "Numbers live in one place")
  it("says each limit and stops typing at it, from the same constant the server uses", async () => {
    const tag = marker();
    const author = await signedIn();
    await author.declare({ description: `limits ${tag}`, shared: "on" });
    const field = (html: string, name: string) => new RegExp(`<input[^>]*name="${name}"[^>]*>`).exec(html)?.[0] ?? "";
    const attr = (input: string, a: string) => new RegExp(`${a}="(\\d+)"`).exec(input)?.[1];
    // the visible text, so a number written into the markup is seen as a reader sees it
    const text = (html: string) => html.replace(/<(script|style)[\s\S]*?<\/\1>/g, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

    const enough = await author.get("/enough/");
    expect(attr(field(enough, "description"), "maxlength")).toBe(String(DESCRIPTION_MAX));
    expect(text(enough)).toContain(`up to ${DESCRIPTION_MAX} characters`);
    expect(attr(field(enough, "worry"), "maxlength")).toBe(String(WORRY_MAX));
    expect(text(enough)).toContain(`up to ${WORRY_MAX} characters`);
    expect(text(enough)).toContain(`in ${WORRY_AFTER_DAYS} days`);

    const all = await author.get("/mine/all/");
    expect(attr(field(all, "note"), "maxlength")).toBe(String(DRAWER_MAX));
    expect(text(all)).toContain(`up to ${DRAWER_MAX} characters`);

    const feed = await author.get("/");
    const comment = field(feed, "text");
    expect(attr(comment, "maxlength")).toBe(String(REPLY_MAX));
    expect(comment).toContain(`up to ${REPLY_MAX} characters`);

    const account = await browser().get("/account/");
    // the register form's password (the sign-in one has no minimum)
    const newPassword = /<input[^>]*name="password"[^>]*new-password[^>]*>/.exec(account)?.[0] ?? "";
    expect(attr(newPassword, "minlength")).toBe(String(PASSWORD_MIN));
    expect(text(account)).toContain(`at least ${PASSWORD_MIN} characters`);
  });

  it(`refuses a description over ${DESCRIPTION_MAX} characters`, async () => {
    const tag = marker();
    const res = await (await signedIn()).declare({ description: `${tag}${"x".repeat(DESCRIPTION_MAX)}`, shared: "on" });
    expect(res.status).toBe(400);
    expect(await browser().get("/")).not.toContain(tag);
  });

  it(`refuses notes over ${NOTES_MAX} characters`, async () => {
    const tag = marker();
    const res = await (await signedIn()).declare({ description: `long ${tag}`, notes: `<p>${"x".repeat(NOTES_MAX)}</p>` });
    expect(res.status).toBe(400);
  });

  // a POST that isn't a form (a script, a stray JSON body) is refused, not a 500
  it("refuses a body that isn't a form without falling over", async () => {
    const res = await (await signedIn()).send("/enough/", { method: "POST", body: "{}", headers: { "content-type": "application/json" } });
    expect(res.status).toBe(400);
  });
});

// The notes editor sends HTML. The server keeps the formatting the editor can
// make and drops anything else, so the owner's own page never runs a script.
describe("formatted notes", () => {
  it("keep bold, italic, lists and a palette colour, and lose everything else", async () => {
    const tag = marker();
    const author = await signedIn();
    await author.declare({
      description: `formatted ${tag}`,
      notes: [
        `<p><strong>bold ${tag}</strong> <em>italic</em> <span class="c-sage">sage</span></p>`,
        "<ol><li>first</li></ol><ul><li>point</li></ul>",
        `<script>alert(1)</script><p><img src=x onerror="alert(2)"><span style="color:red" class="c-neon">x</span><a href="javascript:alert(3)">link</a></p>`,
      ].join(""),
    });
    const html = await author.get("/mine/all/");
    expect(html).toContain(`<strong>bold ${tag}</strong>`);
    expect(html).toContain("<em>italic</em>");
    expect(html).toContain('<span class="c-sage">sage</span>');
    expect(html).toContain("<ol><li>first</li></ol>");
    expect(html).toContain("<ul><li>point</li></ul>");
    for (const gone of ["alert(1)", "onerror", "color:red", "c-neon", "javascript:"]) expect(html).not.toContain(gone);
  });
});

// The time bar sends the half-hours someone coloured in. They're private, and
// the hours stored beside them are always their total, never a second guess.
describe("time spans", () => {
  it("are kept, totalled, and seen only by their owner", async () => {
    const tag = marker();
    const author = await signedIn();
    const res = await author.declare({ description: `spans ${tag}`, shared: "on", hours: "99", spans: "540-690,840-900" });
    expect(res.status).toBe(303);
    const own = await author.get("/mine/all/");
    expect(own).toContain("about 3½ hours");
    expect(own).toContain("9:00–11:30");
    expect(own).toContain("14:00–15:00");
    expect(own).not.toContain("99 hours");
    const other = await browser().get("/");
    expect(other).toContain(`spans ${tag}`);
    expect(other).not.toContain("9:00–11:30");
  });

  it("keep the crayon they were drawn with, and only a palette colour", async () => {
    const author = await signedIn();
    await author.declare({ description: `sage ${marker()}`, spans: "540-600", crayon: "sage" });
    await author.declare({ description: `neon ${marker()}`, spans: "600-660", crayon: "neon" });
    const own = await author.get("/mine/all/");
    expect(own).toContain("--crayon: var(--c-sage)");
    expect(own).not.toContain("neon)");
  });

  it("refuses times that aren't whole half-hours inside one day", async () => {
    for (const spans of ["540-555", "1400-1500", "600-540", "nine-ten"]) {
      const res = await (await signedIn()).declare({ description: `bad ${marker()}`, spans });
      expect(res.status, spans).toBe(400);
    }
  });
});

// Deleting is the owner's alone, and a deleted shared enough leaves every
// open feed at once.
describe("deleting", () => {
  const idOf = (html: string, text: string) => {
    const m = new RegExp(`data-enough="(\\d+)"[\\s\\S]*?${text}`).exec(html);
    if (!m) throw new Error(`no card for ${text}`);
    return m[1];
  };

  it("takes a shared enough off everyone's feed, live", async () => {
    const tag = marker();
    const author = await signedIn();
    await author.declare({ description: `gone ${tag}`, shared: "on" });
    const id = idOf(await author.get("/mine/all/"), `gone ${tag}`);
    const received = await readStream(() => author.remove(id), `"id":${id}`, 3_000);
    expect(received).toContain("event: removed");
    expect(await browser().get("/")).not.toContain(`gone ${tag}`);
    expect(await author.get("/mine/all/")).not.toContain(`gone ${tag}`);
  });

  it("shrugs off a POST with no form body instead of erroring", async () => {
    for (const path of ["/delete/", "/reply/"]) {
      const res = await fetch(new URL(path, baseUrl), { method: "POST", headers: { "sec-fetch-site": "same-origin" }, redirect: "manual" });
      expect(res.status, path).toBeLessThan(500);
    }
  });

  it("can't delete someone else's", async () => {
    const tag = marker();
    const author = await signedIn();
    await author.declare({ description: `kept ${tag}`, shared: "on" });
    const id = idOf(await author.get("/mine/all/"), `kept ${tag}`);
    await (await signedIn()).remove(id);
    expect(await browser().get("/")).toContain(`kept ${tag}`);
  });
});

// One-line comments are public and live; enough reports hide one from everyone.
describe("comments", () => {
  const enoughId = (html: string, text: string) => {
    const m = new RegExp(`data-enough="(\\d+)"[\\s\\S]*?${text}`).exec(html);
    if (!m) throw new Error(`no card for ${text}`);
    return m[1];
  };
  const commentId = (html: string, text: string) => {
    const m = new RegExp(`data-comment="(\\d+)"[\\s\\S]*?${text}`).exec(html);
    if (!m) throw new Error(`no comment ${text}`);
    return m[1];
  };

  it("reach every open feed within about a second", async () => {
    const tag = marker();
    const author = await signedIn();
    await author.declare({ description: `talk ${tag}`, shared: "on" });
    const id = enoughId(await author.get("/"), `talk ${tag}`);
    const other = await signedIn();
    const received = await readStream(() => other.comment(id, `well done ${tag}`), `well done ${tag}`, 3_000);
    expect(received).toContain(`well done ${tag}`);
    expect(await browser().get("/")).toContain(`well done ${tag}`);
  });

  it(`refuses a comment over ${REPLY_MAX} characters`, async () => {
    const tag = marker();
    const author = await signedIn();
    await author.declare({ description: `long ${tag}`, shared: "on" });
    const id = enoughId(await author.get("/"), `long ${tag}`);
    const res = await (await signedIn()).comment(id, `${tag}${"x".repeat(REPLY_MAX)}`);
    expect(res.status).toBe(303);
    expect(await browser().get("/")).not.toContain(`${tag}xxxx`);
  });

  it(`hide once ${REPORTS_TO_HIDE} different people report them, and not before`, async () => {
    const tag = marker();
    const author = await signedIn();
    await author.declare({ description: `reported ${tag}`, shared: "on" });
    const id = enoughId(await author.get("/"), `reported ${tag}`);
    const commenter = await signedIn();
    await commenter.comment(id, `unkind ${tag}`);
    const cid = commentId(await author.get("/"), `unkind ${tag}`);

    // reporting your own does nothing, and one person reporting twice counts once
    await commenter.report(cid);
    const repeat = await signedIn();
    await repeat.report(cid);
    await repeat.report(cid);
    for (let i = 2; i < REPORTS_TO_HIDE; i++) await (await signedIn()).report(cid);
    expect(await browser().get("/")).toContain(`unkind ${tag}`);

    const last = await signedIn();
    const received = await readStream(() => last.report(cid), `reported ${tag}`, 3_000);
    expect(received).not.toContain(`unkind ${tag}`);
    expect(await browser().get("/")).not.toContain(`unkind ${tag}`);
    expect(await author.get("/mine/all/")).not.toContain(`unkind ${tag}`);
  });
});

// Breaks: others see how many are resting and where someone went after a
// shared enough, never who is resting or for how long.
describe("breaks", () => {
  // the count as the page shows it (not the wording kept in its data attributes)
  const restingCount = (html: string) => {
    const shown = /id="resting"[^>]*>\s*([^<]*)/.exec(html)?.[1] ?? "";
    // nobody resting is an empty line
    if (!shown.trim()) return 0;
    const n = /^(\d+)/.exec(shown);
    return n ? Number(n[1]) : Number.NaN;
  };

  it("change the resting count for everyone, live, and back again", async () => {
    const before = restingCount(await browser().get("/"));
    const someone = await signedIn();
    const started = await readStream(() => someone.rest({ kind: "tea" }), "event: resting", 3_000);
    expect(started).toContain(`"count":${before + 1}`);
    const ended = await readStream(() => someone.rest({ end: "1" }), "event: resting", 3_000);
    expect(ended).toContain(`"count":${before}`);
  });

  it("put each resting person's little one on the meadow, live: what they're doing, never who", async () => {
    const someone = await signedIn();
    const started = await readStream(() => someone.rest({ kind: "nap" }), "event: resting", 3_000);
    const data = JSON.parse(/event: resting\ndata: (.*)/.exec(started)?.[1] ?? "{}");
    const kinds = data.ones.map((o: { kind: string }) => o.kind);
    expect(kinds).toContain("nap");
    expect(data.ones).toHaveLength(data.count);
    // only the count and the little ones, each only what it's doing and what
    // it wears (item keys): no block number, person, time or id
    expect(Object.keys(data).sort()).toEqual(["count", "ones"]);
    for (const one of data.ones) {
      expect(Object.keys(one).sort()).toEqual(["kind", "wears"]);
      expect(typeof one.kind === "string" && /^[a-z]+$/.test(one.kind)).toBe(true);
      expect(one.wears.every((k: unknown) => typeof k === "string" && /^[a-z]+$/.test(k))).toBe(true);
    }
    // and the page draws the meadow from the same list, for anyone
    const feed = await browser().get("/");
    expect(feed).toContain('class="meadow"');
    expect(/data-ones="([^"]*)"/.exec(feed)?.[1]).toContain("nap");
    await someone.rest({ end: "1" });
  });

  it("after a shared enough, show where they went and when they're back, never how long", async () => {
    const tag = marker();
    const author = await signedIn();
    const received = await readStream(
      () => author.declare({ description: `then walk ${tag}`, shared: "on", spans: "540-720", next: "walk" }),
      `then walk ${tag}`,
      3_000,
    );
    expect(received).toContain(`then walk ${tag}`);
    let feed = await browser().get("/");
    expect(feed).toContain(BREAK_KINDS.walk.going);
    expect(feed).not.toContain("3 hours");
    await author.rest({ end: "1" });
    feed = await browser().get("/");
    expect(feed).toContain(BREAK_KINDS.walk.back);
  });
});

// "I want to check it again" is the owner's alone: recorded, shown back to
// them, and never to anyone else.
describe("rechecking", () => {
  it("is recorded for the owner only", async () => {
    const tag = marker();
    const author = await signedIn();
    await author.declare({ description: `recheck ${tag}`, shared: "on", notes: `<p>checked refs ${tag}</p>` });
    const mineHtml = await author.get("/mine/all/");
    const id = new RegExp(`data-enough="(\\d+)"[\\s\\S]*?recheck ${tag}`).exec(mineHtml)?.[1] ?? "";
    expect(mineHtml).toContain(`checked refs ${tag}`);
    await author.urge(id, "let_go");
    await author.urge(id, "checked");
    await (await signedIn()).urge(id, "checked");
    const own = await author.get("/mine/all/");
    expect(own).toContain("Wanted to check it again 2 times; let it go 1.");
    expect(await browser().get("/")).not.toContain("Wanted to check it again");
  });
});

// Looking back on Mine: a day, week or month of your own enoughs, for you alone.
describe("looking back", () => {
  it("adds up this week's enoughs, feelings, hours and rechecks for the owner only", async () => {
    const tag = marker();
    const author = await signedIn();
    await author.declare({ description: `week one ${tag}`, spans: "540-660", feeling: "Just enough" });
    await author.declare({ description: `week two ${tag}`, shared: "on", spans: "600-630", feeling: "Just enough" });
    const id = new RegExp(`data-enough="(\\d+)"[\\s\\S]*?week two ${tag}`).exec(await author.get("/mine/all/"))?.[1] ?? "";
    await author.urge(id, "let_go");
    const text = (await author.get("/mine/")).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
    expect(text).toContain(`week one ${tag}`);
    expect(text).toContain(`week two ${tag}`);
    expect(text).toContain("Just enough ×2");
    expect(text).toContain("About 2½ hours in all");
    expect(text).toContain("check something 1 time this week, and let it go 1 of those");
    // each one links to its card on Each one
    expect(await author.get("/mine/")).toContain(`/mine/all/#enough-${id}`);
    // nobody else's Looking back, and not the feed, shows the private parts
    const other = await signedIn();
    expect(await other.get("/mine/")).not.toContain(tag);
    const feed = await browser().get("/");
    expect(feed).toContain(`week two ${tag}`);
    expect(feed).not.toContain("Just enough ×");
    expect(feed).not.toContain("hours in all");
  });

  it("an unknown period falls back to the week; a day and a month have their own label", async () => {
    const author = await signedIn();
    for (const [query, heading] of [["?period=nonsense", "Week of"], ["?period=month&back=1", ""], ["?period=day", ""]]) {
      const res = await author.send(`/mine/${query}`);
      expect(res.status).toBe(200);
      if (heading) expect(await res.text()).toContain(heading);
    }
  });

  it("works out periods on Sydney dates, weeks from Monday (summary.ts)", () => {
    // Tuesday 21 October 2026
    expect(periodRange("day", 0, "2026-10-21")).toEqual({ from: "2026-10-21", to: "2026-10-21" });
    expect(periodRange("week", 0, "2026-10-21")).toEqual({ from: "2026-10-19", to: "2026-10-25" });
    expect(periodRange("week", 0, "2026-10-25")).toEqual({ from: "2026-10-19", to: "2026-10-25" });
    expect(periodRange("week", 1, "2026-10-19")).toEqual({ from: "2026-10-12", to: "2026-10-18" });
    expect(periodRange("month", 0, "2026-10-21")).toEqual({ from: "2026-10-01", to: "2026-10-31" });
    expect(periodRange("month", 8, "2026-10-21")).toEqual({ from: "2026-02-01", to: "2026-02-28" });
    expect(periodRange("month", 10, "2026-10-21")).toEqual({ from: "2025-12-01", to: "2025-12-31" });
    expect(periodLabel("week", { from: "2026-10-19" })).toBe("Week of 19 October 2026");
    expect(periodLabel("month", { from: "2026-02-01" })).toBe("February 2026");

    const range = periodRange("day", 0, "2026-10-21");
    // 23:30 UTC on the 20th is 10:30 on the 21st in Sydney; 14:00 UTC on the 21st is the 22nd
    const enoughs = [
      { id: 1, description: "a", createdAt: "2026-10-20T23:30:00.000Z", hours: null, spans: "540-600,570-630", feeling: "Just enough" },
      { id: 2, description: "b", createdAt: "2026-10-21T01:00:00.000Z", hours: 1.5, spans: null, feeling: null },
      { id: 3, description: "c", createdAt: "2026-10-21T14:00:00.000Z", hours: 9, spans: null, feeling: "Just enough" },
    ];
    const urges = [
      { choice: "let_go", createdAt: "2026-10-21T02:00:00.000Z" },
      { choice: "checked", createdAt: "2026-10-21T03:00:00.000Z" },
      { choice: "let_go", createdAt: "2026-10-22T03:00:00.000Z" },
    ];
    const s = summarise(enoughs, urges, range);
    expect(s.enoughs.map((e) => e.id)).toEqual([1, 2]);
    expect(s.feelings.find((f) => f.feeling === "Just enough")?.n).toBe(1);
    expect(s.unsaid).toBe(1);
    // overlapping spans count once (9:00–10:30), plus the typed 1.5 hours
    expect(s.hours).toBe(3);
    expect(s.slots.slice(17, 22)).toEqual([0, 1, 1, 1, 0]);
    expect(s.urges).toEqual({ wanted: 2, letGo: 1 });
  });
});

// Things kept for later are the owner's alone: a note in the drawer for
// tomorrow, and one worry for a week on. Neither shows before its day, and
// neither ever reaches the feed, the stream or anyone else's Mine.
describe("kept for later", () => {
  const idOf = async (b: Awaited<ReturnType<typeof signedIn>>, text: string) =>
    new RegExp(`data-enough="(\\d+)"[\\s\\S]*?${text}`).exec(await b.get("/mine/all/"))?.[1] ?? "";

  it("a note for tomorrow counts as wanting to check, and shows nowhere today", async () => {
    const tag = marker();
    const note = `the second table ${tag}`;
    const author = await signedIn();
    await author.declare({ description: `drawer ${tag}`, shared: "on" });
    const id = await idOf(author, `drawer ${tag}`);
    const received = await readStream(() => author.urge(id, "tomorrow", note), note, 1_500);
    expect(received).not.toContain(note);
    const own = await author.get("/mine/all/");
    expect(own).toContain("Wanted to check it again 1 time; let it go 0.");
    // not due until tomorrow (Sydney): on neither of the owner's pages yet
    expect(own).not.toContain(note);
    expect(own).not.toContain("In your drawer");
    expect(await author.get("/mine/")).not.toContain(note);
    const other = await signedIn();
    for (const page of ["/", "/mine/", "/mine/all/"]) expect(await other.get(page)).not.toContain(note);
    expect(await browser().get("/")).not.toContain(note);
  });

  it(`refuses an empty note, one over ${DRAWER_MAX} characters, or one on someone else's enough`, async () => {
    const tag = marker();
    const author = await signedIn();
    await author.declare({ description: `long drawer ${tag}` });
    const id = await idOf(author, `long drawer ${tag}`);
    for (const note of ["   ", `${tag}${"x".repeat(DRAWER_MAX)}`]) {
      const res = await author.urge(id, "tomorrow", note);
      expect(res.status).toBe(303);
    }
    await (await signedIn()).urge(id, "tomorrow", `not yours ${tag}`);
    expect(await author.get("/mine/all/")).not.toContain("Wanted to check it again");
  });

  it("a worry is kept for its owner, and never on the feed, the stream or anyone else's Mine", async () => {
    const tag = marker();
    // words no timestamp or id could contain
    const worry = `the ending felt rushed qz${tag}`;
    const author = await signedIn();
    const received = await readStream(
      () => author.declare({ description: `worried ${tag}`, shared: "on", worry }),
      `worried ${tag}`,
      3_000,
    );
    expect(received).toContain(`worried ${tag}`);
    expect(received).not.toContain(worry);
    expect(received).not.toMatch(/"worry"/);
    expect(await browser().get("/")).not.toContain(worry);
    // not shown before its week, even to its owner
    for (const page of ["/mine/", "/mine/all/"]) {
      expect(await author.get(page)).not.toContain(worry);
      expect(await (await signedIn()).get(page)).not.toContain(worry);
    }
  });

  it(`refuses a worry over ${WORRY_MAX} characters, keeping what was typed`, async () => {
    const tag = marker();
    const worry = `${tag}${"w".repeat(WORRY_MAX)}`;
    const res = await (await signedIn()).declare({ description: `too worried ${tag}`, shared: "on", worry });
    expect(res.status).toBe(400);
    const html = await res.text();
    expect(html).toContain(`Keep the worry to ${WORRY_MAX} characters or fewer.`);
    expect(html).toContain(worry);
    expect(await browser().get("/")).not.toContain(`too worried ${tag}`);
  });

  it(`come back on the right Sydney day: the next for the drawer, ${WORRY_AFTER_DAYS} on for a worry (later.ts)`, () => {
    // 13:30 UTC on the 27th is already 00:30 on the 28th in Sydney
    expect(dayAfter("2026-10-27T13:30:00.000Z")).toBe("2026-10-29");
    expect(dayAfter("2026-10-27T12:30:00.000Z")).toBe("2026-10-28");
    expect(dayAfter("2026-12-31T01:00:00.000Z")).toBe("2027-01-01");
    expect(weekLater("2026-10-27T01:00:00.000Z")).toBe("2026-11-03");
    expect(weekLater("2026-02-25T01:00:00.000Z")).toBe("2026-03-04");
    // across the day Sydney's clocks go forward (4 October 2026), still seven days
    expect(weekLater("2026-10-01T03:00:00.000Z")).toBe("2026-10-08");
    expect(isDue("2026-10-28", "2026-10-27")).toBe(false);
    expect(isDue("2026-10-28", "2026-10-28")).toBe(true);
    expect(isDue("2026-10-28", "2026-11-02")).toBe(true);
  });

  it("the drawer says it's from yesterday only when it was (later.ts)", () => {
    // openFrom is the day after the note was written; today is Tuesday 3 November
    expect(drawerHeading(["2026-11-03"], "2026-11-03")).toBe("In your drawer from yesterday");
    expect(drawerHeading(["2026-10-30"], "2026-11-03")).toBe("In your drawer from Thursday");
    expect(drawerHeading(["2026-10-28"], "2026-11-03")).toBe("In your drawer");
    expect(drawerHeading(["2026-11-03", "2026-10-30"], "2026-11-03")).toBe("In your drawer");
  });

  // The app's clock can't be moved from the spec, so what shows on which day,
  // and who can put it away, is checked on db.ts itself, with its own
  // throwaway database in this test process.
  it("show from their day until put away, and only their owner can put them away (db.ts)", async () => {
    process.env.DATA_DIR = mkdtempSync(join(tmpdir(), "spec-later-"));
    const db = await import("../src/lib/db.ts");
    const { localDate } = await import("../src/lib/summary.ts");
    const owner = db.createPerson(`owner-${marker()}`);
    const other = db.createPerson(`other-${marker()}`);
    const base = { shared: false, hours: "", spans: "", crayon: "", feeling: "", notes: "" };
    const made = db.declareEnough(owner.id, { ...base, description: "a thing", worry: "the colours" });
    if (!made.ok) throw new Error(made.reason);
    const enough = made.value;
    expect(db.putInDrawer(owner.id, enough.id, "check the margins").ok).toBe(true);
    expect(db.putInDrawer(other.id, enough.id, "not mine").ok).toBe(false);

    const today = localDate(Date.now());
    expect(db.dueLater(owner.id, today)).toEqual({ drawer: [], worries: [] });
    const tomorrow = dayAfter(Date.now());
    const due = db.dueLater(owner.id, tomorrow);
    expect(due.drawer.map((n) => n.text)).toEqual(["check the margins"]);
    expect(due.drawer[0].description).toBe("a thing");
    expect(due.worries).toEqual([]);
    const week = weekLater(enough.createdAt);
    expect(db.dueLater(owner.id, week).worries.map((n) => n.text)).toEqual(["the colours"]);
    expect(db.dueLater(other.id, week)).toEqual({ drawer: [], worries: [] });

    // someone else can't put either away; the owner can, once
    const worryId = db.dueLater(owner.id, week).worries[0].id;
    expect(db.putAway(other.id, "drawer", due.drawer[0].id).ok).toBe(false);
    expect(db.putAway(other.id, "worry", worryId).ok).toBe(false);
    expect(db.dueLater(owner.id, week).drawer).toHaveLength(1);
    expect(db.putAway(owner.id, "drawer", due.drawer[0].id).ok).toBe(true);
    expect(db.putAway(owner.id, "drawer", due.drawer[0].id).ok).toBe(false);
    expect(db.putAway(owner.id, "worry", worryId).ok).toBe(true);
    expect(db.dueLater(owner.id, week)).toEqual({ drawer: [], worries: [] });

    // a tomorrow note counts as wanting to check, not as letting go
    expect(db.mine(owner.id)[0].urges).toEqual({ letGo: 0, checked: 1 });
    // deleting the enough takes what was kept for it too
    expect(db.deleteEnough(owner.id, enough.id).ok).toBe(true);
  });
});

// Reading needs nothing; every write needs an account, checked on the server.
// No streaks, rankings or public totals (CLAUDE.md): with plenty on the
// feed, the page someone reads still adds nothing up and compares no one.
// The only numbers it shows are how many are resting now, each card's own
// reply counts, and times.
describe("no totals on the feed", () => {
  it("shows no running total, streak or ranking, however much there is", async () => {
    const tag = marker();
    const author = await signedIn();
    for (let i = 0; i < 3; i++) await author.declare({ description: `count ${i} ${tag}`, shared: "on" });
    const resting = await signedIn();
    await resting.rest({ kind: "tea" });
    // what a reader sees: the page's text, without its scripts and styles
    const html = await browser().get("/");
    const text = html
      .replace(/<(script|style)[\s\S]*?<\/\1>/g, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ");
    expect(text).toContain(`count 2 ${tag}`);
    expect(text).not.toMatch(/\bstreaks?\b|in a row|leaderboard|\branks?(ed|ing)?\b|\btop \d|\bmost (rest|stop|enough)/i);
    // a number next to the feed's own nouns would be a total: "12 enoughs",
    // "5 people stopped", "3 this week"
    expect(text).not.toMatch(/\b\d+\s+(enoughs?|things|stops|records|days?|times|this (week|month)|today)\b/i);
    expect(text).not.toMatch(/\b\d+\s+(people|person)\s+(have\s+)?(stopped|called|finished|done)/i);
    await resting.rest({ end: "1" });
  });
});

describe("without an account", () => {
  it("anyone can read the feed", async () => {
    const res = await browser().send("/");
    expect(res.status).toBe(200);
  });

  it("every write is refused, and nothing is written", async () => {
    const tag = marker();
    const author = await signedIn();
    await author.declare({ description: `target ${tag}`, shared: "on" });
    const id = new RegExp(`data-enough="(\\d+)"[\\s\\S]*?target ${tag}`).exec(await author.get("/mine/all/"))?.[1] ?? "";

    // Every page that takes a POST, found in src/pages rather than listed by
    // hand, so a new write route is tried the day it's added. Signing in and
    // registering are the only writes that don't need an account.
    const routes = writeRoutes().filter((r) => r !== "/account/");
    expect(routes.length).toBeGreaterThanOrEqual(11);
    // fields each route would accept from someone signed in
    const fields: Record<string, Record<string, string>> = {
      "/enough/": { description: `anon ${tag}`, shared: "on" },
      "/comment/": { enough: id, text: `anon comment ${tag}` },
      "/reply/": { enough: id, preset: "seen" },
      "/delete/": { enough: id },
      "/report/": { comment: "1" },
      "/break/": { kind: "walk" },
      "/urge/": { enough: id, choice: "tomorrow", note: `anon note ${tag}` },
      "/put-away/": { kind: "drawer", id: "1" },
      "/work/": { action: "start", alarm: "none" },
      "/scene/": { thing: "lamp", weather: "rain" },
      "/outfit/": { head: "strawhat" },
    };
    const reader = browser();
    for (const path of routes) {
      for (const accept of ["application/json", "text/html"]) {
        const res = await reader.send(path, {
          method: "POST",
          body: new URLSearchParams(fields[path] ?? {}),
          headers: { accept },
        });
        // refused: never a success, and a redirect only ever to sign in
        expect(res.status, `${path} (${accept})`).toBeGreaterThanOrEqual(300);
        if (res.status >= 300 && res.status < 400) expect(res.headers.get("location"), path).toContain("/account/");
      }
    }
    const feed = await browser().get("/");
    expect(feed).not.toContain(`anon ${tag}`);
    expect(feed).not.toContain(`anon comment ${tag}`);
    expect(feed).toContain(`target ${tag}`);
  });
});

