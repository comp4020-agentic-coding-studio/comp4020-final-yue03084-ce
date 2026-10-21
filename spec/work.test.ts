import { describe, expect, inject, it } from "vitest";
import {
  BLOCK_FACTOR,
  DIMMEST_GLOW,
  GLOW_FACTOR,
  SLOW_EVERY_MINUTES,
  SLOWEST_SPEED,
  SPEED_FACTOR,
  YAWN_AFTER_MINUTES,
} from "../src/lib/limits.ts";
import { carriedAfterRest, localDay, localMinutes, nextAlarm, spansFor, tiredness } from "../src/lib/worktime.ts";

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
  if (shown.startsWith("Nobody")) return 0;
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

describe("the little one's picture", () => {
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

  it("recovers fully after a long enough rest, partly after a short one", () => {
    expect(carriedAfterRest(30, 10)).toBe(0);
    expect(carriedAfterRest(30, 5)).toBeCloseTo(15);
  });
});
