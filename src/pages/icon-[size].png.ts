import type { APIRoute } from "astro";
import { iconPng, isIconSize } from "../lib/icon";

// The little one as an icon, at /icon-180.png, /icon-192.png and
// /icon-512.png (icon.ts). The same picture every time, so browsers keep it.
export const GET: APIRoute = ({ params }) => {
  const size = Number(params.size);
  if (!isIconSize(size)) return new Response("No icon at that size", { status: 404 });
  return new Response(new Uint8Array(iconPng(size)), {
    headers: { "content-type": "image/png", "cache-control": "public, max-age=86400" },
  });
};
