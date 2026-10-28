# Process overview

## From the Friends game to a new direction

My first direction was a spot-the-difference game set in Monica's apartment
from *Friends*. Building it showed me the scene was too detailed: too hard to
build, and too hard to play ([e452c10](https://github.com/comp4020-agentic-coding-studio/comp4020-final-yue03084-ce/commit/e452c10)). I also realised I wanted
to make something useful rather than a game. Giving it up didn't feel like
much, because I knew that road was closed. The hardest part was the time
after, with no new direction, when I kept thinking about it. Once I found one,
I felt much better.

The new direction came from my own life. I've used Notion, a Pomodoro timer and
Forest, and they all look forward: they record what you plan to do and push you
to do it. What I struggle with is the other side. With AI-assisted work I keep
reopening and rechecking things, never sure they're good enough. On my bedroom
wall there's a note, "Live with imperfection" (与不完美共存), and seeing it
pulls me out of that loop. So the app is about learning to stop and rest.

## How the idea changed

At first I thought the core was being witnessed: other people telling you
"that's enough". Talking it through, I realised I pace myself by the people
around me. If they put their work down, I can rest with a clear conscience. So
the core became seeing others stop.

That moved it from small fixed circles to one public, anonymous space, and it
set the rule for what people see: only the stopping, never how much someone
finished or how long it took. Time spent, how it felt and what you checked stay
private, as evidence for when your mind says you haven't done enough. I wrote
this decision down in [ADR 0002](docs/adr/0002-what-others-see.md)
([8791f7a](https://github.com/comp4020-agentic-coding-studio/comp4020-final-yue03084-ce/commit/8791f7a)).

## Stack and workflow

In crit 8 I went with the agent's suggestion because I didn't know how to
choose. This time I chose myself: Astro and SQLite, because organising pages
and adjusting the design went smoothly in crit 7, and I expect to polish this
app many times ([ADR 0001](docs/adr/0001-stack.md), [55f87d5](https://github.com/comp4020-agentic-coding-studio/comp4020-final-yue03084-ce/commit/55f87d5)). The
agent then built the first real-time version ([0c23536](https://github.com/comp4020-agentic-coding-studio/comp4020-final-yue03084-ce/commit/0c23536)).

Most features are one small commit each, checked with `pnpm check` and
deployed by CI on every push ([310c75a...949f48a](https://github.com/comp4020-agentic-coding-studio/comp4020-final-yue03084-ce/compare/310c75a...949f48a)).
For the bigger login system, a sub-agent built it on a separate branch, and I
checked it myself before it was merged ([faf32c2](https://github.com/comp4020-agentic-coding-studio/comp4020-final-yue03084-ce/commit/faf32c2)).

The course gives every project the same shape: one small machine with 256 MB
of memory, and one disk at `/data`, the only thing that survives a restart or
a redeploy. There's no separate database server. I knew this when I chose, and
it's why the stack fits: SQLite is a single file on that disk, and the live
updates are broadcast from the server's own memory. It's simple and fast, and
the cost is that it can only ever run on one machine, so it can't grow by
adding more. For this project that's the right trade. In use, deploying has
been quick; only right after a deploy does the site sometimes feel slow to
open. Changing the database's structure has gone smoothly, including two new
tables added in one round ([5a94a16](https://github.com/comp4020-agentic-coding-studio/comp4020-final-yue03084-ce/commit/5a94a16), [53eeed5](https://github.com/comp4020-agentic-coding-studio/comp4020-final-yue03084-ce/commit/53eeed5)). I can't say my
sense of it runs deep, though, because I haven't used other stacks in depth to
compare.

## From prototype to a fuller site

At first this felt like a prototype. As I kept building, it grew more
complete: a crayon bar for time spent ([0fdb40d](https://github.com/comp4020-agentic-coding-studio/comp4020-final-yue03084-ce/commit/0fdb40d)), comments and reporting
([8658080](https://github.com/comp4020-agentic-coding-studio/comp4020-final-yue03084-ce/commit/8658080)), breaks and "I want to check it again" ([574b8f5](https://github.com/comp4020-agentic-coding-studio/comp4020-final-yue03084-ce/commit/574b8f5)). With so
much personal record-keeping, a site without accounts felt very incomplete.
Accounts started as optional ([faf32c2](https://github.com/comp4020-agentic-coding-studio/comp4020-final-yue03084-ce/commit/faf32c2)), then I changed the decision:
anyone can read, but writing needs an account ([7804228](https://github.com/comp4020-agentic-coding-studio/comp4020-final-yue03084-ce/commit/7804228),
[ADR 0003](docs/adr/0003-who-sees-and-changes-what.md)).

I also wanted a reminder you can see, not just an alarm: people mean to rest
after a while, then get absorbed and forget. So a little one builds a tower
while you work and slows down as you get tired ([240c133](https://github.com/comp4020-agentic-coding-studio/comp4020-final-yue03084-ce/commit/240c133)).

## The little one in pixels

When I first thought of a companion, I wanted it in the pixel style of
Stardew Valley, a game I love. Pixel art also leaves more room to play later:
it can wear things. I gave the agent a four-step spec and checked each step
from screenshots ([9504f28](https://github.com/comp4020-agentic-coding-studio/comp4020-final-yue03084-ce/commit/9504f28)). The little one now works in a small
taped-in picture, its sky following the clock, and each time you start, its
tower begins again, sized to your alarm ([75a4d8b](https://github.com/comp4020-agentic-coding-studio/comp4020-final-yue03084-ce/commit/75a4d8b)). On the feed,
everyone on a break sits together on a pixel meadow, live, never saying who
([05e7aec](https://github.com/comp4020-agentic-coding-studio/comp4020-final-yue03084-ce/commit/05e7aec)).

The room to play became the Collection: hats, a scarf, a tabby cat
([5ed8c66](https://github.com/comp4020-agentic-coding-studio/comp4020-final-yue03084-ce/commit/5ed8c66)). It looks like a reward, and I don't build rewards. But the
core idea is helping people learn to rest more wisely, so underneath there's
no clash: things come only from stopping (breaks, letting a recheck go,
resting when the alarm rings, days spent here, never in a row), and never from
work.

## Handing the last round to sub-agents

For the last round I wanted to try a different workflow, one where I didn't
have to follow every step. I settled all the details first, then the agent
split the work among sub-agents running in parallel, and merged and checked
what came back ([5a94a16](https://github.com/comp4020-agentic-coding-studio/comp4020-final-yue03084-ce/commit/5a94a16), [ac4dc97](https://github.com/comp4020-agentic-coding-studio/comp4020-final-yue03084-ce/commit/ac4dc97), [53eeed5](https://github.com/comp4020-agentic-coding-studio/comp4020-final-yue03084-ce/commit/53eeed5)). It was more
efficient, and while the agents worked I could do other things. But some
details were decided by the agents themselves, such as an example in a text
box, "The second table's numbers", that I didn't understand and later changed
([58e214b](https://github.com/comp4020-agentic-coding-studio/comp4020-final-yue03084-ce/commit/58e214b)). Those need my review and testing afterwards. Without
watching each step, details slip more easily, and every time I come back my
brain has to reload the context. Settling the details before starting still
has a lot of room to improve. I think it's a trade-off, and the point is
finding the balance.

## Directing and correcting the agent

I rewrote `CLAUDE.md` for the new direction: I dropped the *Friends* rules,
picked which crit 7 rules to carry over, and added product rules, such as
"show stopping, never finishing" ([e34cc4a](https://github.com/comp4020-agentic-coding-studio/comp4020-final-yue03084-ce/commit/e34cc4a)). The tests check the
ones that can be checked: nothing private reaches anyone else.

I corrected the agent several times. It read my dislike of anxious
record-keeping as being against records altogether, and it suggested scoring
your attention; I changed that to how you felt about your effort. It also
corrected me: when I wanted the list of what you did to be public, it pointed
out the clash with my own rule, and I kept it private.

Some problems only a person could see. The pixel little one's stretch had arms
like poles past its head; the agent saw nothing wrong, and I found it strange
at a glance ([afde72b](https://github.com/comp4020-agentic-coding-studio/comp4020-final-yue03084-ce/commit/afde72b)). Trying it once, I found its tower filled up
within minutes on my second session, and that tending the tower looked like
doing squats ([0920474](https://github.com/comp4020-agentic-coding-studio/comp4020-final-yue03084-ce/commit/0920474)). It was a little funny, and it showed me I can't
rely on the agent for this. I think from a screenshot the agent infers what
the little one is doing from the things around it and its pose, so it assumes
it's carrying blocks. In crit 10, the little one was only sliding sideways for
the same reason ([134e2ea](https://github.com/comp4020-agentic-coding-studio/comp4020-final-yue03084-ce/commit/134e2ea)). Some corrections went into the harness so
they wouldn't happen again: CI went red once because a test's hours "7.5"
matched inside a timestamp, and that rule is now in `CLAUDE.md`
([5ada816](https://github.com/comp4020-agentic-coding-studio/comp4020-final-yue03084-ce/commit/5ada816)).
