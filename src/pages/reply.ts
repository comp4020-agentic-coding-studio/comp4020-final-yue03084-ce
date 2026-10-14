import type { APIRoute } from "astro";
import { reply } from "../lib/db";
import { bus } from "../lib/events";
import { isPresetKey } from "../lib/limits";
import { ensurePerson } from "../lib/person";

// A preset reply to a shared enough. The feed sends it with fetch and wants
// JSON back; without script it's a plain form post, sent back to the feed.
export const POST: APIRoute = async ({ request, cookies, url, redirect }) => {
  // a POST with no form body (not one a page sends) is just refused
  const form = await request.formData().catch(() => new FormData());
  const preset = String(form.get("preset") ?? "");
  const enoughId = Number(form.get("enough"));
  const wantsJson = request.headers.get("accept")?.includes("application/json");

  const outcome =
    isPresetKey(preset) && Number.isInteger(enoughId)
      ? reply(ensurePerson(cookies, url.protocol === "https:").id, enoughId, preset)
      : ({ ok: false, reason: "Pick one of the replies." } as const);

  if (!outcome.ok) {
    return wantsJson ? Response.json({ error: outcome.reason }, { status: 400 }) : redirect("/", 303);
  }
  bus.emit("reply", outcome.value);
  return wantsJson ? Response.json(outcome.value) : redirect("/", 303);
};
