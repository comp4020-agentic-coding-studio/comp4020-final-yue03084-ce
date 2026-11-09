# Where a lesson goes: why agent harnesses fill up by default

Two pieces of advice about coding agents are now common sense. When the agent
gets something wrong, write the fix into the harness so it doesn't happen twice:
[Klaassen](https://every.to/c/compounding-engineering) calls this compound
engineering, and
[Willison](https://simonwillison.net/guides/agentic-engineering-patterns/hoard-things-you-know-how-to-do/)'s
version is to "hoard things you know how to do". And keep the harness lean,
because the agent reads its instruction file on every turn. I agree with both,
but the hard part is the step in between: deciding where a lesson should live.
The literature explains each place a lesson can go, but not how to choose. When
nobody notices the choice, the lesson goes to the file the agent loads every
time, and a harness meant to reduce cognitive debt starts adding to it.

## What only a person can hold

[Storey (2026a)](https://queue.acm.org/detail.cfm?id=3807966) distinguishes
three kinds of debt: technical debt in the code, cognitive debt in people's
heads, and intent debt, the goals, constraints and reasons nobody wrote down.
The idea goes back to [Naur
(1985)](https://gwern.net/doc/cs/algorithm/1985-naur.pdf): a program is a theory
held by the people who built it. My site never shows who anyone is. A sub-agent
took that to mean the pixel characters needn't belong to anyone, so a
character's look went by its place in a queue, and whenever one person left,
the characters behind them changed. I saw it in hair colour, as nobody had
unlocked anything else yet. No test failed, because I had never decided how it
should work. The agent hadn't misunderstood me; it had filled a gap with a
default. Intent debt came first, cognitive debt after. The same happens to the
harness: a decision nobody makes gets made by default.

## A lesson has several places to go

[Böckeler (2026)](https://martinfowler.com/articles/harness-engineering.html)
splits a harness into guides, which steer the agent before it acts, and sensors,
which check afterwards, and prefers tests to markdown rules. A test runs on
every check, and nobody has to read it. A skill is loaded only when its task
comes up. `CLAUDE.md`, the instruction file, is read every turn. Git history is
read when someone asks why. What separates them is who will read a lesson, and
when. Each time I fixed a bug and kept the lesson, I never asked.

## What the default looks like

[Galster et al. (2026)](https://arxiv.org/abs/2602.14690) looked at 2,853
repositories set up for coding agents and found context files far ahead of
everything else, often the only mechanism, with skills and subagents rare. My
harness fits, except that I don't think I ever chose. My `CLAUDE.md` grew from
1,179 words in mid-October to 5,851 by early November. I wanted each lesson down
quickly, never noticed a choice, and the agent didn't raise it.
Browser-screenshot steps that only some sessions needed sat there instead of in
a skill. By the end I had stopped reading it. [Storey
(2026b)](https://margaretstorey.com/blog/2026/02/18/cognitive-debt-revisited/)
warns that documents are "not sufficient if they are not living artifacts that
teams actively engage with". Mine was living only for the agent, and the gap
between what it said and what I understood was cognitive debt again, inside the
harness.

Asked afterwards, the question splits the fix that made each character its
account's three ways. That a character must not change when someone else leaves
can be checked by a machine, so it belongs in a test, and one now exists. That a
character belongs to its account is needed whenever the agent touches that code,
so it earns one line in `CLAUDE.md`. That hair went by queue position until 3 November, as a sub-agent's
default, matters only when someone asks why, so it belongs in git. My
`CLAUDE.md` holds all three in one paragraph, and that is typical: 50 such notes
of history in italics make up about 1,350 of its 5,851 words.

## Two objections

One objection: sorting every lesson takes time, and one file keeps things
moving. But the cost just arrives later, and sorting is one question. Another is
that context windows keep growing. But a rule among thousands of words may carry
less weight even if the agent reads them all, and a person who stops reading the
harness can't steer with it. Nor has "write more down" been shown to work: the
evidence for compound engineering is mostly anecdote, as is mine, from one
project.

## Placing, not just writing

Good practice, then, isn't only writing lessons down but placing them: a test
when a machine can check it, a skill when only some tasks need it, a short line
in the instruction file when it must be read every time, and the history left to
git. Like the intent behind a feature, it's a decision a person has to make;
otherwise it gets made by default.

## References

- Böckeler, B. (2026). [Harness engineering for coding agent users](https://martinfowler.com/articles/harness-engineering.html). martinfowler.com, 2 April.
- Galster, M., Mohsenimofidi, S., Lulla, J. L., Abubakar, M. A., Treude, C., & Baltes, S. (2026). [Harness engineering for agentic AI coding tools: An exploratory study](https://arxiv.org/abs/2602.14690). arXiv:2602.14690.
- Klaassen, K. (2025). [Compounding engineering](https://every.to/c/compounding-engineering). Every.
- Naur, P. (1985). [Programming as theory building](https://gwern.net/doc/cs/algorithm/1985-naur.pdf). *Microprocessing and Microprogramming*, 15(5), 253–261.
- Storey, M.-A. (2026a). [From technical debt to cognitive and intent debt](https://queue.acm.org/detail.cfm?id=3807966). *ACM Queue*, 24(2).
- Storey, M.-A. (2026b). [What I'm hearing about cognitive debt (so far)](https://margaretstorey.com/blog/2026/02/18/cognitive-debt-revisited/). Blog, 18 February.
- Willison, S. (2026). [Hoard things you know how to do](https://simonwillison.net/guides/agentic-engineering-patterns/hoard-things-you-know-how-to-do/). *Agentic Engineering Patterns*.
