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
export const PRESET_REPLIES = {
  seen: "Seen. You can put it down.",
  rest: "Go and rest.",
  enough: "That's enough.",
} as const;
export type PresetKey = keyof typeof PRESET_REPLIES;
export const isPresetKey = (key: string): key is PresetKey => Object.hasOwn(PRESET_REPLIES, key);

// How it felt, asked towards "enough", never as a score. Private.
export const FEELINGS = ["I gave it my all", "More than I thought", "Just enough"] as const;
