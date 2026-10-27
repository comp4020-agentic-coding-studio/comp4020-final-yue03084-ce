import type { APIRoute } from "astro";
import { checkOutfit } from "../lib/collection";
import { currentBreak } from "../lib/db";
import { emitResting } from "../lib/events";
import { OUTFIT_SLOTS } from "../lib/limits";
import { logEvent } from "../lib/log";
import { countsFor, setOutfit } from "../lib/outfit";
import { signedInPerson } from "../lib/person";

// Choose what the little one wears and has with it, from the Collection page:
// one thing per slot, or nothing. Only things its owner has unlocked, each in
// its own slot; anything else is refused whole. If they're on a break right
// now the meadow redraws, so what they show is the same everywhere. A plain
// form; back to the Collection page.
export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  // a POST with no form body (not one a page sends) is just ignored
  const form = await request.formData().catch(() => new FormData());
  // writing needs an account (signedInPerson)
  const person = signedInPerson(cookies);
  if (!person) return redirect("/account/", 303);
  const fields = Object.fromEntries(OUTFIT_SLOTS.map((slot) => [slot, String(form.get(slot) ?? "")]));
  const choice = checkOutfit(fields, countsFor(person.id));
  if (!choice.ok) {
    logEvent("outfit_refused", { block: person.id });
    return redirect("/mine/collection/?refused=1", 303);
  }
  setOutfit(person.id, choice.value);
  // item keys only: what's worn is public on the meadow anyway, progress never
  logEvent("outfit_chosen", {
    block: person.id,
    ...Object.fromEntries(OUTFIT_SLOTS.map((slot) => [slot, choice.value[slot] ?? undefined])),
  });
  if (currentBreak(person.id)) emitResting();
  return redirect("/mine/collection/", 303);
};
