import type { APIRoute } from "astro";
import { logEvent } from "../lib/log";
import { report } from "../lib/db";
import { bus } from "../lib/events";
import { signedInPerson } from "../lib/person";

// Report a comment. Once enough people have, it's hidden, and every open feed
// gets the card without it.
export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  // a POST with no form body (not one a page sends) is just refused
  const form = await request.formData().catch(() => new FormData());
  const commentId = Number(form.get("comment"));
  const wantsJson = request.headers.get("accept")?.includes("application/json");
  // writing needs an account (signedInPerson)
  const person = signedInPerson(cookies);
  if (!person) {
    return wantsJson ? Response.json({ error: "Sign in to join in." }, { status: 401 }) : redirect("/account/", 303);
  }
  const outcome = Number.isInteger(commentId)
    ? report(person.id, commentId)
    : ({ ok: false, reason: "That comment isn't there." } as const);
  if (!outcome.ok) {
    return wantsJson ? Response.json({ error: outcome.reason }, { status: 400 }) : redirect("/", 303);
  }
  // hidden: the comment no longer appears on the card everyone gets
  const hidden = !outcome.value.comments.some((c) => c.id === commentId);
  logEvent("comment_reported", { block: person.id, comment: commentId, hidden });
  bus.emit("reply", outcome.value);
  return wantsJson ? Response.json({ ok: true }) : redirect("/", 303);
};
