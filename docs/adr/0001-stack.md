# ADR 0001: Astro and SQLite for the stack

Date: 2026-10-13. Status: accepted.

## Context

The app is a public, anonymous space for people who take their work seriously
and lean towards perfectionism. When someone finishes something, they record
that it's "enough", and choose whether to share it. Others see these moments of
stopping and can leave a line in reply. Data such as time spent and how often
they went back to check is visible only to the person themselves, as evidence
for when their mind tells them they haven't done enough. The core idea is
learning to stop and rest.

The course fixes three requirements: multi-user (people in different browsers
act on shared state, and the app tells them apart), real-time (a change one
person makes appears on everyone else's page within about a second, without a
reload), and persistence (data survives restarts and redeploys). It runs on one
machine with 256 MB of memory, and persistent data can only be written to
`/data`.

The code already in the repo belongs to the earlier direction, a *Friends*
spot-the-difference game. That project has almost nothing in common with this
one, and none of its data or pages can be reused, so it has to be rewritten
whichever stack I choose.

## Options

- **A. Keep the existing Node and SQLite, with no framework.** It's already
  deployed and it's the lightest option. But every page is written by hand,
  and the structure would get messy as features are added.
- **B. Astro and SQLite.** I used it in crit 7. Organising the pages, building
  the features and adjusting the page design all went smoothly, with no really
  painful moments, and deploying was quick. For example, crit 7's date had to
  be typed in by hand, which I found annoying, since most websites now let you
  pick from a calendar. I wanted it to work that way, and the change was quick
  to make
  ([cd3440a](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-yue03084-ce/commit/cd3440a)).
- **C. Switch to another language or framework.** It would start from scratch,
  the deploy path would need proving again, and I don't have the experience
  with it that I have with B.

## Decision

B. I expect to polish, refine and improve the app many times, so I want a sound
framework from the start, rather than having to move to a new one once the
features pile up.

## Consequences

- Some things have to be rebuilt now: setting up the framework, and rewriting
  the `/readme/` page and the Dockerfile.
- It's less lightweight: compared with plain Node it adds a build step and more
  dependencies.
