import type { APIRoute } from "astro";
import { logEvent } from "../lib/log";
import { endBreak, restingNow, startBreak } from "../lib/db";
import { bus } from "../lib/events";
import { isBreakKind } from "../lib/limits";
import { signedInPerson } from "../lib/person";
import { pauseWork, resumeWork } from "../lib/work";

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
  if (form.get("end")) {
    card = endBreak(person.id);
    resumeWork(person.id); // a work session on pause picks up again
    logEvent("break_ended", { block: person.id });
  } else {
    const kind = String(form.get("kind") ?? "");
    if (!isBreakKind(kind)) return redirect(to, 303);
    const enough = Number(form.get("enough"));
    const outcome = startBreak(person.id, kind, Number.isInteger(enough) && enough > 0 ? enough : null);
    if (outcome.ok) card = outcome.value;
    pauseWork(person.id, kind); // and a work session going pauses
    logEvent("break_started", { block: person.id, kind, after: card ? card.id : undefined });
  }
  const resting = restingNow();
  logEvent("resting_now", { count: resting });
  bus.emit("resting", { count: resting });
  if (card) bus.emit("reply", card);
  return redirect(to, 303);
};
