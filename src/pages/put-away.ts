import type { APIRoute } from "astro";
import { logEvent } from "../lib/log";
import { putAway } from "../lib/db";
import { signedInPerson } from "../lib/person";

// "Put it away": the reminder for a week-old worry, the owner's own only; the
// worry stays on its enough. Private, so nothing goes on the stream; back to
// the page it came from.
export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  // a POST with no form body (not one a page sends) is just ignored
  const form = await request.formData().catch(() => new FormData());
  const back = form.get("back") === "/mine/all/" ? "/mine/all/" : "/mine/";
  // writing needs an account (signedInPerson)
  const person = signedInPerson(cookies);
  if (!person) return redirect("/account/", 303);
  const id = Number(form.get("id"));
  if (Number.isInteger(id)) {
    const outcome = putAway(person.id, id);
    logEvent(outcome.ok ? "put_away" : "put_away_refused", { block: person.id, id });
  }
  return redirect(back, 303);
};
