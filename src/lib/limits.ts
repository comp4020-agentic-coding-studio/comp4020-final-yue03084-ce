// The site's name, read by every page title.
export const SITE_NAME = "Crooked Tower";

// Every number the app enforces lives here, once. The form, the server check
// and any message about a limit all read these (CLAUDE.md: "Moderation numbers
// live in one place").

// How long the public one-line description of the thing can be.
export const DESCRIPTION_MAX = 60;

// How long a one-line comment on someone's enough can be.
export const REPLY_MAX = 30;

// How many people reporting a comment hide it from everyone.
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
// what the comment box says before anyone types, to point the tone at kindness
export const COMMENT_PROMPT = "Say something to the person who stopped…";
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

// What people go and do when they take a break. Preset only, so nothing on the
// feed needs moderating; the key is stored, the words shown. "going" reads
// after "went to …" on a card, "back" after someone returns.
export const BREAK_KINDS = {
  walk: { label: "Go for a walk", going: "went for a walk", back: "back from a walk" },
  tea: { label: "Make a cup of tea", going: "made a cup of tea", back: "back from tea" },
  nap: { label: "Have a nap", going: "went for a nap", back: "back from a nap" },
  move: { label: "Move a bit", going: "went to move a bit", back: "back from moving" },
  watch: { label: "Watch something", going: "went to watch something", back: "back from watching something" },
} as const;
export type BreakKind = keyof typeof BREAK_KINDS;
export const isBreakKind = (key: string): key is BreakKind => Object.hasOwn(BREAK_KINDS, key);
// a break nobody ended counts as over after this long, so "resting now" stays true
export const BREAK_MAX_MINUTES = 120;

// What someone can choose when they want to go back and check something
// they already called enough.
export const URGE_CHOICES = { let_go: "Okay, I'll leave it", checked: "I'll check it anyway" } as const;
export type UrgeChoice = keyof typeof URGE_CHOICES;
export const isUrgeChoice = (key: string): key is UrgeChoice => Object.hasOwn(URGE_CHOICES, key);

// Accounts (optional). Usernames are 3–30 letters, digits, _ or -.
export const USERNAME_MIN = 3;
export const USERNAME_MAX = 30;
export const PASSWORD_MIN = 8;
// Failed logins allowed per username in a window, before refusing for a while.
export const LOGIN_ATTEMPTS = 5;
export const LOGIN_WINDOW_MINUTES = 15;

// Working, and the little one on Mine who works alongside you. How it slows
// down after your alarm is a metaphor we chose for diminishing returns, not
// something measured: past the alarm, every SLOW_EVERY_MINUTES it moves at
// SPEED_FACTOR of its speed and carries blocks BLOCK_FACTOR of the size, down
// to a floor so it never stops; it yawns after YAWN_AFTER_MINUTES. A break of
// RECOVER_MINUTES or more restores it fully, a shorter one partly.
export const SLOW_EVERY_MINUTES = 10;
export const SPEED_FACTOR = 0.7;
export const BLOCK_FACTOR = 0.8;
export const YAWN_AFTER_MINUTES = 20;
export const RECOVER_MINUTES = 10;
export const SLOWEST_SPEED = 0.25;
export const SMALLEST_BLOCK = 0.35;
// one block on the day's tower for this much work (never shown as a number),
// up to TOWER_MAX blocks drawn. While the page is open the little one also
// lays blocks you can watch, one a trip; on a reload the tower is redrawn
// from the time worked, so the two agree roughly, not exactly.
export const BLOCK_EVERY_MINUTES = 3;
export const TOWER_MAX = 30;
// how long one trip to the tower takes when it's fresh
export const CARRY_SECONDS = 4;
// the Enough alarm: quick intervals to pick from, the longest allowed, and how
// long "Give me 10 more minutes" waits before asking again
export const ALARM_INTERVALS = [60, 90, 120] as const;
export const ALARM_MAX_MINUTES = 12 * 60;
export const SNOOZE_MINUTES = 10;
