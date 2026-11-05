import type { APIRoute } from "astro";
import { logEvent } from "../lib/log";
import { writeSince } from "../lib/db";
import { signedInPerson } from "../lib/person";

// What someone makes of a worry now, in a line, kept beside it on History:
// any time, though History asks a week on. Their own worry only. Private, so
// nothing goes on the stream; the log never says what was written.
export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  // a POST with no form body (not one a page sends) is just ignored
  const form = await request.formData().catch(() => new FormData());
  // writing needs an account (signedInPerson)
  const person = signedInPerson(cookies);
  if (!person) return redirect("/account/", 303);
  const id = Number(form.get("worry"));
  const enoughId = Number(form.get("enough"));
  if (Number.isInteger(id)) {
    const outcome = writeSince(person.id, id, String(form.get("since") ?? ""));
    logEvent(outcome.ok ? "worry_looked_back" : "worry_looked_back_refused", { block: person.id, worry: id });
  }
  return redirect(Number.isInteger(enoughId) && enoughId > 0 ? `/mine/all/#enough-${enoughId}` : "/mine/all/", 303);
};
