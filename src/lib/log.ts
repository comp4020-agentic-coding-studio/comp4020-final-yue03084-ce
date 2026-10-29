import { AsyncLocalStorage } from "node:async_hooks";
import { randomBytes } from "node:crypto";

// The app's log: one line per event, to stdout, which Fly collects
// (`mise exec -- flyctl logs -a comp4020-final-yue03084-ce`). Each line says
// who and what, tagged with the request it happened in, so a request and the
// events inside it read together:
//
//   [a3f9c1] POST /comment/ 303 6ms block=6
//   [a3f9c1] comment_added block=6 enough=12 comment=3
//
// Who is a block number: the account id, from which the feed's name
// ("Sage pebble", names.ts) is made. Never a username,
// password, cookie or token, and never what someone wrote: no description,
// notes, hours, feeling or comment text. CLAUDE.md: "Logs say who did what,
// never what they wrote".

const requests = new AsyncLocalStorage<{ id: string }>();

export const newRequestId = () => randomBytes(3).toString("hex");
export const inRequest = <T>(id: string, run: () => T): T => requests.run({ id }, run);

type Field = string | number | boolean | null | undefined;

// `key=value` pairs; values with spaces are quoted, missing ones left out
const fields = (data: Record<string, Field>) =>
  Object.entries(data)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]) => `${k}=${typeof v === "string" && /\s/.test(v) ? JSON.stringify(v) : v}`)
    .join(" ");

function line(text: string): void {
  const id = requests.getStore()?.id;
  console.log(id ? `[${id}] ${text}` : text);
}

// One meaningful thing someone did, e.g. logEvent("enough_called", { block: 5, enough: 12, shared: true }).
export function logEvent(name: string, data: Record<string, Field> = {}): void {
  const rest = fields(data);
  line(rest ? `${name} ${rest}` : name);
}

// One request, written when it's answered.
export function logRequest(method: string, path: string, status: number, ms: number, block?: number): void {
  line(`${method} ${path} ${status} ${ms}ms${block ? ` block=${block}` : ""}`);
}

// Something went wrong: what and where, enough to find it again, never a secret.
export function logError(where: string, err: unknown): void {
  const message = err instanceof Error ? err.message : String(err);
  line(`error at=${where} ${fields({ message })}`);
  if (err instanceof Error && err.stack) console.error(err.stack);
}
