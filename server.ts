// The whole app: one Node process, node:sqlite on the /data volume, no deps.
// Provisional stack for crit 8; PROCESS.md says why.
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";

const PORT = Number(process.env.PORT ?? 8080);
const DATA_DIR = process.env.DATA_DIR ?? "/data";

mkdirSync(DATA_DIR, { recursive: true });
const db = new DatabaseSync(`${DATA_DIR}/app.db`);
db.exec(`
  PRAGMA journal_mode = WAL;
  -- one table for everyone: a visitor is a person from their first nickname;
  -- registering later only adds credentials to the same row
  CREATE TABLE IF NOT EXISTS people (
    id TEXT PRIMARY KEY,
    nickname TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  -- show -> scene -> level
  CREATE TABLE IF NOT EXISTS shows (id TEXT PRIMARY KEY, name TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS scenes (
    id TEXT PRIMARY KEY,
    show_id TEXT NOT NULL REFERENCES shows(id),
    name TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS levels (
    id INTEGER PRIMARY KEY,
    scene_id TEXT NOT NULL REFERENCES scenes(id),
    author_id TEXT REFERENCES people(id), -- null: set by the platform
    part TEXT NOT NULL,                   -- the part that was swapped
    variant TEXT NOT NULL,                -- what it was swapped for
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  -- every click is kept, right or wrong, so later features can replay them
  CREATE TABLE IF NOT EXISTS clicks (
    id INTEGER PRIMARY KEY,
    level_id INTEGER NOT NULL REFERENCES levels(id),
    person_id TEXT NOT NULL REFERENCES people(id),
    part TEXT NOT NULL,
    correct INTEGER NOT NULL,
    at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// Platform content. Parts and variants are drawn client-side in index.html.
db.exec(`
  INSERT OR IGNORE INTO shows VALUES ('friends', 'Friends');
  INSERT OR IGNORE INTO scenes VALUES ('monica', 'friends', 'Monica''s apartment');
  INSERT OR IGNORE INTO levels (id, scene_id, part, variant) VALUES
    (1, 'monica', 'frame', 'square'),
    (2, 'monica', 'fridge', 'red'),
    (3, 'monica', 'door', 'green');
`);
const PARTS = ["window", "fridge", "table", "couch", "door", "frame"];
// wrong clicks on a level before its answer is shown to that person
const REVEAL_AFTER = 5;

function cookie(req: IncomingMessage, name: string): string | undefined {
  for (const pair of (req.headers.cookie ?? "").split(";")) {
    const [k, ...v] = pair.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return undefined;
}

type Person = { id: string; nickname: string };

function currentPerson(req: IncomingMessage): Person | undefined {
  const id = cookie(req, "pid");
  if (!id) return undefined;
  return db.prepare("SELECT id, nickname FROM people WHERE id = ?").get(id) as Person | undefined;
}

async function body(req: IncomingMessage): Promise<Record<string, unknown>> {
  let raw = "";
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 10_000) throw new Error("body too large");
  }
  try {
    const parsed: unknown = JSON.parse(raw || "{}");
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function json(res: ServerResponse, status: number, data: unknown, headers: Record<string, string> = {}): void {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", ...headers });
  res.end(JSON.stringify(data));
}

function levelList(person: Person | undefined) {
  return db
    .prepare(
      `SELECT l.id, s.name AS scene, sh.name AS show,
         (SELECT COUNT(DISTINCT person_id) FROM clicks WHERE level_id = l.id AND correct = 1) AS solvers,
         (SELECT COUNT(*) FROM clicks WHERE level_id = l.id AND person_id = ?) AS my_clicks,
         (SELECT COUNT(*) FROM clicks WHERE level_id = l.id AND person_id = ? AND correct = 1) > 0 AS solved,
         (SELECT COUNT(*) FROM clicks WHERE level_id = l.id AND person_id = ? AND correct = 0) AS my_wrong
       FROM levels l JOIN scenes s ON s.id = l.scene_id JOIN shows sh ON sh.id = s.show_id
       ORDER BY l.id`,
    )
    .all(person?.id ?? "", person?.id ?? "", person?.id ?? "")
    .map((l) => ({ ...l, revealed: !l.solved && Number(l.my_wrong) >= REVEAL_AFTER }));
}

// The answer, once this person has missed REVEAL_AFTER times without finding it
function revealedAnswer(levelId: number, part: string, person: Person | undefined): string | undefined {
  if (!person) return undefined;
  const { wrong, right } = db
    .prepare(
      `SELECT SUM(correct = 0) AS wrong, SUM(correct = 1) AS right
       FROM clicks WHERE level_id = ? AND person_id = ?`,
    )
    .get(levelId, person.id) as { wrong: number | null; right: number | null };
  return !right && (wrong ?? 0) >= REVEAL_AFTER ? part : undefined;
}

const escapeHtml = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// Just enough markdown for the README: headings, lists, paragraphs, links,
// images, emphasis and code. No script runs at /readme/, so it's rendered here.
function markdown(md: string): string {
  // odd-numbered pieces of a backtick split are code spans, left unformatted
  const inline = (s: string): string =>
    s
      .split("`")
      .map((piece, i) =>
        i % 2
          ? `<code>${escapeHtml(piece)}</code>`
          : escapeHtml(piece)
              .replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, '<img alt="$1" src="/$2">')
              .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2">$1</a>')
              .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
              .replace(/\*([^*]+)\*/g, "<em>$1</em>"),
      )
      .join("");
  const out: string[] = [];
  let para: string[] = [];
  let list = false;
  const flush = (): void => {
    if (para.length) out.push(`<p>${inline(para.join(" "))}</p>`);
    para = [];
  };
  const src = md.replace(/<!--[\s\S]*?-->/g, "");
  for (const line of src.split(/\r?\n/)) {
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    const li = line.match(/^\s*[-*]\s+(.*)$/);
    if (!li && list) {
      out.push("</ul>");
      list = false;
    }
    if (h) {
      flush();
      out.push(`<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`);
    } else if (li) {
      flush();
      if (!list) out.push("<ul>");
      list = true;
      out.push(`<li>${inline(li[1])}</li>`);
    } else if (line.trim() === "") {
      flush();
    } else {
      para.push(line.trim());
    }
  }
  flush();
  if (list) out.push("</ul>");
  return out.join("\n");
}

function readmePage(): string {
  return `<!doctype html>
<html lang="en-AU"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>About Spot the Swap</title>
<style>body{font:16px/1.6 system-ui,sans-serif;max-width:40rem;margin:2rem auto;padding:0 16px;color:#222;background:#fdfbf7}img{max-width:100%}a{color:#6a4fa0}</style>
</head><body><p><a href="/">← back to the game</a></p><main>${markdown(readFileSync("README.md", "utf8"))}</main></body></html>`;
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  const path = url.pathname;
  try {
    if (req.method === "GET" && path === "/") {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(readFileSync("public/index.html"));
      return;
    }
    if (req.method === "GET" && (path === "/readme/" || path === "/readme")) {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(readmePage());
      return;
    }
    if (path === "/api/me" && req.method === "GET") {
      json(res, 200, { person: currentPerson(req) ?? null });
      return;
    }
    if (path === "/api/me" && req.method === "POST") {
      const nickname = String((await body(req)).nickname ?? "").trim().slice(0, 40);
      if (!nickname) return json(res, 400, { error: "nickname required" });
      const existing = currentPerson(req);
      if (existing) {
        db.prepare("UPDATE people SET nickname = ? WHERE id = ?").run(nickname, existing.id);
        return json(res, 200, { person: { id: existing.id, nickname } });
      }
      const id = randomUUID();
      db.prepare("INSERT INTO people (id, nickname) VALUES (?, ?)").run(id, nickname);
      // a year-long cookie is the "browser credential" that remembers them
      return json(res, 200, { person: { id, nickname } }, {
        "set-cookie": `pid=${id}; Path=/; Max-Age=31536000; HttpOnly; SameSite=Lax`,
      });
    }
    if (path === "/api/levels" && req.method === "GET") {
      json(res, 200, { levels: levelList(currentPerson(req)) });
      return;
    }
    const level = path.match(/^\/api\/levels\/(\d+)(\/click)?$/);
    if (level) {
      const row = db.prepare("SELECT id, part, variant FROM levels WHERE id = ?").get(Number(level[1])) as
        | { id: number; part: string; variant: string }
        | undefined;
      if (!row) return json(res, 404, { error: "no such level" });
      if (!level[2] && req.method === "GET") {
        return json(res, 200, {
          id: row.id,
          swaps: { [row.part]: row.variant },
          answer: revealedAnswer(row.id, row.part, currentPerson(req)),
        });
      }
      if (level[2] && req.method === "POST") {
        const person = currentPerson(req);
        if (!person) return json(res, 401, { error: "pick a nickname first" });
        const part = String((await body(req)).part ?? "");
        if (!PARTS.includes(part) && part !== "background") return json(res, 400, { error: "unknown part" });
        const correct = part === row.part;
        db.prepare("INSERT INTO clicks (level_id, person_id, part, correct) VALUES (?, ?, ?, ?)").run(
          row.id,
          person.id,
          part,
          correct ? 1 : 0,
        );
        return json(res, 200, { correct, answer: revealedAnswer(row.id, row.part, person) });
      }
    }
    json(res, 404, { error: "not found" });
  } catch (err) {
    console.error(err);
    if (!res.headersSent) json(res, 500, { error: "server error" });
  }
});

server.listen(PORT, "0.0.0.0", () => console.log(`listening on :${PORT}, data in ${DATA_DIR}`));
