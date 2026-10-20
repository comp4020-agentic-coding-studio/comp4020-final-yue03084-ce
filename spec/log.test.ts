import { describe, expect, it } from "vitest";
import { inRequest, logEvent, logRequest } from "../src/lib/log.ts";

// The log's shape: one line per event, tagged with its request, who as a
// block number. What it must never hold (anything someone wrote, a username,
// a password) is checked against the running app in spec/enough.test.ts's
// neighbour, spec/account.test.ts; here, the format the crit narrates from.
function capture(run: () => void): string[] {
  const lines: string[] = [];
  const original = console.log;
  console.log = (...args: unknown[]) => lines.push(args.join(" "));
  try {
    run();
  } finally {
    console.log = original;
  }
  return lines;
}

describe("the log", () => {
  it("writes one line per event, key=value, tagged with its request", () => {
    const lines = capture(() =>
      inRequest("a3f9c1", () => {
        logRequest("POST", "/comment/", 303, 6, 6);
        logEvent("comment_added", { block: 6, enough: 12, comment: 3 });
      }),
    );
    expect(lines).toEqual(["[a3f9c1] POST /comment/ 303 6ms block=6", "[a3f9c1] comment_added block=6 enough=12 comment=3"]);
  });

  it("leaves out missing values and quotes ones with spaces", () => {
    const [line] = capture(() => logEvent("register_refused", { block: undefined, reason: "That username is taken." }));
    expect(line).toBe('register_refused reason="That username is taken."');
  });
});
