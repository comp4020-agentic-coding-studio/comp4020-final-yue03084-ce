import {
  COLLECTION,
  COLLECTION_WAYS,
  type CollectionItem,
  type CollectionWay,
  isCollectionItem,
  isSceneThing,
  OUTFIT_SLOTS,
  type OutfitSlot,
  SCENE_THINGS,
  type SceneThing,
} from "./limits";

// The Collection's arithmetic, with no database: what a person's counts of
// stopping have unlocked, how far along each thing is (in words, for its
// owner alone), and whether a choice of what to show is allowed. Every count
// is of stopping: breaks, letting a recheck go, resting at the alarm, days
// here. Never work, never in a row (CLAUDE.md: "No streaks, rankings or
// public totals"). db access is in outfit.ts.

export type Counts = Record<CollectionWay, number>;
export type Outfit = Record<OutfitSlot, CollectionItem | null>;
export const NO_OUTFIT: Outfit = { head: null, neck: null, held: null, companion: null, ground: null, sky: null };

export const ITEMS = Object.keys(COLLECTION) as CollectionItem[];

export const isUnlocked = (item: CollectionItem, counts: Counts) => {
  const { what, n } = COLLECTION[item].condition;
  return counts[what] >= n;
};

export const unlocked = (counts: Counts): CollectionItem[] => ITEMS.filter((item) => isUnlocked(item, counts));

// "Unlocked", or how many more of its way of stopping: "2 more breaks",
// "1 more day here". Never a percentage or a bar.
export function progressText(item: CollectionItem, counts: Counts): string {
  const { what, n } = COLLECTION[item].condition;
  const left = n - counts[what];
  if (left <= 0) return "Unlocked";
  const way = COLLECTION_WAYS[what];
  return `${left} more ${left === 1 ? way.one : way.many}`;
}

// The things that can go in each slot, in the order they're listed.
export const itemsFor = (slot: OutfitSlot): CollectionItem[] => ITEMS.filter((item) => COLLECTION[item].kind === slot);

export type Choice = { ok: true; value: Outfit } | { ok: false; reason: string };

// A choice from the form, one field per slot, "" for nothing. Refused whole if
// any slot names something that isn't there, isn't for that slot, or hasn't
// come yet.
export function checkOutfit(fields: Partial<Record<string, string>>, counts: Counts): Choice {
  const value: Outfit = { ...NO_OUTFIT };
  for (const slot of OUTFIT_SLOTS) {
    const key = fields[slot] ?? "";
    if (key === "") continue;
    if (!isCollectionItem(key) || COLLECTION[key].kind !== slot) return { ok: false, reason: "That doesn't go there." };
    if (!isUnlocked(key, counts)) return { ok: false, reason: "That one hasn't come yet." };
    value[slot] = key;
  }
  return { ok: true, value };
}

// What someone shows, from what they chose, keeping only what's still theirs
// (a deleted enough takes its rechecks with it, so a count can go down).
export function wearing(outfit: Outfit, counts: Counts): Outfit {
  const out: Outfit = { ...NO_OUTFIT };
  for (const slot of OUTFIT_SLOTS) {
    const item = outfit[slot];
    if (item && COLLECTION[item].kind === slot && isUnlocked(item, counts)) out[slot] = item;
  }
  return out;
}

// The same as a plain list of item keys, for the meadow.
export const wearsList = (outfit: Outfit): CollectionItem[] =>
  OUTFIT_SLOTS.map((slot) => outfit[slot]).filter((item): item is CollectionItem => item !== null);

// The scene things someone can choose for their picture: the plain ones, and
// any from the Collection they've unlocked.
export const sceneThingsFor = (counts: Counts): SceneThing[] =>
  (Object.keys(SCENE_THINGS) as SceneThing[]).filter((key) => !isCollectionItem(key) || isUnlocked(key, counts));

export const sceneThingAllowed = (key: string, counts: Counts): key is SceneThing =>
  isSceneThing(key) && sceneThingsFor(counts).includes(key);
