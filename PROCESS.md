# Process overview

## From the brief to the idea

My first idea was a film-location check-in app. I dropped it because it was
really a single-player lookup tool: whether anyone else was there made no
difference, and I'm not that into visiting filming locations myself. I also
considered a discussion space you could only enter after watching something,
but a single social media post could do the same job.

What I actually enjoy is the moment of recognition: coming across a place that
looks like something from a show I know well. I wanted to build for people who
feel the same way. Sitcoms suit this because they have fixed sets, which are
easy to set up as scenes, and most of the story happens in them, so fans
remember them well. I chose Monica's apartment from *Friends* because I like it
myself, and it's a classic that I expect many people would recognise
([bd31b3e](https://github.com/comp4020-agentic-coding-studio/comp4020-final-yue03084-ce/commit/bd31b3e)).

For playing together, I leaned towards cooperation and competition, because
they give the most sense of interaction.

## Stack and workflow

The agent suggested Node with SQLite
([bd31b3e](https://github.com/comp4020-agentic-coding-studio/comp4020-final-yue03084-ce/commit/bd31b3e),
[8ef3b53](https://github.com/comp4020-agentic-coding-studio/comp4020-final-yue03084-ce/commit/8ef3b53)).
I'm not familiar with choosing a stack, so I went with its suggestion. I don't
yet know how I'll build the next step.

Because this was my first time using an agent to generate a lot of fairly
complex images, I wanted to see what the results looked like before building
anything else
([bb23baf](https://github.com/comp4020-agentic-coding-studio/comp4020-final-yue03084-ce/commit/bb23baf)).
I tried three or four rounds, giving the agent photos from different angles as
references, but the results were quite average. Individual parts came out well,
but when they were combined, the proportions were completely wrong.

I was in charge of the idea and its overall direction, and wrote my decisions
into `CLAUDE.md` as rules for the agent
([bd31b3e](https://github.com/comp4020-agentic-coding-studio/comp4020-final-yue03084-ce/commit/bd31b3e),
[dc95eee](https://github.com/comp4020-agentic-coding-studio/comp4020-final-yue03084-ce/commit/dc95eee)).
The agent handled the code and the technical decisions I'm not familiar with.

The scene turned out to be too complex. That made it too hard both to build and
to play, so I don't think it's realistic. I'm planning to change direction for
the next crit.
