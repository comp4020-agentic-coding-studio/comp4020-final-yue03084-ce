import type { APIRoute } from "astro";
import { report } from "../lib/db";
import { bus } from "../lib/events";
import { ensurePerson } from "../lib/person";

// Report a comment. Once enough people have, it's hidden, and every open feed
// gets the card without it.
export const POST: APIRoute = async ({ request, cookies, url, redirect }) => {
  // a POST with no form body (not one a page sends) is just refused
  const form = await request.formData().catch(() => new FormData());
  const commentId = Number(form.get("comment"));
  const wantsJson = request.headers.get("accept")?.includes("application/json");
  const outcome = Number.isInteger(commentId)
    ? report(ensurePerson(cookies, url.protocol === "https:").id, commentId)
    : ({ ok: false, reason: "That comment isn't there." } as const);
  if (!outcome.ok) {
    return wantsJson ? Response.json({ error: outcome.reason }, { status: 400 }) : redirect("/", 303);
  }
  bus.emit("reply", outcome.value);
  return wantsJson ? Response.json({ ok: true }) : redirect("/", 303);
};
