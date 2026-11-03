import type { APIRoute } from "astro";
import { ICON_SIZES } from "../lib/icon";
import { SITE_NAME } from "../lib/limits";

// What a phone or a computer needs to add the site to its home screen and
// open it in a window of its own, without the browser's bar. Nothing is kept
// offline: every page still comes from the server, so what's shown is never stale.
export const GET: APIRoute = () =>
  new Response(
    JSON.stringify({
      name: SITE_NAME,
      short_name: SITE_NAME,
      description: "Record when something is enough, and rest alongside other people.",
      start_url: "/",
      scope: "/",
      display: "standalone",
      background_color: "#ffffff",
      theme_color: "#ffffff",
      icons: ICON_SIZES.filter((s) => s !== 180).map((s) => ({
        src: `/icon-${s}.png`,
        sizes: `${s}x${s}`,
        type: "image/png",
        purpose: "any",
      })),
    }),
    { headers: { "content-type": "application/manifest+json", "cache-control": "public, max-age=3600" } },
  );
