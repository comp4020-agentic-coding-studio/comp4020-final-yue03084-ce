import { defineMiddleware } from "astro:middleware";
import { inRequest, logError, logRequest, newRequestId } from "./lib/log";
import { currentPerson } from "./lib/person";

// Every request gets an id, and one log line when it's answered: method,
// path, status, time, and who (a block number) if they have a cookie. The
// event lines written while handling it carry the same id. Static assets and
// the long-lived event stream aren't logged per request: they'd drown the
// rest. A crash is logged with where it happened, then rethrown.
const quiet = (path: string) => path.startsWith("/_astro/") || path === "/favicon.svg" || path === "/api/events";

export const onRequest = defineMiddleware(async (context, next) => {
  const path = context.url.pathname;
  if (quiet(path)) return next();
  const id = newRequestId();
  return inRequest(id, async () => {
    const start = performance.now();
    try {
      const res = await next();
      const block = currentPerson(context.cookies)?.id;
      logRequest(context.request.method, path, res.status, Math.round(performance.now() - start), block);
      return res;
    } catch (err) {
      logError(`${context.request.method} ${path}`, err);
      throw err;
    }
  });
});
