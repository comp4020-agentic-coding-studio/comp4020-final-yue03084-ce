// The site's name, read by every page title.
export const SITE_NAME = "Crooked Tower";

// Every number the app enforces lives here, once. The form, the server check
// and any message about a limit all read these (CLAUDE.md: "Moderation numbers
// live in one place").

// How long the public one-line description of the thing can be.
export const DESCRIPTION_MAX = 60;

// How long a free-text reply can be (replies are preset-only in v1).
export const REPLY_MAX = 30;

// How many reports hide a reply (reporting isn't built yet).
export const REPORTS_TO_HIDE = 3;

// The preset replies, keyed so the database stores the key, not the wording.
// The keys stay as they were when the wording changed, so replies already
// given keep counting under the new words.
export const PRESET_REPLIES = {
  seen: "You've done a lot.",
  rest: "It's okay to stop here.",
  enough: "Proud of you.",
} as const;
export type PresetKey = keyof typeof PRESET_REPLIES;
export const isPresetKey = (key: string): key is PresetKey => Object.hasOwn(PRESET_REPLIES, key);

// How it felt, asked towards "enough", never as a score. Private.
export const FEELINGS = ["I gave it my all", "More than I thought", "Just enough"] as const;

// The colours the notes editor offers: muted, Morandi-style, each with a light
// and a dark shade that keep text readable on the card (4.5:1 or better). The
// notes store the key, never a hex, so the page and the sanitiser read the
// same list and the shade follows the theme.
export const NOTE_COLOURS = {
  sage: { label: "Sage", light: "#5e7360", dark: "#a9bba8" },
  rose: { label: "Dusty rose", light: "#9a6064", dark: "#d4a5a6" },
  mist: { label: "Mist blue", light: "#5a6f82", dark: "#a7b8c7" },
  clay: { label: "Clay", light: "#8a6a45", dark: "#d1b48f" },
} as const;
export type NoteColour = keyof typeof NOTE_COLOURS;
export const isNoteColour = (key: string): key is NoteColour => Object.hasOwn(NOTE_COLOURS, key);
// the crayon the time bar starts with
export const DEFAULT_CRAYON: NoteColour = "clay";

// How long the formatted notes can be, counted as stored HTML.
export const NOTES_MAX = 20_000;

// The time bar: the size of one cell a person colours in, and the range of the
// day it can cover, in minutes since midnight.
export const SLOT_MINUTES = 30;
export const DAY_MINUTES = 24 * 60;
// what the bar shows before someone changes it: 9:00 to 18:00
export const DEFAULT_RANGE = { from: 9 * 60, to: 18 * 60 } as const;
