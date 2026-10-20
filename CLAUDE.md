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
  route. The username is never public: on the feed everyone is still "A block
  #N". *(Records kept only in a cookie are lost with the browser, and a done
  list has to last; markers also come back the next day. Decided 2026-10-20.)*
- **No streaks, rankings or public totals.** Nothing that rewards keeping
  going or compares people. Counts for a person's own look back (how many
  times they checked a project) are allowed, shown only to them. *(These
  features turn a record into another source of anxiety. Decided 2026-10-11.)*
- **Numbers live in one place.** The comment length limit (30 characters),
  how many reports hide a comment (3), and how long an unended break counts
  as going (120 minutes) are each one constant in `src/lib/limits.ts`, read
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
  <file>`.
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
  ours (23 tests on 2026-10-20): the live push; what stays private (unshared
  enoughs, hours, spans, feeling, notes, rechecks); the length limits; notes
  sanitising; time spans and crayons; owner-only delete that leaves every
  feed live; comments live, and hidden at `REPORTS_TO_HIDE`; the resting
  count live and a break never showing how long; and without an account,
  reading works but every write is refused. Writers in specs register first
  (`signedIn()`); `browser()` alone is a reader. `spec/account.test.ts` (8
  tests, 2026-10-20) checks accounts: registering lets you write and what you
  write is yours; signing in elsewhere is that person; the same
  refusal for an unknown user and a wrong password; usernames unique in any
  case; `PASSWORD_MIN`; the username and password never on the feed or the
  stream; logout empties that browser's Mine; `LOGIN_ATTEMPTS` failures lock
  a username for `LOGIN_WINDOW_MINUTES`; an account can't delete someone
  else's enough.
- The login rate limit is in memory, per username. Tests that register reuse
  nothing between runs (each makes a fresh username), so a lockout from one
  test can't fail another.
- A spec that reads a count off the page must read the visible text, not a
  `data-*` attribute holding the template wording. *(The first breaks test
  failed this way on 2026-10-14; the app was right.)*
- Astro refuses a cross-site form POST (403). A bare `fetch` in a spec has to
  send `sec-fetch-site: same-origin`, as a browser would, or it gets 403 for
  the wrong reason. *(The first run of the spec failed this way, not because
  the app was wrong.)*
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
