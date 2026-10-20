import type { APIRoute } from "astro";
import { comment } from "../lib/db";
import { bus } from "../lib/events";
import { signedInPerson } from "../lib/person";

// A one-line comment on a shared enough. The feed sends it with fetch and
// wants JSON back; without script it's a plain form post, sent back to the feed.
export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  // a POST with no form body (not one a page sends) is just refused
  const form = await request.formData().catch(() => new FormData());
  const enoughId = Number(form.get("enough"));
  const wantsJson = request.headers.get("accept")?.includes("application/json");
  // writing needs an account (signedInPerson)
  const person = signedInPerson(cookies);
  if (!person) {
    return wantsJson ? Response.json({ error: "Sign in to join in." }, { status: 401 }) : redirect("/account/", 303);
  }
  const outcome = Number.isInteger(enoughId)
    ? comment(person.id, enoughId, String(form.get("text") ?? ""))
    : ({ ok: false, reason: "Write a few words first." } as const);
  if (!outcome.ok) {
    return wantsJson ? Response.json({ error: outcome.reason }, { status: 400 }) : redirect("/", 303);
  }
  // the whole public card goes out, so every open feed shows the new comment
  bus.emit("reply", outcome.value);
  return wantsJson ? Response.json(outcome.value) : redirect("/", 303);
};
