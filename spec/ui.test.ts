import { JSDOM } from "jsdom";
import { describe, expect, inject, it } from "vitest";
import { NOTE_COLOURS } from "../src/lib/limits";

// The look, as far as the server's HTML can show it: every page says it has
// a light and a dark scheme, the note colours' dark shades come from
// NOTE_COLOURS, and the home page keeps its scene and its caption.
const baseUrl = inject("baseUrl");
const page = async (path: string) => new JSDOM(await (await fetch(new URL(path, baseUrl))).text()).window.document;

describe("the look", () => {
  it("every page offers light and dark", async () => {
    for (const path of ["/", "/enough/", "/working/", "/mine/", "/account/", "/readme/"]) {
      const doc = await page(path);
      expect(doc.querySelector('meta[name="color-scheme"]')?.getAttribute("content"), path).toBe("light dark");
    }
  });

  it("writes the note colours' dark shades from NOTE_COLOURS", async () => {
    const css = [...(await page("/")).querySelectorAll("style")].map((s) => s.textContent).join("\n");
    expect(css).toContain("prefers-color-scheme: dark");
    for (const [key, c] of Object.entries(NOTE_COLOURS)) expect(css).toContain(`--c-${key}: ${c.dark};`);
  });

  it("keeps the home scene and its caption, hidden from screen readers", async () => {
    const scene = (await page("/")).querySelector(".scene");
    expect(scene?.getAttribute("aria-hidden")).toBe("true");
    expect(scene?.querySelector("figcaption")?.textContent).toBe("Live with imperfection.");
    expect(scene?.querySelectorAll(".one")).toHaveLength(2);
  });
});
