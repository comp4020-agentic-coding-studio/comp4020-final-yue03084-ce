import type { APIRoute } from "astro";
import { logEvent } from "../lib/log";
import { writeLookBack } from "../lib/db";
import { signedInPerson } from "../lib/person";

// How an enough's worries look now, in a line, kept under them on History:
// one for the whole enough, any time, though a reminder on You asks a week
// on. Their own enough only. Private, so nothing goes on the stream; the log
// never says what was written. Back to that enough, its More open.
export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  // a POST with no form body (not one a page sends) is just ignored
  const form = await request.formData().catch(() => new FormData());
  // writing needs an account (signedInPerson)
  const person = signedInPerson(cookies);
  if (!person) return redirect("/account/", 303);
  const enoughId = Number(form.get("enough"));
  if (!Number.isInteger(enoughId) || enoughId <= 0) return redirect("/mine/all/", 303);
  const outcome = writeLookBack(person.id, enoughId, String(form.get("text") ?? ""));
  logEvent(outcome.ok ? "worry_looked_back" : "worry_looked_back_refused", { block: person.id, enough: enoughId });
  return redirect(`/mine/all/?open=${enoughId}#enough-${enoughId}`, 303);
};
