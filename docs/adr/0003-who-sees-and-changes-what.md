# ADR 0003: Who sees and changes what

Date: 2026-10-21. Status: accepted.

## Context

Crit 10 makes the app multi-user: the server has to tell people apart, and
decide for each request what that person may see and change. Until now anyone
with a browser cookie could write. I had to decide what needs an account, and
what stays visible only to its owner.

## Options

- **A. No accounts; the cookie is the person.** Anyone can write. Clear the
  cookie or switch browsers and your records are gone, and nothing stops one
  person from posing as many.
- **B. Reading needs nothing; writing needs an account.** Anyone can browse
  the feed. Calling enough, replying, commenting, reporting, taking a break
  and starting work all need you to sign in.
- **C. Everything needs an account.** Even browsing the feed means signing up
  first.

## Decision

B. Seeing other people stop is the core of the app, so it shouldn't sit behind
a sign-up. But records need to last and belong to someone, so writing needs an
account. The server checks every write. It doesn't rely on the page hiding
buttons.

| Who | Can see | Can do |
|---|---|---|
| Anyone | shared enoughs (one line), replies, comments, how many people are resting, where someone went after an enough | browse |
| Signed in | the same | call enough, reply, comment, report, take a break, start work |
| Only the owner | hours, time spans, feeling, notes, how many times they checked again, work sessions, snoozes, the little one | delete or check again their own records |
| Nobody | anyone's username | delete or change someone else's things, report their own comment, report the same comment twice |

On the feed, everyone shows as "A block #N". Effort numbers stay private for
the same reason as in ADR 0002: once they're public, people compare. Specs
cover each refusal, and when one person tries to delete another's record, the
server log shows `delete_refused`.

## Consequences

- Writing anything now takes one extra step: creating an account. Some people
  may leave at that point.
- There's no password reset. Accounts have no email, so a forgotten password
  means a lost account. Later I plan to add a one-time recovery code, given at
  sign-up, so it still works without collecting an email.
- Records made before signing up only carry over if you register in the same
  browser that made them.
