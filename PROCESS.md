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

## Directing and correcting the agent

I rewrote `CLAUDE.md` for the new direction: I dropped the *Friends* rules,
picked which crit 7 rules to carry over, and added product rules, such as
"show stopping, never finishing" ([e34cc4a](https://github.com/comp4020-agentic-coding-studio/comp4020-final-yue03084-ce/commit/e34cc4a)). The tests check the
ones that can be checked: nothing private reaches anyone else.

I corrected the agent several times. It read my dislike of anxious
record-keeping as being against records altogether; I explained I only reject
records that magnify anxiety. It suggested scoring your attention, and I
changed that to how you felt about your effort. When I wanted the list of what
you did to be public, it pointed out the clash with my own rule, and I kept it
private. For the look, the design skill first proposed a purple landing page; I
asked for something quiet and imperfect, and chose the looping scene of figures
who build a crooked tower, then rest ([10e3f24](https://github.com/comp4020-agentic-coding-studio/comp4020-final-yue03084-ce/commit/10e3f24)).

When I checked it myself, the little one was only sliding sideways and never
moved a block. The agent couldn't catch this from screenshots, and it was fixed
so that each trip lays a block on the tower ([134e2ea](https://github.com/comp4020-agentic-coding-studio/comp4020-final-yue03084-ce/commit/134e2ea)). Some
corrections went into the harness so they wouldn't happen again. CI went red
once because a test's hours value "7.5" matched inside a timestamp. Nothing had
leaked, but the rule for writing such tests is now in `CLAUDE.md`
([5ada816](https://github.com/comp4020-agentic-coding-studio/comp4020-final-yue03084-ce/commit/5ada816)). A form sent with no body crashed the server with a 500, and
now there's a test for it ([7d755f0](https://github.com/comp4020-agentic-coding-studio/comp4020-final-yue03084-ce/commit/7d755f0)).
