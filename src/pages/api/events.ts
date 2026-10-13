import type { APIRoute } from "astro";
import type { PublicEnough } from "../../lib/db";
import { bus } from "../../lib/events";

// Server-sent events: a long-lived streaming response the page reads with
// `new EventSource("/api/events")`. One-way (server → browser) and plain HTTP,
// which is all the feed needs: writes go up as ordinary POSTs.
export const GET: APIRoute = () => {
  let onEnough: (e: PublicEnough) => void;
  let onReply: (e: PublicEnough) => void;
  let heartbeat: ReturnType<typeof setInterval>;

  const stream = new ReadableStream<string>({
    start(controller) {
      // an opening comment so the client (and the post-deploy probe) sees
      // bytes at once, and a periodic one so proxies don't drop it as idle
      controller.enqueue(": connected\n\n");
      heartbeat = setInterval(() => controller.enqueue(": ping\n\n"), 30_000);
      onEnough = (e) => controller.enqueue(`event: enough\ndata: ${JSON.stringify(e)}\n\n`);
      onReply = (e) => controller.enqueue(`event: reply\ndata: ${JSON.stringify(e)}\n\n`);
      bus.on("enough", onEnough);
      bus.on("reply", onReply);
    },
    cancel() {
      clearInterval(heartbeat);
      bus.off("enough", onEnough);
      bus.off("reply", onReply);
    },
  });

  return new Response(stream.pipeThrough(new TextEncoderStream()), {
    headers: { "content-type": "text/event-stream", "cache-control": "no-cache" },
  });
};
