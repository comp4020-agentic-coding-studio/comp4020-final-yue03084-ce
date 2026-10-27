import { eq } from "drizzle-orm";
import { type Counts, sceneThingAllowed } from "./collection";
import { db } from "./db";
import { DEFAULT_SCENE_THING, DEFAULT_WEATHER, isWeather, type SceneThing, type Weather } from "./limits";
import { scenes } from "./schema";

// What's in a person's little picture on Working on it: one of SCENE_THINGS
// and a weather. Their own, read only for their own page; nothing here goes
// on the feed or the stream.

export interface Scene {
  thing: SceneThing;
  weather: Weather;
}

// A thing from the Collection (the sunflower) shows only while it's theirs
// (counts from countsFor in outfit.ts).
export function sceneOf(personId: number, counts: Counts): Scene {
  const row = db.select().from(scenes).where(eq(scenes.personId, personId)).get();
  return {
    thing: row && sceneThingAllowed(row.thing, counts) ? row.thing : DEFAULT_SCENE_THING,
    weather: row && isWeather(row.weather) ? row.weather : DEFAULT_WEATHER,
  };
}

export function setScene(personId: number, scene: Scene): void {
  const updatedAt = new Date().toISOString();
  db.insert(scenes)
    .values({ personId, ...scene, updatedAt })
    .onConflictDoUpdate({ target: scenes.personId, set: { ...scene, updatedAt } })
    .run();
}
