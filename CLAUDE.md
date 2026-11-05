# Rules for the agent

Every rule here carries the failure it came from, so a later reader can tell a
dead rule from a live one. Rules marked *(from crit 7)* were carried over on
purpose from the crit 7 harness (most of them it had already taken from A2)
because they don't depend on that stack.

## Decisions I've already made

Each decision says what guards it: **Guarded by** names the spec that goes
red if it's broken; **Not tested** says what nothing checks, so it has to be
watched by hand. When a decision changes, its spec changes in the same
commit (see "A feature lands with its test").

- README.md, PROCESS.md and `reflections/` are mine. The agent must not write
  them in one go on its own. It may suggest an outline, ask questions to guide
  me and point out gaps. I write the content in Chinese; the agent polishes it
  into English, keeping my meaning, and I confirm the final version before it
  goes into the file.
  **Not tested:** a rule for the agent, not the app.
- **Show stopping, never finishing.** What other people see is someone
  stopping: "enough" on one thing, or taking time away. Never what they
  finished, how many things, how long they spent or how much they put in.
  *(The app is for perfectionists who pace themselves by the people around
  them; seeing others finish pushes some people to work harder, which is the
  opposite of the point. Decided 2026-10-12.)*
  **Guarded by:** `enough.test.ts` "an unshared enough reaches nobody else,
  on the feed or the stream"; "shows no running total, streak or ranking".
- **Effort and check records are private.** How much someone put in (hours,
  the coloured-in spans), how it felt, which parts they checked, and each time
  they wanted to check again are visible only to that person. What's public is
  the "enough" itself, a one-line description, replies and comments, how many
  people are on a break, and what someone went to do after a shared "enough".
  Never how long a break lasted. *(Same reason: these are the numbers people
  compare. Decided 2026-10-12; breaks added 2026-10-14.)*
  **Guarded by:** `enough.test.ts` "hours, feeling and notes reach only their
  owner, even when shared", "is recorded for the owner only", "after a shared
  enough, show where they went and when they're back, never how long",
  "worries" ("are kept on their enough for their owner…", "writing down
  what you'd check…", "a week on, ask how it looks…"); `work.test.ts` "never
  reaches the feed or the stream, and snoozes show only on the owner's Mine".
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
  The username shows only to its owner: in the nav's corner (beside their
  own little one's head, `Avatar.astro`) and on `/account/`. There's no
  email: a recovery code (shown once, kept hashed) sets a new password, and
  changing the password or using the code signs out every other browser.
  Deleting an account takes everything, its shared enoughs and comments too.
  *(Account page added 2026-11-02: the old one read as too bare for a real
  site. Email was weighed and left out: sending mail needs an outside
  service and a domain, and an email field that did nothing would be empty.)*
  **Guarded by:** `enough.test.ts` "every write is refused, and nothing is
  written", "gives each shared enough its own name, even two by the same
  person"; `account.test.ts` "never shows the username or password to anyone
  else, on the feed or the stream", and "the account page" (the corner, the
  password, the recovery code, devices, deleting, each refused signed out);
  `ui.test.ts` "public names (names.ts)".
  The first finds every page under `src/pages` that takes a POST, so a new
  write route is tried the day it's added, and checks it's refused with a
  redirect to `/account/` (or a 401). *(On 2026-10-29 that found `/delete/`,
  `/put-away/` and `/urge/` refusing silently back to Mine instead; nothing
  was written, but they now go to sign in like the rest.)*
- **Logs say who did what, never what they wrote.** Every request gets one
  line, and every meaningful action an event line (`src/lib/log.ts`,
  `src/middleware.ts`), tagged with the request id. Who is a block number
  (the account id, which the feed never shows). Never a username, password, cookie or token, and never a description,
  notes, hours, feeling or comment text. *(Crit 10 is narrated from the logs
  alone, and the logs outlive it. A log line is read by whoever reads the
  logs, so it holds nothing a person wouldn't want there. Decided
  2026-10-21.)*
  Nor a recovery code, or which browser someone uses.
  **Guarded by:** `lasting.test.ts` "does everything private once, and the
  log holds none of it" (boots its own server and reads what it prints;
  includes making and using a recovery code);
  `log.test.ts` for the line format. A new kind of private field needs
  adding to that spec's `secret`.
- **No streaks, rankings or public totals.** Nothing that rewards keeping
  going or compares people. Counts for a person's own look back (how many
  times they checked a project) are allowed, shown only to them. *(These
  features turn a record into another source of anxiety. Decided 2026-10-11.)*
  **Guarded by:** `enough.test.ts` "shows no running total, streak or
  ranking, however much there is" (the feed's visible text). **Not tested:**
  pages other than the feed; a total worded some new way.
- **Someone arriving on the meadow floats down on a parachute.** Only
  someone who goes on a break while the page is open; whoever is already
  resting when it opens is simply there, so a reload isn't a shower of
  parachutes. Worked out on the page from the line of little ones, which
  keeps its order (`arrivals` in `src/lib/meadow.ts`); the server sends
  nothing for it. With reduced motion nobody floats, and nor does anyone on
  the page that has just sent a break form: the update can beat the reload,
  and showed its own person a parachute for a moment. *(Asked for
  2026-11-03: a playful way in for a new little one. The flash was found the
  same day by tapping I'm back and a break in turn.)*
  **Guarded by:** `ui.test.ts` "parachutes on the meadow (meadow.ts)";
  `enough.test.ts` "put each resting person's little one on the meadow…"
  (the event holds only kind, wears and hair). **Not tested:** how it looks
  and moves, and the page that sent the form not floating its own person:
  both checked in a browser.
- **Worries are kept, and looked back on.** A worry is written when calling
  something enough, or instead of checking it again ("Write it down" in "I
  want to check it again"). It stays on that record in History, for its
  owner only, and a week on (`WORRY_AFTER_DAYS`) the record asks "A week on,
  how does it look now?"; what they write stays beside it. A reminder at the
  top of You links there; putting it away keeps the worry. No yes/no, no
  score, no "most of your worries didn't happen": seeing them in their own
  words is the point. *(2026-11-05: worries came back once a week later and
  were gone, and the drawer note for tomorrow came back once on You and was
  gone, so nothing could be looked back on. "Did it happen?" was offered and
  turned down as too narrow. The drawer was folded in: drawer_notes is kept
  but unread, migration 0012 copied every note into worries.)* A view of
  worries over time is wanted next, once there are some to show.
  **Guarded by:** `enough.test.ts` "worries" (on their enough, private,
  counted as wanting to check, refused when empty, too long or not yours,
  the week, and the answer on `db.ts`); `lasting.test.ts` (neither a worry
  nor a line a week on reaches the log).
- **One place to rest, come back or finish.** A thin status bar under the
  nav (`StatusBar.astro`), on every page and only for its signed-in owner:
  "Take a break: walk · tea · …", plus "Working" and Finish while working,
  or "On a break (tea) · I'm back". The feed and Together have no break,
  back or finish buttons of their own; the feed keeps the resting count and
  the meadow (`Resting.astro`) for anyone. The meadow is always there, empty
  and saying so when nobody's resting, so it doesn't come and go with
  other people (hidden until 2026-11-04; that read as broken). Call it enough's "And now?" and
  the alarm's overlay still rest, as part of what they're for. Never how
  long. *(2026-11-04: with breaks on the feed, on Together and at the end of
  Call it enough, the agent and I both lost track of where things were;
  adding a bar on top would have meant three I'm backs, so the others went.)*
  **Guarded by:** `work.test.ts` "the status bar" (signed out, each state on
  every page, only one of each, back to the page it came from, links on
  hover); `ui.test.ts` "keeps the meadow on the feed, saying it's empty…".
- **The little one can come with you; the site can be installed.** On
  Together, "Keep it beside you" moves the little one's picture itself into
  a small window that stays on top (Document Picture-in-Picture, Chrome and
  Edge only; the button stays hidden elsewhere), so it carries on mid-step
  and comes back when the window closes. It closes with the page, on Go, I'm
  back or Finish. The site has a manifest and an icon drawn from the
  standing frame (`src/lib/icon.ts`), so it can be added to a home screen;
  nothing is cached offline and there's no push, so no page is ever stale.
  *(Asked for by the tutor on 2026-11-03: PWA for phones, and the little one
  working alongside you.)*
  What's in the picture and the weather change as soon as they're chosen,
  on the page or in the small window, and are kept in the background; every
  choice is drawn already and only shown by `data-thing`/`data-weather`.
  Between bricks it knocks the tower crouched when it's low, standing, or up
  a ladder that grows with it (`reachFor` in `sprites.ts`). *(Asked for
  2026-11-04: "Keep this" then "Bring it back" was two steps for one choice,
  and it tapped a two-brick tower standing up.)*
  **Guarded by:** `work.test.ts` "offers to keep it beside you…", "draws
  every choice…", "reaching the top of the tower"; `ui.test.ts` "adding it
  to a home screen". **Not tested:** the small window opening and the
  picture moving there and back, the climb itself: checked in a browser.
- **The Collection unlocks only from stopping.** Its things (`COLLECTION` in
  `src/lib/limits.ts`, arithmetic in `src/lib/collection.ts`) come from
  breaks taken, letting a recheck go, resting when the alarm rang
  (`breaks.from_alarm`, recorded from 2026-10-27 on) and days used, added up
  and never in a row or reset. Never from work hours, tower height or
  bricks. How far along someone is stays on their own `/mine/collection/`;
  what they choose to wear is public on the meadow, as item keys, never who
  and never how it came. A break is counted once however many times its kind
  is changed: changing it is the same break. The little one is the
  account's: everyone starts brown, other hair colours come from the
  Collection, and its hair and things go with it everywhere (Together,
  the avatar, the meadow). *(Until 2026-11-03 the meadow gave out hair by
  place in the line, so when one person left or came back, everyone behind
  them changed colour; and switching from walk to nap started a new break,
  so tapping between kinds unlocked the straw hat in seconds. Hair by place
  had been the agent's choice in the 2026-10-27 sub-agent round, not a
  decision. A colour says nothing about who: there are five, among many
  people, and the things a little one wears already go with the account.)* *(The same reason as no streaks: a reward for
  working is a reason to keep working. Decided 2026-10-27.)*
  **Guarded by:** `collection.test.ts` "unlocks each thing at its own number
  of times stopping, and only from stopping", "counts changing what you're
  doing on a break as the same break", "gives a little one its owner's hair
  on the meadow, whoever comes and goes", "starts everyone brown…";
  `enough.test.ts` "changing what you're doing on a break keeps your place
  on the meadow"; "counts resting when the alarm
  rang towards the flower crown; an ordinary break doesn't", "puts what a
  resting person wears on the meadow, never who, and nobody's progress", "is
  for its owner…".
- **Numbers live in one place.** The comment length limit (30 characters),
  how many reports hide a comment (3), and how long an unended break counts
  as going (120 minutes), and the worry length and the worry's week
  (`WORRY_MAX`, `WORRY_AFTER_DAYS`) are each one
  constant in `src/lib/limits.ts`, read
  by the page, the server and any message about them. *(A limit enforced in
  two places will drift; see "One fact, one piece of code".)*
  **Guarded by:** each limit's spec reads the constant, not a number:
  `enough.test.ts` "refuses a description over `DESCRIPTION_MAX`…", "…a
  comment over `REPLY_MAX`…", "hide once `REPORTS_TO_HIDE`…", "refuses an
  empty one, one over `WORRY_MAX`…", "…a worry over `WORRY_MAX`…"; and "says each limit and
  stops typing at it, from the same constant the server uses" checks each
  field's `maxlength` and its "(up to N characters)" against the constant.
- **The look is plain; the pixel art is the only signature.** White page,
  warm-grey cards (`--card`) with a 1px `--line` edge and no shadow; the
  feed's records are rules between, not boxes. The primary button is
  near-black (`--primary`); brown (`--accent`) is only for links and small
  marks like Reply, never a filled area. Only the primary button and fields
  have a corner (`--radius`, 8px); everything else is square, and nothing is
  a pill. Inter for everything you press or read past, Lora only for record
  titles, page titles and the home description. No hand-written font, tape,
  tilt, texture, gradient or dashed border. *(Cream, wine and sage, then
  brick red, read as "made by AI"; oat paper with grain and blue-grey layered
  cards were tried and dropped. A plain page let the little ones stand out.
  Decided 2026-10-29.)* **Not tested:** looked at in a browser each time.

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

**Guarded by:** "Multi-user" and "real-time": `enough.test.ts` "reaches
another open page within about a second, with no reload", "reach every open
feed within about a second", "change the resting count for everyone, live".
"Persists": `enough.test.ts` "is still on the feed for someone else after a
reload"; `lasting.test.ts` "keeps what was written through a restart".
**Not tested:** a redeploy itself (the restart is the nearest check).

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
- **Answer me in Chinese.** I write requests in Chinese and paste briefs in
  English; code, commits and the files in this repo stay in English.
- **Show me before it ships.** Screenshots at desktop (1440×900) and phone
  (390×844) widths, light and dark where it matters, then ask before merging
  or pushing, unless I've said to go ahead for that round. *(I look at every
  round; three restyles on 2026-10-29 were each turned around from a
  screenshot.)*
- **When something I ask for clashes with a rule or decision here, or with
  a spec, stop and ask before building it**, unless there's only one
  reasonable way through (then do it, and say so). Put all the clashes from
  one request into one question, each with what clashes, two or three ways
  through and the one you'd pick, and wait for my answer. Explain them in
  plain words, not just names: many are technical details I may simply have
  got wrong, and I'm still catching up on how the code works. *(On
  2026-10-29 four clashes in one brief, such as deleting the home h1 and
  fitting the reactions on one line at phone width, were each settled by the
  agent and only reported at the end of a long summary. The one it stopped
  to ask about, what replaces "A block #N", went best.)*
- **I come back after days away and forget what was settled.** Check the
  code, git log and the course site rather than asking me what's done; keep
  this file current rather than relying on me to remember.
- **A feature lands with its test.** Anything that changes what someone
  sees or what the server allows gets a spec in the same commit, and the
  decision it touches gets its **Guarded by** line updated. Before calling a
  new spec done, break the thing it guards on purpose and watch it go red.
  *(On 2026-10-29 the feed's names, times and break lines changed in one
  round; each came with a test only because the agent chose to add one, and
  this file's list of specs had gone stale by two files. I often come back
  after days away, so what isn't written here gets forgotten.)*

## The checks (verified against package.json on 2026-10-13)

- `pnpm check` is `pnpm typecheck && pnpm test`; `typecheck` is `astro check`
  and `test` is `astro build && vitest run`. Because of the `&&`, a type error
  means the build and the spec never run.
- `vitest` runs `spec/**/*.test.ts` against the running app.
  `spec/global-setup.ts` boots the built server (`dist/server/entry.mjs`)
  with a throwaway `DATA_DIR` unless `APP_URL` is set; CI sets it to the
  Docker image it built.
- Spec files run one at a time (`fileParallelism: false` in
  `vitest.config.ts`), about 17s instead of 8. *(They share one server, and
  the resting count and the meadow are everyone's: on 2026-11-04 three
  different specs failed now and then because another file rested at the
  same moment.)*
- `spec/invariants.test.ts` is the course's (`/` answers, `/readme/` has every
  README heading in the server's HTML): keep it as it is.
- What each spec checks is in its test names; which decision each guards is
  under that decision above. This section keeps only what you need to know
  to write one.
- In a spec, a writer registers first (`signedIn()`); `browser()` alone is a
  reader. *(Every write needs an account, so a reader that writes is
  refused, and the test fails for the wrong reason.)*
- Private fields (hours, spans, feeling, notes) show only on `/mine/all/`, so
  a spec that checks them, or acts on a card, reads that page.
- Anything that depends on today's date (a worry's week, relative times,
  the alarm, the tower) is tested by calling its function with `now` passed
  in (`later.ts`, `when.ts`, `worktime.ts`, `summary.ts`, `collection.ts`).
  A worry coming back, answering it and putting its reminder away are
  tested on `db.ts` itself with its own throwaway `DATA_DIR`. *(The spec
  can't move the server's clock.)*
- A spec that needs to know *whose* something is (an order between people,
  one person's break among others) checks it inside, on `db.ts` with its
  own `DATA_DIR`, where every row has its account. The stream and the feed
  never say who, and every spec file shares one server at once, so from
  outside one person's "tea" can't be told from another spec's. *(On
  2026-11-04 the meadow-order spec failed now and then because a work spec
  rested with "tea" at the same moment; nothing in the app was wrong.)*
- A spec that needs the server's own output or a restart boots its own copy
  of `dist/server/entry.mjs` on its own `DATA_DIR`, as `lasting.test.ts` does.
  *(The shared test server's output is discarded, and in CI it's a Docker
  container the spec can't read or restart.)*
- You (the nav's name since 2026-11-03; the URL is still `/mine/`, and the
  code and spec names still say Mine) is three pages: `/mine/` is Summary (a
  day, week or month added up for the owner, `src/lib/summary.ts`, never
  compared with another period), `/mine/all/` is History, the full cards,
  and `/mine/collection/` is the Collection. *(Looking back and Each one
  until 2026-11-05, renamed with the picture's choices, Scene: Lamp · Plant
  · Open view, because they read as a toy. Guarded by `ui.test.ts`
  "wording".)*
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
- Reading the live log: `mise exec -- flyctl logs -a comp4020-final-yue03084-ce`.
  What it must never hold is checked by `lasting.test.ts`; on 2026-10-21 that
  was done once by hand (two simulated people, the log grepped for every
  private value they sent: none appeared), and from 2026-10-29 on every run.
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

Deleted on 2026-10-29: the paragraph listing what each spec file checked,
with test counts. It had gone stale (two spec files missing, counts wrong);
the test names now say what each checks, and each decision says which spec
guards it.

Deleted on 2026-10-12: the rules about scene images, characters, storing every
click, show → scene → level, and the shared "people" table. They belonged to
the *Friends* spot-the-difference game, which I dropped for a new direction.
