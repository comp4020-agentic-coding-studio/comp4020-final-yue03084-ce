import type { APIRoute } from "astro";
import { logEvent } from "../lib/log";
import { startBreak } from "../lib/db";
import { emitResting } from "../lib/events";
import { isBreakKind } from "../lib/limits";
import { signedInPerson } from "../lib/person";
import { finishWork, parseAlarm, parseTz, pauseWork, snooze, startWork } from "../lib/work";

// A work session from Mine: start (with an optional Enough alarm), "Give me
// 10 more minutes", "Okay, go and rest" (a break, through the same break as
// anywhere else, so the feed's resting count goes up), and finish (to Call it
// enough, with the time bar filled in). The owner's alone; nothing about it
// goes on the stream except the resting count a break changes.
export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  // a POST with no form body (not one a page sends) is just ignored
  const form = await request.formData().catch(() => new FormData());
  const wantsJson = request.headers.get("accept")?.includes("application/json");
  // writing needs an account (signedInPerson)
  const person = signedInPerson(cookies);
  if (!person) {
    return wantsJson ? Response.json({ error: "Sign in to join in." }, { status: 401 }) : redirect("/account/", 303);
  }
  const field = (name: string) => String(form.get(name) ?? "");
  const action = field("action");

  if (action === "start") {
    const alarm = parseAlarm(field("alarm"), field("minutes"), field("clock"));
    startWork(person.id, parseTz(field("tz")), alarm);
    logEvent("work_started", { block: person.id, alarm: alarm ? alarm.kind : "none" });
  } else if (action === "snooze") {
    snooze(person.id);
    logEvent("alarm_snoozed", { block: person.id });
  } else if (action === "rest") {
    const kind = field("kind");
    if (isBreakKind(kind)) {
      startBreak(person.id, kind, null);
      pauseWork(person.id, kind);
      logEvent("break_started", { block: person.id, kind, from: "alarm" });
      emitResting();
    }
  } else if (action === "finish") {
    const outcome = finishWork(person.id);
    if (outcome.ok) {
      logEvent("work_finished", { block: person.id, session: outcome.value.id });
      return redirect(`/enough/?session=${outcome.value.id}`, 303);
    }
  }
  return wantsJson ? Response.json({ ok: true }) : redirect("/working/", 303);
};
