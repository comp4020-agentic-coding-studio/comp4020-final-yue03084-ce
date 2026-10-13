import sanitizeHtml from "sanitize-html";
import { NOTE_COLOURS } from "./limits";

// The private notes are formatted in the browser and arrive as HTML, so the
// server keeps only what the editor can make: paragraphs, bold, italic,
// lists, and a colour from NOTE_COLOURS as a class. Anything else (a script,
// a link, an inline style, an unknown colour) is dropped before it's stored.
const colourClasses = Object.keys(NOTE_COLOURS).map((key) => `c-${key}`);

export function cleanNotes(html: string): string {
  const cleaned = sanitizeHtml(html, {
    allowedTags: ["p", "br", "strong", "em", "ul", "ol", "li", "span"],
    allowedAttributes: { span: ["class"] },
    allowedClasses: { span: colourClasses },
  });
  // an editor left empty still sends <p></p>
  return cleaned.replace(/<p>\s*<\/p>/g, "").trim();
}

// Notes written before the editor are plain text: show them as they were.
export const isHtml = (notes: string) => /^<(p|ul|ol)[\s>]/.test(notes);
