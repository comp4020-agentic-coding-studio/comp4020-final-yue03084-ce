# Rules for the agent

Every rule here carries the failure it came from, so a later reader can tell a
dead rule from a live one. Rules marked *(from crit 7)* were carried over on
purpose from the crit 7 harness (most of them it had already taken from A2)
because they don't depend on that stack.

## Decisions I've already made

- README.md, PROCESS.md and `reflections/` are mine. The agent must not write
  them in one go on its own. It may suggest an outline, ask questions to guide
  me and point out gaps. I write the content in Chinese; the agent polishes it
  into English, keeping my meaning, and I confirm the final version before it
  goes into the file.
- **Show stopping, never finishing.** What other people see is someone
  stopping: "enough" on one thing, or taking time away. Never what they
  finished, how many things, how long they spent or how much they put in.
  *(The app is for perfectionists who pace themselves by the people around
  them; seeing others finish pushes some people to work harder, which is the
  opposite of the point. Decided 2026-10-12.)*
- **Effort and check records are private.** How much someone put in (hours,
  the coloured-in spans), how it felt, which parts they checked, and each time
  they wanted to check again are visible only to that person. What's public is
  the "enough" itself, a one-line description, replies and comments, how many
  people are on a break, and what someone went to do after a shared "enough".
  Never how long a break lasted. *(Same reason: these are the numbers people
  compare. Decided 2026-10-12; breaks added 2026-10-14.)*
- **Writing needs an account; reading doesn't.** Anyone can read the feed,
  the resting count and comments. Calling something enough, replying,
  commenting, reporting, a break, a recheck and deleting all need an account,
  checked on the server by one function (`signedInPerson`) in every write
  route. The username is never public, and neither is who wrote what: on
  the feed each enough and each comment has its own name, a colour and a
  thing ("Sage pebble") made from its own id by `displayName` in
  `src/lib/names.ts`. *(Records kept only in a cookie are lost with the
  browser, and a done list has to last; markers also come back the next day.
  Decided 2026-10-20. Until 2026-10-29 everyone was "A block #N", one name
  per person; that read as a database id, and it let anyone count how often
  one person stopped, the comparison this app avoids.)*
- **Logs say who did what, never what they wrote.** Every request gets one
  line, and every meaningful action an event line (`src/lib/log.ts`,
  `src/middleware.ts`), tagged with the request id. Who is a block number (the account id, which
  the feed never shows).
  Never a username, password, cookie or token, and never a description,
  notes, hours, feeling or comment text. *(Crit 10 is narrated from the logs
  alone, and the logs outlive it. A log line is read by whoever reads the
  logs, so it holds nothing a person wouldn't want there. Decided
  2026-10-21.)*
- **No streaks, rankings or public totals.** Nothing that rewards keeping
  going or compares people. Counts for a person's own look back (how many
  times they checked a project) are allowed, shown only to them. *(These
  features turn a record into another source of anxiety. Decided 2026-10-11.)*
- **The Collection unlocks only from stopping.** Its things (`COLLECTION` in
  `src/lib/limits.ts`, arithmetic in `src/lib/collection.ts`) come from
  breaks taken, letting a recheck go, resting when the alarm rang
  (`breaks.from_alarm`, recorded from 2026-10-27 on) and days used, added up
  and never in a row or reset. Never from work hours, tower height or
  bricks. How far along someone is stays on their own `/mine/collection/`;
  what they choose to wear is public on the meadow, as item keys, never who
  and never how it came. *(The same reason as no streaks: a reward for
  working is a reason to keep working. Decided 2026-10-27.)*
- **Numbers live in one place.** The comment length limit (30 characters),
  how many reports hide a comment (3), and how long an unended break counts
  as going (120 minutes), and the drawer note and worry lengths and the
  worry's week (`DRAWER_MAX`, `WORRY_MAX`, `WORRY_AFTER_DAYS`) are each one
  constant in `src/lib/limits.ts`, read
  by the page, the server and any message about them. *(A limit enforced in
  two places will drift; see "One fact, one piece of code".)*

## The brief, verbatim

Quoted, not paraphrased: a requirement restated in the author's own words is no
longer the requirement. *(from crit 7)* Checked against the raw text of the
[final project page](https://comp.anu.edu.au/courses/comp4020-agentic-coding-studio/assessments/final-project/)
with `curl` on 2026-10-12.

- "Make a multi-user, real-time website that's good."
- "Multi-user: two or more people, each in their own browser, act on shared
  state, and the app tells them apart."
- "Real-time: a change one person makes appears in every other open session
  showing it within about a second, with no reload or other action by the
  viewer."
- "Persists: what someone does in your app is still there when they, or
  anyone else, come back, across sessions, restarts and redeploys."

## Hard limits from the course

- The app runs on one machine with 256 MB of memory, and persistent data can
  only be written to `/data`.
- `/readme/` must render README.md in full without relying on client-side
  scripts.
- Run `pnpm check` before committing and pushing; only push when it's green.

## How to work in here

- **Don't `cd`.** Put the directory in the command instead: `pnpm -C <repo>`,
  `git -C <repo>`, absolute paths. The shell's working directory persists
  between tool calls, and `git` run in a different repo fails silently where
  `pnpm` fails loudly. *(from crit 7; on 2026-10-12 a `cd notes` left the
  session's working directory in the wrong place.)*
- **Before trusting a measurement, know which build and which database it
  read.** There are three: `pnpm dev` (database in `.data/`), the built server
  that `pnpm test` boots on a free port with a throwaway `DATA_DIR` (or
  whatever app `APP_URL` points at, as in CI), and Fly (database
  `/data/enough.db` on the volume). A probe prints what it measured. If it
  says nothing changed, suspect the probe before the code. *(from crit 7,
  where a stale build and a reused browser tab each reported a working fix as
  broken.)*
- **Look at the page in a real browser**, not just at whether it built.
  *(from crit 7.)* `agent-browser` 0.39.0 is installed on this machine (via
  npm, 2026-10-13); `agent-browser open <url>` then `agent-browser screenshot
  <file>`. For dark mode, open a page first and then `agent-browser set media
  dark`. *(On 2026-10-27 `--color-scheme dark` on an already-running browser
  was silently ignored, and the "dark" screenshots came out light.)* Measure
  contrast on a page loaded fresh in the scheme, not just after `set media`:
  the buttons' 200ms colour transition is still running, and the numbers are
  wrong. *(On 2026-10-27 the audit flagged home's buttons at 1.2:1 that way;
  reloaded, every one passed.)*
- **Tap targets are at least 44px tall** (`min-height: 2.75rem`) for buttons,
  nav and tab links and whole radio rows; a small mark (a colour swatch, a
  crayon) keeps its size and gets a bigger hit area around it. Links inside a
  sentence are exempt. *(The 2026-10-27 audit found 20 kinds of control at
  28–41px on a phone.)*
- **Colours are tokens.** A colour on the page reads a `:root` variable in
  `src/styles.css` (redefined under `prefers-color-scheme: dark`); the note
  colours come from `NOTE_COLOURS` via `src/layouts/Page.astro`. Only the pixel
  pictures keep their own palette (`src/lib/pixel.ts`). *(On 2026-10-27 dark
  mode found a hard-coded light overlay in WorkPanel and a white-on-warn
  delete button.)*
- **One fact, one piece of code.** A number the app enforces (a length limit,
  how many reports hide a reply) lives in one place, and both the page and any
  message about it read it. Two sources for one fact is a page that will
  eventually contradict itself. *(from crit 7.)*
- **Default to incremental.** Don't restructure, don't rewrite copy that's
  there, don't break an interaction that works. Before building each feature,
  say two things back: **when it updates** and **what must not change**.
  *(from crit 7, where that question alone settled a feature's design.)*
- **When a check fails, read its output before changing anything**; the
  message names the file, the line or the contract. A red check is
  authoritative. **Never commit a red state.** *(from crit 7.)*

## The checks (verified against package.json on 2026-10-13)

- `pnpm check` is `pnpm typecheck && pnpm test`; `typecheck` is `astro check`
  and `test` is `astro build && vitest run`. Because of the `&&`, a type error
  means the build and the spec never run.
- `vitest` runs `spec/**/*.test.ts` against the running app.
  `spec/global-setup.ts` boots the built server (`dist/server/entry.mjs`)
  with a throwaway `DATA_DIR` unless `APP_URL` is set; CI sets it to the
  Docker image it built.
- `spec/invariants.test.ts` is the course's (`/` answers, `/readme/` has every
  README heading in the server's HTML): keep it. `spec/enough.test.ts` is
  ours: the live push; what stays private (unshared
  enoughs, hours, spans, feeling, notes, rechecks); the length limits; notes
  sanitising; time spans and crayons; owner-only delete that leaves every
  feed live; comments live, and hidden at `REPORTS_TO_HIDE`; the resting
  count live and a break never showing how long; the meadow (each resting
  person's little one, from the "resting" event's `ones`, each only
  `{kind, wears}`: never who, never how long); without an account, reading
  works but every write is refused; Looking back; and things kept for later
  (the tomorrow drawer and a worry for a week on): never on the feed, the
  stream or another person's Mine, not shown before their day,
  `DRAWER_MAX`/`WORRY_MAX` refused, put away by the owner only (31 tests on
  2026-10-27). Which day they come back is pure arithmetic in
  `src/lib/later.ts`, tested directly; showing and putting away is tested on
  `db.ts` itself with its own throwaway `DATA_DIR`, because the spec can't
  move the app's clock. Mine is three pages: `/mine/` is Looking back (a day, week or
  month added up for the owner, `src/lib/summary.ts`, never compared with
  another period), `/mine/all/` is Each one, the full cards, and
  `/mine/collection/` is the Collection; specs that
  check private fields or act on a card read `/mine/all/`. Writers in specs register first
  (`signedIn()`); `browser()` alone is a reader. `spec/account.test.ts` (8
  tests, 2026-10-20) checks accounts: registering lets you write and what you
  write is yours; signing in elsewhere is that person; the same
  refusal for an unknown user and a wrong password; usernames unique in any
  case; `PASSWORD_MIN`; the username and password never on the feed or the
  stream; logout empties that browser's Mine; `LOGIN_ATTEMPTS` failures lock
  a username for `LOGIN_WINDOW_MINUTES`; an account can't delete someone
  else's enough. `spec/work.test.ts` (19 tests, 2026-10-22) checks work
  sessions and the Enough alarm: Finish fills in the time bar for the owner
  only; one open session at a time; sessions and snoozes never on the feed
  or the stream, the snooze count only on the owner's Mine; resting from a
  session raises the resting count and coming back resumes work; no start
  without an account; each session's tower starts from nothing and is
  planned to that session's alarm. And what's in the little one's picture (`/scene/`):
  the choice is kept with the account across sessions; unknown keys are
  ignored; no change without an account; one person's choice is never
  another's; it never reaches the feed or the stream. The arithmetic in
  `src/lib/worktime.ts` (spans leave breaks out, rounding, local day,
  alarms, the tiredness curve with the lamp's glow, recovery, the tower's
  bricks and pace, `towerPlan`/`bricksLaid`) is tested
  directly, because the spec can't move the app's clock.
  `spec/collection.test.ts` (12 tests, 2026-10-27) checks the Collection:
  nothing at first, three breaks bring the straw hat; a locked or wrong-slot
  choice is refused, and a chosen hat shows on its owner's Working on it
  only; resting from the alarm counts toward the flower crown and an
  ordinary break doesn't; letting go (not checking anyway) counts toward the
  scarf; the meadow and stream carry what's worn but no identity and no
  progress; the sunflower can't go in the picture until it's come; signed
  out, no progress and no choosing. `unlocked`, `progressText`,
  `checkOutfit`, `wearing` and `sceneThingAllowed` are tested directly.
- Wearables (hat, crown, scarf) are drawn once in `WEARABLES` and placed per
  frame by `anchorsOf()`, which finds the hair's top row ("oooooooo") and the
  neck ("kSSk", or above the collar when napping) in the frame itself. A new
  frame needs those rows, or its wearables won't show.
- The little one is pixel art drawn as character grids (`src/lib/sprites.ts`)
  in one palette (`src/lib/pixel.ts`). An upper-case ink becomes a class with
  a "2" suffix and a digit ink one with a "b" prefix, so "B" can't be an ink:
  it would share `px-b2` with block colour "2". *(On 2026-10-21 the
  umbrella's edge, drawn in "B", turned every pink block wine red.)*
- A local server started with a relative path runs that folder's
  migrations and escapes `pkill -f` on the full path. Start it with the
  folder as the working directory and the absolute `entry.mjs`, and stop it
  by the port's PID. *(On 2026-10-21 two rounds of screenshots read a stale
  server, and one read main's migrations without the new table.)*
- The login rate limit is in memory, per username. Tests that register reuse
  nothing between runs (each makes a fresh username), so a lockout from one
  test can't fail another.
- A spec that checks a private value never reaches the stream must use a
  value no timestamp or id could contain, and also check the field name is
  absent. *(On 2026-10-20 CI went red because hours "7.5" matched inside a
  createdAt of …27.579Z; nothing had leaked, but the deploy was blocked.)*
- A spec that reads a count off the page must read the visible text, not a
  `data-*` attribute holding the template wording. *(The first breaks test
  failed this way on 2026-10-14; the app was right.)*
- Astro refuses a cross-site form POST (403). A bare `fetch` in a spec has to
  send `sec-fetch-site: same-origin`, as a browser would, or it gets 403 for
  the wrong reason. *(The first run of the spec failed this way, not because
  the app was wrong.)*
- `spec/log.test.ts` checks the log line format (key=value, request id).
  Reading the live log: `mise exec -- flyctl logs -a comp4020-final-yue03084-ce`.
  On 2026-10-21 two simulated people were run against a local build and the
  log grepped for every private value they sent: none appeared.
- Schema changes: edit `src/lib/schema.ts`, `pnpm db:generate`, commit what it
  writes to `drizzle/`. Migrations run at boot.

## Process

- **Commit as you go.** The commit trail is read as process evidence, and a
  dump the night before is the weakest evidence. *(from crit 7.)*

## Lessons learned

- Never show the contents of `mise.local.toml` or any token in command output.
- Changing live data (deleting data, or writing through a remote shell) needs
  my permission first.
- Keep the README's "What's there now" and the Honest notes in step with
  what's shipped. *(On 2026-10-14 it still described the night-before version
  after six features had gone live, and it named reporting before reporting
  existed.)*

## Keeping this file honest

When you add a rule, write the failure that caused it and check any claim
about a tool against `package.json`, the workflow or the script. A wrong reason
is worse than none, because it gets believed. When you delete a rule, say what
stopped being true. When something is settled outside this file, leave a
pointer in it: this is the only file every session is guaranteed to read.
*(from crit 7.)*

Deleted on 2026-10-12: the rules about scene images, characters, storing every
click, show → scene → level, and the shared "people" table. They belonged to
the *Friends* spot-the-difference game, which I dropped for a new direction.
