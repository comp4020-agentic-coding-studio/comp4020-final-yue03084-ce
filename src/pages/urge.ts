import type { APIRoute } from "astro";
import { recordUrge } from "../lib/db";
import { isUrgeChoice } from "../lib/limits";
import { signedInPerson } from "../lib/person";

// "I want to check it again": record what they chose. Private, so nothing
// goes on the stream.
export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  // a POST with no form body (not one a page sends) is just ignored
  const form = await request.formData().catch(() => new FormData());
  // writing needs an account (signedInPerson)
  const person = signedInPerson(cookies);
  const enoughId = Number(form.get("enough"));
  const choice = String(form.get("choice") ?? "");
  if (person && Number.isInteger(enoughId) && isUrgeChoice(choice)) recordUrge(person.id, enoughId, choice);
  return redirect("/mine/", 303);
};
