import { JSDOM } from "jsdom";
import { describe, expect, inject, it } from "vitest";
import { NOTE_COLOURS } from "../src/lib/limits";

// The look, as far as the server's HTML can show it: every page says it has
// a light and a dark scheme, the note colours' dark shades come from
// NOTE_COLOURS, and the home page keeps its scene, now without a caption.
const baseUrl = inject("baseUrl");
const page = async (path: string, cookie = "") =>
  new JSDOM(await (await fetch(new URL(path, baseUrl), { headers: cookie ? { cookie } : {} })).text()).window.document;

// a signed-in browser's cookie, so the pages that are forms only for an
// account (Call it enough, Mine) show them
async function signedInCookie() {
  const res = await fetch(new URL("/account/", baseUrl), {
    method: "POST",
    redirect: "manual",
    headers: { "sec-fetch-site": "same-origin" },
    body: new URLSearchParams({
      action: "register",
      username: `ui${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
      password: "a-long-enough-password",
    }),
  });
  if (res.status !== 303) throw new Error(`couldn't register a test account: ${res.status}`);
  return (res.headers.get("set-cookie") ?? "").split(";")[0];
}

const PAGES = ["/", "/enough/", "/working/", "/mine/", "/mine/all/", "/mine/collection/", "/account/", "/readme/"];

describe("the look", () => {
  it("every page offers light and dark", async () => {
    for (const path of PAGES) {
      const doc = await page(path);
      expect(doc.querySelector('meta[name="color-scheme"]')?.getAttribute("content"), path).toBe("light dark");
    }
  });

  it("writes the note colours' dark shades from NOTE_COLOURS", async () => {
    const css = [...(await page("/")).querySelectorAll("style")].map((s) => s.textContent).join("\n");
    expect(css).toContain("prefers-color-scheme: dark");
    for (const [key, c] of Object.entries(NOTE_COLOURS)) expect(css).toContain(`--c-${key}: ${c.dark};`);
  });

  // The two little ones head the page; the hand-written caption went in the
  // plain restyle (2026-10-29), and the h1 is there for screen readers only.
  it("keeps the home scene, hidden from screen readers, and a hidden h1", async () => {
    const doc = await page("/");
    const scene = doc.querySelector(".scene");
    expect(scene?.getAttribute("aria-hidden")).toBe("true");
    expect(scene?.querySelector("figcaption")).toBeNull();
    expect(scene?.querySelectorAll(".one")).toHaveLength(2);
    expect(doc.querySelector("h1")?.classList.contains("visually-hidden")).toBe(true);
  });

  // A screen reader moves by headings: one h1 names the page, and no level is skipped.
  it("every page has one h1 and no skipped heading levels, signed in or not", async () => {
    const cookie = await signedInCookie();
    for (const who of ["", cookie]) {
      for (const path of PAGES) {
        const doc = await page(path, who);
        expect(doc.querySelectorAll("h1"), path).toHaveLength(1);
        const levels = [...doc.querySelectorAll("h1, h2, h3, h4, h5, h6")]
          .filter((h) => !h.closest('[aria-hidden="true"]'))
          .map((h) => Number(h.tagName[1]));
        levels.forEach((n, i) => {
          if (i > 0) expect(n, `${path}: h${levels[i - 1]} then h${n}`).toBeLessThanOrEqual(levels[i - 1] + 1);
        });
        expect(doc.documentElement.lang, path).toBe("en-AU");
      }
    }
  });

  // Every control a person fills in says what it's for, and every group of
  // radios is a fieldset with a legend.
  it("every form control has a label and every radio group a legend", async () => {
    const cookie = await signedInCookie();
    // the account forms are for someone signed out; the rest for someone signed in
    for (const [path, who] of [["/enough/", cookie], ["/working/", cookie], ["/mine/collection/", cookie], ["/account/", ""]]) {
      const doc = await page(path, who);
      const controls = [...doc.querySelectorAll("input:not([type=hidden]), select, textarea")];
      // a new account has nothing in its Collection yet, so no outfit form there
      if (path !== "/mine/collection/") expect(controls.length, path).toBeGreaterThan(0);
      for (const c of controls) {
        const labelled =
          c.closest("label") ||
          c.getAttribute("aria-label") ||
          c.getAttribute("aria-labelledby") ||
          (c.id && doc.querySelector(`label[for="${c.id}"]`));
        expect(labelled, `${path}: ${c.outerHTML.slice(0, 80)}`).toBeTruthy();
      }
      for (const r of doc.querySelectorAll("input[type=radio]")) {
        expect(r.closest("fieldset")?.querySelector("legend")?.textContent?.trim(), `${path}: radio ${r.getAttribute("name")}`).toBeTruthy();
      }
    }
  });

  // The pictures are decoration: hidden from screen readers, the meaning in the text beside them.
  it("keeps the pixel pictures hidden and the resting count polite", async () => {
    const doc = await page("/");
    for (const fig of doc.querySelectorAll(".scene, .meadow")) expect(fig.getAttribute("aria-hidden")).toBe("true");
    expect(doc.getElementById("resting")?.getAttribute("aria-live")).toBe("polite");
  });
});
