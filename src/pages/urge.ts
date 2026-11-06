import type { APIRoute } from "astro";
import { logEvent } from "../lib/log";
import { recordUrge } from "../lib/db";
import { isUrgeChoice } from "../lib/limits";
import { signedInPerson } from "../lib/person";

// "I want to check it again": record what they chose, and keep what was
// making them want to, if they wrote it, as a worry on that enough. Private,
// so nothing goes on the stream; the log never says what was written. Back
// to that enough, with its More open when a worry was kept, so they see it.
export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  // a POST with no form body (not one a page sends) is just ignored
  const form = await request.formData().catch(() => new FormData());
  // writing needs an account (signedInPerson)
  const person = signedInPerson(cookies);
  if (!person) return redirect("/account/", 303);
  const enoughId = Number(form.get("enough"));
  const choice = String(form.get("choice") ?? "");
  if (!Number.isInteger(enoughId) || !isUrgeChoice(choice)) return redirect("/mine/all/", 303);
  const outcome = recordUrge(person.id, enoughId, choice, String(form.get("note") ?? ""));
  logEvent(outcome.ok ? "recheck" : "recheck_refused", { block: person.id, enough: enoughId, choice });
  if (!outcome.ok) return redirect("/mine/all/", 303);
  return redirect(outcome.value.worried ? `/mine/all/?open=${enoughId}#enough-${enoughId}` : `/mine/all/#enough-${enoughId}`, 303);
};
