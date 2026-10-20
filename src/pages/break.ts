import type { APIRoute } from "astro";
import { endBreak, restingNow, startBreak } from "../lib/db";
import { bus } from "../lib/events";
import { isBreakKind } from "../lib/limits";
import { signedInPerson } from "../lib/person";

// Start or end a break. Every open feed hears the new resting count, and if
// the break follows a shared enough, that card's "went for a walk" / "back".
export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  // a POST with no form body (not one a page sends) is just ignored
  const form = await request.formData().catch(() => new FormData());
  // writing needs an account (signedInPerson)
  const person = signedInPerson(cookies);
  if (!person) return redirect("/account/", 303);
  const back = String(form.get("back") ?? "/");
  const to = back.startsWith("/") && !back.startsWith("//") ? back : "/";
  let card = null;
  if (form.get("end")) card = endBreak(person.id);
  else {
    const kind = String(form.get("kind") ?? "");
    if (!isBreakKind(kind)) return redirect(to, 303);
    const enough = Number(form.get("enough"));
    const outcome = startBreak(person.id, kind, Number.isInteger(enough) && enough > 0 ? enough : null);
    if (outcome.ok) card = outcome.value;
  }
  bus.emit("resting", { count: restingNow() });
  if (card) bus.emit("reply", card);
  return redirect(to, 303);
};
