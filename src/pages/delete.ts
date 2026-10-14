import type { APIRoute } from "astro";
import { deleteEnough } from "../lib/db";
import { bus } from "../lib/events";
import { currentPerson } from "../lib/person";

// Delete one of your own enoughs, from Mine. If it was on the feed, every open
// page is told to take its card away.
export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  // a POST with no form body (not one a page sends) is just ignored
  const form = await request.formData().catch(() => new FormData());
  const enoughId = Number(form.get("enough"));
  const person = currentPerson(cookies);
  if (!person || !Number.isInteger(enoughId)) return redirect("/mine/", 303);
  const outcome = deleteEnough(person.id, enoughId);
  if (outcome.ok && outcome.value.wasShared) bus.emit("removed", { id: enoughId });
  return redirect("/mine/", 303);
};
