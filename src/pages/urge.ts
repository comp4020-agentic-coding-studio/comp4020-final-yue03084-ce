import type { APIRoute } from "astro";
import { logEvent } from "../lib/log";
import { putInDrawer, recordUrge } from "../lib/db";
import { isUrgeChoice } from "../lib/limits";
import { signedInPerson } from "../lib/person";

// "I want to check it again": record what they chose. Private, so nothing
// goes on the stream. "tomorrow" also keeps their note in the drawer; the
// log never says what the note was.
export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  // a POST with no form body (not one a page sends) is just ignored
  const form = await request.formData().catch(() => new FormData());
  // writing needs an account (signedInPerson)
  const person = signedInPerson(cookies);
  if (!person) return redirect("/account/", 303);
  const enoughId = Number(form.get("enough"));
  const choice = String(form.get("choice") ?? "");
  if (Number.isInteger(enoughId) && isUrgeChoice(choice)) {
    const outcome =
      choice === "tomorrow"
        ? putInDrawer(person.id, enoughId, String(form.get("note") ?? ""))
        : recordUrge(person.id, enoughId, choice);
    logEvent(outcome.ok ? "recheck" : "recheck_refused", { block: person.id, enough: enoughId, choice });
  }
  return redirect("/mine/all/", 303);
};
