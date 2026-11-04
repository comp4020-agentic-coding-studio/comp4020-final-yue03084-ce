import { describe, expect, inject, it } from "vitest";
import {
  BLOCK_FACTOR,
  DIMMEST_GLOW,
  GLOW_FACTOR,
  SLOW_EVERY_MINUTES,
  SLOWEST_SPEED,
  SPEED_FACTOR,
  TOWER_AT_ALARM,
  TOWER_HEIGHT,
  TOWER_PLAN_MINUTES,
  TOWER_WIDTH,
  YAWN_AFTER_MINUTES,
} from "../src/lib/limits.ts";
import {
  bricksLaid,
  carriedAfterRest,
  localDay,
  localMinutes,
  nextAlarm,
  sleepyEffort,
  spansFor,
  tiredness,
  towerPlan,
} from "../src/lib/worktime.ts";
import { CROUCH_BELOW, KEEPER, LADDER_ABOVE, ladderRows, reachFor } from "../src/lib/sprites.ts";

// Work sessions, the little one and the Enough alarm. Against the running
// app: they're the owner's alone (never on the feed or the stream, another
// person's ?session= fills in nothing), one open session per person, snoozes
// counted only for the owner, resting from a session raises the public
// resting count. And the arithmetic in worktime.ts, which needs no app: the
// spans a session fills in leave out breaks, the decline curve, the alarm.
const baseUrl = inject("baseUrl");

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
    work: (fields: Record<string, string>) => post("/work/", fields),
    rest: (fields: Record<string, string>) => post("/break/", fields),
    scene: (fields: Record<string, string>) => post("/scene/", fields),
    register: (username: string) =>
      post("/account/", { action: "register", username, password: "a-long-enough-password" }),
  };
}

let accounts = 0;
async function signedIn() {
  const b = browser();
  const res = await b.register(`w${Date.now().toString(36)}${(accounts++).toString(36)}${Math.random().toString(36).slice(2, 6)}`);
  if (res.status !== 303) throw new Error(`couldn't register a test account: ${res.status}`);
  return b;
}

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

// the time bar's spans as the form carries them
const spansIn = (html: string) => /name="spans" value="([^"]*)"/.exec(html)?.[1] ?? "";

const restingCount = (html: string) => {
  const shown = /id="resting"[^>]*>\s*([^<]*)/.exec(html)?.[1] ?? "";
  // nobody resting is an empty line
  if (!shown.trim()) return 0;
  const n = /^(\d+)/.exec(shown);
  return n ? Number(n[1]) : Number.NaN;
};

describe("a work session", () => {
  it("finishes into Call it enough with the time bar filled in, for its owner only", async () => {
    const me = await signedIn();
    await me.work({ action: "start", tz: "660", alarm: "interval", minutes: "90" });
    const done = await me.work({ action: "finish" });
    expect(done.status).toBe(303);
    const to = done.headers.get("location") ?? "";
    expect(to).toMatch(/\/enough\/\?session=\d+$/);
    const filled = spansIn(await me.get(to));
    expect(filled).toMatch(/^\d+-\d+$/);

    // anyone else asking for that session gets an empty bar
    const other = await signedIn();
    expect(spansIn(await other.get(to))).toBe("");
  });

  it("is one at a time: starting again while working changes nothing", async () => {
    const me = await signedIn();
    await me.work({ action: "start", tz: "0" });
    await me.work({ action: "start", tz: "0" });
    const first = await me.work({ action: "finish" });
    expect(first.headers.get("location")).toMatch(/session=/);
    // nothing left open to finish
    const second = await me.work({ action: "finish" });
    expect(second.headers.get("location")).toBe("/working/");
  });

  it("never reaches the feed or the stream, and snoozes show only on the owner's Mine", async () => {
    const me = await signedIn();
    const received = await readStream(async () => {
      await me.work({ action: "start", tz: "660", alarm: "interval", minutes: "60" });
      await me.work({ action: "snooze" });
      await me.work({ action: "snooze" });
    }, 1_500);
    for (const word of ["snooze", "alarm", "work_session", "sleepy", "Working"]) expect(received).not.toContain(word);

    const mine = await me.get("/working/");
    expect(mine).toContain("10 more minutes 2 times");
    const feed = await browser().get("/");
    expect(feed).not.toContain("more minutes");
    expect(await (await signedIn()).get("/working/")).not.toContain("more minutes 2 times");
    await me.work({ action: "finish" });
  });

  it("resting from the alarm raises the public resting count, and coming back resumes work", async () => {
    const before = restingCount(await browser().get("/"));
    const me = await signedIn();
    await me.work({ action: "start", tz: "0", alarm: "interval", minutes: "1" });
    await me.work({ action: "rest", kind: "tea" });
    expect(restingCount(await browser().get("/"))).toBe(before + 1);
    expect(await me.get("/working/")).toContain("On a break");

    await me.rest({ end: "1", back: "/working/" });
    expect(restingCount(await browser().get("/"))).toBe(before);
    const back = await me.get("/working/");
    expect(back).toContain(">Building<");
    await me.work({ action: "finish" });
  });

  it("finishing after a break still fills in a valid stretch of the day", async () => {
    const me = await signedIn();
    await me.work({ action: "start", tz: "-300" });
    await me.work({ action: "rest", kind: "walk" });
    await me.rest({ end: "1", back: "/working/" });
    const done = await me.work({ action: "finish" });
    const filled = spansIn(await me.get(done.headers.get("location") ?? ""));
    for (const part of filled.split(",")) {
      const [from, to] = part.split("-").map(Number);
      expect(to).toBeGreaterThan(from);
      expect(from % 30).toBe(0);
    }
  });

  it("without an account, can't start", async () => {
    const res = await browser().work({ action: "start", tz: "0" });
    expect(res.headers.get("location")).toContain("/account/");
  });
});

// what the little one's picture holds, read off the page: the attributes the
// server rendered, and the radio button checked in each group
const sceneIn = (html: string) => ({
  thing: /data-thing="([a-z]+)"/.exec(html)?.[1],
  weather: /data-weather="([a-z]+)"/.exec(html)?.[1],
  checkedThing: /name="thing" value="([a-z]+)" checked/.exec(html)?.[1],
  checkedWeather: /name="weather" value="([a-z]+)" checked/.exec(html)?.[1],
});

// what the page hands the little one's script for the tower
const towerIn = (html: string) => ({
  minutes: Number(/data-tower-minutes="([\d.]+)"/.exec(html)?.[1]),
  worked: Number(/data-worked="([\d.]+)"/.exec(html)?.[1]),
});

describe("the little one's tower", () => {
  it("starts again from nothing each session, planned to that session's alarm", async () => {
    const me = await signedIn();
    await me.work({ action: "start", tz: "0", alarm: "interval", minutes: "30" });
    await new Promise((r) => setTimeout(r, 1200));
    const first = towerIn(await me.get("/working/"));
    expect(first.minutes).toBe(30);
    expect(first.worked).toBeGreaterThan(0);
    await me.work({ action: "finish" });
    // a second session the same day: a new tower, at its own pace
    await me.work({ action: "start", tz: "0", alarm: "interval", minutes: "120" });
    const second = towerIn(await me.get("/working/"));
    expect(second.minutes).toBe(120);
    expect(second.worked).toBeLessThan(first.worked);
    await me.work({ action: "finish" });
    // no alarm: the default plan
    await me.work({ action: "start", tz: "0" });
    expect(towerIn(await me.get("/working/")).minutes).toBe(TOWER_PLAN_MINUTES);
    await me.work({ action: "finish" });
  });
});

describe("the little one's picture", () => {
  // The picker changes the picture on the page at once (its script sets
  // data-thing and data-weather), so every choice has to be drawn already.
  it("draws every choice, so a new one shows at once, and still keeps it through the form", async () => {
    const me = await signedIn();
    await me.work({ action: "start", tz: "660" });
    const html = await me.get("/working/");
    for (const part of ["for-lamp", "for-plant", "weather rain", "weather snow"]) expect(html, part).toContain(`class="${part}"`);
    // the sunflower only once it's theirs, as before
    expect(html).not.toContain('class="for-sunflower"');
    expect((await me.scene({ thing: "plant", weather: "rain" })).status).toBe(303);
    expect(sceneIn(await me.get("/working/"))).toMatchObject({ thing: "plant", weather: "rain" });
    // its script takes the button away rather than hiding it: the site's
    // button style would show a hidden one (2026-11-04)
    expect(html).toMatch(/querySelector\(.button.\)\?\.remove\(\)/);
    await me.work({ action: "finish" });
  });

  // Keep it beside you moves this picture into a small window of its own
  // (WorkPanel's script). The button is hidden until the script finds a
  // browser that can, so a page without it never offers what it can't do.
  it("offers to keep it beside you while working or resting, hidden until the browser can", async () => {
    const me = await signedIn();
    // not before starting: there is no little one yet
    expect(await me.get("/working/")).not.toMatch(/<button[^>]*keep-beside/);
    await me.work({ action: "start", tz: "660" });
    for (const html of [await me.get("/working/"), (await me.work({ action: "rest", kind: "walk" }), await me.get("/working/"))]) {
      const button = /<button[^>]*keep-beside[^>]*>([^<]*)</.exec(html);
      expect(button?.[1]).toBe("Keep it beside you");
      expect(button?.[0]).toContain("hidden");
      // the picture sits in the place it comes back to
      expect(html).toMatch(/class="little-one-home"[^>]*>\s*<figure[^>]*class="little-one"/);
    }
    await me.rest({ end: "1", back: "/working/" });
    await me.work({ action: "finish" });
  });

  it("keeps what you choose, after a reload and the next time you work", async () => {
    const me = await signedIn();
    await me.work({ action: "start", tz: "660" });
    // before choosing: the lamp, clear skies
    expect(sceneIn(await me.get("/working/"))).toMatchObject({ thing: "lamp", weather: "clear" });

    const res = await me.scene({ thing: "plant", weather: "snow" });
    expect(res.status).toBe(303);
    expect(sceneIn(await me.get("/working/"))).toEqual({
      thing: "plant",
      weather: "snow",
      checkedThing: "plant",
      checkedWeather: "snow",
    });
    // it belongs to the account, not to one session
    await me.work({ action: "finish" });
    await me.work({ action: "start", tz: "660" });
    expect(sceneIn(await me.get("/working/"))).toMatchObject({ thing: "plant", weather: "snow" });
    await me.work({ action: "finish" });
  });

  it("ignores a choice that isn't on the list", async () => {
    const me = await signedIn();
    await me.work({ action: "start", tz: "0" });
    await me.scene({ thing: "window", weather: "rain" });
    await me.scene({ thing: "candle", weather: "rain" });
    await me.scene({ thing: "plant", weather: "hail" });
    expect(sceneIn(await me.get("/working/"))).toMatchObject({ thing: "window", weather: "rain" });
    await me.work({ action: "finish" });
  });

  it("can't be changed without an account, and is never anyone else's", async () => {
    const res = await browser().scene({ thing: "plant", weather: "rain" });
    expect(res.headers.get("location")).toContain("/account/");

    const me = await signedIn();
    const other = await signedIn();
    await me.work({ action: "start", tz: "0" });
    await other.work({ action: "start", tz: "0" });
    await me.scene({ thing: "plant", weather: "rain" });
    expect(sceneIn(await other.get("/working/"))).toMatchObject({ thing: "lamp", weather: "clear" });
    await me.work({ action: "finish" });
    await other.work({ action: "finish" });
  });

  it("never reaches the feed or the stream", async () => {
    const me = await signedIn();
    await me.work({ action: "start", tz: "0" });
    const received = await readStream(() => me.scene({ thing: "plant", weather: "snow" }), 1_000);
    for (const word of ["plant", "snow", "scene", "weather"]) expect(received).not.toContain(word);
    const feed = await browser().get("/");
    for (const word of ["data-thing", "data-weather", "A little plant", "/scene/"]) expect(feed).not.toContain(word);
    await me.work({ action: "finish" });
  });
});

describe("work arithmetic (worktime.ts)", () => {
  const at = (iso: string) => Date.parse(iso);

  it("fills in the working stretches in local time, leaving the break out", () => {
    // 09:00–10:00 local, a break, then 10:30–11:30, in Canberra summer (UTC+11)
    const spans = spansFor(
      [
        { from: at("2026-10-19T22:00:00Z"), to: at("2026-10-19T23:00:00Z") },
        { from: at("2026-10-19T23:30:00Z"), to: at("2026-10-20T00:30:00Z") },
      ],
      660,
    );
    expect(spans).toEqual([
      { from: 540, to: 600 },
      { from: 630, to: 690 },
    ]);
  });

  it("rounds to the nearest half hour, at least one slot", () => {
    expect(spansFor([{ from: at("2026-10-20T09:07:00Z"), to: at("2026-10-20T09:12:00Z") }], 0)).toEqual([
      { from: 540, to: 570 },
    ]);
  });

  it("knows the local day and minute", () => {
    expect(localMinutes(at("2026-10-20T13:30:00Z"), 660)).toBe(30);
    expect(localDay(at("2026-10-20T13:30:00Z"), 660)).toBe("2026-10-21");
  });

  it("rings an interval from the start, and a clock time at its next reading, once", () => {
    const start = at("2026-10-20T00:00:00Z");
    expect(nextAlarm({ kind: "interval", minutes: 90 }, start, 0, false)).toBe(start + 90 * 60_000);
    expect(nextAlarm({ kind: "clock", minute: 60 }, start, 0, false)).toBe(start + 60 * 60_000);
    // a clock time already passed today is tomorrow's, and once rung it doesn't repeat
    expect(nextAlarm({ kind: "clock", minute: 0 }, start + 60_000, 0, false)).toBe(start + 24 * 60 * 60_000);
    expect(nextAlarm({ kind: "clock", minute: 60 }, start, 0, true)).toBeNull();
  });

  it("slows by a factor each step past the alarm, yawns later, never stops", () => {
    expect(tiredness(0)).toEqual({ sleepy: false, speed: 1, block: 1, glow: 1, yawning: false });
    const one = tiredness(SLOW_EVERY_MINUTES);
    expect(one.speed).toBeCloseTo(SPEED_FACTOR);
    expect(one.block).toBeCloseTo(BLOCK_FACTOR);
    expect(one.glow).toBeCloseTo(GLOW_FACTOR);
    expect(one.yawning).toBe(false);
    expect(tiredness(YAWN_AFTER_MINUTES).yawning).toBe(true);
    expect(tiredness(10_000).speed).toBe(SLOWEST_SPEED);
    // the lamp dims with it but never goes out
    expect(tiredness(10_000).glow).toBe(DIMMEST_GLOW);
  });

  it("plans the tower to the alarm: few big blocks for a short stretch, many small bricks for a long one", () => {
    const short = towerPlan(10);
    const half = towerPlan(30);
    const long = towerPlan(180);
    expect(short.before).toBeLessThan(half.before);
    expect(half.before).toBeLessThan(long.before);
    for (const p of [short, half, long]) {
      // two thirds of the way up at the alarm, and it all fits in the picture
      expect(p.layersBefore * p.height).toBeLessThanOrEqual(TOWER_HEIGHT * TOWER_AT_ALARM);
      expect(p.layersBefore * p.height).toBeGreaterThan(TOWER_HEIGHT * TOWER_AT_ALARM - p.height);
      const after = (p.capacity - p.before) / p.perLayer;
      expect(p.layersBefore * p.height + after * p.sleepyHeight).toBeLessThanOrEqual(TOWER_HEIGHT);
      expect(p.perLayer * p.width).toBeLessThanOrEqual(TOWER_WIDTH);
      // past the alarm the bricks are thinner
      expect(p.sleepyHeight).toBeLessThanOrEqual(p.height);
    }
  });

  it("lays bricks at an even pace to the alarm, then slower, and stops when full", () => {
    const p = towerPlan(30);
    expect(bricksLaid(p, 0)).toBe(0);
    expect(bricksLaid(p, 15)).toBe(Math.floor(p.before / 2));
    expect(bricksLaid(p, 30)).toBe(p.before);
    // the first SLOW_EVERY_MINUTES past the alarm are still full speed
    // (tiredness()), so compare twenty minutes: fewer bricks after, and thinner
    const before = bricksLaid(p, 30) - bricksLaid(p, 10);
    const after = bricksLaid(p, 50) - bricksLaid(p, 30);
    expect(after).toBeLessThan(before);
    expect(after * p.sleepyHeight).toBeLessThan(before * p.height);
    expect(sleepyEffort(SLOW_EVERY_MINUTES)).toBeCloseTo(SLOW_EVERY_MINUTES);
    expect(sleepyEffort(2 * SLOW_EVERY_MINUTES)).toBeCloseTo(SLOW_EVERY_MINUTES * (1 + SPEED_FACTOR));
    expect(bricksLaid(p, 100_000)).toBe(p.capacity);
  });

  it("recovers fully after a long enough rest, partly after a short one", () => {
    expect(carriedAfterRest(30, 10)).toBe(0);
    expect(carriedAfterRest(30, 5)).toBeCloseTo(15);
  });
});

// How it tends the tower, by its height in pixels (sprites.ts): crouched
// for a low one, standing, then up a ladder that grows with it.
describe("reaching the top of the tower (sprites.ts)", () => {
  it("crouches for a low tower, stands for a middling one, climbs a ladder for a tall one", () => {
    expect(reachFor(0).how).toBe("crouch");
    expect(reachFor(CROUCH_BELOW - 1).how).toBe("crouch");
    expect(reachFor(CROUCH_BELOW).how).toBe("stand");
    expect(reachFor(LADDER_ABOVE).how).toBe("stand");
    expect(reachFor(LADDER_ABOVE + 1)).toEqual({ how: "ladder", lift: LADDER_ABOVE - 9 });
    expect(reachFor(46).lift).toBeLessThanOrEqual(26);
  });

  it("puts a rung under its feet and the ladder's foot on the grass", () => {
    for (const lift of [5, 12, 26]) {
      const rows = ladderRows(lift);
      // its feet are `lift` above the grass; the ladder starts 6 above them
      expect(rows).toHaveLength(lift + 7);
      expect(rows[6]).toBe("NnnnnnnN");
      expect(rows.every((r) => r.startsWith("N") && r.endsWith("N"))).toBe(true);
    }
  });

  it("has a crouched knock for each look, fresh to nearly asleep", () => {
    for (const name of ["ctap1", "ctap2", "ctap1~1", "ctap2~1", "ctap1~2", "ctap2~2"]) expect(KEEPER.frames[name], name).toHaveLength(24);
  });
});

// The status bar under the nav (StatusBar.astro) is the one place to take a
// break, come back or finish, on every page, for its owner only. Neither
// the feed nor Together has its own any more, so there's never two of one.
describe("the status bar", () => {
  const PAGES = ["/", "/working/", "/enough/", "/mine/", "/mine/all/", "/mine/collection/", "/account/", "/readme/"];
  const bar = (html: string) => /<section class="status"[\s\S]*?<\/section>/.exec(html)?.[0] ?? "";
  const count = (html: string, re: RegExp) => (html.match(re) ?? []).length;

  it("isn't there for someone signed out", async () => {
    for (const path of PAGES) expect(bar(await browser().get(path)), path).toBe("");
  });

  it("says where you are on every page: free, working or on a break, never how long", async () => {
    const me = await signedIn();
    for (const path of PAGES) {
      const free = bar(await me.get(path));
      expect(free, path).toContain("Take a break:");
      expect(free, path).not.toContain("Finish");
      expect(free, path).not.toContain("I'm back");
    }
    await me.work({ action: "start", tz: "660" });
    for (const path of PAGES) {
      const working = bar(await me.get(path));
      expect(working, path).toContain("Working");
      expect(working, path).toContain("Finish");
      expect(working, path).toContain("Take a break:");
    }
    await me.rest({ kind: "nap", back: "/working/" });
    for (const path of PAGES) {
      const resting = bar(await me.get(path));
      expect(resting, path).toContain("On a break (nap)");
      expect(resting, path).toContain("I'm back");
      expect(resting, path).not.toContain("Take a break:");
      expect(resting, path).not.toMatch(/\d+\s*(min|hour|h\b)/);
    }
    await me.rest({ end: "1" });
    await me.work({ action: "finish" });
  });

  it("is the only way to rest, come back or finish on a page", async () => {
    const me = await signedIn();
    expect(count(await me.get("/"), /action="\/break\/"/g)).toBe(1);
    await me.work({ action: "start", tz: "660" });
    const working = await me.get("/working/");
    expect(count(working, /name="action" value="finish"/g)).toBe(1);
    // the alarm's own overlay rests too, but only when it rings: not here, with no alarm
    expect(count(working, /action="\/break\/"/g)).toBe(1);
    await me.rest({ kind: "tea" });
    for (const path of ["/", "/working/"]) expect(count(await me.get(path), />I'm back</g), path).toBe(1);
    await me.rest({ end: "1" });
    await me.work({ action: "finish" });
  });

  // Its choices are submit buttons drawn as links, so they must undo the
  // site's filled submit-button hover, or "I'm back" turns into a black box
  // (2026-11-04). Read from the page's own CSS: the rule clears the fill.
  it("keeps its choices as links on hover, never a filled button", async () => {
    const me = await signedIn();
    const html = await me.get("/");
    // the page's styles, inline and in the files it links
    let css = html;
    for (const [, href] of html.matchAll(/<link rel="stylesheet" href="(\/[^"]+)"/g)) css += await me.get(href);
    const hover = /\.status-link[^{,]*:hover[^{]*\{([^}]*)\}/.exec(css)?.[1] ?? "";
    // "none", or "0 0" as the build writes it
    expect(hover).toMatch(/background:\s*(none|0 0)/);
    expect(hover).toContain("underline");
  });

  it("comes back to the page it was sent from", async () => {
    const me = await signedIn();
    const res = await me.rest({ kind: "walk", back: "/mine/" });
    expect(res.headers.get("location")).toBe("/mine/");
    expect((await me.rest({ end: "1", back: "/working/" })).headers.get("location")).toBe("/working/");
  });
});
