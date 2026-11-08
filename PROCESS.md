# Process overview

## Where the idea came from

I've used Notion, a Pomodoro timer and Forest, and they all look forward: they
record what you plan to do and push you to do it. What I struggle with is the
other side. With AI-assisted work I keep reopening and rechecking things, never
sure they're good enough. On my bedroom wall there's a note, "Live with
imperfection" (与不完美共存), and seeing it pulls me out of that loop. I want people like me,
who lean towards perfectionism and don't know how to rest, to have a space that
is anonymous yet public, where we keep that idea up together and make it
stronger. So people see only the stopping, never how much someone finished or
how long it took. Time spent, how it felt and what you checked stay
private, as evidence for when your mind says you haven't done enough
([ADR 0002](docs/adr/0002-what-others-see.md), [8791f7a](https://github.com/comp4020-agentic-coding-studio/comp4020-final-yue03084-ce/commit/8791f7a)).

## What I read, and where I stand

Sloan's home-cooked app is for four people he knows. Mine is public, but the
group it's for is still narrow, and like his it leaves out what a wider audience
would expect: circles of people you know, rankings, totals. Curran and Hill
found the steepest rise is in feeling that others expect more of you; here, all
you see of others is that they stopped. Weiser and Brown's calm technology fits
the little one best. It gets on with its own work beside you, and its slowing
down is both company and a reminder to rest; only when the alarm rings does it
come to the centre. When people rest, the meadow is quiet too.

## Stack

In crit 8 I went with the agent's suggestion because I didn't know how to
choose. This time I chose myself: Astro and SQLite, because organising pages
and adjusting the design went smoothly in crit 7, and I expect to polish this
app many times ([ADR 0001](docs/adr/0001-stack.md), [55f87d5](https://github.com/comp4020-agentic-coding-studio/comp4020-final-yue03084-ce/commit/55f87d5)).

The course gives every project the same shape: one small machine with 256 MB
of memory, and one disk at `/data`, the only thing that survives a restart or
a redeploy. There's no separate database server. I knew this when I chose, and
it's why the stack fits: SQLite is a single file on that disk, and the live
updates are broadcast from the server's own memory. It's simple and fast, and
the cost is that it can only ever run on one machine, so it can't grow by
adding more. For this project that's the right trade. I can't say my
sense of it runs deep, though, because I haven't used other stacks in depth to
compare.

## The harness

I rewrote `CLAUDE.md` for this app: I picked which crit 7 rules to carry
over, and added product rules, such as
"show stopping, never finishing" ([e34cc4a](https://github.com/comp4020-agentic-coding-studio/comp4020-final-yue03084-ce/commit/e34cc4a)). The tests check the
ones that can be checked: nothing private reaches anyone else.

As the app grew, I worried that with more features things would break more
easily, and the tests wouldn't keep up. So I had the agent check my tests
against `CLAUDE.md`, and rewrote every decision there to name the spec that
guards it, or to say plainly that nothing does ([207fc19](https://github.com/comp4020-agentic-coding-studio/comp4020-final-yue03084-ce/commit/207fc19)). One new
spec finds every page that writes and tries it signed out; it caught three
that refused the wrong way ([0074eea](https://github.com/comp4020-agentic-coding-studio/comp4020-final-yue03084-ce/commit/0074eea)). Now, when I come back after
days away, I can see what was decided, what guards it, and which parts only I
can check, by looking.

## How I directed the agent

For one round I wanted to try a different workflow, one where I didn't have
to follow every step. I settled all the details first, then the agent split
the work among sub-agents running in parallel, and merged and checked what
came back ([5a94a16](https://github.com/comp4020-agentic-coding-studio/comp4020-final-yue03084-ce/commit/5a94a16), [ac4dc97](https://github.com/comp4020-agentic-coding-studio/comp4020-final-yue03084-ce/commit/ac4dc97), [53eeed5](https://github.com/comp4020-agentic-coding-studio/comp4020-final-yue03084-ce/commit/53eeed5)).
It was more efficient, and while the agents worked I could do other things.
But with so many tasks, some details were quietly decided by the agents
themselves, and a cognitive debt built up between us. A week later, testing
with three windows myself, I saw other people's little ones change whenever
someone came or went. The page can't say who anyone is, and a sub-agent had
taken that to mean a little one needn't be anyone's: hair was given out by
place in the line, and changing what you were doing on a break sent you to the
back. I made the little one the account's, the same everywhere, with specs
that check it stays put, and wrote in `CLAUDE.md` that the old way had been a
sub-agent's choice, not mine ([b0ae3db](https://github.com/comp4020-agentic-coding-studio/comp4020-final-yue03084-ce/commit/b0ae3db)). A spec can only guard
what I've already decided; this one I only caught by using it. Every time I
come back, my brain has to reload the context. I think it's a trade-off, and
the point is finding the balance.

Some problems only a person could see. The pixel little one's stretch had arms
like poles past its head; the agent saw nothing wrong, and I found it strange
at a glance ([afde72b](https://github.com/comp4020-agentic-coding-studio/comp4020-final-yue03084-ce/commit/afde72b)). Trying it once, I found its tower filled up
within minutes on my second session, and that tending the tower looked like
doing squats ([0920474](https://github.com/comp4020-agentic-coding-studio/comp4020-final-yue03084-ce/commit/0920474)). It was a little funny, and it showed me I can't
rely on the agent for this.

## What I turned down

Accounts started as optional ([faf32c2](https://github.com/comp4020-agentic-coding-studio/comp4020-final-yue03084-ce/commit/faf32c2)); with so much personal
record-keeping, I changed that: anyone can read, but writing needs an account
([7804228](https://github.com/comp4020-agentic-coding-studio/comp4020-final-yue03084-ce/commit/7804228), [ADR 0003](docs/adr/0003-who-sees-and-changes-what.md)).

When the tutor suggested groups or a sharing layer, I turned it down: once
people know each other, or aren't anonymous, they compare, which runs against
the whole idea. That's what I told the tutor.

The obvious look for a gentle app about rest is warm colours and handmade
touches, and that's what the agent kept giving me, from its own favourite
palettes, piling on whatever I asked for. As elements grew, it stopped feeling
usable, unlike the sites I actually use. So I changed it to a plain white page
with the pixel art as the only signature
([380360c...b69aa82](https://github.com/comp4020-agentic-coding-studio/comp4020-final-yue03084-ce/compare/380360c...b69aa82)), and went on to plainer
button words ([6a46d59](https://github.com/comp4020-agentic-coding-studio/comp4020-final-yue03084-ce/commit/6a46d59)) and record cards with a clear order of
title, words and small print ([441ba56](https://github.com/comp4020-agentic-coding-studio/comp4020-final-yue03084-ce/commit/441ba56), [83559fa](https://github.com/comp4020-agentic-coding-studio/comp4020-final-yue03084-ce/commit/83559fa)).

## The little one

I wanted a reminder you can see, not just an alarm: people mean to rest
after a while, then get absorbed and forget. So a little one builds a tower
while you work and slows down as you get tired ([240c133](https://github.com/comp4020-agentic-coding-studio/comp4020-final-yue03084-ce/commit/240c133)).

The Collection ([5ed8c66](https://github.com/comp4020-agentic-coding-studio/comp4020-final-yue03084-ce/commit/5ed8c66)) looks like
a reward, and I don't build rewards, but things come only from stopping, never
from work.
