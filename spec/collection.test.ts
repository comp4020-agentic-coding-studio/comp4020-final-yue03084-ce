import { describe, expect, inject, it } from "vitest";
import {
  type Counts,
  checkOutfit,
  NO_OUTFIT,
  progressText,
  sceneThingAllowed,
  unlocked,
  wearing,
  wearsList,
} from "../src/lib/collection.ts";
import { COLLECTION } from "../src/lib/limits.ts";

// The Collection: things that come from stopping. Against the running app:
// nothing to begin with; breaks, letting go and resting at the alarm unlock
// things (an ordinary break isn't resting at the alarm); a locked thing
// can't be chosen, on /outfit/ or (the sunflower) on /scene/; what's chosen
// shows on its owner's Working on it and on the meadow, never with who, and
// nobody's progress is on the feed or the stream. And the arithmetic in
// collection.ts, which needs no app.
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
    outfit: (fields: Record<string, string>) => post("/outfit/", fields),
    declare: (fields: Record<string, string>) => post("/enough/", fields),
    urge: (enough: string, choice: string) => post("/urge/", { enough, choice }),
    register: (username: string) =>
      post("/account/", { action: "register", username, password: "a-long-enough-password" }),
  };
}

let accounts = 0;
async function signedIn() {
  const b = browser();
  const res = await b.register(`c${Date.now().toString(36)}${(accounts++).toString(36)}${Math.random().toString(36).slice(2, 6)}`);
  if (res.status !== 303) throw new Error(`couldn't register a test account: ${res.status}`);
  return b;
}

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
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        received += decoder.decode(value, { stream: true });
        if (until && received.includes(until)) break;
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

type Me = Awaited<ReturnType<typeof signedIn>>;
// n ordinary breaks, each started and ended
async function breaks(me: Me, n: number) {
  for (let i = 0; i < n; i++) {
    await me.rest({ kind: "tea" });
    await me.rest({ end: "1" });
  }
}
// n rests from the Enough alarm, each in its own work session
async function alarmRests(me: Me, n: number) {
  for (let i = 0; i < n; i++) {
    await me.work({ action: "start", tz: "0", alarm: "interval", minutes: "60" });
    await me.work({ action: "rest", kind: "walk" });
    await me.rest({ end: "1" });
    await me.work({ action: "finish" });
  }
}

// one card's progress line on the Collection page
const progressOf = (html: string, item: string) =>
  new RegExp(`data-item="${item}"[\\s\\S]*?class="progress"[^>]*>([^<]*)<`).exec(html)?.[1]?.trim();

describe("the Collection", () => {
  it("starts with nothing, and three breaks bring the straw hat", async () => {
    const me = await signedIn();
    let page = await me.get("/mine/collection/");
    for (const item of Object.keys(COLLECTION)) expect(progressOf(page, item)).not.toBe("Unlocked");
    expect(progressOf(page, "strawhat")).toBe("3 more breaks");
    await breaks(me, 2);
    page = await me.get("/mine/collection/");
    expect(progressOf(page, "strawhat")).toBe("1 more break");
    await breaks(me, 1);
    page = await me.get("/mine/collection/");
    expect(progressOf(page, "strawhat")).toBe("Unlocked");
    // and only the hat: the tabby needs more
    expect(progressOf(page, "tabby")).toBe("7 more breaks");
  });

  it("refuses something not unlocked; what's chosen shows on its owner's little one only", async () => {
    const me = await signedIn();
    const refused = await me.outfit({ head: "strawhat" });
    expect(refused.headers.get("location")).toContain("refused");
    // wrong slot is refused too, even once unlocked
    await breaks(me, 3);
    expect((await me.outfit({ neck: "strawhat" })).headers.get("location")).toContain("refused");
    expect((await me.outfit({ head: "nonsense" })).headers.get("location")).toContain("refused");
    const ok = await me.outfit({ head: "strawhat" });
    expect(ok.headers.get("location")).toBe("/mine/collection/");
    expect(await me.get("/mine/collection/")).toMatch(/name="head" value="strawhat" checked/);

    await me.work({ action: "start", tz: "0" });
    expect(await me.get("/working/")).toContain('data-w="strawhat"');
    await me.work({ action: "finish" });

    const other = await signedIn();
    await other.work({ action: "start", tz: "0" });
    expect(await other.get("/working/")).not.toContain('data-w="strawhat"');
    await other.work({ action: "finish" });
  });

  it("counts resting when the alarm rang towards the flower crown; an ordinary break doesn't", async () => {
    const me = await signedIn();
    await breaks(me, 3);
    expect(progressOf(await me.get("/mine/collection/"), "flowercrown")).toBe("3 more rests when the alarm rings");
    await alarmRests(me, 3);
    const page = await me.get("/mine/collection/");
    expect(progressOf(page, "flowercrown")).toBe("Unlocked");
    // alarm rests are breaks too
    expect(progressOf(page, "tabby")).toBe("4 more breaks");
  });

  it("counts letting a recheck go towards the scarf, not checking anyway", async () => {
    const me = await signedIn();
    await me.declare({ description: `scarf ${Date.now()}` });
    const id = /data-enough="(\d+)"/.exec(await me.get("/mine/all/"))?.[1] ?? "";
    await me.urge(id, "checked");
    await me.urge(id, "let_go");
    await me.urge(id, "let_go");
    expect(progressOf(await me.get("/mine/collection/"), "scarf")).toBe("1 more time letting it go");
    await me.urge(id, "let_go");
    expect(progressOf(await me.get("/mine/collection/"), "scarf")).toBe("Unlocked");
  });

  it("puts what a resting person wears on the meadow, never who, and nobody's progress", async () => {
    const me = await signedIn();
    await breaks(me, 3);
    await me.outfit({ head: "strawhat" });
    const received = await readStream(() => me.rest({ kind: "nap" }), "event: resting", 3_000);
    const data = JSON.parse(/event: resting\ndata: (.*)/.exec(received)?.[1] ?? "{}");
    expect(data.ones.some((o: { kind: string; wears: string[] }) => o.kind === "nap" && o.wears.includes("strawhat"))).toBe(
      true,
    );
    for (const one of data.ones) expect(Object.keys(one).sort()).toEqual(["kind", "wears"]);
    const feed = await browser().get("/");
    expect(/data-ones="([^"]*)"/.exec(feed)?.[1]).toContain("strawhat");
    // how it came, and how far along anyone is, are never public
    for (const text of [received, feed]) {
      expect(text).not.toMatch(/more breaks?|Unlocked|letting it go|alarm rings|days? here|condition|progress/);
    }
    await me.rest({ end: "1" });
  });

  it("won't let the sunflower into the picture until it's come", async () => {
    const me = await signedIn();
    await me.work({ action: "start", tz: "0" });
    let page = await me.get("/working/");
    expect(page).not.toContain('value="sunflower"');
    await me.scene({ thing: "sunflower", weather: "clear" });
    page = await me.get("/working/");
    expect(page).toContain('data-thing="lamp"');
    await me.work({ action: "finish" });
  });

  it("is for its owner: signed out, the page shows no progress, and choosing needs an account", async () => {
    const page = await browser().get("/mine/collection/");
    expect(page).toContain("Sign in");
    expect(page).not.toContain('class="progress"');
    const res = await browser().outfit({ head: "strawhat" });
    expect(res.headers.get("location")).toContain("/account/");
  });
});

const counts = (c: Partial<Counts> = {}): Counts => ({ breaks: 0, letGo: 0, alarmRests: 0, days: 0, ...c });

describe("the Collection's arithmetic", () => {
  it("unlocks each thing at its own number of times stopping, and only from stopping", () => {
    expect(unlocked(counts())).toEqual([]);
    expect(unlocked(counts({ breaks: 3 }))).toEqual(["strawhat"]);
    expect(unlocked(counts({ breaks: 10 }))).toEqual(["strawhat", "tabby"]);
    expect(unlocked(counts({ letGo: 10 }))).toEqual(["scarf", "lantern"]);
    expect(unlocked(counts({ alarmRests: 10 }))).toEqual(["flowercrown", "sunflower"]);
    expect(unlocked(counts({ days: 7 }))).toEqual(["picnic"]);
    expect(unlocked(counts({ days: 14 }))).toEqual(["picnic", "kite"]);
  });

  it("says how many more in words, never a percentage", () => {
    expect(progressText("strawhat", counts())).toBe("3 more breaks");
    expect(progressText("strawhat", counts({ breaks: 2 }))).toBe("1 more break");
    expect(progressText("strawhat", counts({ breaks: 5 }))).toBe("Unlocked");
    expect(progressText("kite", counts({ days: 13 }))).toBe("1 more day here");
    expect(progressText("lantern", counts({ letGo: 1 }))).toBe("9 more times letting it go");
    for (const item of Object.keys(COLLECTION) as (keyof typeof COLLECTION)[]) {
      expect(progressText(item, counts())).not.toMatch(/%|streak|in a row|score/);
    }
  });

  it("checks a choice: only unlocked things, each in its own slot", () => {
    const c = counts({ breaks: 3 });
    expect(checkOutfit({ head: "strawhat" }, c)).toEqual({ ok: true, value: { ...NO_OUTFIT, head: "strawhat" } });
    expect(checkOutfit({ head: "" }, c)).toEqual({ ok: true, value: NO_OUTFIT });
    expect(checkOutfit({ head: "flowercrown" }, c).ok).toBe(false);
    expect(checkOutfit({ neck: "strawhat" }, c).ok).toBe(false);
    expect(checkOutfit({ head: "crown" }, c).ok).toBe(false);
  });

  it("stops showing something that's no longer theirs, and lists what's worn as keys", () => {
    const chosen = { ...NO_OUTFIT, head: "strawhat" as const, neck: "scarf" as const };
    expect(wearing(chosen, counts({ breaks: 3 }))).toEqual({ ...NO_OUTFIT, head: "strawhat" });
    expect(wearsList(wearing(chosen, counts({ breaks: 3, letGo: 3 })))).toEqual(["strawhat", "scarf"]);
  });

  it("offers the sunflower in the picture only once it's come", () => {
    expect(sceneThingAllowed("sunflower", counts({ alarmRests: 9 }))).toBe(false);
    expect(sceneThingAllowed("sunflower", counts({ alarmRests: 10 }))).toBe(true);
    expect(sceneThingAllowed("plant", counts())).toBe(true);
    expect(sceneThingAllowed("strawhat", counts({ breaks: 3 }))).toBe(false);
  });
});
