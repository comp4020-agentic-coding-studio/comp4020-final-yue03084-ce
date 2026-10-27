import type { APIRoute } from "astro";
import { sceneThingAllowed } from "../lib/collection";
import { isWeather } from "../lib/limits";
import { logEvent } from "../lib/log";
import { countsFor } from "../lib/outfit";
import { signedInPerson } from "../lib/person";
import { setScene } from "../lib/scene";

// Choose what's in the little one's picture and the weather. The owner's
// alone: nothing is pushed to anyone else. A plain form; back to Working on it.
export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  // a POST with no form body (not one a page sends) is just ignored
  const form = await request.formData().catch(() => new FormData());
  // writing needs an account (signedInPerson)
  const person = signedInPerson(cookies);
  if (!person) return redirect("/account/", 303);
  const thing = String(form.get("thing") ?? "");
  const weather = String(form.get("weather") ?? "");
  // the sunflower only once it's come from their Collection
  if (!sceneThingAllowed(thing, countsFor(person.id)) || !isWeather(weather)) {
    logEvent("scene_refused", { block: person.id });
    return redirect("/working/", 303);
  }
  setScene(person.id, { thing, weather });
  logEvent("scene_chosen", { block: person.id, thing, weather });
  return redirect("/working/", 303);
};
