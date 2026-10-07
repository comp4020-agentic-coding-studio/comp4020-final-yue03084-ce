# Rules for the agent

## Decisions I've already made

- README.md, PROCESS.md and `reflections/` are written by me. The agent may
  point out gaps, but must not draft or rewrite them.
- Scene images come only from the platform. Don't build any way for players to
  upload images.
- Be careful with characters; prefer objects as scene parts.
- Store every click made while solving, right or wrong. Don't store only the
  outcome to save effort.
- Data is organised as show → scene → level. Don't hard-code "Friends" or
  "Monica's apartment" into the logic.
- Anonymous and registered players share one "people" table. Registering only
  adds login credentials to that person; it never creates a new person.

## Hard limits from the course

- The app runs on one machine with 256 MB of memory, and persistent data can
  only be written to `/data`.
- `/readme/` must render README.md in full without relying on client-side
  scripts.
- Run `pnpm check` before committing and pushing; only push when it's green.

## Lessons learned

- Never show the contents of `mise.local.toml` or any token in command output.
- Changing live data (deleting data, or writing through a remote shell) needs
  my permission first.
