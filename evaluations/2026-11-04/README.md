# Architecture maps: iteration toward Excellent

Real Claude Code map generations, rendered by the actual Vibeprint daemon/web client at 1194 × 834 (iPad landscape), followed by a fresh image-and-source review. All ten rubric dimensions use 0–4; totals are computed from those scores. Starting at round 4, generation and judging explicitly request claude-opus-5-5 and verify the modelUsage receipt returned by Claude Code. Generation uses a second source audit and the previous reviewer’s findings; the judge is given no previous scores or target to reach. Generator and judge share a provider, in separate contexts. This is a model-assisted evaluation, not an independent human cold-read study.

[Visual gallery](index.html). Target: every project scores at least 36/40. Status: all latest diagrams reach Excellent.

| Project | Score history | Latest verdict | Judge |
|---|---|---|---|
| Outbound (Threadline checkout) | 10 → 21 → 27 → 26 → 33 → 30 → 33 → 33 → 30 → 31 → 38 /40 | Excellent | claude-opus-5-5 |
| Crumb | 13 → 19 → 28 → 29 → 29 → 27 → 27 → 28 → 29 → 30 → 35 → 39 /40 | Excellent | claude-opus-5-5 |
| Vibeprint | 11 → 19 → 29 → 27 → 30 → 28 → 30 → 33 → 35 → 32 → 38 /40 | Excellent | claude-opus-5-5 |

## Changes

- Round 1: original prompt and renderer; bare component graphs.
- Round 2: scoped runtime questions, audience, real deployment/trust containers, flow labels/modes, source-linked operational notes, deliberate omissions and provenance. Rendering defects remained visible.
- Round 3: sampled rectangle outlines, orthogonal obstacle-aware connectors, parallel attachment lanes, clear-space labels with flow keys, and shorter labels. Scores reached 27 / 28 / 29.
- Rounds 4–6: explicit Opus 5.5 model receipts, a second implementation-level source audit, prior-review feedback, narrower workflows and typeset map text. Original hand ink remains unchanged.
- Round 7: compound Dagre layout reserves full edge labels and separates deployment containers; bundled DejaVu Sans and exact glyph advances replace approximate wrapping.
- Rounds 8–10: restructure around useful concurrency, autosave and sketch-persistence questions; make loss windows, retries and exception paths explicit. Human redesign guidance is archived in iteration-guidance.json.
- Round 11: preserve timer self-loops through the complete pipeline, check that rendering drops no units/flows, enlarge flow labels, use wider annotations and reduce padding. The generator now receives its previous map as well as reviewer findings. Judge instructions apply the supplied anchors literally and distinguish genuine errors from optional enhancements; all earlier scores remain unchanged.
- Round 12: replace malformed compound self-loop geometry with a contained U between distinct ports, reserve room inside its host frame, mask line strokes behind flow labels in browser and PNG exports, and increase boundary/source/provenance text. A regression checks the whole self-loop stays inside a frame.

## Limits

- No production system was accessed or verified. Freshness is capped at 3/4 by the judge. Date/revision describe source review, not live deployment. Unverified ownership remains explicit; no maintainer is invented for a higher score.
- Read each latest review’s factual objections before relying on its diagram. Earlier trials contained an overbroad Outbound fail-closed claim and an unconditional-looking optional Claude API; those historical artifacts remain unchanged.
- A fresh model cold read does not prove a new human understands the diagram. Scores can vary between model calls; the exact receipt is saved for new rounds. Read the evidence and screenshots alongside the total.
- Request arrows include their response as stated in the visible key; independently initiated flows need their own arrows. Reviewer suggestions are checked against source rather than blindly applied.
- The questions and scope evolve between rounds, so score histories measure revised views rather than a fixed benchmark. Latest focused views do not replace a complete system overview or linked screen/detail navigation.
- These trials evaluate Map this repo. The existing Clean up path still uses the simpler reconciliation layout; carrying presentation metadata through cleanup is a follow-up.
- Source project checkouts, live canvases and daemons were preserved. All generated canvases used isolated temporary state. No npm publish, public deployment or live-daemon upgrade was performed.
- Exact prompts/model builds were not archived for the first nine trials. Round 4 onward archives generation recipes, judge prompts and actual model receipts. Completed reviews are immutable and skipped on rerun.

## Outbound (Threadline checkout)

| Dimension | R1 | R2 | R3 | R4 | R5 | R6 | R7 | R8 | R9 | R10 | R11 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Purpose and audience | 0 | 3 | 4 | 4 | 4 | 4 | 4 | 4 | 4 | 4 | 4 |
| Abstraction consistency | 2 | 3 | 3 | 3 | 4 | 3 | 4 | 4 | 3 | 3 | 4 |
| Completeness vs. focus | 2 | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 4 | 3 | 4 |
| Relationships and data flow | 1 | 1 | 2 | 2 | 3 | 3 | 3 | 3 | 2 | 3 | 4 |
| Boundaries and grouping | 0 | 1 | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 4 |
| Visual clarity and layout | 2 | 1 | 2 | 2 | 3 | 2 | 3 | 3 | 2 | 3 | 3 |
| Notation and legend | 1 | 2 | 2 | 2 | 3 | 3 | 3 | 4 | 3 | 3 | 4 |
| Failure modes and non-functional insight | 0 | 3 | 3 | 3 | 4 | 3 | 4 | 3 | 3 | 3 | 4 |
| Accuracy and freshness | 1 | 2 | 2 | 2 | 3 | 3 | 3 | 3 | 3 | 3 | 3 |
| Standalone comprehension | 1 | 2 | 3 | 2 | 3 | 3 | 3 | 3 | 3 | 3 | 4 |

### Round 1: 10/40 — Redo

[Diagram](threadline/round-1/diagram.png) · [Editable canvas](threadline/round-1/canvas.json) · [Map](threadline/round-1/map.json) · [Review](threadline/round-1/review.json) · [Render metrics](threadline/round-1/render.json)

Judge: Claude Code; reviewed 2026-11-04T04:05:43.475Z; source f467a33. Browser errors: 0. Fit-to-screen text: 12.4–12.4 px, excluding arrow labels.

Cold read: A Scout CLI sends data over HTTP to a Web app. The Web app calls an Engine. The Engine writes to Postgres over SQL, uses a Sources module that calls Apollo/Exa, calls OpenRouter for LLM work, and also talks to a LinkedIn browser and the Gmail API. From the picture alone I can't tell what the system is for (outbound sales prospecting), who uses it, that sending is gated on an owner click, where each part runs, or how replies come back.

- **Purpose and audience: 0/4.** There is no title, caption, or question stated. The image is nine red boxes with no context, so a viewer cannot tell it describes an owner-only outbound sales tool.
- **Abstraction consistency: 2/4.** Most boxes sit at one level (clients, a module, a service, a DB, external APIs). 'Sources' is a code subfolder (lib/sources/) shown as a peer of deployed services, and the 'Apollo / Exa' box merges two vendors into one.
- **Completeness vs. focus: 2/4.** The main pieces are present. Missing: the cron/hourly-fill trigger, the owner-click send gate (the core invariant in CLAUDE.md), and the external sources GitHub, HN and X. Scout's yc/gh/bird tools are also left out.
- **Relationships and data flow: 1/4.** Web→Engine and Engine→Sources have no labels. The Engine→Gmail edge has no visible label and runs straight through the LinkedIn browser box, so the 'runs' label looks like it belongs to that edge. Gmail reads replies and bounces, but the diagram only shows one direction. Nothing marks sync vs. async or the order of steps.
- **Boundaries and grouping: 0/4.** There are no containers. Nothing separates Vercel from the Fly.io browser service, AWS RDS, the local CLI, or the third-party APIs.
- **Visual clarity and layout: 2/4.** The top-down direction is clear. The Gmail arrow cuts through the LinkedIn browser box. Edge labels are tiny (about 6px), and the content fills only the middle of the canvas, leaving the left third empty.
- **Notation and legend: 1/4.** Everything uses the same red rectangle except the Postgres cylinder. Externals, clients and modules look identical and there is no legend. The names themselves are real.
- **Failure modes and non-functional insight: 0/4.** No failure modes, retries, rate limits, LinkedIn session fragility, cron schedule, or approval gate are shown.
- **Accuracy and freshness: 1/4.** The visible names match the repo: lib/gmail.ts, lib/ai.ts, lib/linkedin.ts and lib/engine.ts exist. But the image has no date, version or owner, and nothing was checked against production.
- **Standalone comprehension: 1/4.** A newcomer would see a web app calling an engine that fans out to services. They would not learn what the product does, that sends need a human click, or how replies come back.

Reviewer-reported inaccuracies:

- The Engine→Gmail edge has no visible label (the map says 'send') and passes through the LinkedIn browser box, so the 'runs' label reads ambiguously.
- Gmail is shown as send-only, but lib/gmail.ts and the engine's reply detection also read replies and bounces, so the flow goes both ways.
- Sources (lib/sources/) also calls YC, GitHub, HN, X and websites. The diagram shows only Apollo/Exa.
- Scout CLI's local dependencies (yc/gh/bird for X) are left out, and so is the cron/hourly-fill entry point into the web app.

Next changes:

- Add a title, for example 'Threadline outbound: how prospects are found, drafted and sent (owner-click gated)', plus a date, the source revision and an owner.
- Group nodes into labeled deployment/trust containers: local machine (Scout), Vercel (web + engine + cron), Fly.io (LinkedIn browser), AWS RDS, and third-party APIs. Add a legend that uses shape as well as color.
- Label every edge in readable type and reroute Gmail so it doesn't cross the browser box. Show the reply path back from Gmail, the cron trigger, and the owner Send gate (sendMessage), and note LinkedIn session fragility as a failure point.

### Round 2: 21/40 — Mediocre

[Diagram](threadline/round-2/diagram.png) · [Editable canvas](threadline/round-2/canvas.json) · [Map](threadline/round-2/map.json) · [Review](threadline/round-2/review.json) · [Render metrics](threadline/round-2/render.json)

Judge: Claude Code; reviewed 2026-11-04T04:09:08.055Z; source f467a33. Browser errors: 0. Fit-to-screen text: 10.5–20.9 px, excluding arrow labels.

Cold read: The owner clicks Send on the Today page. The Next.js app on Vercel claims the draft in Postgres (RDS), runs fail-closed checks (24h limits, a fresh Gmail reply check, in-touch status), then either sends the email through the Gmail API or queues a LinkedIn run on a Fly.io browser worker and polls it for status. The worker drives Chromium into LinkedIn only through a home Tailscale exit node. A Fly machine calls /api/cron every hour to refresh replies and confirm queued actions; it never sends. Prospect finding and AI drafting are out of scope.

- **Purpose and audience: 3/4.** Clear visible title question plus an audience/scope subtitle. Undermined by the broken rendering, which makes the answer hard to read off the body.
- **Abstraction consistency: 3/4.** Seven boxes, all at the runtime-unit level (owner, web app, Postgres, cron, worker, Gmail, LinkedIn). The 'home exit node' appears only as prose inside the LinkedIn box and the Third parties frame, not as its own unit.
- **Completeness vs. focus: 3/4.** Omissions are stated deliberately ('Outside this view…'). The Vercel daily 15:00 cron is missing (vercel.json:7). The cron's hourly fillPipeline is shown only as 'refresh', with no note that it also sources and drafts.
- **Relationships and data flow: 1/4.** Edge labels collide and can't be read: '[sync] HTTPS: bearer /[sync] HTTPS: refresh reply scan', 'claim draft, [as[sync] HTTPS: poll run status'. The cron→web arrow appears to run left to right toward Gmail, so its direction is misleading. Two web→gmail edges stack on top of each other, and the arrowheads to the worker are unclear.
- **Boundaries and grouping: 1/4.** The frames are drawn as huge curved, distorted shapes that cross into each other and over node text. They label zones but don't show clear containment. The Fly frame is labeled 'self-hosted' and the Vercel frame 'managed', which helps a little.
- **Visual clarity and layout: 1/4.** Left-to-right columns are aligned, but the frame strokes slash through every box. Labels overprint each other ('Chromium via Tailscale SOCKS5' over 'external · Invites'), and much of the canvas is empty top whitespace. At 1194x834 the body text is small and partly hidden.
- **Notation and legend: 2/4.** There is a visible reading key explaining frames, boxes and [sync]/[async] tags. Everything is red, and the one 'blue' convention is unused. Node shapes don't differ by kind, and the frame artifacts contradict the key's 'frames' meaning.
- **Failure modes and non-functional insight: 3/4.** The three visible notes give real failure behavior: fail-closed pre-send checks, the single send path, and worker exit-node gating with no replay. There is nothing on Gmail token expiry, LinkedIn session revocation, or the cron time bound (~230s).
- **Accuracy and freshness: 2/4.** Dated, with revision f467a33 + local edits and 'Live runtime NOT verified' stated. Owner Unassigned. Mostly matches AGENTS.md:241-242 (Fly hourly machine), but it omits the Vercel daily cron and isn't production-verified.
- **Standalone comprehension: 2/4.** The title, notes and key carry the story. The diagram body itself can't be read without the JSON or a walkthrough because of the overlapping labels and frame artifacts.

Reviewer-reported inaccuracies:

- vercel.json:7 defines a Vercel cron for /api/cron daily at 15:00 UTC. The diagram shows only the Fly hourly cron.
- AGENTS.md:154: the hourly cron also runs fillPipeline (sourcing/drafting). 'Hourly cron … to refresh' understates this, and the out-of-scope note doesn't say that it's triggered here.
- The cron→web arrow renders as a long left-to-right line ending at Gmail API, so the visible direction and target are misleading.
- The home exit node (the Jetson, per the worker's Tailscale setup in browser/worker.py) is grouped under 'Third parties / external managed services', but it is owner-run hardware.

Next changes:

- Fix the renderer: draw frames as plain rectangles that fully contain their nodes, and route edge labels so they never overlap each other or node text. Merge the two web→gmail edges into one labeled edge.
- Route cron→web visibly into the Web app box (for example from below), and add the Vercel daily 15:00 cron as a second trigger. Note that the hourly run also fills the pipeline.
- Show the home exit node as its own self-hosted node between the worker and LinkedIn. Use a non-color signal for async (dashed lines) and different shapes for the DB and external nodes, and put the most likely failure points on the edges (Gmail token, LinkedIn session revoked).

### Round 3: 27/40 — Mediocre

[Diagram](threadline/round-3/diagram.png) · [Editable canvas](threadline/round-3/canvas.json) · [Map](threadline/round-3/map.json) · [Review](threadline/round-3/review.json) · [Render metrics](threadline/round-3/render.json)

Judge: Claude Code; reviewed 2026-11-04T04:19:06.203Z; source f467a33. Browser errors: 0. Fit-to-screen text: 8.3–16.6 px, excluding arrow labels.

Cold read: The owner reviews drafts in a Next.js app on Vercel and clicks Send. The server claims the message row in RDS Postgres by changing draft to sending. For email, it checks Gmail for replies and then sends through the Gmail API. For LinkedIn, it queues a run on a browser-use worker on Fly and polls it. The worker drives Chromium with OpenRouter model steps, and its traffic goes over SOCKS5 through the owner's home Tailscale exit node to LinkedIn. If that node is down, runs stay queued and expire after 24h. LinkedIn sends that don't confirm within 30s stay 'sending' until a refresh confirms them. OpenRouter also drafts messages.

- **Purpose and audience: 4/4.** The title asks one clear question ('how does an owner-approved message reach a prospect?'), and the subtitle gives the audience (new engineers) and the scope.
- **Abstraction consistency: 3/4.** The boxes are mostly runtime units. 'Home exit node' is a machine sitting next to services, and the Web app box names a code file (lib/engine.ts). There are no zoom-in views.
- **Completeness vs. focus: 3/4.** The send path is covered and omissions are listed in the 'Outside this view' line. Draft prompts to OpenRouter aren't part of the send question, so they're noise. The send preconditions (daily limits, stage checks) are missing.
- **Relationships and data flow: 2/4.** Edges are labeled, but the path to LinkedIn is hard to trace: SOCKS5 traffic runs from the worker back left to the exit node, then page actions runs all the way right to LinkedIn, crossing the Fly frame. At this size I can't tell whether 'queue run, poll' is dashed for async. The Gmail edge's 'reply check, send' doesn't show order.
- **Boundaries and grouping: 3/4.** Four labeled frames describe local vs hosted-managed vs self-hosted vs vendor. The owner frame mixes a browser with an always-on proxy machine, and the Tailscale trust link isn't shown.
- **Visual clarity and layout: 2/4.** Columns go left to right, but long orthogonal edges cross several frames and each other (page-actions, SOCKS5, draft prompts, agent steps). The 'SQL: claim+status' label collides with the arrow. Box description text and the notes are small at 1194x834.
- **Notation and legend: 2/4.** There is a reading key, but at viewing size solid, dashed and dotted lines are hard to tell apart. Everything is the same red, so the 'AI red; your additions blue' key has nothing to point to. Box types are shown in text, which is a good non-color signal.
- **Failure modes and non-functional insight: 3/4.** Three notes cover the fail-closed claim, the exit-node SPOF with its 24h TTL, and async confirmation. However, the fail-closed note is contradicted by the code, and daily limits aren't shown.
- **Accuracy and freshness: 2/4.** It is dated with revision f467a33 + local edits, the owner is 'Unassigned', and the footer says the runtime was not verified. Most names match the code, but the fail-closed claim is wrong.
- **Standalone comprehension: 3/4.** A newcomer would get the overall send path. They would likely misread the LinkedIn routing, and the inaccurate fail-closed note would mislead them.

Reviewer-reported inaccuracies:

- The 'Single send path, fail-closed' note says nothing is sent if the reply check fails. In lib/engine.ts:1383 the call is `checkReplies([person]).catch(() => 0)`, so a failed Gmail check counts as zero replies and the send goes ahead. That is fail-open. The check also only runs when person.lastContactedAt is set and there is no reply.
- The send preconditions in lib/engine.ts:1370-1381 are not shown: the stage gate (replied/meeting/closed) and the daily LinkedIn/email limits.
- Draft prompts to OpenRouter happen at drafting time, not on the send path the title asks about.

Next changes:

- Correct the fail-closed note to match lib/engine.ts:1383 (the reply check fails open and only runs once the person has been contacted), or change the code if fail-closed is what's intended. Add the stage and daily-limit gates.
- Reroute the LinkedIn path so it reads in one direction, e.g. put the exit node between the Fly worker and LinkedIn or draw Tailscale as its own lane. Number the send steps (claim → reply check → Gmail send / queue worker) and use clearly distinguishable dashed async lines.
- Make the text readable at 1194x834: bigger box and note text, fewer crossings, labels that don't overlap arrows. Either use the blue/red convention or drop it from the key, and name an accountable owner.

### Round 4: 26/40 — Mediocre

[Diagram](threadline/round-4/diagram.png) · [Editable canvas](threadline/round-4/canvas.json) · [Map](threadline/round-4/map.json) · [Review](threadline/round-4/review.json) · [Render metrics](threadline/round-4/render.json) · [Generation recipe](threadline/round-4/recipe.json) · [Judge model receipt](threadline/round-4/judge-receipt.json) · [Generator model receipt](threadline/round-4/generator-receipt.json) · [Judge prompt](threadline/round-4/judge-prompt.txt)

Judge: claude-opus-5-5; reviewed 2026-11-04T04:38:28.798Z; source f467a33. Browser errors: 0. Fit-to-screen text: 7.8–15.6 px, excluding arrow labels.

Cold read: The owner clicks Send in their browser, which calls sendMessage in the Next.js app on Vercel. sendMessage claims the draft in Postgres by setting it to 'sending' so it is claimed only once, then checks the daily limit. It checks Gmail for replies; if that check errors, it counts as no reply and the send goes ahead (fails open). It then checks whether the owner is already in touch with the person; if that check errors, the send is blocked (fails closed). For email, the app sends through the Gmail API and marks the row sent. For LinkedIn, it starts a run on a single serial Python/browser-use worker on Fly. The worker drives Chromium through the owner's home Tailscale exit node, waiting up to 24h for that route, and sends the invite or DM. The app waits 75s for the result, after which later polls resolve rows still marked 'sending'. Runs cut off by a restart are marked failed, not retried. Prospecting and X DMs are out of scope.

- **Purpose and audience: 4/4.** Title asks one question (what happens when the owner clicks Send). The subtitle names the audience (new engineers) and scope (sendMessage only).
- **Abstraction consistency: 3/4.** Boxes are mostly runtime units with a type tag. 'Owner' is a person, not a unit, and Postgres is filed under 'Third parties' with the vendor APIs, which is a little odd.
- **Completeness vs. focus: 3/4.** Scope is tight, and the out-of-scope items (Exa/Apollo/LLM, X DMs) are listed at the bottom. There is no visible order of steps (claim, then gates, then send), even though order is the whole question. The worker's own DB or status reporting path is not shown.
- **Relationships and data flow: 2/4.** Edges have labels and use solid for sync and dashed for async. But start/poll is shown only as a footnote marker, 'F1'. The claim/mark and check+send lines run horizontally through the Fly.io worker frame, so they look like they come from the worker. The 'invite / DM' label sits far from its line. Nothing is numbered, so the order is lost.
- **Boundaries and grouping: 3/4.** Four labelled frames: local device, Vercel host, Fly container, external. The managed vs self-run distinction is in text. Edges cutting through the Fly frame blur that boundary.
- **Visual clarity and layout: 2/4.** Reads left to right, but the diagram fills only about 60% of the canvas. Body text is roughly 8–9px at 1194x834 and hard to read. Orthogonal lines overlap and cross the worker frame, and the large empty frame space wastes room.
- **Notation and legend: 2/4.** The key explains frames, boxes, solid/dashed/dotted and caller→recipient. But everything is the same red, so nothing but text separates managed from external. The 'All generated ink is AI red; user additions are blue' line is tool chrome, not something a reader of the system needs. Dotted is in the key but never used.
- **Failure modes and non-functional insight: 3/4.** Notes cover fail-open reply check vs fail-closed in-touch check, the daily limit, the one-time claim, the serial lock, the 75s wait then polling, the exit-node wait with a 24h timeout, and no retry after restarts. None of this is attached to the components it describes, and Gmail-down behavior isn't covered.
- **Accuracy and freshness: 2/4.** Dated, with revision f467a33 + local edits, and it says outright that the live system was not checked and the owner is 'Unassigned', so nobody is accountable. The claims I spot-checked match lib/engine.ts (status 'sending', daily limit, checkReplies .catch(()=>0), resolveLinkedinSend 75_000).
- **Standalone comprehension: 2/4.** A newcomer gets the gist from the notes. But without a walkthrough, the routing makes it easy to think the Fly worker calls Postgres and Gmail, the order of the gates isn't visible, and the small text slows reading.

Reviewer-reported inaccuracies:

- The claim/mark (web→Postgres) and check+send (web→Gmail) lines run horizontally through the Fly.io worker frame, which suggests the worker talks to Postgres and Gmail. sendMessage in lib/engine.ts makes those calls from the web app.
- Postgres is grouped under 'Third parties / vendor services'. The map gives no hosting evidence for that, and it misleads about who owns the data.
- start/poll is shown only as 'F1'. Polling also happens later from refresh (lib/engine.ts:1758–1764, resolveLinkedinSend with 0 wait), which is a separately started event and is not drawn.
- Order matters in lib/engine.ts (~1323–1393: claim, daily limit, reply check, in-touch check, then send), but the edges show no order.
- The key defines a dotted style that is never used and includes a line about the authoring tool's colors that says nothing about the system.

Next changes:

- Number the steps on the edges (1 claim, 2 limit, 3 reply check, 4 in-touch check, 5a Gmail send / 5b start worker, 6 poll/mark) and draw the later refresh poll as its own dashed edge.
- Re-route the web→Postgres and web→Gmail lines around the Fly frame, or move Fly below Third parties. Put start/poll back as an inline label instead of the F1 footnote, and keep 'invite / DM' next to its line.
- Fill the canvas and raise the body text to at least 11px. Use a non-color signal for external vs self-run (shape or fill), drop the tool-chrome key text, and attach each note to the component it describes. Name an owner.

### Round 5: 33/40 — Good

[Diagram](threadline/round-5/diagram.png) · [Editable canvas](threadline/round-5/canvas.json) · [Map](threadline/round-5/map.json) · [Review](threadline/round-5/review.json) · [Render metrics](threadline/round-5/render.json) · [Generation recipe](threadline/round-5/recipe.json) · [Judge model receipt](threadline/round-5/judge-receipt.json) · [Generator model receipt](threadline/round-5/generator-receipt.json) · [Judge prompt](threadline/round-5/judge-prompt.txt)

Judge: claude-opus-5-5; reviewed 2026-11-04T04:41:56.722Z; source f467a33. Browser errors: 0. Fit-to-screen text: 12.5–25.0 px, excluding arrow labels.

Cold read: The owner clicks Send, optionally with edits, on an email draft in the Today or conversation view in their browser. The browser makes a synchronous call to the hosted Next.js server, where sendMessage in lib/engine.ts is the only send path. sendMessage first claims the Postgres message row: it sets the row to 'sending' only if the message is outbound and in draft or failed state, so a second click gets 'skipped'. Next come the checks. The daily email limit is enforced. The Gmail reply check fails open: if it errors, the send goes ahead. The Gmail in-touch check fails closed: if it errors, the send is blocked. If the draft passes, the server sends the email in-thread through the Gmail API and records the row as sent in Postgres. If Gmail is not connected or the send throws, the row becomes 'failed' with the error recorded, and there is no automatic retry; the owner has to click Send again. LinkedIn, X DMs, discovery and drafting are outside this view. The diagram was reviewed from source at f467a33 plus local edits, the live system was not verified, and no owner is assigned.

- **Purpose and audience: 4/4.** The visible title asks one specific question: how one approved email draft gets sent through Gmail. The subtitle names the audience (new engineers) and the scope. The level of detail suits that audience.
- **Abstraction consistency: 4/4.** There are four nodes, each a runtime component: browser, Next.js server, Postgres and Gmail API. Code detail (sendMessage) appears only as a description, not as a separate box.
- **Completeness vs. focus: 3/4.** The diagram is tightly focused, and its omissions are stated in the 'Outside this view' line. But the notes leave out checks that really happen in sendMessage: the person stage/closed check (skipped), missing person, and a missing or bounced email address (lib/engine.ts:1369-1374, 1413).
- **Relationships and data flow: 3/4.** There are three directed, labeled sync arrows. The order only shows up through the numbered notes 1) to 4); the arrows have no sequence numbers. Server to Gmail ('checks, send') bundles two separately timed calls: the in-touch check happens before the send. Nothing shows that the claim comes before the Gmail calls or that 'sent' is written after.
- **Boundaries and grouping: 3/4.** Each node sits in a labeled frame: Owner device (local), Web app (hosted), Database ('hosting not verified') and Google (external, vendor-managed). Each frame holds exactly one node, so the frames add little grouping. Trust and ownership between the app and Postgres are left unclear.
- **Visual clarity and layout: 3/4.** Flow runs left to right with good spacing, and text is readable at 1194x834. Problems: the server→Gmail arrow loops over the top of the Database frame, the 'checks, send' label is struck through by the line, and the labels render with stray middle dots ('Send·+·edits', 'claim,-sent'). The top ~120px is empty.
- **Notation and legend: 3/4.** There is a key for frames, boxes, the cylinder and the double border, and the cylinder and double border are non-color signals. The key also defines dashed (async) and dotted (local I/O) lines that never appear. Everything is drawn in a single red, so color carries no meaning.
- **Failure modes and non-functional insight: 4/4.** The notes cover the double-send claim, which checks fail open and which fail closed, and the absence of retries on Gmail errors (the row becomes 'failed' and the owner must click again). All of this matches lib/engine.ts:1345-1466 and fits this small system.
- **Accuracy and freshness: 3/4.** The footer shows the review date, revision f467a33 + local edits, Owner: Unassigned, and 'Live runtime NOT verified'. The claims match the source. The score is capped at 3 because production was not verified, and no owner is assigned.
- **Standalone comprehension: 3/4.** A newcomer could explain the path and the safeguards. They might still think every Gmail call happens after all checks, or that a failed check always yields 'failed'. In fact a reply found or a closed stage yields 'skipped'.

Reviewer-reported inaccuracies:

- The checks note leaves out the person-stage/closed check (lib/engine.ts:1373-1374), which comes before the daily limit and ends in 'skipped'. It also leaves out the missing-person check (1369) and the no-usable/bounced-email check (1413).
- The note implies every check failure produces 'failed'. Actually, 'already replied' and a closed stage set the row to 'skipped' (lib/engine.ts:1374, 1384); only the limit, in-touch and Gmail errors set 'failed'.
- Replies the owner writes from a conversation skip the reply and in-touch checks (lib/engine.ts:1382, 1389: `!reply`). The diagram presents those checks as unconditional.
- The single 'checks, send' arrow merges two Gmail calls made at different times: the in-touch check happens before the send, and markSent writes to the DB after it (lib/engine.ts:1393, 1426-1435).

Next changes:

- Number the arrows (1 claim, 2 checks, 3 send, 4 record sent) and split server→Gmail into separate 'history check' and 'send' edges, so the order is visible without reading the notes.
- Fix the edge rendering: route server→Gmail so it doesn't cross over the Database frame, keep the line from striking through its label, and remove the stray dot glyphs from the labels. Drop the dashed and dotted entries from the key, since no edge uses them.
- Correct the checks note: add the stage, person and email-address checks, distinguish 'skipped' from 'failed' outcomes, mention that conversation replies bypass the cold checks, and assign an owner.

### Round 6: 30/40 — Good

[Diagram](threadline/round-6/diagram.png) · [Editable canvas](threadline/round-6/canvas.json) · [Map](threadline/round-6/map.json) · [Review](threadline/round-6/review.json) · [Render metrics](threadline/round-6/render.json) · [Generation recipe](threadline/round-6/recipe.json) · [Exact generator queries](threadline/round-6/generator-queries.json) · [Renderer hashes](threadline/round-6/render-source.json) · [Judge model receipt](threadline/round-6/judge-receipt.json) · [Generator model receipt](threadline/round-6/generator-receipt.json) · [Judge prompt](threadline/round-6/judge-prompt.txt)

Judge: claude-opus-5-5; reviewed 2026-11-04T04:51:30.859Z; source f467a33. Browser errors: 0. Fit-to-screen text: 10.6–21.2 px, excluding arrow labels.

Cold read: The owner clicks Send in the web app. That calls a Next.js server action on Vercel (sendMessage). The server first claims the message row in Postgres: only outgoing draft or failed rows flip to 'sending', so a double click or a second tab sends once and returns 'skipped'. It then calls Gmail to check whether the prospect replied, and whether the owner is already in touch with them outside this sequence. If the guards pass, it sends through Gmail and gets back the message and thread ids. Finally it marks the row sent or failed in Postgres. Closed stage or an existing reply gives 'skipped'. A missing person, the daily limit, an in-touch hit, a bad email address or a Gmail error gives 'failed'. If the reply check errors, the send goes ahead. If the in-touch check errors, the send is blocked. LinkedIn and X DMs are out of scope.

- **Purpose and audience: 4/4.** The title asks one exact question: how an approved email draft gets checked and sent through Gmail. The subtitle names the audience (new engineers) and the scope. The level of detail suits that audience.
- **Abstraction consistency: 3/4.** All four boxes are runtime actors or stores at the same level. The notes mix in code-level guard details, which is acceptable. Database reads (person, settings, campaign, daily count) are folded into 'checks' with no zoom-in view.
- **Completeness vs. focus: 3/4.** The diagram is tight, and the omissions are noted explicitly (LinkedIn, X, finding and drafting). Missing: the database reads before the guards (loadSettings, people, sentInLastDay, campaigns) and the in-touch override write to people. Only the claim and the final mark are drawn.
- **Relationships and data flow: 3/4.** The arrows are numbered, labelled and marked sync, and the legend says a response is included. Arrow 2 does not show that the claim also writes the edits. The guard reads are invisible. Arrow 3 looks unconditional; only a note says it is skipped for replies and overrides.
- **Boundaries and grouping: 3/4.** Four labelled zones: owner device, Vercel (managed), Postgres (hosted), Google (external). The 'Owner device' frame implies the web app runs only in the browser, but it is served by the Vercel app. The diagram does not say who hosts Postgres.
- **Visual clarity and layout: 2/4.** The flow runs left to right, but arrow 4 loops over the top of the Postgres frame and arrow 3 runs underneath it. Labels 2, 3 and 5 crowd around the junction next to the database, and the label boxes overlap the lines. The footer text is tiny at 1194x834, and the top of the canvas is mostly empty.
- **Notation and legend: 3/4.** The key explains frames, boxes, the cylinder and the double border, and says the flow type is also written on each arrow. Everything is drawn in one red colour, so the subtle double border is the only external-service cue. A solid line means sync, but there is no other line style to compare it with.
- **Failure modes and non-functional insight: 3/4.** Strong notes cover the idempotent claim, skipped versus failed outcomes, and the asymmetric handling of check errors. Missing: what happens if the process crashes after the claim, which leaves the row stuck in 'sending', and the 'Gmail not connected' failure.
- **Accuracy and freshness: 3/4.** Dated 2026-11-04, revision f467a33 plus local edits. The claims match lib/engine.ts:1339-1441. The owner is unassigned and the live system was not verified, so the score is capped at 3.
- **Standalone comprehension: 3/4.** A new engineer could explain the click → claim → checks → send → record sequence correctly. They might wrongly conclude that the server makes no other database reads, or that both Gmail checks always run.

Reviewer-reported inaccuracies:

- lib/engine.ts:1344-1409: sendMessage also reads settings, people, the daily sent count, firstSentAt and campaigns from Postgres between the claim and the send. None of these reads are drawn.
- lib/engine.ts:1352-1353: the claim also writes the owner's subject and body edits. Arrow 2 is labelled only 'claim → sending'.
- lib/engine.ts:1398-1401: an in-touch hit writes the touch details to people.metadata. This write to Postgres is not drawn.
- lib/engine.ts:1382-1389: the reply check runs only if the person has lastContactedAt and the message is not a reply. The in-touch check is skipped for replies and overrides. Arrow 3 looks unconditional.
- lib/engine.ts:1415: 'Connect Gmail in Settings first' is a failure path that is missing from the 'Skipped vs failed' note.
- The web app is drawn only inside 'Owner device', but it is served by the Next.js app on Vercel.

Next changes:

- Re-route arrows 3 and 4 so they don't wrap around the Postgres frame. For example, put Gmail directly right of the app server and Postgres below it. This removes the crowded label junction and makes the footer text larger.
- Add a 'reads person/settings/limits' database arrow and mark arrow 3 as conditional (skipped for replies and overrides), so the guard phase is visible.
- Add the crash-after-claim risk (a row stuck in 'sending') and the 'Gmail not connected' failure to the notes. Add a non-colour cue for external services beyond the thin double border.

### Round 7: 33/40 — Good

[Diagram](threadline/round-7/diagram.png) · [Editable canvas](threadline/round-7/canvas.json) · [Map](threadline/round-7/map.json) · [Review](threadline/round-7/review.json) · [Render metrics](threadline/round-7/render.json) · [Generation recipe](threadline/round-7/recipe.json) · [Exact generator queries](threadline/round-7/generator-queries.json) · [Renderer hashes](threadline/round-7/render-source.json) · [Judge model receipt](threadline/round-7/judge-receipt.json) · [Generator model receipt](threadline/round-7/generator-receipt.json) · [Judge prompt](threadline/round-7/judge-prompt.txt)

Judge: claude-opus-5-5; reviewed 2026-11-04T04:54:24.316Z; source f467a33. Browser errors: 0. Fit-to-screen text: 9.0–18.0 px, excluding arrow labels.

Cold read: The owner clicks Send in the Today or conversation UI in their browser. A Next.js server action on Vercel runs sendMessage. It first claims the message row in Postgres, changing it from draft/failed to 'sending' and saving any edits, so a double click sends only once. Next come the guards: the daily email limit (if exceeded, the row is marked failed); the check for an earlier reply from this person (if that check errors, it counts as no reply and sending continues); and a Gmail check for existing contact outside the sequence (if that check errors, nothing is sent; owner override and replies skip it). Then it checks that the address is usable and that Gmail is connected, sends through the Gmail API, and marks the row sent. Every failure leaves the row 'failed', and failed rows can be claimed again. A crash in the middle of a send can leave a row stuck in 'sending'. LinkedIn and X sends, and the discovery/research pipeline, are deliberately left out.

- **Purpose and audience: 4/4.** The visible title asks one specific question ('how does an approved email draft get sent through Gmail?'). The subtitle names the audience (new engineers) and the scope (the email branch of sendMessage).
- **Abstraction consistency: 4/4.** All four nodes are runtime components at the same level (browser, app server, Postgres, Gmail API). No code modules, teams or concepts are mixed in.
- **Completeness vs. focus: 3/4.** The omissions are stated in the image ('Outside this view…'). Some steps are missing: the closed-stage and 'already replied' checks end as skipped rather than failed, and the person/campaign/thread reads are folded into 'read'.
- **Relationships and data flow: 3/4.** Arrows are directed, labelled and marked sync, and the legend says a response is included. But '2/4. claim, read, mark' merges several separately ordered DB calls, and '3. checks, send' merges the reply check, the in-touch check and the send, so the real order (claim → limit read → Gmail checks → DB reads → send → mark) is lost.
- **Boundaries and grouping: 3/4.** Labelled frames for owner device, Vercel, Postgres and Google, with local/hosted/external/managed notes. The Postgres frame says 'Hosted database' but not who hosts it. Each frame holds a single node, so the grouping adds little.
- **Visual clarity and layout: 3/4.** Clear left-to-right flow with no crossings. Edge labels and frame sublabels are very small (about 8px) at 1194x834. The App server's diagonal leader lines to the edges look awkward, and a lot of space is wasted.
- **Notation and legend: 3/4.** The key explains frames, boxes, the cylinder, the double border and arrow semantics, and flow type is written as text, not just colour. Everything is one red colour, and the Postgres frame and node share a name, which is redundant.
- **Failure modes and non-functional insight: 4/4.** Three notes cover the atomic claim and double-click safety, a row stuck in 'sending' after a crash, which guards fail open and which fail closed, the daily limit, and retryable failed rows. All of this matches lib/engine.ts:1345-1415.
- **Accuracy and freshness: 3/4.** The footer shows the date, revision f467a33 + local edits, 'Owner: Unassigned' and 'Live runtime NOT verified'. The names match the code. There is no production verification and no owner, so 3 is the cap.
- **Standalone comprehension: 3/4.** A newcomer could explain the click → claim → guards → Gmail → mark flow. The merged step numbers and the small text may need a short walkthrough to get the exact order right.

Reviewer-reported inaccuracies:

- Several guard outcomes are not shown: a closed person stage and 'already replied' end the attempt as 'skipped', not 'failed' (lib/engine.ts:1373-1384). The notes only mention 'skipped' for the claim race.
- If the person no longer exists, the row is marked failed (lib/engine.ts:1369). No note mentions this.
- The label '2/4. claim, read, mark' hides DB reads that happen after the Gmail checks (firstSentAt, the campaign and previous emails at lib/engine.ts:1390-1416). Because of that, a single step 3 between steps 2 and 4 is not the true order.
- The in-touch check is skipped only when the inTouchOverride flag is set or when sending a reply (lib/engine.ts:1389). That matches the note, but the Gmail edge never shows that a hit is also written back to people.metadata in Postgres (lib/engine.ts:1397-1401).

Next changes:

- Number every call in order (1 claim, 2 limit/person read, 3 reply check, 4 in-touch check, 5 send, 6 mark sent) instead of the merged '2/4' and '3' labels.
- Make edge labels and frame sublabels at least 11–12px at 1194x834, and route the App server's arrows directly instead of through diagonal leaders.
- Show which outcomes end as skipped and which as failed (closed stage and already replied → skipped). Also name an owner and who hosts Postgres.

### Round 8: 33/40 — Good

[Diagram](threadline/round-8/diagram.png) · [Editable canvas](threadline/round-8/canvas.json) · [Map](threadline/round-8/map.json) · [Review](threadline/round-8/review.json) · [Render metrics](threadline/round-8/render.json) · [Generation recipe](threadline/round-8/recipe.json) · [Exact generator queries](threadline/round-8/generator-queries.json) · [Renderer hashes](threadline/round-8/render-source.json) · [Judge model receipt](threadline/round-8/judge-receipt.json) · [Generator model receipt](threadline/round-8/generator-receipt.json) · [Judge prompt](threadline/round-8/judge-prompt.txt)

Judge: claude-opus-5-5; reviewed 2026-11-04T04:58:10.657Z; source f467a33. Browser errors: 0. Fit-to-screen text: 12.9–25.7 px, excluding arrow labels.

Cold read: The owner clicks Send in the Today view or a conversation view in their browser. The browser calls the sendAction server action on the Next.js app server hosted on Vercel, passing the message id and any edits. sendMessage then runs a single atomic UPDATE…RETURNING against the messages table in Postgres. That statement only matches outbound rows whose status is draft or failed. It sets status to 'sending' and saves any edits in the same step. If no row comes back, a second click or another tab has already claimed the draft, so the request returns 'skipped: Already sent or no longer a draft.' This prevents duplicate sends but does not guarantee delivery. Later guards can reset the row to failed or skipped. If the process crashes after the claim, the row stays stuck in 'sending' and can't be claimed again. The health check flags only LinkedIn rows stuck for more than 3h, and nothing recovers email rows automatically. Delivery, drafting, cron jobs and the worker are out of scope.

- **Purpose and audience: 4/4.** The title asks one precise question (how a draft is claimed so a double click can't send it twice). The subtitle names the audience (new engineers) and the scope.
- **Abstraction consistency: 4/4.** There are three runtime boxes at the same level (browser, app server, Postgres), each inside its deployment zone. Code-level detail stays in the notes.
- **Completeness vs. focus: 3/4.** The diagram is tightly focused and the omissions are listed in the footer. However, the race it exists to explain (two concurrent requests where one gets 'none') is only described in text, never drawn, and the 'skipped' reply path back to the browser is not shown.
- **Relationships and data flow: 3/4.** Both arrows are numbered, labelled, marked sync, and the key covers responses. With only two edges the ordering is trivial, and the concurrent second click isn't shown as its own event.
- **Boundaries and grouping: 3/4.** Frames separate the owner device, Vercel (hosted, managed) and Postgres (hosted, provider not verified). Each frame wraps a single node, so they add little beyond the labels. The trust boundary (owner-only auth) isn't shown.
- **Visual clarity and layout: 3/4.** Flow runs clearly left to right with no crossings, and text is readable at 1194x834. Arrow labels are small and sit over the frame borders. About 40% of the canvas is empty top and bottom while the notes are dense.
- **Notation and legend: 4/4.** The key explains frames, boxes, the cylinder, arrow direction including the response, and sync. Flow type is also written on each arrow, so meaning doesn't depend on colour alone. Names match the code (sendAction, sendMessage, messages).
- **Failure modes and non-functional insight: 3/4.** The notes cover the important failure modes: suppression rather than exactly-once, guards resetting the row to failed or skipped, rows stuck in 'sending' after a crash, the 3h health check for LinkedIn only, and no recovery for email. None of this appears on the drawing itself.
- **Accuracy and freshness: 3/4.** Dated 2026-11-04 at revision f467a33 with local edits. The owner is shown as Unassigned and live runtime is marked NOT verified. The claims match lib/engine.ts:1346-1358. The cap of 3 applies because production was not verified.
- **Standalone comprehension: 3/4.** A newcomer can explain the claim mechanism from the notes, but has to picture the race between two clicks without a drawing of it. The 'skipped' message is never shown returning to the UI.

Reviewer-reported inaccuracies:

- Atomic claim note: the claim UPDATE in lib/engine.ts:1348-1354 also clears error and sets sentAt and updatedAt, which the note omits. This matters because a failed retry clears its previous error.
- The Postgres cylinder says 'draft/failed → sending' but leaves out that the guards in lib/engine.ts:1360-1364 later move the row back to failed or skipped with sentAt set to null. The node suggests a one-way transition.
- The app server node attributes the claim to sendMessage via sendAction (app/(app)/actions.ts:363). That is correct, but sendMessage calls loadSettings() before the claim (engine.ts:1344), so the claim is not the first database call. This is minor.

Next changes:

- Draw the race: show two concurrent Send requests (click 1 and click 2) hitting the same row, with one getting the row back and the other getting 'none → skipped'. That makes the core idea visual instead of text-only.
- Add the response or outcome back to the browser ('skipped: Already sent…' versus continuing to the guards) and a small status-transition strip: draft/failed → sending → sent | failed | skipped | stuck.
- Use the empty vertical space: put the frames and notes closer together, and keep arrow labels off the frame borders. Mark the crash-after-claim risk on the server→Postgres edge itself, not only in a note.

### Round 9: 30/40 — Good

[Diagram](threadline/round-9/diagram.png) · [Editable canvas](threadline/round-9/canvas.json) · [Map](threadline/round-9/map.json) · [Review](threadline/round-9/review.json) · [Render metrics](threadline/round-9/render.json) · [Generation recipe](threadline/round-9/recipe.json) · [Exact generator queries](threadline/round-9/generator-queries.json) · [Renderer hashes](threadline/round-9/render-source.json) · [Judge model receipt](threadline/round-9/judge-receipt.json) · [Generator model receipt](threadline/round-9/generator-receipt.json) · [Judge prompt](threadline/round-9/judge-prompt.txt)

Judge: claude-opus-5-5; reviewed 2026-11-04T05:00:34.575Z; source f467a33. Browser errors: 0. Fit-to-screen text: 7.9–15.8 px, excluding arrow labels.

Cold read: The owner has the same draft open in two browser tabs and clicks Send in both. Each tab calls the Next.js server action sendAction with the message id and the edits. On the server, sendMessage loads settings and then runs a single conditional Postgres UPDATE: WHERE id matches, direction='out' and status is draft or failed. It sets status to 'sending', clears error, stamps sentAt, saves the edits and returns the row. Only one request can match, because the first UPDATE changes the status. That request continues to the guards and delivery; the other gets no row and returns 'skipped'. If a guard fails afterwards, the row becomes failed (Send can claim it again) or skipped (final). If the process crashes after the claim, the row stays 'sending' and nobody can claim it again. The only exception is queued LinkedIn rows with an externalId, which Refresh resolves. Delivery itself is out of scope.

- **Purpose and audience: 4/4.** The visible title asks one clear question (how concurrent Send clicks claim one draft). The subtitle names the audience (new engineers) and the scope, and the detail fits that audience.
- **Abstraction consistency: 3/4.** Tabs, server and DB are all runtime actors at the same level. But 'App server' appears as a node inside an 'App server' frame, and 'Postgres' as a node inside a 'Postgres' frame. These frames repeat the node rather than adding a level.
- **Completeness vs. focus: 4/4.** There are only four nodes, all needed for the race. The 'Outside this view' line names the deliberate omissions: guards, delivery, rate limits, and find/research/draft.
- **Relationships and data flow: 2/4.** Arrows are numbered and labelled. But the legend says 'response included', and the diagram still draws step-3 responses as separate server→tab arrows, which contradicts the key. 'won: on to guards' is not a response the tab receives at that moment; the tab only gets one after guards and delivery finish. Nothing shows that the two step-1 calls race, or which one reaches the UPDATE first.
- **Boundaries and grouping: 3/4.** Frames for Owner device, App server and Postgres label local versus hosted. The owner-only auth boundary (the server action trusts only an owner session) is not shown, and neither is managed versus self-hosted for Postgres.
- **Visual clarity and layout: 2/4.** At 1194x834 most text is about 8–10px: the edge labels, node descriptions, notes and footer are hard to read. The four tab-B/server lines run close together and cross near the server. The content covers about 55% of the width and leaves large empty margins.
- **Notation and legend: 3/4.** There is a visible key for frames, boxes, cylinders and solid sync arrows, and real names (sendAction, lib/engine.ts) are used. Everything is a single red, which is fine for colour-blind readers but gives no extra signal. The convention violation on the step-3 arrows weakens the key.
- **Failure modes and non-functional insight: 3/4.** The notes cover the atomic UPDATE...RETURNING, failed rows being re-claimable while skipped rows are not, and the stuck-'sending' crash case. Nothing is shown on the diagram itself, for example a mark at the claim point. The fact that the claimed 'sending' row counts toward the daily limit is not mentioned.
- **Accuracy and freshness: 3/4.** The footer gives the date 2026-11-04, revision f467a33 plus local edits, 'Owner: Unassigned', and 'Live runtime NOT verified'. The claims match lib/engine.ts:1344-1366. No owner is assigned and nothing was verified in production, so this cannot go higher.
- **Standalone comprehension: 3/4.** A newcomer can explain the race and the single-UPDATE claim from the image and notes alone. They may misread 'won: on to guards' as a response that arrives immediately, and the small text slows reading.

Reviewer-reported inaccuracies:

- The legend says 'response included' for caller→recipient arrows, yet the diagram also draws separate server→tab step-3 arrows. These are responses, not separately initiated events, so the diagram breaks its own key.
- The step-3 label 'won: on to guards' (server→tab A) suggests the tab is told it won. In app/(app)/actions.ts:363-372 and lib/engine.ts:1339+, the winning tab gets nothing until sendMessage returns a final SendOutcome (sent/pending/failed/skipped) after the guards and delivery.
- The DB node says 'draft/failed claimed once', but failed rows can be claimed again on a later Send (lib/engine.ts:1356, 1360-1366). 'Once' only holds for each concurrent race. The note explains this, but the node text does not.
- Node path 'app/(app)/' for the tabs is vague. The Send buttons live on specific pages (Today, conversation), and the map does not identify them.

Next changes:

- Follow the stated key: remove the separate step-3 return arrows and put the outcomes on the request arrows, e.g. 'returns SendOutcome; loser → skipped'. Alternatively, change the key and label step 3 as the final response after guards and delivery.
- Increase the size of the edge labels, node text and notes so they read at 1194x834. Use the empty margins, and route the tab-B request and response lines apart so they don't cross.
- Mark the race on the Postgres node itself, e.g. 'UPDATE … WHERE status IN (draft,failed) RETURNING: the first commit wins, the second matches 0 rows'. Add a visible stuck-'sending' failure marker on the diagram rather than only in the notes, and assign an owner.

### Round 10: 31/40 — Good

[Diagram](threadline/round-10/diagram.png) · [Editable canvas](threadline/round-10/canvas.json) · [Map](threadline/round-10/map.json) · [Review](threadline/round-10/review.json) · [Render metrics](threadline/round-10/render.json) · [Generation recipe](threadline/round-10/recipe.json) · [Exact generator queries](threadline/round-10/generator-queries.json) · [Renderer hashes](threadline/round-10/render-source.json) · [Judge model receipt](threadline/round-10/judge-receipt.json) · [Generator model receipt](threadline/round-10/generator-receipt.json) · [Judge prompt](threadline/round-10/judge-prompt.txt)

Judge: claude-opus-5-5; reviewed 2026-11-04T05:07:04.359Z; source f467a33. Browser errors: 0. Fit-to-screen text: 8.7–17.4 px, excluding arrow labels.

Cold read: The owner may have the Today page open in two browser tabs, both showing the same draft. Each Send click calls a Next.js server action on Vercel (sfo1). That action checks it is the owner, validates the edited text with Zod, and calls sendMessage. sendMessage begins with a single conditional UPDATE on the message row in RDS Postgres (us-west-1). The UPDATE sets status to 'sending', clears the error, stamps sentAt, and saves the edits, but only WHERE the row is outbound and still draft or failed, and it RETURNS the row. Whichever request gets there first claims the row. The other request's UPDATE matches zero rows, so that tab immediately gets 'skipped'. So the database row, not the server, is what stops a double send. This is suppression, not exactly-once. The winner's result only comes back after the guards and delivery run. Most guard failures and thrown errors put the row back to 'failed', and a failed row can be claimed and sent again, even when Gmail already accepted the email and only the bookkeeping afterwards (markSent) threw. 'Closed' and 'already replied' set 'skipped' instead. If the function dies right after the claim, the row is stuck in 'sending'. Send and Skip no longer match it, refresh only rescues LinkedIn rows that have a run id, and Today lists it under 'Queued on LinkedIn' whatever the channel. Conversation replies are outside this view: each click inserts a new row, so there's no shared claim.

- **Purpose and audience: 4/4.** The visible title asks one exact question: "Outbound: how does the draft claim suppress a concurrent double Send?" The subtitle names the audience (New engineers) and the scope (two Today tabs, the server action, the conditional Postgres claim). The amount of detail, a conditional UPDATE plus three failure notes with line-cited sources, suits that audience.
- **Abstraction consistency: 3/4.** Every node is a runtime actor or a store, so the level is mostly consistent. One mismatch matters for a race diagram: the client side is drawn as two instances (tab A and tab B), but the server is a single "Next.js server" box, even though each Send is its own server-action request with its own UPDATE. The server node also mixes in code-level text ("run(): assertOwner, Zod, then sendMessage"), and the DB node carries a behaviour statement instead of a name and role.
- **Completeness vs. focus: 3/4.** It stays on the claim. A visible "Outside this view" line names the deliberate omissions: post-claim guards and delivery, and Conversation Send inserting its own row (correct per lib/engine.ts:1204-1223). Several relevant facts are missing. The losing tab's edits are thrown away. The loser gets "Already sent or no longer a draft" and its card disappears (components/today.tsx:174-176). Stranded 'sending' rows still count toward the daily limit (lib/engine.ts:1316-1329).
- **Relationships and data flow: 3/4.** All three arrows are directed and labelled with what flows ("Send+edits → SendOutcome", "claim UPDATE → row/none") and marked sync, which matches the stated convention. The ordering that the question is about, though, is only in text. The two claims share one server→DB arrow, and the diagram never shows which caller gets row and which gets none, or that the second UPDATE waits on the row lock and then matches 0 rows.
- **Boundaries and grouping: 3/4.** Three labelled frames: Owner's browser ("Local client: two tabs, one session"), Vercel ("Hosted, managed … sfo1"), and AWS RDS ("Hosted, managed … us-west-1"). The legend says frames are trust/deployment zones. The managed vs. client split is clear. The auth boundary (assertOwner) is buried in the node text rather than drawn, and the cross-provider network hop (Vercel to RDS, TLS required) isn't marked.
- **Visual clarity and layout: 3/4.** Clean left-to-right flow with no crossings and aligned frames, and the notes sit in three tidy columns. At 1194x834 the drawing uses only about 60% of the width (roughly 240px empty on each side), and the browser and Vercel frames have dead space. The edge labels and subtitle are about 9px and the footer metadata about 8px, which is small on an iPad. Node text (10–13px) is readable.
- **Notation and legend: 3/4.** A visible key explains frames, boxes, the cylinder, arrow direction including the response, and solid = sync, and the flow type is also written on each arrow. Shapes carry the meaning, so nothing relies on colour. Weaknesses: everything is the same red, so the failure notes don't stand out from neutral facts. The "solid = sync" convention never has a contrasting style to compare with. Real code names are partial: the action's actual name, sendAction, is never shown, and the DB text "First draft|failed→sending" is cryptic.
- **Failure modes and non-functional insight: 3/4.** Strong, well-sourced failure notes. "Suppression, not exactly-once": failed rows can be claimed again even if markSent throws after Gmail accepted the email, which is a real duplicate-send risk. "Crash after claim strands the row": only draft|failed can be sent or skipped, and refresh only resolves LinkedIn rows that have a run id. Missing: the concrete crash cause (the function timeout, maxDuration 300 in app/(app)/page.tsx, while LinkedIn sends wait up to 75s), the only alert (LinkedIn rows stuck over 3h, lib/engine.ts:2010-2022; email and X rows get none), and the quota taken up by stranded rows.
- **Accuracy and freshness: 3/4.** The footer shows "Source review 2026-11-04 · revision f467a33 + local edits · Owner: Unassigned · Live runtime NOT verified". Every claim I checked matches the source: lib/engine.ts:1346-1358, 1360-1466, 1755-1759; components/today.tsx:27, 107-116; vercel.json:4; AGENTS.md:203. The score can't go above 3 without verifying production, and there is no accountable owner.
- **Standalone comprehension: 3/4.** A newcomer can explain the main mechanism from the image alone: two tabs, one server action, a conditional UPDATE in Postgres, first one wins. The three notes add the important caveats. Possible misreadings: the single server box suggests in-process dedupe, the identical tab arrows hide that the loser gets "skipped", and the 8–9px labels and footer are easy to miss.

Reviewer-reported inaccuracies:

- Server node and the server→DB arrow: drawn as one 'Next.js server' issuing one 'claim UPDATE'. In fact each tab's Send is a separate sendAction request (app/(app)/actions.ts:363-373), likely a separate function invocation, and each issues its own UPDATE (lib/engine.ts:1346-1357). The single arrow hides that two claims race.
- Edge label 'Send+edits → SendOutcome': the action returns ActionResult<SendOutcome> (app/(app)/actions.ts:44, 366). A failed assertOwner or Zod check returns {ok:false,error} and no SendOutcome (actions.ts:46-61); DraftCard handles that separately (components/today.tsx:166).
- Both tab arrows say 'Send+edits' as if both sets of edits are kept. Only the winner's UPDATE writes body/subject (lib/engine.ts:1352-1353). The loser's edits are silently dropped, and it gets 'Already sent or no longer a draft.' (engine.ts:1358).
- The DB node and note 1 ('A concurrent UPDATE then matches 0 rows') leave out that under Postgres READ COMMITTED the second UPDATE blocks on the row lock until the first one commits, then re-checks status IN (draft,failed). That re-check is the real reason suppression works without an explicit transaction.
- Note 2, 'Winner's outcome arrives after guards/delivery': for LinkedIn the winner can get 'pending' after a 75s wait with delivery unconfirmed (lib/engine.ts:1455-1461). It isn't always a delivered result.
- Note 3 is accurate but incomplete. Stranded 'sending' rows still count toward the daily limit (sentInLastDay includes 'sending', lib/engine.ts:1323). The only alert is the over-3-hours LinkedIn warning (lib/engine.ts:2010-2022). Stranded email and X rows get no alert at all.

Next changes:

- Show the race itself. Split the server into two concurrent invocations, or add a small numbered sequence strip. Tab A: UPDATE → row → guards/delivery → sent/failed/skipped. Tab B: UPDATE waits on the row lock, re-checks status → none → 'skipped: Already sent or no longer a draft', with its edits dropped. Name the real entry point, sendAction → sendMessage, and the return type ActionResult<SendOutcome>.
- Use the 1194x834 viewport. Scale the drawing about 1.3–1.4× to remove the ~240px side margins and the empty frame space. Raise the edge labels, subtitle, source lines and footer to at least 11px. Give the three failure notes a non-colour marker (icon or border) so they stand apart from neutral facts in the all-red palette.
- Complete the operations and freshness picture. Name the likely crash cause (function timeout: maxDuration 300, LinkedIn wait 75s). Add that stranded 'sending' rows use up the daily limit and that only LinkedIn rows get the over-3-hours alert; there is no sweeper for email or X. Assign a named, accountable owner and record when the diagram was checked against production.

### Round 11: 38/40 — Excellent

[Diagram](threadline/round-11/diagram.png) · [Editable canvas](threadline/round-11/canvas.json) · [Map](threadline/round-11/map.json) · [Review](threadline/round-11/review.json) · [Render metrics](threadline/round-11/render.json) · [Generation recipe](threadline/round-11/recipe.json) · [Exact generator queries](threadline/round-11/generator-queries.json) · [Renderer hashes](threadline/round-11/render-source.json) · [Judge model receipt](threadline/round-11/judge-receipt.json) · [Generator model receipt](threadline/round-11/generator-receipt.json) · [Judge prompt](threadline/round-11/judge-prompt.txt)

Judge: claude-opus-5-5; reviewed 2026-11-04T05:18:08.490Z; source f467a33. Browser errors: 0. Fit-to-screen text: 8.8–17.7 px, excluding arrow labels.

Cold read: The owner has the same Today draft open in two browser tabs. Both tabs belong to one owner session on their own machine. Clicking Send in either tab makes its own synchronous server-action call (sendAction) to the Next.js app on Vercel (sfo1). The call carries the draft id and that tab's edited body, plus the subject for a first email. The server checks that the caller is the owner, then runs sendMessage. Its first step is one autocommitting conditional UPDATE against Postgres on AWS RDS (us-west-1). The UPDATE only matches if the row is still 'draft' or 'failed', and it claims the row by moving it to 'sending'. When both clicks land together, Postgres's default READ COMMITTED makes the second UPDATE wait on the row lock and then re-check the condition. The row no longer matches, so it gets 0 rows. That tab is told 'skipped', its edits are discarded and its card hides. The winning tab goes on to the guards and a delivery attempt, which are deliberately out of this view. This blocks a double send but is not exactly-once. If a guard fails or anything inside the delivery try throws, the row resets to 'failed' and can be sent again. That holds even if Gmail already accepted the email and only the follow-up markSent write failed. If the function times out (300s) or a query outside the try throws, the row is stuck in 'sending'. It can't be sent or skipped, it counts toward the daily email/LinkedIn limit for 24h, and only LinkedIn rows trigger a 3-hour alert. Conversation Sends don't share this claim, because each click inserts its own row. The diagram comes from a source review of f467a33 with local edits. It has no owner and was not checked against the live system.

- **Purpose and audience: 4/4.** The title asks one exact question: 'Outbound: how does the draft claim suppress a concurrent double Send?' The subtitle names the audience ('New engineers') and the scope (two Today tabs, separate sendAction calls, a conditional Postgres UPDATE). The level of detail suits engineers: READ COMMITTED, row lock and file:line sources.
- **Abstraction consistency: 4/4.** Every box is a runtime actor at the same level: two browser tabs, one Next.js server and one Postgres store, each inside a deployment frame. Code-level detail stays in the notes and does not mix with the boxes. No zoom-in view is needed for a focused race diagram.
- **Completeness vs. focus: 4/4.** It shows only what the race needs: both tabs, the server action path, the conditional claim, the loser's outcome, what 'suppression' does and does not guarantee, and the stranded-row edge case. The omissions are stated in the image: 'Outside this view: Guards and Gmail/LinkedIn/X delivery after a successful claim; Conversation Send: each click inserts its own row, so no shared claim.' The second matches sendReply's insert at lib/engine.ts:1209-1223. Optional: the claimed status value 'sending' appears only in note 3, not on the core path.
- **Relationships and data flow: 4/4.** There are three directed arrows, one meaning each, and the legend defines them: 'caller → recipient, response included; solid (sync) = awaited request/reply'. Each label says what flows: 'id+edits → ActionResult (sync)' from each tab as its own call, and '2× claim UPDATE → row/0 (sync)' to Postgres. The race outcome is stated on the nodes ('either may win', 'First draft|failed UPDATE wins, per attempt'). The winner's order (claim, then guards, then a delivery try) is given in note 2.
- **Boundaries and grouping: 4/4.** Three labelled frames, and the legend says frames are trust/deployment zones: 'Owner's browser — Local client: two tabs, one session'; 'Vercel — Hosted, managed: Vercel functions, sfo1'; 'AWS RDS — Hosted, managed: us-west-1, TLS per docs'. The server is marked 'owner-gated'. Local vs hosted and managed is explicit. Matches vercel.json regions [sfo1] and AGENTS.md:203-204 (RDS us-west-1, TLS required).
- **Visual clarity and layout: 3/4.** Unmet condition: tidy and readable at the real viewing size. It reads left to right with no crossings and aligned frames, but there are small flaws at 1194x834. The server text breaks mid-word ('sendAction→sendMe / ssage'). The edge lines run through their own labels ('___id+edits →___'). Frame sublabels, note sources and the footer (omissions and verification stamp) are about 8-9px, so these key lines are the hardest to read. The browser and Vercel frames have large empty areas while the notes are dense. Effect: still readable, but a new engineer has to squint at the boundary and freshness details.
- **Notation and legend: 4/4.** The visible key explains every convention: frames = trust/deployment zones, box = runtime actor/process, cylinder = stored state, arrow direction and response, solid/(sync). Shape and text carry the meaning, so the single authorship colour is fine. Names are real and match the code: Today tab / DraftCard (components/today.tsx:138), sendAction (app/(app)/actions.ts:363), sendMessage (lib/engine.ts:1339), Postgres.
- **Failure modes and non-functional insight: 4/4.** Failure behaviour and state are explicit. The loser waits on the row lock under READ COMMITTED autocommit, gets 0 rows, is skipped, and its edits are dropped. It is 'Suppression, not exactly-once': guard failures and errors inside the try reset the row to failed even after Gmail accepted, so it can be sent again. A crash after the claim strands the row in 'sending': maxDuration 300, Send/Skip blocked, the row counts toward the 24h limit, and only LinkedIn gets a 3h alert. Owner 'Unassigned' is stated openly. Delivery dependencies are deliberately out of scope.
- **Accuracy and freshness: 3/4.** The stamp is visible: 'Source review 2026-11-04 · revision f467a33 + local edits · Owner: Unassigned · Live runtime NOT verified'. Every claim I checked matches the source: claim UPDATE at lib/engine.ts:1346-1358, fail() at 1360-1366, markSent inside the try at 1435 → catch at 1462-1466, sentInLastDay counting 'sending' at 1316-1329, 3h LinkedIn alert at 2010-2022, maxDuration at app/(app)/page.tsx:4, no isolation override in lib/db/client.ts:9-20, skipped → card hides at components/today.tsx:174-176. Capped at 3 because only source was reviewed, not the running production system.
- **Standalone comprehension: 4/4.** A newcomer can correctly retell it from the image alone. Each tab separately calls sendAction on the owner-gated Vercel server. Each call runs a conditional UPDATE in RDS. Only the first draft|failed match gets the row; the other gets 0 rows, returns skipped, loses its edits and hides its card. The winner then runs guards and delivery, can fail back to a re-sendable state, and can be stranded in 'sending' by a crash. The legend and notes stop the main misreading (thinking this is exactly-once).

Reviewer-reported inaccuracies:

- None reported.

Next changes:

- Put the claim mechanism on the main path, not only in the notes. Label the Postgres edge or node 'SET status=sending WHERE id=? AND status IN (draft, failed)'. Split '2× claim UPDATE → row/0' into the two results: 'first: 1 row → guards/delivery' and 'second: 0 rows → skipped'. The key state would then be visible without reading note 3 (lib/engine.ts:1346-1358).
- Fix the readability problems at 1194x834. Widen or re-wrap the server node so it doesn't break 'sendMe/ssage'. Move edge labels off the lines. Raise the frame sublabels, source lines and footer (omissions, verification stamp) from about 9px to 11px or more, using the empty space inside the browser and Vercel frames.
- Make note 2 and note 3 more precise, then check against production to lift freshness. When a guard fails, the winner resolves without any delivery attempt. LinkedIn sends can also return 'pending' and stay in 'sending' on purpose (resolveLinkedinSend, lib/engine.ts:1531-1532), and the 3h alert exists for those rows, so 'sending' does not always mean a crash. Then confirm RDS default_transaction_isolation, the deployed revision and the Vercel region in the live system, and name an owner.

## Crumb

| Dimension | R1 | R2 | R3 | R4 | R5 | R6 | R7 | R8 | R9 | R10 | R11 | R12 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Purpose and audience | 0 | 3 | 4 | 4 | 4 | 4 | 4 | 4 | 4 | 4 | 4 | 4 |
| Abstraction consistency | 2 | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 4 | 4 | 4 |
| Completeness vs. focus | 2 | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 4 | 4 |
| Relationships and data flow | 2 | 1 | 2 | 2 | 3 | 2 | 3 | 3 | 3 | 3 | 3 | 4 |
| Boundaries and grouping | 0 | 1 | 3 | 3 | 3 | 3 | 3 | 2 | 2 | 2 | 4 | 4 |
| Visual clarity and layout | 3 | 0 | 2 | 2 | 2 | 1 | 1 | 2 | 2 | 2 | 2 | 4 |
| Notation and legend | 1 | 2 | 2 | 3 | 2 | 3 | 3 | 3 | 3 | 3 | 4 | 4 |
| Failure modes and non-functional insight | 1 | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 4 | 4 |
| Accuracy and freshness | 1 | 2 | 3 | 3 | 3 | 3 | 2 | 2 | 3 | 3 | 3 | 3 |
| Standalone comprehension | 1 | 1 | 3 | 3 | 3 | 2 | 2 | 3 | 3 | 3 | 3 | 4 |

### Round 1: 13/40 — Redo

[Diagram](crumb/round-1/diagram.png) · [Editable canvas](crumb/round-1/canvas.json) · [Map](crumb/round-1/map.json) · [Review](crumb/round-1/review.json) · [Render metrics](crumb/round-1/render.json)

Judge: Claude Code; reviewed 2026-11-04T04:05:35.696Z; source 557acd4. Browser errors: 0. Fit-to-screen text: 16.0–16.0 px, excluding arrow labels.

Cold read: crumb is a local Node CLI that gives AI agents per-account browser sessions. Agents run `crumb launch site:account`. resolve.ts uses config bindings and vault listings to pick the account. session.ts starts Chromium through Playwright (launchPersistentContext in browser.ts) on a per-account profile dir, injects saved cookies and storage, and later snapshots them back into the vault. vault.ts seals each entry with crypto.ts, using a key held in a keystore. transfer.ts imports cookies from the user's real browsers (sweet-cookie) or from files, and exports them. Separately, a Claude Code/Codex PreToolUse hook (hooks/guard.mjs) blocks any agent tool call that mentions ~/.crumb or CRUMB_HOME, so agents have to go through the CLI. Most of this cannot be recovered from the image alone.

- **Purpose and audience: 0/4.** The image has no title, subtitle or caption. Nothing says it shows crumb, what question it answers, or who it is for.
- **Abstraction consistency: 2/4.** Most boxes are TS modules, which is consistent. But Guard hook is a separate agent-harness script, and Vault files and Chromium are runtime resources, all drawn with the same box style. config.ts, crypto.ts and paths.ts are left out, while Vault stands in for them in some places but not others.
- **Completeness vs. focus: 2/4.** Missing pieces: the agent that calls the CLI and that the hook intercepts; Chrome profile dirs (session.ts uses profileDir); the user's installed browsers that transfer.ts reads through @steipete/sweet-cookie; the OS keychain/keystore in crypto.ts; and config.ts. None of these omissions are noted.
- **Relationships and data flow: 2/4.** Only 3 of 10 arrows are labeled ('guards', 'encrypted', 'CDP'). The unlabeled arrows seem to mean 'calls', but 'guards' means something else entirely. The Hook→Vault files arrow suggests the hook writes or reads the files, when it actually blocks agent tool calls. Nothing shows ordering or the detached/supervise process model.
- **Boundaries and grouping: 0/4.** There are no containers. Nothing separates the crumb process from the agent harness, the local filesystem or external browsers, and no trust boundary is drawn even though the tool exists to keep secrets away from agents.
- **Visual clarity and layout: 3/4.** Flows mostly top to bottom with no crossings, and node labels are readable at 1194x834. Edge labels ('guards', 'CDP', 'encrypted') are very small. The graph sits in the middle third of the canvas with a lot of empty margin, and the long Guard hook edge is awkward.
- **Notation and legend: 1/4.** Every node is the same red sketch box apart from the cylinder for storage. External Chromium looks the same as internal modules. There is no legend and no non-color signal for kind.
- **Failure modes and non-functional insight: 1/4.** Only the 'encrypted' label and the guard hint at non-functional concerns. The diagram doesn't show the key source or keychain, detached supervisor processes or run files, locking, browser-not-found or decryption failures, or stale cookies.
- **Accuracy and freshness: 1/4.** There is no date, version, revision or owner on the image, and it hasn't been checked against a running system. Several edges are inaccurate (see inaccuracies).
- **Standalone comprehension: 1/4.** A newcomer could tell it's a CLI driving sessions and a vault, but not what crumb is for, why the hook exists, or where cookies come from. Without a walkthrough they would likely misread how the hook works.

Reviewer-reported inaccuracies:

- Browser→Chromium is labeled 'CDP', but src/browser.ts:95 launches with chromium.launchPersistentContext. The only connectOverCDP call is in src/session.ts:281, which goes directly to playwright-core and bypasses browser.ts.
- The Guard hook→Vault files 'guards' arrow suggests the hook accesses the files. hooks/guard.mjs actually reads agent tool-call JSON on stdin and exits 2 when a call references the vault path. It acts on the agent, which the diagram doesn't show.
- Transfer only connects to Vault. src/transfer.ts:2 also reads cookies from the user's installed browsers through @steipete/sweet-cookie, an external source that isn't drawn.
- CLI calls vault.ts directly (exists/listAccounts/removeAccount, src/cli.ts:14) and config.ts (src/cli.ts:7). Neither edge is shown.
- Encryption depends on crypto.ts and config.ts (key store, execFileSync for the OS keychain in src/crypto.ts:1), which aren't drawn. Unencrypted Chrome profile dirs (paths.profileDir) also live on disk and aren't shown.
- browser.ts imports normalizeState from vault.ts (src/browser.ts:7), a dependency the diagram leaves out.

Next changes:

- Add a title, plus a date/revision line (557acd4, 2026-11-04) and an owner line. Then add boundaries: an 'agent harness' container (Agent + PreToolUse guard hook), a 'crumb CLI process' container, a 'local disk ~/.crumb' container (encrypted vault, config, profile dirs) and 'external' items (Chromium, the user's browsers, the OS keychain).
- Fix and label every edge with what flows, e.g. 'launch site:account', 'read/seal entry', 'launchPersistentContext / connectOverCDP', 'import cookies (sweet-cookie)'. Redraw the guard as Agent tool call → Guard → blocked/allowed, not as an arrow to the files.
- Add a legend that separates modules, external processes and storage with distinct shapes or line styles. Annotate key failure points (missing or locked key, browser not found, decrypt failure, stale session) and the detached supervise/run-file lifecycle.

### Round 2: 19/40 — Mediocre

[Diagram](crumb/round-2/diagram.png) · [Editable canvas](crumb/round-2/canvas.json) · [Map](crumb/round-2/map.json) · [Review](crumb/round-2/review.json) · [Render metrics](crumb/round-2/render.json)

Judge: Claude Code; reviewed 2026-11-04T04:09:11.481Z; source 557acd4. Browser errors: 0. Fit-to-screen text: 8.0–16.1 px, excluding arrow labels.

Cold read: A coding agent runs `crumb launch site:account`. The short-lived CLI spawns a detached supervisor and polls ~/.crumb for a run handle (pid + CDP URLs) for up to 60s, or for an error file. The supervisor gets the vault key from the OS keychain or secret-tool (or CRUMB_KEY), decrypts the AES-GCM session, and starts Chrome with launchPersistentContext, injecting the saved cookies and storage. The agent then drives Chrome directly over CDP, and Chrome talks to the target sites with the saved cookies. The supervisor saves the session back into the vault every 30s, on SIGUSR2 (crumb sync) and on SIGTERM (crumb close). A PreToolUse hook stops agent tool calls that mention ~/.crumb. If the key is missing, crumb fails closed with KEY_UNAVAILABLE.

- **Purpose and audience: 3/4.** Clear question-style title and audience/scope subtitle are visible. The rendering mangles the content below them, so the title promises more than the picture delivers.
- **Abstraction consistency: 3/4.** Boxes are mostly runtime units: agent, CLI, supervisor, Chrome, vault, key store, sites. Vault guard is a hook script (hooks/guard.mjs) placed next to processes, which is a small mix of levels.
- **Completeness vs. focus: 3/4.** The right components are present for the launch flow, and the omissions (transfer, check, capture) are written on the image. The guard→agent relationship is reduced to a single unclear arrow.
- **Relationships and data flow: 1/4.** Edges carry [sync]/[async]/[local] labels, but in the image those labels collide with node text (for example '[sync] CDP: browser control' runs over the Vault guard and Supervisor text, and '[local] Read/merge-write session' runs over the Chrome text). Arrowheads point at empty space (the Fetch vault key and HTTPS arrows end at frame edges). There is no step ordering.
- **Boundaries and grouping: 1/4.** The four zone frames render as skewed, curved shapes that cross each other and nodes. The 'Local crumb processes' header text overprints its own description. Internal vs. external is stated only in the small subtitle text.
- **Visual clarity and layout: 0/4.** At 1194x834 the drawing is a mess of distorted shapes. Text overlaps in many places (Coding agent/CLI label, Supervisor/CDP label, Chrome/vault label). Fonts are about 8px. About a third of the canvas above the title is empty.
- **Notation and legend: 2/4.** A reading key explains the frames, boxes and [sync]/[async]/[local] tags, and real names are used. The shapes themselves are broken and inconsistent. Everything is red, so there is no non-colour distinction between kinds.
- **Failure modes and non-functional insight: 3/4.** Notes cover the autosave interval and signals, the 60s startup handshake with its error file, and the key store failing closed. Chrome crashes and orphaned supervisors are not shown.
- **Accuracy and freshness: 2/4.** Revision 557acd4, the date and 'Owner: Unassigned' appear, and the image says the live runtime was not verified. The checked claims match the source. Because there is no owner and nothing was checked against a running system, this can't score higher.
- **Standalone comprehension: 1/4.** The notes and title are readable. The core flow can't be followed because arrows and labels overlap or end nowhere, so a newcomer would need someone to walk them through it.

Reviewer-reported inaccuracies:

- Chrome is launched from src/browser.ts:95 (launchPersistentContext), but the Supervisor box suggests src/session.ts does it directly.
- Vault guard is labelled as being under 'hooks/', but the actual file is hooks/guard.mjs, registered through hooks/hooks.json. The 'Tool call vetted pre-run' arrow points from the agent to the guard. In practice the agent host calls the hook before each tool call, and the hook can block it, which the arrow doesn't show.
- The 'Fetch vault key' and 'HTTPS with saved cookies' arrowheads end at frame edges, not at the OS key store and Target sites boxes, so what they connect to is visually wrong.
- The key note cites src/crypto.ts, but the rendered source line reads 'src/cryptats' (garbled).

Next changes:

- Fix the renderer. Use straight, axis-aligned rectangles for frames and nodes, and route edge labels so they don't overlap node text. Every arrow should end on its target box. Remove the empty band at the top.
- Number the launch steps (1 spawn, 2 fetch key, 3 decrypt, 4 start Chrome, 5 write handle, 6 CLI returns CDP URL, 7 agent drives over CDP). Then a reader can follow the order without the notes.
- Raise node and label text to at least 12px at 1194x834. Distinguish node kinds and internal vs. external zones with shape or line style, not only red. Name an owner.

### Round 3: 28/40 — Good

[Diagram](crumb/round-3/diagram.png) · [Editable canvas](crumb/round-3/canvas.json) · [Map](crumb/round-3/map.json) · [Review](crumb/round-3/review.json) · [Render metrics](crumb/round-3/render.json)

Judge: Claude Code; reviewed 2026-11-04T04:19:05.790Z; source 557acd4. Browser errors: 0. Fit-to-screen text: 8.3–16.6 px, excluding arrow labels.

Cold read: An AI agent (Claude Code or Codex) runs `crumb launch <id>`. The Crumb CLI spawns a detached supervisor (`__supervise`) and then polls the vault directory for a run handle file. The supervisor gets the vault key from the OS key store (Keychain or secret-tool, falling back to CRUMB_KEY or a key file) and decrypts the saved session. It injects the cookies and state into a local Chrome over CDP and autosaves every 30s, on SIGUSR2 and on SIGTERM, merging changes so concurrent runs don't overwrite each other. The agent then drives Chrome directly over CDP. A PreToolUse hook (Vault guard) blocks agent tool calls that touch ~/.crumb. If the key is missing, crumb fails closed instead of creating a new key. If startup takes longer than 60s, it reports the supervisor's .error file, or INTERNAL if there isn't one.

- **Purpose and audience: 4/4.** Visible title states the exact question ('how does an AI agent get a logged-in browser for a saved account?'), and the subtitle names the audience (new engineers) and the scope.
- **Abstraction consistency: 3/4.** Most boxes are runtime units (agent, CLI, supervisor, Chrome, vault, key store). The 'Vault guard' hook is a module-level item in a host frame, and the vault box mixes encrypted entries with run handle files.
- **Completeness vs. focus: 3/4.** Covers the launch path, and the omissions (transfer.ts, interactive login) are listed under 'Outside this view'. It is missing the agent getting the CDP endpoint/handle from CLI stdout, and how the guard's block verdict reaches the agent. The note 'AI red; your additions blue' is authoring noise.
- **Relationships and data flow: 2/4.** Edges are labelled, but most are dashed or dotted, so the line styles are hard to tell apart at this size. 'encrypted session' points one way only, although the supervisor both reads and writes the vault. No return path shows the CLI printing the handle that the agent then uses for CDP. Order is not numbered.
- **Boundaries and grouping: 3/4.** Three labelled frames (agent host, crumb processes, local state/OS) with self-hosted/user-run descriptors. The key store is an external OS service but sits in the same frame as the local vault files, with no visual distinction between them.
- **Visual clarity and layout: 2/4.** Left-to-right columns, but body text is small at 1194x834. The 'CDP automation' arrow runs down the agent frame edge and crosses into the middle frame. Labels overlap lines ('encrypted session', 'spawn __supervise', 'vault·key·lookup' sitting on the frame edge). A frame title wraps an orphaned ']'. There is a lot of empty margin.
- **Notation and legend: 2/4.** There is a reading key, but it promises a solid/dashed/dotted distinction that is hard to read in the hand-drawn style. Every element is red, so color carries no meaning, and the 'AI red; your additions blue' line describes an authoring convention. Names match the code.
- **Failure modes and non-functional insight: 3/4.** Notes state that a missing key fails closed (KEY_UNAVAILABLE, confirmed at src/crypto.ts:60-104), the 30s/SIGUSR2/SIGTERM autosave with merge (session.ts:235), and the 60s start timeout with a .error file. Not shown: Chrome crash or orphaned-supervisor behaviour, and what the guard does on a block.
- **Accuracy and freshness: 3/4.** Dated 2026-11-04 at revision 557acd4. Names (__supervise at session.ts:143 and cli.ts:302, KEY_UNAVAILABLE) match the code. The owner is 'Unassigned' and the live runtime is explicitly not verified, so the score is capped at 3.
- **Standalone comprehension: 3/4.** A newcomer can explain the agent → CLI → detached supervisor → Chrome flow, with the vault and key behind it. The missing handle-return step and the ambiguous line styles could lead to misreading how the agent finds the CDP endpoint.

Reviewer-reported inaccuracies:

- The CLI→vault edge is labelled 'poll handle file', but nothing shows the CLI printing the handle/CDP endpoint back to the agent, which is how the agent reaches Chrome (src/session.ts, src/cli.ts).
- The 'encrypted session' edge goes one way only (supervisor→vault), but the supervisor both loads and autosaves sessions (src/session.ts autosave around line 212).
- The supervisor→keystore edge is drawn as a one-way sync lookup. src/crypto.ts also falls back to CRUMB_KEY or a key file and can store a newly created key (crypto.ts:84), so the store is not only read.
- The legend line 'AI red; your additions blue' describes an authoring workflow, not the system, and the image contains no blue.

Next changes:

- Add numbered steps and an explicit return edge (CLI → agent: 'prints CDP endpoint/handle'), so the order of the flow and how the agent finds Chrome can be read without a walkthrough.
- Re-route 'CDP automation' so it doesn't run along the frame edge, keep labels off the lines, fix the wrapped ']' in the frame title, and use the empty margin to enlarge the body text for 1194x834.
- Make the notation actually distinguishable: use clearly different line styles or a second color for sync vs local-IO edges, give the external OS key store its own visual treatment, drop the 'AI red/blue' text, and note what happens when Chrome or the supervisor crashes.

### Round 4: 29/40 — Good

[Diagram](crumb/round-4/diagram.png) · [Editable canvas](crumb/round-4/canvas.json) · [Map](crumb/round-4/map.json) · [Review](crumb/round-4/review.json) · [Render metrics](crumb/round-4/render.json) · [Generation recipe](crumb/round-4/recipe.json) · [Judge model receipt](crumb/round-4/judge-receipt.json) · [Generator model receipt](crumb/round-4/generator-receipt.json) · [Judge prompt](crumb/round-4/judge-prompt.txt)

Judge: claude-opus-5-5; reviewed 2026-11-04T04:38:37.543Z; source 557acd4. Browser errors: 0. Fit-to-screen text: 9.0–18.0 px, excluding arrow labels.

Cold read: A coding agent runs `crumb launch`. The Crumb CLI spawns a detached Supervisor process. The Supervisor gets the vault key from the OS key store (Keychain, secret-tool, CRUMB_KEY or a key file) and reads the encrypted session from the vault files. It then starts Chrome (system Chrome or Playwright Chromium), injects the saved storage state, and writes a run handle file. Meanwhile the CLI polls for that handle every 150ms for up to 60s. It fails if an error file appears or the Supervisor exits; otherwise it prints the handle JSON. The agent then drives Chrome directly over CDP on 127.0.0.1. While the session runs, the Supervisor saves cookie/storage diffs back into the encrypted vault every 30s and on SIGTERM/SIGUSR2. If Chrome closes on its own, the Supervisor exits without a final save. A missing or wrong key fails closed with KEY_UNAVAILABLE.

- **Purpose and audience: 4/4.** The visible title asks one precise question: how does `crumb launch` give an agent a logged-in Chrome? The subtitle names the audience (new engineers) and the scope (one machine, launch through CDP control and autosave).
- **Abstraction consistency: 3/4.** All six boxes are runtime units: an agent, two Node processes, Chrome, files and a key store. 'Vault files' merges two different things, encrypted sessions and plaintext run handles, which blurs the two dotted edges into it. There is no linked zoom-in view.
- **Completeness vs. focus: 3/4.** Omissions are stated in the footer. Missing: the handle JSON (with the CDP ws URL) going back to the agent is never labelled, even though it is how the agent finds Chrome. The page navigation to the home URL and SIGINT handling are also missing.
- **Relationships and data flow: 2/4.** Edges are mostly labelled, but the 'storage state' label floats between Supervisor and CLI. Its arrow leaves a vertical bundle shared with vault key and state+handle, so it could read as CLI→Chrome. 'spawn' is dotted, which the legend defines as local I/O, so the notation is wrong for that edge. 'state+handle' merges two separate writes (session saves and handle writes). The order (spawn → poll ↔ handle write) is only partly explained by a note. The agent→Chrome CDP edge loops over the top through the Crumb frame.
- **Boundaries and grouping: 3/4.** Four labelled frames separate the agent, Crumb's self-hosted Node processes, local Chrome on 127.0.0.1, and local state. The OS key store is marked 'external'. There is no outer 'single machine / same user' trust boundary, and the frames carry deployment zones only, not trust levels. Even so, this is proportionate for a local tool.
- **Visual clarity and layout: 2/4.** Columns run cleanly left to right, but at 1194x834 the edge labels (F1, spawn, poll·handle, state+handle, vault·key, CDP commands) are about 7px and hard to read. The orthogonal routes bundle on one vertical line next to the CLI and Supervisor, and the dashed poll and state lines run through the Browser frame. The tall frames are mostly empty and the top fifth of the canvas is blank.
- **Notation and legend: 3/4.** A legend explains frames, boxes, arrow direction (response included) and the solid/dashed/dotted line styles, giving a non-colour signal. Real names are used. The spawn edge breaks the legend's dotted = local I/O rule, 'dashed = async' is never used visibly, and the 'AI red / user blue' colour convention adds no information.
- **Failure modes and non-functional insight: 3/4.** Three grounded notes cover the 150ms/60s handshake with error-file failure, autosave every 30s plus SIGTERM/SIGUSR2 with the gap when Chrome closes, and KEY_UNAVAILABLE failing closed. The notes are not tied to specific edges, and they omit the swallowed autosave errors (session.ts:211-212), the 15s DevTools port timeout (browser.ts:78) and the detached-orphan behaviour.
- **Accuracy and freshness: 3/4.** The footer gives the date, revision 557acd4, Owner: Unassigned and 'Live runtime NOT verified'. The claims match session.ts:148-164 and 222-241 and crypto.ts. This is capped at 3: there is no production verification and no accountable owner.
- **Standalone comprehension: 3/4.** A newcomer can mostly retell the launch flow, but would likely misread the storage-state source and miss how the agent obtains the CDP endpoint (from the printed handle JSON), so a short walkthrough is still needed.

Reviewer-reported inaccuracies:

- The spawn edge is drawn dotted, which the legend defines as local I/O. It is a detached process spawn: src/session.ts:148 spawn(process.execPath, ..., {detached:true}).
- Because 'storage state' is placed and routed ambiguously, the arrow can read as CLI→Chrome. In fact the Supervisor calls inject(b.context, session.state) at src/session.ts:175.
- 'state+handle' merges two separate writes from src/session.ts: writeSession for session state (line 207) and writeHandle for run/<id>.json (lines 194-195, 210). Only the session data is encrypted, yet 'Vault files' is tagged with encryption as a whole.
- Nothing labels how the agent learns the CDP endpoint. The handle written at src/session.ts:190 contains cdp.http/ws, and the CLI prints it, but the F1 edge mentions only 'crumb launch'.
- The autosave note leaves out SIGINT, which also triggers stop() and a final save (src/session.ts:234). It also leaves out that autosave failures are only logged (lines 211-212).

Next changes:

- Fix the edge semantics. Use a distinct 'spawns process' style rather than the dotted local-I/O style, anchor 'storage state' clearly to Supervisor→Chrome, and split 'state+handle' into 'encrypted session save' (to the vault) and 'run handle JSON' (to the run dir, a separate box or sub-box).
- Make the return path visible. Label F1 as 'crumb launch → handle JSON {cdp.ws}', and number the steps in order (1 spawn, 2 key, 3 inject, 4 write handle, 5 poll, 6 CDP) so the sequence reads without the notes.
- Make the diagram legible at 1194x834. Raise edge-label font size, use the blank top area and the empty frame space, route the poll/state lines so they don't cross the Browser frame, and attach each failure note to its edge with a marker.

### Round 5: 29/40 — Good

[Diagram](crumb/round-5/diagram.png) · [Editable canvas](crumb/round-5/canvas.json) · [Map](crumb/round-5/map.json) · [Review](crumb/round-5/review.json) · [Render metrics](crumb/round-5/render.json) · [Generation recipe](crumb/round-5/recipe.json) · [Judge model receipt](crumb/round-5/judge-receipt.json) · [Generator model receipt](crumb/round-5/generator-receipt.json) · [Judge prompt](crumb/round-5/judge-prompt.txt)

Judge: claude-opus-5-5; reviewed 2026-11-04T04:42:16.196Z; source 557acd4. Browser errors: 0. Fit-to-screen text: 9.2–18.5 px, excluding arrow labels.

Cold read: An agent runs `crumb launch`. The short-lived CLI spawns a detached hidden `__supervise` Node process and then polls the run directory. The supervisor reads the account's session from the AES-256-GCM vault (the key comes from the OS store, a key file or CRUMB_KEY) and launches Chromium with a temporary profile and a debugging port on 127.0.0.1. It injects the saved cookies and storage, then writes run/<id>.json, which holds the CDP endpoints. The CLI sees that file and prints it as the handle JSON. The agent then drives Chrome directly over CDP. If something goes wrong, the supervisor writes an .error file, or the child exits, or the 60s timeout hits; in each case the CLI fails and points to the .log file. A missing key fails the launch with KEY_UNAVAILABLE. While running, the supervisor autosaves every 30s, on SIGUSR2 and on SIGTERM/SIGINT. Autosave failures are only logged, and closing the window skips the final save.

- **Purpose and audience: 4/4.** The title asks a specific question ('how does `crumb launch` restore a saved session for an agent?'). The subtitle names the audience (new engineers) and the scope (state mode), and the detail level suits that audience.
- **Abstraction consistency: 3/4.** All six boxes are runtime actors or stores at the same level. 'Agent process' is a generic actor next to code-backed components. The Run files store merges handle, error and log files, which are all different artifacts. There is no linked zoom-in view.
- **Completeness vs. focus: 3/4.** Omissions are listed in the footer (login, capture, check, close, sync, profile mode). Missing: the CLI first reads the account entry and fails with NOT_FOUND or NEEDS_LOGIN before spawning (src/session.ts:135-137), and the CLI also creates the .log file and deletes a stale .error file (src/session.ts:139-142).
- **Relationships and data flow: 3/4.** Arrows are labelled and the legend states 'caller → recipient (response included)'. But the Agent→CLI edge is labelled 'handle JSON', which is the response rather than the invocation. Dashed and dotted lines are hard to tell apart at this size. There is no ordering: the steps spawn → decrypt → launch → inject → write handle → poll are never numbered.
- **Boundaries and grouping: 3/4.** Three labelled frames (Caller, Browser runtime, Crumb data dir) separate the process and disk zones, marked local and self-managed. The trust implication is not drawn: the plaintext CDP port on 127.0.0.1 is open to any local process. The 0600 file permissions also go unmentioned.
- **Visual clarity and layout: 2/4.** Flow runs left to right, but the diagram fills only the middle ~55% of the 1194x834 frame. Edge labels ('spawn·detach', 'session r/w', 'handle/error', 'poll handle') are roughly 8px and hard to read. The CDP and spawn lines overlap along the Caller frame edge. The 'handle/error' label floats away from its line, and 'poll handle' detours around the bottom of everything.
- **Notation and legend: 2/4.** The legend explains frames, boxes, cylinders and line styles. It also defines 'double border = external service', which nothing in the diagram uses. Everything is drawn in a single red, and the dashed/dotted distinction is the only non-color signal, which is weak at this size. Real names are used (__supervise, run/<id>.json, CRUMB_KEY).
- **Failure modes and non-functional insight: 3/4.** Three notes cover failure behaviour: fail-closed startup with the 150ms/60s polling, KEY_UNAVAILABLE blocking restore, and best-effort autosave (30s, SIGUSR2/SIGTERM/SIGINT, no save when the window is closed). All match src/session.ts:152-163 and 222-241. Not shown: the .error file path being written on failure, concurrent-launch or port conflicts, and the temp profile being deleted on exit.
- **Accuracy and freshness: 3/4.** The footer shows the date, revision 557acd4, 'Owner: Unassigned' and 'Live runtime NOT verified'. The claims I checked match the source. Capped at 3 because the running system was not verified and there is no owner.
- **Standalone comprehension: 3/4.** A newcomer can get the main path from the diagram plus the notes. The order of steps and the 'handle JSON' direction need a short walkthrough, and the tiny edge labels slow reading.

Reviewer-reported inaccuracies:

- The Agent→CLI edge is labelled 'handle JSON', which is the CLI's output. The request is the `crumb launch` invocation, so under the stated 'caller → recipient' convention the label describes the wrong direction (src/cli.ts, src/session.ts:155).
- The CLI is shown only polling Run files. It also reads the vault entry header before spawning, which can fail with NOT_FOUND or NEEDS_LOGIN (src/session.ts:135-137). It also creates the .log file and removes a stale .error file (src/session.ts:139-142).
- The legend defines 'double border = external service', but no node uses it.
- Run files are described as 'Plaintext' without noting they are written with mode 0600 and that run/<id>.json is deleted on shutdown (src/session.ts:194, 218-221).

Next changes:

- Scale the diagram to fill the 1194x834 viewport and enlarge the edge labels to at least 11-12px. Reroute the CDP and poll edges so they don't overlap frame borders or detour around the bottom.
- Number the steps (1 launch → 2 spawn → 3 decrypt → 4 launch Chrome + inject → 5 write handle → 6 CLI polls and prints → 7 agent drives CDP). Relabel Agent→CLI as 'crumb launch → handle JSON'.
- Add a second visual channel (colors or arrowheads per line style) and remove the unused double-border legend entry. Note the local trust boundary: the CDP port on 127.0.0.1 is reachable by any local process, and run files are 0600.

### Round 6: 27/40 — Mediocre

[Diagram](crumb/round-6/diagram.png) · [Editable canvas](crumb/round-6/canvas.json) · [Map](crumb/round-6/map.json) · [Review](crumb/round-6/review.json) · [Render metrics](crumb/round-6/render.json) · [Generation recipe](crumb/round-6/recipe.json) · [Exact generator queries](crumb/round-6/generator-queries.json) · [Renderer hashes](crumb/round-6/render-source.json) · [Judge model receipt](crumb/round-6/judge-receipt.json) · [Generator model receipt](crumb/round-6/generator-receipt.json) · [Judge prompt](crumb/round-6/judge-prompt.txt)

Judge: claude-opus-5-5; reviewed 2026-11-04T04:46:13.305Z; source 557acd4. Browser errors: 0. Fit-to-screen text: 10.6–21.1 px, excluding arrow labels.

Cold read: An agent runs `crumb launch` (step 1). The CLI reads the account's entry header from the encrypted vault. If there is no entry it fails with NOT_FOUND, and if the entry is empty it fails with NEEDS_LOGIN. Otherwise it spawns a detached `__supervise` process and polls the run directory for a handle or an .error file, for up to 60s. The supervisor decrypts the session from the vault, launches system Chrome with CDP on 127.0.0.1, and injects the cookies and storage. It then writes a 0600 handle file containing the CDP URLs. The CLI returns that handle to the agent, and the agent drives Chrome directly over CDP (step 7). While Chrome runs, the supervisor merges changed state back into the vault every 30s and on SIGUSR2 or SIGTERM. Failures there are only logged, and closing Chrome skips the final save. The CDP port is unauthenticated, so any local process can drive the logged-in browser.

- **Purpose and audience: 4/4.** The visible title asks one specific question (how `crumb launch` restores a saved session into a browser an agent can drive). The subtitle names the audience (new engineers) and the scope (state mode, one machine).
- **Abstraction consistency: 3/4.** All six boxes are runtime actors or stores at the same level. Run files are a set of mixed artifacts (handle, error, log, temp dir), and 'Crumb CLI' really runs session.ts:launchDetached rather than cli.ts logic. Profile mode is pushed out to a footnote with no separate zoom-in view.
- **Completeness vs. focus: 3/4.** Covers the launch path and has an explicit 'Outside this view' line. It leaves out the early-return case: if a run handle already exists, launchDetached returns it without spawning (session.ts:133-134). It also leaves out the supervisor's header touch (session.ts:196) and the home-page navigation.
- **Relationships and data flow: 2/4.** Steps are numbered and each arrow carries its sync/async/local type in text, but four of the eight edges are hidden behind indirection labels (F1–F4), so the reader has to look the meaning up in a list. 'poll handle / .error' has no step number, and step 8 'save' is bundled into the step 4 arrow. Two separately initiated events (the initial decrypt and the periodic or signal-driven save) share one arrow.
- **Boundaries and grouping: 3/4.** There are four frames: Agent, Crumb processes, Crumb data dir and Browser, each with a same-host description. The detached supervisor and the CLI sit in one frame with no process boundary between them. The open CDP trust boundary appears only in a note and is not drawn.
- **Visual clarity and layout: 1/4.** Direction is left to right, but the CLI→Vault and Supervisor→Run file labels collide with the dotted edges ('2. read entry header' is overprinted). Step 5 and F4 take long detours around the frames. In the notes row, 'NEEDS_LOGIN' overprints 'Every 30s' and 'logged' runs into '127.0.0.1'. Several labels are small at 1194x834.
- **Notation and legend: 3/4.** The key explains frames, boxes and cylinders, and solid, dotted and dashed lines, and flow types are also written as text, which gives a non-color signal. The whole diagram is one red hue. Dotted and dashed are hard to tell apart at this size, and the F-label indirection adds an undocumented step for the reader.
- **Failure modes and non-functional insight: 3/4.** The notes cover the pre-spawn NOT_FOUND/NEEDS_LOGIN checks, errors passed through run/<id>.error, the 60s timeout leading to INTERNAL, best-effort autosave on a 30s timer and on SIGUSR2/SIGTERM, Chrome closing without a final save, and unauthenticated CDP. Missing: the poll stops early when the child exits (session.ts:161), the timeout and interval are configurable, SIGINT also saves, and cleanup removes the temp dir.
- **Accuracy and freshness: 3/4.** Shows a date, revision 557acd4, 'Owner: Unassigned' and 'Live runtime NOT verified'. Names match the code (__supervise, SIGUSR2, NEEDS_LOGIN). Capped at 3 because only the source was reviewed and no live system was checked.
- **Standalone comprehension: 2/4.** A newcomer can get the gist, but has to decode the F1–F4 list, untangle overlapping labels, and read past collided note text. The 'Checks entry' step attributed to the CLI is easy to misread.

Reviewer-reported inaccuracies:

- The pre-spawn checks, spawn and polling labeled 'Crumb CLI' (map path src/cli.ts) are actually implemented in src/session.ts:131-165 (launchDetached).
- Omitted: if a handle for the account is already running, launch returns it immediately without spawning (src/session.ts:133-134).
- The poll ends early with INTERNAL if the supervisor exits before writing a handle (src/session.ts:161). The 60s timeout and 30s autosave interval are defaults that can be overridden with options (session.ts:152, 191, 222).
- SIGINT also triggers a stop with a final save (src/session.ts:234). The note mentions only SIGTERM.
- The supervisor also writes the vault header right after launch (touchHeader lastUsedAt, src/session.ts:196), so step 4 is not only decrypt and later save.
- The supervisor navigates to the session's home URL or --url after injecting (src/session.ts:178-180). The diagram does not show this.

Next changes:

- Fix the collisions: move the edge labels off the dotted lines and stop the note columns overprinting each other ('NEEDS_LOGIN'/'Every 30s', 'logged'/'127.0.0.1'). Route step 5 and the CDP edge directly rather than around the frames.
- Remove the F1–F4 indirection by writing each label on its arrow. Number the poll edge, and split step 8 (save, triggered by a timer or signal) into its own arrow marked as a separately initiated event.
- Draw the unauthenticated CDP port as an explicit trust-boundary marker on the Browser frame. Add the reuse-running-handle shortcut, plus the child-exit and SIGINT paths, to the failure notes.

### Round 7: 27/40 — Mediocre

[Diagram](crumb/round-7/diagram.png) · [Editable canvas](crumb/round-7/canvas.json) · [Map](crumb/round-7/map.json) · [Review](crumb/round-7/review.json) · [Render metrics](crumb/round-7/render.json) · [Generation recipe](crumb/round-7/recipe.json) · [Exact generator queries](crumb/round-7/generator-queries.json) · [Renderer hashes](crumb/round-7/render-source.json) · [Judge model receipt](crumb/round-7/judge-receipt.json) · [Generator model receipt](crumb/round-7/generator-receipt.json) · [Judge prompt](crumb/round-7/judge-prompt.txt)

Judge: claude-opus-5-5; reviewed 2026-11-04T04:54:53.106Z; source 557acd4. Browser errors: 0. Fit-to-screen text: 5.2–10.4 px, excluding arrow labels.

Cold read: Running `crumb launch` makes the CLI spawn a detached `__supervise` Node process (step 1). The supervisor gets the vault key from the OS keychain or secret-tool, falling back to CRUMB_KEY or a key file (step 2). It decrypts the account's AES-256-GCM session state from the vault (step 3), launches local Chrome and injects the state, which exposes a CDP endpoint on 127.0.0.1 (step 4). It then writes a handle JSON with the CDP http/ws URLs to the run dir, or an error JSON if something failed (step 5). Meanwhile the CLI checks the run dir every 150 ms and returns the handle. If an error file appears, or the supervisor exits, or 60 s pass, the CLI fails. While the browser is running, the supervisor saves merged snapshots back to the vault every 30 s, when it receives SIGUSR2, and on SIGTERM/SIGINT (step 6). Save errors are only logged, and closing the window skips the final save. Any local process can drive the logged-in browser through the CDP port.

- **Purpose and audience: 4/4.** The visible title asks exactly one question ("how does `crumb launch` restore a saved session into a live browser?"). The subtitle names the audience (new engineers) and the scope. The detail level suits that audience.
- **Abstraction consistency: 3/4.** Every box is a runtime process or a stored artifact, so the level is mostly consistent. Two things are muddled: 'Key store' is drawn as an external service, but its body text also covers the CRUMB_KEY env var and a key file. 'Run dir' combines handle/error files with the temp profile.
- **Completeness vs. focus: 3/4.** The footer states what is left out (other commands, agent-side CDP use), and there is little noise. Missing: the CLI reads the vault itself before spawning (readEntry gates in src/session.ts:133-137), and profile-mode sessions use a persistent profileDir instead of inject.
- **Relationships and data flow: 3/4.** Edges are numbered (1–6) and labelled, and the legend says solid = sync and dotted = local command/IO. '3/6 decrypt/save' combines a startup read with a recurring asynchronous write on one arrow. The CLI→vault gate read and the CLI's initial running-handle check are not drawn.
- **Boundaries and grouping: 3/4.** There are three labelled frames: crumb host, Chrome process and OS key store. Each frame says it runs on the same host, and external nodes have a double border. The unauthenticated CDP trust exposure appears only in a note, not as a boundary. The env/key-file fallback sits inside the 'OS key store' frame, which blurs that boundary.
- **Visual clarity and layout: 1/4.** The diagram uses only about 420 px in the middle of the 1194 px viewport. Most text, including edge labels, node descriptions, legend and notes, renders at roughly 5–6 px and can barely be read on an iPad. The 'exec: get vault key' edge runs down through the Chrome frame to reach the Key store, crossing the Chrome arrow. There is a lot of empty space.
- **Notation and legend: 3/4.** The visible key explains frames, boxes, cylinders, double borders, arrow direction and dotted vs solid lines. Shape and line style give signals that don't rely on color, and names match the code. The whole drawing is a single color, and the legend text is tiny.
- **Failure modes and non-functional insight: 3/4.** The notes cover the startup gates (NOT_FOUND, NEEDS_LOGIN, KEY_UNAVAILABLE to the error file, 60s timeout to INTERNAL), best-effort autosave including the missing final save when the window closes, and the unauthenticated CDP port. These are relevant and correct. They live only in prose and are not attached to the edges they describe.
- **Accuracy and freshness: 2/4.** The footer shows the source review date, revision 557acd4, 'Owner: Unassigned' and 'Live runtime NOT verified'. Claims checked against src/session.ts and src/crypto.ts are mostly correct. There is no owner and no production verification, and the small omissions listed under inaccuracies remain.
- **Standalone comprehension: 2/4.** The numbered steps and notes would support a correct two-minute explanation if the text could be read. At the intended viewport the small text makes that hard, and the combined 3/6 edge and the missing CLI gate read invite misreading.

Reviewer-reported inaccuracies:

- src/session.ts:133-137: before spawning, the CLI process checks for a running handle in the run dir and reads the vault entry itself (readEntry) to return NOT_FOUND or NEEDS_LOGIN. The diagram shows no CLI→vault or initial CLI→run-dir read, so it looks as if all vault access belongs to the supervisor.
- src/session.ts:172-175: injection happens only in 'state' mode. 'profile' mode uses a persistent profileDir, not the temp profile the 'Run dir' node implies, and has no inject step. The label 'launch+inject' leaves this out.
- src/session.ts:178-195: the handle is written only after navigation to the home URL, and touchHeader also writes to the vault at startup. Neither appears in the steps.
- The edge '3/6 decrypt/save state' combines a one-time startup read with a recurring timer- or signal-driven write that the supervisor starts separately. Drawing two edges would match the actual control flow better.
- src/crypto.ts: the 'OS key store' frame also contains the CRUMB_KEY env / key-file fallbacks, which are not OS services.

Next changes:

- Make the diagram fill the 1194x834 viewport and raise every font to at least about 11 px, especially edge labels, the legend and the notes. Move the Key store frame next to the supervisor so its edge no longer cuts through the Chrome frame.
- Split edge 3/6 into 'decrypt state (startup)' and 'autosave merged snapshot (every 30s / SIGUSR2 / SIGTERM, async)'. Add the CLI's pre-spawn gate reads (running handle, vault entry → NOT_FOUND/NEEDS_LOGIN).
- Name an owner, and attach the failure and security callouts to their edges (error file on step 5, CDP exposure on step 4). Note the profile-mode vs state-mode difference.

### Round 8: 28/40 — Good

[Diagram](crumb/round-8/diagram.png) · [Editable canvas](crumb/round-8/canvas.json) · [Map](crumb/round-8/map.json) · [Review](crumb/round-8/review.json) · [Render metrics](crumb/round-8/render.json) · [Generation recipe](crumb/round-8/recipe.json) · [Exact generator queries](crumb/round-8/generator-queries.json) · [Renderer hashes](crumb/round-8/render-source.json) · [Judge model receipt](crumb/round-8/judge-receipt.json) · [Generator model receipt](crumb/round-8/generator-receipt.json) · [Judge prompt](crumb/round-8/judge-prompt.txt)

Judge: claude-opus-5-5; reviewed 2026-11-04T04:58:01.253Z; source 557acd4. Browser errors: 0. Fit-to-screen text: 7.4–14.8 px, excluding arrow labels.

Cold read: On the local machine, a detached Node supervisor keeps a Chrome browser context open for an agent. Every --autosave seconds (default 30; 0 disables it), on SIGUSR2 from `crumb sync`, or on SIGINT/SIGTERM, the supervisor snapshots cookies and storage from Chrome. If nothing changed it skips the save. Otherwise it reads the vault's latest encrypted copy, does a 3-way merge of its changes onto it, and writes the result via temp file + rename. It then records lastSavedAt in a plaintext run-handle JSON file. `crumb sync` polls that handle for up to 10s to confirm a new save and returns without error even if nothing changed. `crumb close` sends SIGTERM, waits up to 30s, then SIGKILLs, which loses the final save. Closing Chrome directly exits the supervisor without a final save. Save errors are only logged.

- **Purpose and audience: 4/4.** The visible title asks one specific question: how changes in a running Chrome session get saved back to the vault. The subtitle names the audience (new engineers) and the scope. The detail level suits that audience.
- **Abstraction consistency: 3/4.** The boxes are runtime actors (CLI, Supervisor, Chrome) and the cylinders are stored state (Run handle, Session vault), so the level is mostly consistent. Chrome is drawn as a peer process, but it is really a Playwright browser context that the supervisor owns (b.context in src/session.ts). The merge and snapshot logic appears only in notes, with no linked zoom-in view.
- **Completeness vs. focus: 3/4.** The diagram has all five actors needed to answer the question, and a footer explicitly notes what it leaves out (launch, profile mode, login, capture). Some lifecycle details are missing: the supervisor deletes the handle on cleanup, and the vault key or passphrase source, which encrypted writes depend on, isn't shown.
- **Relationships and data flow: 3/4.** Every arrow is labeled with what flows and its mode (SIGUSR2 / SIGTERM async; snapshot cookies+storage sync; read latest, write merge local). The ordering of a save (snapshot → read latest → merge → write → update lastSavedAt) is only implied by the notes, not numbered. The CLI's read of the handle at startup (runningHandle) and the SIGKILL path aren't drawn as edges.
- **Boundaries and grouping: 2/4.** There is a single 'Local machine' frame. There's no visual boundary for the supervisor process versus its Chrome context, and nothing visually separates encrypted from plaintext stores. That difference appears only in node text ('Plaintext pid', 'Encrypted').
- **Visual clarity and layout: 2/4.** Left-to-right direction with no crossings. But the content uses only about the middle half of the 1194x834 viewport, and edge labels and the footer are tiny (~6–7px) and hard to read. At this size the dashed (async) and dotted (local) lines are nearly impossible to tell apart, and the 'snapshot cookies+storage' label crowds its arrowhead.
- **Notation and legend: 3/4.** The key explains frames, boxes, cylinders and the arrow convention (request includes its response; dashed/solid/dotted), and each arrow also states its mode as text, which is a non-color signal. Everything is drawn in one red, and the dashed and dotted styles are visually ambiguous at viewing size.
- **Failure modes and non-functional insight: 3/4.** The notes cover real failure behavior that the code confirms: skip when unchanged, a shared in-flight save, errors only logged, Chrome closing directly means no final save, close falls back to SIGKILL after 30s, and sync returns after 10s without error. This is all prose, though; none of these failure points is marked on the graph itself.
- **Accuracy and freshness: 2/4.** Dated 2026-11-04 with revision 557acd4, and names match the code. The owner is 'Unassigned' and the footer states that live runtime was not verified, so this is a source review only.
- **Standalone comprehension: 3/4.** A new engineer could explain the timer, signal, snapshot, merge and write loop from the diagram plus its notes. Tiny labels and the ambiguous line styles invite misreads, and seeing that Chrome lives inside the supervisor needs a walkthrough.

Reviewer-reported inaccuracies:

- Chrome is drawn as an independent peer service. In src/session.ts:202,229,236 it is the supervisor's own Playwright context (b.context), and its 'close' event ends the supervisor process. That lifecycle coupling isn't shown.
- The supervisor→Run handle edge is labeled only 'lastSavedAt'. In src/session.ts:194-195,219 the supervisor also writes the whole handle at startup and deletes it on exit; closeSession also deletes it (src/session.ts:258).
- The CLI's interaction with the handle is shown only as 'poll lastSavedAt'. The CLI also reads the handle first to get the pid it signals (runningHandle, src/session.ts:252,264), so the signal edge's dependency on the handle isn't visible.
- 'Plaintext' handle: it is written with mode 0o600 (src/session.ts:194), a local permission boundary the diagram doesn't mention.
- The vault write also records a provenance header (source 'sync', src/session.ts:207) and merges browser hints, which 'write merge' leaves out (minor).

Next changes:

- Make it readable at 1194x834. Scale the diagram to fill the viewport, raise edge-label and footer fonts to at least 11px, and replace dashed vs dotted with clearly different styles (e.g., a double line or open arrowheads), or drop one of the styles.
- Show ownership and lifecycle boundaries. Nest Chrome inside a 'Supervisor process' frame (Playwright-owned context, and Chrome closing kills the supervisor). Visually separate the encrypted vault from the plaintext 0600 handle, and show where the vault key comes from.
- Move the failure behavior onto the graph. Number the save steps (1 snapshot → 2 read latest → 3 merge → 4 temp+rename → 5 lastSavedAt), and mark failure points inline (SIGKILL after 30s skips the save; Chrome closed directly means no final save; errors only logged). Assign an owner as well.

### Round 9: 29/40 — Good

[Diagram](crumb/round-9/diagram.png) · [Editable canvas](crumb/round-9/canvas.json) · [Map](crumb/round-9/map.json) · [Review](crumb/round-9/review.json) · [Render metrics](crumb/round-9/render.json) · [Generation recipe](crumb/round-9/recipe.json) · [Exact generator queries](crumb/round-9/generator-queries.json) · [Renderer hashes](crumb/round-9/render-source.json) · [Judge model receipt](crumb/round-9/judge-receipt.json) · [Generator model receipt](crumb/round-9/generator-receipt.json) · [Judge prompt](crumb/round-9/judge-prompt.txt)

Judge: claude-opus-5-5; reviewed 2026-11-04T05:00:29.831Z; source 557acd4. Browser errors: 0. Fit-to-screen text: 7.2–14.4 px, excluding arrow labels.

Cold read: crumb runs a detached Node supervisor for each state-mode session, and the supervisor owns a Playwright Chrome context. Every --autosave seconds (default 30), on SIGUSR2, or on SIGINT/SIGTERM as a final save, the supervisor takes a snapshot of Chrome's cookies and storage (1). It then reads the latest encrypted session for the account from the vault (2), three-way merges latest/before/after, and writes the result atomically to a 0600 temp file, then renames it into place (3). Saves that overlap are combined into one, and unchanged snapshots are skipped. Errors are only logged. If Chrome closes by itself, the supervisor exits without a final save. The vault key comes from CRUMB_KEY, the OS keychain, or a key file. There is no lock against other writers.

- **Purpose and audience: 4/4.** The visible title asks a precise question (how a running state-mode session autosaves into the vault), and the subtitle names the audience (new engineers) and the scope.
- **Abstraction consistency: 3/4.** All three boxes are runtime actors or stores at the same level. But the triggers (timer, signals from outside senders such as `crumb sync` SIGUSR2) and the key source exist only as prose, not as elements.
- **Completeness vs. focus: 3/4.** Omissions are stated deliberately below the diagram. The supervisor's run-handle update after each save (`lastSavedAt`, src/session.ts:209) and the external signal sender are left out, even though they are part of the save loop.
- **Relationships and data flow: 3/4.** Arrows are numbered 1-3 and labelled with mode. But labels are hyphen-broken mid-word ('rena me', 'cookies/s tore'), and edges 2 and 3 both go to the vault with a crossing approach. Triggers are not drawn as separately initiated events.
- **Boundaries and grouping: 2/4.** There is a single 'Local machine' frame. No internal boundary separates the supervisor process from its child Chrome, or shows the encrypted at-rest store or the key provider (keychain/env/file).
- **Visual clarity and layout: 2/4.** The diagram fills about 30% of the 1194x834 canvas, and the note and footer text is about 7-9px, which is hard to read at iPad size. Edge labels are tiny and wrap mid-word, and the frame has large empty space.
- **Notation and legend: 3/4.** The legend explains frames, boxes, cylinders, and the solid vs dotted arrow styles, and the line style itself is a non-color signal. But everything is a single red hue, and the legend is small.
- **Failure modes and non-functional insight: 3/4.** Notes cover coalescing, skipping unchanged snapshots, errors that are only logged, Chrome closing with no final save, no lock against other writers, and the atomic temp+rename write. None of these is attached to the diagram as a failure marker.
- **Accuracy and freshness: 3/4.** Shows date, revision 557acd4, and 'Owner: Unassigned', and states that the live runtime was NOT verified. The claims match src/session.ts:205-236 and vault.ts:112. Capped at 3 without production verification.
- **Standalone comprehension: 3/4.** A newcomer can follow snapshot → read latest → merge+write from the numbers plus the notes. But small text and broken labels slow this down, and who sends the signals needs explaining.

Reviewer-reported inaccuracies:

- Each successful save also updates the run handle's autosave.lastSavedAt (src/session.ts:209), which `crumb sync` polls (src/session.ts:266-272). The 'Outside this view' note excludes run handle files, but leaving them out hides the signal/acknowledgement loop.
- Who sends SIGUSR2/SIGTERM is not shown. In practice the CLI's sync and close commands send them (src/session.ts:254, 267), so the 'Save triggers' note looks like a purely internal trigger.
- The edge labels 'merge→temp+rena me' and 'snapshot→cookies/s tore' are wrapped mid-token, so the visible text is garbled even though the facts are right.

Next changes:

- Scale the diagram to fill the 1194x834 viewport and raise the font size of edge labels and notes to at least 12px. Widen the edge label boxes so tokens don't break mid-word.
- Draw the triggers explicitly: a timer element and an external 'crumb CLI (sync/close)' actor sending SIGUSR2/SIGTERM, styled as separately initiated events. Optionally add the handle `lastSavedAt` write as the acknowledgement path.
- Attach failure markers to the elements they affect (Chrome closing on its own → no final save; write → no lock; save error → only logged). Show the key provider as an external dependency of the vault.

### Round 10: 30/40 — Good

[Diagram](crumb/round-10/diagram.png) · [Editable canvas](crumb/round-10/canvas.json) · [Map](crumb/round-10/map.json) · [Review](crumb/round-10/review.json) · [Render metrics](crumb/round-10/render.json) · [Generation recipe](crumb/round-10/recipe.json) · [Exact generator queries](crumb/round-10/generator-queries.json) · [Renderer hashes](crumb/round-10/render-source.json) · [Judge model receipt](crumb/round-10/judge-receipt.json) · [Generator model receipt](crumb/round-10/generator-receipt.json) · [Judge prompt](crumb/round-10/judge-prompt.txt)

Judge: claude-opus-5-5; reviewed 2026-11-04T05:09:24.709Z; source 557acd4. Browser errors: 0. Fit-to-screen text: 7.8–15.7 px, excluding arrow labels.

Cold read: This diagram shows how crumb keeps a running browser's login current. When you `crumb launch` a state-mode account, a background Node "Supervisor" process starts and owns a Chrome child running on a throwaway temp profile. The Supervisor saves on a timer, every 30s by default (`--autosave 0` turns the timer off). Each save works like this: (1) ask Chrome for its storageState over Playwright and get the cookies back; (2) read the account's current vault entry; (3) do a three-way merge, applying only what changed in this browser since the last save onto whatever is in the vault now, then write a temp file and rename it over the entry. If nothing changed, the save is skipped. If a tick fires during a save, it joins that save. Errors are only logged. The vault entry is a 0600 file whose header is plain text and whose session body is AES-256-GCM encrypted, with the account id as additional authenticated data (AAD). The key comes from CRUMB_KEY or from the OS keychain/Secret Service/~/.crumb/key and is cached per process. Two risks: there is no file lock, so anything another writer saves between the read and the rename is lost; and if the user closes Chrome themselves, the Supervisor exits without a final save, so changes since the last tick are lost. A SIGTERM/SIGINT (e.g. `crumb close`) saves first. Everything runs on one machine as one OS user. Launch, `crumb sync`, profile mode and agent CDP use are out of scope.

- **Purpose and audience: 4/4.** The visible title asks one exact question: "crumb: how does a running state-mode session autosave its cookies to the vault?". The subtitle names the audience ("New engineers") and the scope (snapshot Chrome, merge with the latest vault entry, rewrite it). Three nodes plus three notes is about the right depth for new engineers. One wording problem: the title says "cookies" when more than cookies is saved (see inaccuracies).
- **Abstraction consistency: 4/4.** All three shapes are at the same runtime level: the Supervisor process, the Chrome child process, and the vault files. Code details (AAD, temp file + rename, ticks joining a save already in progress) go into the source-cited notes, not into boxes. The key store is left out of the drawing, which is reasonable because `vaultKey()` caches the key for the life of the process (src/crypto.ts:13,53), so autosave ticks never touch it.
- **Completeness vs. focus: 3/4.** Only the three parts needed are shown, and the "Outside this view" line deliberately lists what is out of scope (launch, handle files, sync/close signal saves, profile mode, agent CDP). But the timer, which is what starts every autosave, appears only in text. The map's sup→sup timer edge is missing from the render. The key-custody note is a little off the autosave question. "Errors only logged" does not say where (~/.crumb/run/<site>__<account>.log).
- **Relationships and data flow: 3/4.** Every arrow is labeled, numbered (1 storageState; 2 read, 3 merge + rename) and marked with its type in words and line style. The separately started Chrome self-close is drawn as its own dashed async arrow ("close → exit, no save"), which is good. Points off: no visible trigger, so the numbering starts at 1 with nothing causing it. "3 merge" sits on the vault arrow even though `mergeState` runs in the Supervisor's memory (src/session.ts:204-205). Read and write share one arrow.
- **Boundaries and grouping: 2/4.** There is one frame, "Local machine: Local self-managed host, same OS user". That is a real trust statement, since 0600 files only protect against other users. Nothing separates the OS-managed key stores (Keychain/Secret Service, mentioned only in a note), the third-party Chrome binary run as a Playwright child, or the ~/.crumb file tree. The frame also leaves loopback CDP exposure unmarked, as a boundary or as a deliberate omission. Most grouping is implied.
- **Visual clarity and layout: 2/4.** No arrows cross, but there is no clear main direction (Supervisor left-centre, Chrome upper right, Vault lower right). The drawing uses only the middle ~48% of the 1194px width, and the bottom third of the frame is empty. At 1194x834 the node text and edge labels are about 8–10px, and the subtitle, "Outside this view" and the provenance footer are about 7–8px. That is hard to read on an iPad. Edge labels sit on the lines: the dotted stroke runs into "merge +", and the arrowhead nearly touches "rename (local)".
- **Notation and legend: 3/4.** There is a visible key: frames = trust/deployment zones, box = actor/process, cylinder = stored state, solid/dotted/dashed = sync/local I/O/async, and it notes that "Flow type is also written on each arrow". So meaning does not depend on colour, and the drawing is monochrome anyway. Weaknesses: the legend mixes two axes. Vault I/O is also synchronous (readFileSync/renameSync), while storageState is an awaited async Playwright call. The step numbers are not explained. Labels are generic ("Supervisor", "Vault files") rather than code names or paths (`supervise()`, ~/.crumb/vault/<site>/<account>.crumb).
- **Failure modes and non-functional insight: 3/4.** The notes and node text give the important local failure behaviour: --autosave 0 means no timer, ticks join an in-flight save, unchanged snapshots skip, errors are only logged, Chrome self-close exits with no final save (up to one interval lost), SIGTERM/SIGINT save first, there is no lock so writes between read and rename are lost, files are swapped by temp-file rename, and the key is cached. Missing: where errors go, KEY_UNAVAILABLE/NOT_FOUND cases, and the fact that a failed save is retried on the next tick because `before` is not advanced (src/session.ts:208). The notes are also tiny and not tied to the elements they describe.
- **Accuracy and freshness: 3/4.** The visible footer reads "Source review 2026-11-04 · revision 557acd4 · Owner: Viraat Das · Live runtime NOT verified". The owner matches package.json "author" and the git user. The notes match src/session.ts:198-241, src/vault.ts:108-147,206-223 and src/crypto.ts:52-85. Capped at 3 because nothing was checked against a running system. Small inaccuracy: "cookies" leaves out localStorage and IndexedDB.
- **Standalone comprehension: 3/4.** A new engineer could explain the loop correctly from the subtitle plus the three notes: snapshot, re-read, three-way merge, atomic rewrite, no lock, no save when Chrome self-closes. But the trigger exists only in text, merge looks like a vault-side operation, and much of the useful text is 7–9px at the target viewport. They would get it right only after reading closely, not at a glance.

Reviewer-reported inaccuracies:

- The map's "timer tick, default 30s" self-loop on Supervisor does not appear in the image. Visible steps start at "1" with no trigger, although the timer is the core of the question (`setInterval(save, …)` at src/session.ts:222).
- The title says "autosave its cookies" and edge 1 says "storageState → cookies". The snapshot is actually `context.storageState({ indexedDB: true })` (src/browser.ts:123-125), and `mergeState` also merges per-origin localStorage and IndexedDB (src/vault.ts:206-223). Full storage state is saved, not just cookies.
- "3 merge" is on the Supervisor→Vault arrow, which makes it look like a vault-side operation. The merge happens in the Supervisor's memory (`mergeState(latest.state, before, after)` at src/session.ts:205). Only reading and the temp-file write + rename (`atomicWrite`, src/vault.ts:108-113) are file I/O. The write path also re-reads the entry header (`readEntry` in `writeSession`, src/vault.ts:135), so header-only updates such as `touchHeader` from `crumb check` (src/session.ts:342) can also be lost in the unlocked window.
- The legend contrasts "solid = sync" with "dotted = local command/I/O", but the vault I/O is fully synchronous (readFileSync/writeFileSync/renameSync, src/vault.ts:108-119). The storageState call is an awaited async Playwright request. The legend mixes transport and synchrony on one axis.
- "Errors only logged" leaves out the destination. The supervisor's stderr is redirected to ~/.crumb/run/<site>__<account>.log (src/session.ts:142-148, 212). It also hides that a failed save is effectively retried on the next tick, because `before` only advances on success (src/session.ts:208).
- The verification metadata says dirty:false, but the working tree has an untracked DECISIONS.md. Source files are unaffected, but the provenance claim is a little loose.

Next changes:

- Draw the trigger and split the steps. Add a visible "0 timer tick (setInterval, 30s; --autosave 0 = off)" self-loop or a timer element on Supervisor. Then show '2 readSession (decrypt)' as Supervisor→Vault, '3 mergeState(latest, before, after)' inside Supervisor, and '4 writeSession: temp file + rename' as a separate write arrow, so ordering and the unlocked read-to-rename window can be read directly from the arrows.
- Make it readable at 1194x834. Scale the drawing to fill the width, raise node, edge-label, subtitle and footer text to at least 12px, remove the empty bottom of the frame, move edge labels off the strokes, and attach the three notes to the elements they describe with numbered callouts.
- Make the names and boundaries accurate. Replace "cookies" with "storage state (cookies + localStorage + IndexedDB)", use real names and paths (`supervise()` in src/session.ts, ~/.crumb/vault/<site>/<account>.crumb, ~/.crumb/run/<id>.log for errors), and split the local frame into Node supervisor, Chrome child (third-party binary, temp profile), ~/.crumb files and the OS key store, marking loopback CDP exposure as a deliberate omission.

### Round 11: 35/40 — Good

[Diagram](crumb/round-11/diagram.png) · [Editable canvas](crumb/round-11/canvas.json) · [Map](crumb/round-11/map.json) · [Review](crumb/round-11/review.json) · [Render metrics](crumb/round-11/render.json) · [Generation recipe](crumb/round-11/recipe.json) · [Exact generator queries](crumb/round-11/generator-queries.json) · [Renderer hashes](crumb/round-11/render-source.json) · [Judge model receipt](crumb/round-11/judge-receipt.json) · [Generator model receipt](crumb/round-11/generator-receipt.json) · [Judge prompt](crumb/round-11/judge-prompt.txt)

Judge: claude-opus-5-5; reviewed 2026-11-04T05:18:58.600Z; source 557acd4. Browser errors: 0. Fit-to-screen text: 9.0–18.0 px, excluding arrow labels.

Cold read: crumb keeps per-account browser sessions in an encrypted vault on the local machine. This view covers one thing: while a state-mode session is running, how its storage gets saved back. A Supervisor process (supervise(), Node.js/Playwright) owns a Chrome child that runs on a temporary profile. Supervisor, Chrome and the vault files all run as the same OS user on one machine. A timer fires every 30s by default (--autosave 0 turns it off) (1). The supervisor asks Chrome for a storage-state snapshot of cookies, localStorage and IndexedDB, and waits for the reply (2). If nothing changed since the last good save, it stops there. Otherwise it reads the current vault entry for the account (3). In memory, it applies only the changes between the previous snapshot ('before') and the new one ('after') to that latest entry, and adds 'sync' provenance and browser hints. It then writes a temp file and renames it over the entry (4). The entry body is AES-256-GCM encrypted, the header is plaintext, and the file is mode 0600. The key comes from CRUMB_KEY, or else the key store named in config.json, and is cached at startup, so saves never touch the key store. Failure behaviour: a tick that arrives during a save joins that save. Errors are only logged to the run log, and because 'before' is not advanced, the next tick retries. There is no lock, so if another process writes the entry between the read and the rename, that write is lost. If the user closes Chrome, the supervisor exits without a final save, so up to one interval of changes is lost. Signal-driven sync/close, launch, handle files and profile mode are outside this view.

- **Purpose and audience: 4/4.** The visible title asks one question: 'crumb: how does a running state-mode session autosave storage state to the vault?' The subtitle names the audience (New engineers) and the scope (timer-driven saves in supervise()). The level of detail suits new engineers: process names, the merge rule and the failure notes, with no line-level code.
- **Abstraction consistency: 4/4.** There are three nodes, all at the runtime level: the Supervisor process, its child Chrome process, and the Vault files store. Key-store and log details sit in notes and do not appear as mixed-level boxes. Nothing is jumbled across infrastructure, code and concepts.
- **Completeness vs. focus: 4/4.** It shows every step needed for the question: tick, snapshot (cookies, localStorage, IndexedDB), read, in-memory merge, then temp write and rename. The 'Outside this view' line names the deliberate omissions: launch, run handle files (the post-save lastSavedAt handle write is one of them), signal-driven sync/close, profile mode, agent CDP and login/check. Nothing extra is included.
- **Relationships and data flow: 3/4.** All edges are directed, labelled and numbered 1–4, and each is marked sync, async or local. The legend says a request arrow includes its response, so the single 'read' arrow is fine, and the Chrome→Supervisor 'close event: no save' is drawn as its own async event. Deduction: the '1 tick' self-loop is drawn as a broken triangle. One dashed segment runs out of the Local machine frame to about (383,558), and another ends with no arrowhead near the step-3 label. A reader could take this as an unlabelled extra edge or a trigger from outside the machine. The merge between steps 3 and 4 is also only in a note, not a visible step.
- **Boundaries and grouping: 4/4.** An explicit 'Local machine' frame is captioned 'Local host; all three as one OS user', which states the trust and ownership situation. Chrome is marked 'Owned child, temp profile'. Vault files are marked 'Encrypted per-account files, 0600, no lock'. No external services sit on the save path (the key is cached), so no extra boundary is needed for this local project.
- **Visual clarity and layout: 2/4.** Supervisor sits on the left and fans out to Chrome and Vault on the right, but the layout is awkward at 1194x834. The self-loop is a stray triangle that pokes below the frame and leaves a segment dangling. The solid edge runs through '2 storage-state snapshot', and the dotted edge runs through '3 read; 4 temp +'. The arrowhead and the cylinder top crowd the 'Vault files' title. The subtitle, frame caption, 'Source:' lines and footer are about 8–9px, hard to read at this size. The diagram uses only the centre of the canvas and leaves large empty margins.
- **Notation and legend: 4/4.** A visible key explains frames (trust/deployment zones), boxes (runtime actor/process), cylinders (stored state), and arrows (caller → recipient, response included; dashed = async event, solid = awaited request/reply, dotted = file/IPC). Line style, not colour, carries the meaning, so the single red authorship colour is fine. Names match the code (supervise(), Chrome, Vault files).
- **Failure modes and non-functional insight: 4/4.** The notes cover the relevant behaviour. Timer: default 30s, 0 = off. Concurrency: ticks join an in-flight save, and unchanged state skips the write. Retry: errors go only to the run log, and 'before' advances only on success, so the next tick retries. Race: no lock, so another process's write between steps 3 and 4 is lost. The Chrome close path ends without a save. Key store: the key is cached at startup, so saves make no key-store calls. The encrypted body vs plaintext header is stated.
- **Accuracy and freshness: 3/4.** The footer shows date (2026-11-04), revision 557acd4, owner Viraat Das and 'Live runtime NOT verified'. All claims I checked match src/session.ts, src/vault.ts, src/crypto.ts and src/browser.ts. Without verification against a running system the rubric caps this at 3.
- **Standalone comprehension: 3/4.** A newcomer can mostly retell the save cycle from the image: tick, snapshot, read, merge, rewrite, plus the close/no-save and no-lock caveats. But the malformed self-loop that leaves the frame could be misread as an external trigger or an extra edge. The tiny caption and footer text also makes the trust and verification context easy to miss without someone explaining it.

Reviewer-reported inaccuracies:

- None reported.

Next changes:

- Redraw the '1 tick, default 30s' self-loop as a small closed loop on the Supervisor box, or as a timer glyph or node inside the frame. It must stay inside the Local machine frame and leave no dangling segment, so it no longer reads as an external trigger or a stray edge.
- Move edge labels off their lines so the strokes don't run through '2 storage-state snapshot' and '3 read; 4 temp + rename', and end the dotted arrow at the cylinder body, clear of the 'Vault files' title. Consider splitting 3 (read) and 4 (temp + rename) into separate arrows, and showing the in-memory 'merge before→after' as a visible step between them.
- Scale the diagram up to fill the 1194x834 viewport and raise the subtitle, frame caption, 'Source:' lines and footer (date/revision/owner/not-verified) to at least 11–12px. Optionally add drawn line-style swatches to the text-only key.

### Round 12: 39/40 — Excellent

[Diagram](crumb/round-12/diagram.png) · [Editable canvas](crumb/round-12/canvas.json) · [Map](crumb/round-12/map.json) · [Review](crumb/round-12/review.json) · [Render metrics](crumb/round-12/render.json) · [Generation recipe](crumb/round-12/recipe.json) · [Exact generator queries](crumb/round-12/generator-queries.json) · [Renderer hashes](crumb/round-12/render-source.json) · [Judge model receipt](crumb/round-12/judge-receipt.json) · [Generator model receipt](crumb/round-12/generator-receipt.json) · [Judge prompt](crumb/round-12/judge-prompt.txt)

Judge: claude-opus-5-5; reviewed 2026-11-04T05:26:48.976Z; source 557acd4. Browser errors: 0. Fit-to-screen text: 10.4–17.4 px, excluding arrow labels.

Cold read: When a crumb account is launched in state mode, a detached Node supervisor process owns a Chrome child that runs on a throwaway temp profile. All three pieces (supervisor, Chrome, vault files) live on the local machine under one OS user. The supervisor runs a timer, 30 s by default; `--autosave 0` turns it off. On each tick (1) it asks Chrome, synchronously, for a Playwright storageState snapshot of cookies, localStorage and IndexedDB (2). If the snapshot is identical to the last saved one ('before'), it does nothing. Otherwise it reads the account's current vault file (3) and, in memory (4), applies only what changed since 'before' onto that fresh copy. Cookies and localStorage merge key by key; IndexedDB is replaced whole for each origin in the snapshot. It then writes the file back atomically: temp file, then rename (5). A tick that fires while a save is still running just joins that save. If a save fails, the error goes only to the run/ log, 'before' doesn't move, and the next tick tries again. There is no file lock, so if another process writes the same vault entry between steps 3 and 5, that write is lost. If Chrome itself closes, the supervisor exits without a final save, so anything since the last tick is lost. The vault key is loaded once at startup (from CRUMB_KEY or the key store named in config.json), and launch fails if it's missing. Only the session body is AES-256-GCM encrypted; the entry header and the run/ handle (with lastSavedAt) are plaintext. Launch, the signal-triggered saves (`crumb sync`, `crumb close`), profile mode and agent CDP are left out on purpose. The view was checked against source revision 557acd4 on 2026-11-04, owned by Viraat Das, and not against a running system.

- **Purpose and audience: 4/4.** The visible title asks one exact question: "how does a running state-mode session autosave storage state to the vault?" The subtitle names the audience ("New engineers") and the scope (timer-driven saves in supervise()). The level of detail (merge semantics, lock gap, key caching) suits engineers who will work on this code.
- **Abstraction consistency: 4/4.** All three shapes are at the same runtime level: two processes (Supervisor, Chrome) and one store (Vault files). The merge step is shown as text inside the Supervisor box rather than as an extra box, and code-level details are pushed into notes that each cite a source file. Nothing mixes in teams, functions or unrelated concepts.
- **Completeness vs. focus: 4/4.** Steps 1–5 cover the whole save cycle: tick, snapshot, read, merge, temp-file-plus-rename. The note on skips, in-flight joins and retries matches src/session.ts:198-216. The 'Outside this view' line names what was left out on purpose (launch, crumb sync/close signals, profile mode, agent CDP, login/check). Small optional gaps: the handle's lastSavedAt rewrite after a save isn't drawn as a step, and the starting 'before' snapshot isn't explained.
- **Relationships and data flow: 4/4.** The key defines arrows as caller → recipient with the response included. Every edge is labelled with what flows and is numbered 1→5 to give the order. Each edge also carries a textual mode: (async) for the tick and the close event, (sync) for the awaited storageState call, (local) for file I/O. The browser close is shown as its own event, initiated by Chrome. The code order (snapshot before readSession) matches the numbering.
- **Boundaries and grouping: 4/4.** One 'Local machine' frame states "all three as one OS user", which is accurate: there is no internal OS trust boundary and nothing is managed or remote in scope. The local ownership boundaries that matter are explicit: Chrome is an "Owned child, temp profile", the Supervisor is "Detached", and the encrypted-versus-plaintext split of the vault entry and handle is in a note. No infrastructure is invented.
- **Visual clarity and layout: 4/4.** The flow runs left to right, from Supervisor to a right-hand column of Chrome above Vault. No edges cross, the notes sit in three aligned columns, and most text is about 10–11 px, which is readable at 1194x834. A minor oddity: the self-loop is drawn as two dashed stubs with the label covering the turn, but it still reads clearly as a timer tick.
- **Notation and legend: 4/4.** The visible key explains frames, boxes (actor/process), the cylinder (stored state), arrow direction including responses, and dashed/solid/dotted lines. Every edge also has a text tag ((async)/(sync)/(local)), so meaning doesn't depend on colour, which makes the single colour fine. Names match the code: Supervisor/supervise(), storageState, ~/.crumb/vault, CRUMB_KEY, keyStore, run/.
- **Failure modes and non-functional insight: 4/4.** Failure behaviour and state are spelled out: errors go only to the log; 'before' advances only on success, so the next tick retries; unchanged snapshots are skipped; ticks join an in-flight save; there is no lock, so another process's write in the 3→5 window is lost; closing the browser skips the save; a missing key fails launch; the key is cached; headers and the handle are partly plaintext. All of this matches src/session.ts:198-241, src/vault.ts:108-113,132-147,206-223 and src/crypto.ts:52-85.
- **Accuracy and freshness: 3/4.** The footer gives a date (2026-11-04), revision 557acd4 plus local edits, and an owner, Viraat Das, which is backed by the package.json author. It also says plainly "Live runtime NOT verified". Every claim I checked matches the source, but this was a source-only review, so the rubric caps freshness at 3.
- **Standalone comprehension: 4/4.** From the title, the numbered edges, the key and the three notes, a newcomer could correctly explain the 30 s tick, the snapshot, the three-way merge onto a fresh read, the atomic rewrite, retry and skip, the lost-update gap, and that closing the browser loses unsaved changes. Small risks: 'before', 'header' and 'run/ handle' are used without definition, and the browser 'close' (no save) could be confused with `crumb close` (which saves). Neither causes a wrong overall explanation.

Reviewer-reported inaccuracies:

- None reported.

Next changes:

- Run one real session to lift freshness, the only dimension below 4. For example, `crumb launch <id> --autosave 5`, change a cookie, and watch `autosave.lastSavedAt` in the run/ handle and the vault file's mtime change; then put 'runtime verified <date>' in the footer.
- Make clear which 'close' skips the save. Relabel the Chrome→Supervisor edge as something like 'browser window/context closed (user or agent): exit, changes since last tick lost', and add a short contrast that `crumb close` sends SIGTERM and does a final save (src/session.ts:224-241). Otherwise readers may think `crumb close` also loses data.
- Fill in the small gaps a newcomer will ask about. Draw the post-save write of lastSavedAt to the handle as a step 6 (src/session.ts:208-210). Say that 'before' starts as the snapshot taken right after inject at launch (src/session.ts:176). Define 'header' as the plaintext account descriptor in the .crumb entry. Use the real log file name, ~/.crumb/run/<site>__<account>.log (src/paths.ts:39-41), instead of run/<id>.log.

## Vibeprint

| Dimension | R1 | R2 | R3 | R4 | R5 | R6 | R7 | R8 | R9 | R10 | R11 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Purpose and audience | 1 | 3 | 4 | 4 | 4 | 4 | 4 | 4 | 4 | 4 | 4 |
| Abstraction consistency | 2 | 3 | 3 | 3 | 3 | 3 | 3 | 4 | 4 | 4 | 4 |
| Completeness vs. focus | 2 | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 4 | 3 | 4 |
| Relationships and data flow | 1 | 1 | 3 | 2 | 3 | 2 | 3 | 3 | 3 | 3 | 4 |
| Boundaries and grouping | 0 | 2 | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 4 |
| Visual clarity and layout | 2 | 0 | 2 | 2 | 3 | 2 | 2 | 3 | 3 | 3 | 3 |
| Notation and legend | 1 | 2 | 3 | 2 | 2 | 3 | 3 | 3 | 3 | 3 | 4 |
| Failure modes and non-functional insight | 0 | 2 | 3 | 3 | 3 | 3 | 3 | 4 | 4 | 3 | 4 |
| Accuracy and freshness | 1 | 2 | 2 | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 3 |
| Standalone comprehension | 1 | 1 | 3 | 2 | 3 | 2 | 3 | 3 | 4 | 3 | 4 |

### Round 1: 11/40 — Redo

[Diagram](vibeprint/round-1/diagram.png) · [Editable canvas](vibeprint/round-1/canvas.json) · [Map](vibeprint/round-1/map.json) · [Review](vibeprint/round-1/review.json) · [Render metrics](vibeprint/round-1/render.json)

Judge: Claude Code; reviewed 2026-11-04T04:05:49.809Z; source dca6c85. Browser errors: 0. Fit-to-screen text: 10.1–10.1 px, excluding arrow labels.

Cold read: The diagram has no title, so this is inferred: a web canvas talks to a local daemon over HTTP/WS. A CLI starts both the daemon and an MCP server, and the MCP server calls the daemon over HTTP. The daemon uses Core and Interpret, and Interpret calls the Claude API. The daemon and the web canvas both connect to a Relay over WebSocket, presumably for remote access. The image doesn't say what the product does, where each box runs, who uses MCP (coding agents), that the relay is a hosted Fly service for the iPad, or where state is stored.

- **Purpose and audience: 1/4.** There's no title, subtitle or caption in the image. A reader can guess it's a component overview of some local tool, but nothing says which question it answers or who it's for.
- **Abstraction consistency: 2/4.** Mostly at the component level, but it mixes processes (Daemon, Relay, CLI), in-process libraries (Core, Interpret), an entry point (CLI) and an external SaaS (Claude API) as identical boxes. Nothing marks which ones run as processes and which are code modules.
- **Completeness vs. focus: 2/4.** The main pieces are present, but some important ones are missing: the .vibeprint/ on-disk state, git/repo scanning, and the MCP fallback that writes files directly when the daemon is down (src/mcp/backend.ts:103, src/mcp/server.ts:54). The coding agent that uses MCP and the iPad device aren't shown either.
- **Relationships and data flow: 1/4.** 5 of the 10 arrows have no label (CLI→Daemon, CLI→MCP, Daemon→Core, Daemon→Interpret, Interpret→Core), and arrows mean different things: 'starts' (CLI), 'calls' (modules) and 'connects' (protocols). The labels that do exist are protocol names rather than what flows. Relay traffic, which goes iPad→relay→tunnel→daemon, isn't shown as directional.
- **Boundaries and grouping: 0/4.** There are no containers at all. Nothing separates local machine, hosted Fly relay, external Anthropic API and the remote iPad, even though that trust and network split is the most important boundary in this system.
- **Visual clarity and layout: 2/4.** Flows top-down with no crossings, but it takes up roughly the middle 25% of the 1194px width and leaves large empty margins. Edge labels ('WebSocket', 'HTTP/WS', 'API') are about 6px and hard to read at iPad size. The long Web canvas→Relay arrow runs parallel to the Daemon edges and adds visual weight.
- **Notation and legend: 1/4.** Every node is the same red sketchy rectangle. The map's 'kind' (client/service/module/external) isn't shown visually, and there's no legend. Real names are used, which is the only credit here.
- **Failure modes and non-functional insight: 0/4.** No failure or state information appears: not the daemon-down file fallback, the relay identity/secret, the Claude-vs-heuristic fallback in Interpret, or where state persists.
- **Accuracy and freshness: 1/4.** Names match the directories (src/server, src/mcp, src/core, src/interpret, relay/), and the Daemon→Relay WebSocket matches src/server/relay.ts:8-10. But the diagram shows no date, version or owner, and it hasn't been checked against the running system.
- **Standalone comprehension: 1/4.** A newcomer couldn't tell what Vibeprint does, why there's a relay, who calls MCP, or that Core/Interpret are libraries inside the daemon process. Someone would need to explain it.

Reviewer-reported inaccuracies:

- The MCP server doesn't depend only on the daemon. src/mcp/backend.ts:103 and src/mcp/server.ts:54 add a no-daemon mode that reads and writes .vibeprint/ files directly, and the diagram doesn't show it.
- Web canvas→Relay is drawn as a plain 'WebSocket' arrow. Per src/server/relay.ts:8-10, remote requests from the iPad arrive at https://<id>.<relay domain>/ and the relay replays them over the daemon's single outbound WebSocket. The relay is a proxy, not a peer endpoint, so this edge suggests the wrong mental model.
- CLI→Daemon and CLI→MCP have no labels, so 'starts the process' looks the same as the runtime 'calls' arrows from Daemon to Core/Interpret.
- Core and Interpret are in-process libraries (src/core, src/interpret), and src/core/daemon-client.ts is also used by MCP. Drawing them as peer boxes next to processes and services misrepresents the deployment.
- The image shows no versions or revision, even though the source is at 0.7.0 / dca6c85.

Next changes:

- Add a title stating what question the diagram answers (e.g. 'Vibeprint 0.7.0 runtime: how the iPad canvas and coding agents reach the local daemon'), plus the date, revision and an owner line.
- Draw boundary containers for Local machine (CLI, daemon process with Core/Interpret inside, MCP, .vibeprint/ files), Hosted on Fly (Relay), External (Claude API), and Remote device (iPad browser and the coding agent). Use shape or line style for each kind and add a legend.
- Label every arrow with what flows and when (starts, board JSON over HTTP, sketch→map request, tunnelled HTTPS over outbound WS). Add the failure paths: MCP's file fallback when the daemon is down, and Interpret's heuristic fallback when Claude is unavailable. Use the empty canvas space and enlarge the edge labels.

### Round 2: 19/40 — Mediocre

[Diagram](vibeprint/round-2/diagram.png) · [Editable canvas](vibeprint/round-2/canvas.json) · [Map](vibeprint/round-2/map.json) · [Review](vibeprint/round-2/review.json) · [Render metrics](vibeprint/round-2/render.json)

Judge: Claude Code; reviewed 2026-11-04T04:09:05.699Z; source dca6c85. Browser errors: 0. Fit-to-screen text: 8.0–16.1 px, excluding arrow labels.

Cold read: The diagram is meant to show how a sketch drawn on an iPad canvas (a web app) reaches the Vibeprint daemon running on the developer's machine. On the same network it goes directly over HTTP with a token. When remote, it goes through an optional relay hosted on Fly.io, which the daemon reaches through an outbound tunnel. The daemon can ask the Claude API to read handwriting and writes the sketch and architecture graph to .vibeprint/. The coding agent (Claude Code or Codex) calls the MCP server over stdio. The MCP server reads data and writes marks through the daemon on 127.0.0.1, or reads and writes .vibeprint/ directly if the daemon is down. Structural changes are proposed as marks and wait for the user's approval. Most of this comes from the notes and from guessing, because the arrows themselves are unreadable.

- **Purpose and audience: 3/4.** The title is a specific question ('how does an iPad sketch reach the local coding agent?') and the subtitle names the audience and scope. But the render is so broken that it doesn't actually answer that question for new engineers.
- **Abstraction consistency: 3/4.** All seven boxes are runtime units at the same level (app, relay, daemon, state, MCP server, agent, external API). The coding agent is a client outside the codebase, which is a slight mismatch with the rest.
- **Completeness vs. focus: 3/4.** The path covers the needed components. Omissions are stated in the 'Outside this view' line. Group descriptions repeat the node descriptions, which adds noise.
- **Relationships and data flow: 1/4.** The map's edge labels are good, but the image doesn't show them usefully. Canvas→Daemon, Canvas→Relay and the relay tunnel labels run together into one unreadable line ('[sync] HTTPS: sketch sync (remote)+token...[async] Forwarded requests'). The MCP→daemon and state labels overprint each other ('[sync] HTTP 127.0.0.1' on top of the .vibeprint state text). Arrowheads and endpoints can't be traced.
- **Boundaries and grouping: 2/4.** There are four labelled zones (device, hosted, machine, external) with managed/self-hosted wording. But the frames are drawn as skewed, curved, blade-like shapes that don't enclose their nodes cleanly. In Developer machine the nodes spill outside the frame.
- **Visual clarity and layout: 0/4.** Shapes are badly distorted: frames are wedge-shaped, and node outlines are warped trapezoids that cut through text. Edge labels collide horizontally across all four columns, and the vertical stack in the machine column overlaps. Text is about 8–9px at 1194x834. In effect it's spaghetti.
- **Notation and legend: 2/4.** There is a reading key for frames, boxes, arrows and [sync]/[async]/[local]. Everything is drawn in one red colour, so node kinds can't be told apart visually, and the distorted shapes make the shape conventions meaningless.
- **Failure modes and non-functional insight: 2/4.** The notes cover token checks on forwarded requests, the relay keeping no state, MCP falling back to the filesystem when the daemon is down, and the approval gate. There is nothing on relay outage, Claude API failure or the no-key path beyond 'only with an API key', or conflicting writes to state.
- **Accuracy and freshness: 2/4.** The footer is dated 2026-11-04, cites revision dca6c85 plus local edits, and says 'Owner: Unassigned' and 'Live runtime NOT verified'. relay/, src/mcp/server.ts and src/core/daemon-client.ts exist. There is no owner and no production check.
- **Standalone comprehension: 1/4.** A newcomer could get the zones and the notes, but couldn't work out the request paths from the overlapping arrows and labels without someone walking them through it.

Reviewer-reported inaccuracies:

- Render fault: the frames and node outlines are drawn as skewed, curved polygons instead of rectangles, so nodes in the Developer machine column (MCP server, Coding agent) spill outside their frame.
- Render fault: the edge labels for Canvas→Daemon, Canvas→Relay, Daemon↔Relay and Daemon→Claude overlap on one horizontal line, and the direct LAN Canvas→Daemon edge can't be distinguished from the relay path.
- The labels '[sync] HTTP 127.0.0.1: read/marks' and '[local] FS: fallback' overprint the .vibeprint state node text.
- No owner is named (the footer says 'Unassigned'), and the claims are checked only against source (relay/server.mjs, src/mcp/server.ts, src/core/daemon-client.ts), not against a running system.

Next changes:

- Fix the shape renderer in web/src/canvas/png.ts and editor.ts so frames and nodes come out as proper rectangles that contain their children.
- Route the edges with dedicated label positions and no overlap. Put Canvas→Daemon (LAN) and the relay path on separate visible lanes, and use real arrowheads.
- Raise the font size to at least 12px at 1194x834, tell node kinds apart with shape or colour beyond plain red, and add failure notes for a relay outage and for the Claude API being unavailable or having no key.

### Round 3: 29/40 — Good

[Diagram](vibeprint/round-3/diagram.png) · [Editable canvas](vibeprint/round-3/canvas.json) · [Map](vibeprint/round-3/map.json) · [Review](vibeprint/round-3/review.json) · [Render metrics](vibeprint/round-3/render.json)

Judge: Claude Code; reviewed 2026-11-04T04:19:06.020Z; source dca6c85. Browser errors: 0. Fit-to-screen text: 6.9–13.7 px, excluding arrow labels.

Cold read: The user draws on a Canvas app in an iPad browser. Strokes reach the Daemon on the developer machine (`vibeprint serve`) in one of two ways: directly over the LAN, or through an optional hosted Relay that the daemon connects to with a tunnel WebSocket. The daemon writes canvas.json into the repo's .vibeprint/ files, commits them with git, and sends sketches to the Claude API (Anthropic) for interpretation. A local coding agent calls tools on the MCP server. The MCP server asks the daemon over HTTP for the current sketch or to wait for the user. If the daemon isn't running, the MCP server reads and writes .vibeprint/ directly, and live waiting is not available. The relay is optional and retries in the background. An unparseable canvas.json fails closed and asks the user to resolve merge conflicts or restore from git.

- **Purpose and audience: 4/4.** The visible title asks one question ('how does an iPad sketch reach the local coding agent?'). The subtitle names the audience (new engineers) and the scope, and the level of detail suits that audience.
- **Abstraction consistency: 3/4.** Most boxes are runtime units (Canvas app, Relay, Daemon, MCP server, Claude API). '.vibeprint files' is a storage artifact and 'Coding agent' is an actor, but the reading key accounts for both. There is no linked zoom-in view.
- **Completeness vs. focus: 3/4.** There is a visible 'Outside this view' line listing the deliberate omissions. The diagram leaves out that interpretation can also come from a heuristic plus the coding agent through the MCP interpret tool (src/mcp/backend.ts interpret(); daemon.ts:853). That is a core part of the sketch path, not a side detail.
- **Relationships and data flow: 3/4.** Every arrow has a label, and the key defines initiator→recipient plus solid/dashed/dotted styles. F1 and F2 are spelled out in footnotes. Two things are unclear: 'strokes via LAN' is dashed but runs as a long horizontal line through the Relay frame, so it reads as passing through the relay, and nothing shows the order in which the steps happen.
- **Boundaries and grouping: 3/4.** Four labeled frames: iPad browser, Hosted relay (optional), Developer machine (self-hosted), and Anthropic (external managed). These boundaries are clear. Nothing marks the Claude API dependency as optional or keyed by an API key.
- **Visual clarity and layout: 2/4.** The diagram runs left to right, but at 1194x834 the node descriptions, edge labels and reading key are tiny and hard to read. The top ~150px is empty. The MCP→Daemon 'HTTP: sketch, wait' line runs along the frame edge and overlaps other labels ('tunnel WebSocket' is cut off at the frame edge). The edge labels near .vibeprint files are cramped.
- **Notation and legend: 3/4.** There is a reading key for frames, boxes, arrow direction and line styles. The type of each box is written as text ('service ·', 'storage ·'), so the meaning does not depend on color alone. All boxes have the same shape, so storage and external services are not visually distinct, and the sync/async line styles are hard to tell apart at this size.
- **Failure modes and non-functional insight: 3/4.** Three visible notes, each citing its source file: the daemon-down file fallback, the optional relay with background retry, and canvas.json failing closed. The diagram omits the files.lock concurrency lock in LocalBackend (src/mcp/backend.ts:106-160) and the case where the Claude API is unavailable or no key is set.
- **Accuracy and freshness: 2/4.** The footer gives the date, the revision dca6c85 plus local edits, owner 'Unassigned', and 'Live runtime NOT verified'. The labeling is honest, but no one owns the diagram, and it presents the Claude API as unconditional, which the code does not.
- **Standalone comprehension: 3/4.** A newcomer could explain the main path (iPad → daemon via LAN or relay → files and Claude → MCP → agent) plus the fallbacks. They would likely misread Claude as required and miss that the agent can do the interpretation itself.

Reviewer-reported inaccuracies:

- The Claude API is drawn as an unconditional step. In fact it is used only when ANTHROPIC_API_KEY is set (src/interpret/claude.ts:33). Otherwise interpretation is a heuristic plus the coding agent (src/server/daemon.ts:853).
- The diagram does not show that the agent can submit interpretations through MCP (Backend.interpret in src/mcp/backend.ts:40,73,175). That is a second interpretation path.
- The note 'MCP reads/writes .vibeprint/ directly' leaves out the files.lock mutual exclusion and its 503 error when the lock is busy (src/mcp/backend.ts:106-150).
- The 'strokes via LAN' line runs across the Relay frame, so it looks like LAN traffic passes through the hosted relay.

Next changes:

- Mark the Claude API edge and frame as optional (only with ANTHROPIC_API_KEY), and add the alternative path where the agent interprets the sketch via the MCP interpret tool.
- Make the diagram readable at 1194x834: use the empty top band, enlarge node and edge-label text, route 'strokes via LAN' below or around the Relay frame, and stop the 'tunnel WebSocket' label from being cut off.
- Assign a real owner and add a note on the files.lock contention and the 503 when the lock is busy. Give storage and external services distinct shapes so they don't rely on text labels alone.

### Round 4: 27/40 — Mediocre

[Diagram](vibeprint/round-4/diagram.png) · [Editable canvas](vibeprint/round-4/canvas.json) · [Map](vibeprint/round-4/map.json) · [Review](vibeprint/round-4/review.json) · [Render metrics](vibeprint/round-4/render.json) · [Generation recipe](vibeprint/round-4/recipe.json) · [Judge model receipt](vibeprint/round-4/judge-receipt.json) · [Generator model receipt](vibeprint/round-4/generator-receipt.json) · [Judge prompt](vibeprint/round-4/judge-prompt.txt)

Judge: claude-opus-5-5; reviewed 2026-11-04T04:38:22.503Z; source dca6c85. Browser errors: 0. Fit-to-screen text: 8.0–15.9 px, excluding arrow labels.

Cold read: The iPad runs the Sketch app (React and Vite). It reaches the Daemon on the developer machine in one of two ways: directly over the LAN, or through an optional hosted Relay. In the relay case, the daemon itself opens a WebSocket tunnel out to the relay, and the iPad's HTTPS requests are forwarded over it. The daemon interprets the strokes and keeps the sketch and graph in the .vibeprint directory. If an API key is set, it also sends the sketch image to the Claude API for a handwriting pass. A coding agent uses vibeprint's MCP tools, which call the daemon. If the daemon is not running, the MCP tools write marks straight into .vibeprint/ under a lock file and return a 503 after 5 seconds of contention. If the relay goes down, the daemon retries with backoff and the LAN URL keeps working. Requests that come through the relay still need the access token.

- **Purpose and audience: 4/4.** The title asks one clear question: how an iPad sketch reaches the local coding agent. The subtitle names the audience (new engineers) and the scope.
- **Abstraction consistency: 3/4.** Five of the six boxes are runtime units. '.vibeprint dir' is a storage directory and 'Agent + MCP' combines an external agent with the vibeprint MCP server, so the box levels are slightly mixed. There is no linked zoom-in view.
- **Completeness vs. focus: 3/4.** The main path is covered, and the omissions are stated in the 'Outside this view' line. The relay's identity and token handshake appear only in a note, and the daemon's serving of the web app is not drawn.
- **Relationships and data flow: 2/4.** The labels are short ('HTTPS req', 'tunnel WS', 'LAN strokes'), and the Claude edge is reduced to the footnote 'F1'. Solid, dashed and dotted lines are hard to tell apart at this size. The 'sketch, graph' arrow looks double-headed, and the 'tool calls' line winds around the right side of the Developer machine frame before reaching the daemon. Nothing shows ordering, or that the relay path and the LAN path are alternatives.
- **Boundaries and grouping: 3/4.** Four labelled frames separate device, hosted relay, developer machine and Anthropic, and their captions say which parts are optional, managed or self-hosted. The 'LAN strokes' line passes through the Hosted relay frame, which suggests the LAN path goes via the relay. The 'Developer machine ]' label breaks onto a second line.
- **Visual clarity and layout: 2/4.** There is a clear left-to-right direction. However, the diagram fills only about 60% of the 1194x834 canvas, and the box text and notes are roughly 8px, which is hard to read on an iPad. The 'tool calls' and 'marks (lock)' labels are crowded and collide near the agent box, and the LAN line runs underneath the relay.
- **Notation and legend: 2/4.** There is a key for frames, boxes and line styles. Everything is drawn in the same red, and kind is shown only as a text prefix with no shape difference. The dash styles barely show at this size, so the line-style key does little work.
- **Failure modes and non-functional insight: 3/4.** Three notes cover the relevant local failure points: relay backoff with LAN fallback, the token required on tunneled requests, and the files.lock fallback with a 503. Each cites a source file, and all three match the code. The Claude API being optional is mentioned in a box. None of these are attached to the edges they describe.
- **Accuracy and freshness: 3/4.** The footer gives the date, the revision (dca6c85 plus local edits), 'Owner: Unassigned' and 'Live runtime NOT verified'. The notes match src/server/relay.ts:206-207 and src/mcp/backend.ts:106,148. With no production check and no owner, it cannot score higher than 3.
- **Standalone comprehension: 2/4.** The boxes and notes give a reasonable picture. Small text, the edge meaning hidden behind 'F1', ambiguous routing and indistinct line styles mean a newcomer could misread whether the LAN path goes through the relay.

Reviewer-reported inaccuracies:

- The 'LAN strokes' edge is drawn through the Hosted relay frame. In the code the LAN path goes straight to the daemon (src/server/daemon.ts) and never touches relay/.
- The 'sketch, graph' edge between the Daemon and .vibeprint dir appears double-headed, while the key and the map define it as a one-way local write.
- The Daemon to Claude API edge is reduced to the code 'F1', so the edge's meaning is only in a footnote rather than on the line.
- The 'Agent + MCP' box combines the external coding agent with vibeprint's own MCP server (src/mcp/), so the code's ownership is unclear.

Next changes:

- Scale the diagram to fill the 1194x834 viewport with text at least 12px, and put 'sketch image (sync)' directly on the Claude edge instead of the F1 footnote.
- Route 'LAN strokes' under or around the Hosted relay frame instead of through it, mark the relay and LAN paths as alternatives, and route 'tool calls' straight to the daemon so it doesn't cross other lines.
- Add non-color signals for sync, async and local edges and for node kind: thicker or clearly different dashes, plus a distinct shape for storage (e.g. a cylinder) and for external services. Split the agent from the vibeprint MCP server. Attach each failure note to its edge with a numbered marker.

### Round 5: 30/40 — Good

[Diagram](vibeprint/round-5/diagram.png) · [Editable canvas](vibeprint/round-5/canvas.json) · [Map](vibeprint/round-5/map.json) · [Review](vibeprint/round-5/review.json) · [Render metrics](vibeprint/round-5/render.json) · [Generation recipe](vibeprint/round-5/recipe.json) · [Judge model receipt](vibeprint/round-5/judge-receipt.json) · [Generator model receipt](vibeprint/round-5/generator-receipt.json) · [Judge prompt](vibeprint/round-5/judge-prompt.txt)

Judge: claude-opus-5-5; reviewed 2026-11-04T04:42:19.572Z; source dca6c85. Browser errors: 0. Fit-to-screen text: 11.5–23.0 px, excluding arrow labels.

Cold read: Vibeprint links an iPad drawing canvas to a coding agent running on your machine. The iPad browser (a React web app) sends canvas strokes, along with a token, to a local daemon started by `vibeprint serve`. It reaches the daemon either directly over the LAN or through an opt-in hosted relay. In the relay case, the daemon keeps an outgoing WebSocket tunnel open to the relay. The daemon stores canvas, graph and relay-identity state as plain JSON files in .vibeprint/. On the agent side, Claude Code or Codex runs an MCP server as a stdio child process, with tools such as get_sketch, marks and wait_for_user. Each tool call goes to the daemon over HTTP if a daemon is running. Otherwise it reads and writes the .vibeprint/ files directly, and in that case wait_for_user can't block and returns immediately. Sketch interpretation and the CLI or git features are deliberately left out of this view.

- **Purpose and audience: 4/4.** Visible title asks a specific question, the subtitle names the audience (new engineers) and the scope, and the level of detail suits onboarding.
- **Abstraction consistency: 3/4.** Nodes are mostly runtime processes, but a storage directory and a module-level MCP server sit beside a whole external agent product. There is no linked zoom-in view.
- **Completeness vs. focus: 3/4.** The core path is complete and the omissions are stated (interpret/, CLI, git checkpoints). It doesn't show how the agent's marks or chat get back to the iPad, so the return trip is only implied.
- **Relationships and data flow: 3/4.** Every arrow is labelled and the legend says what direction means. At this size, dashed and dotted lines are hard to tell apart. The MCP→daemon 'HTTP: tools' line runs along the agent frame's edge, so its start point is unclear. 'LAN canvas' is drawn from the iPad frame, not from the browser box.
- **Boundaries and grouping: 3/4.** Four frames separate the iPad, the hosted relay, and two dev-machine zones, and they are labelled local, self-hosted, opt-in or external. The two 'Dev machine' frames are drawn separately, which hides that they are one host and one trust zone.
- **Visual clarity and layout: 3/4.** The flow reads left to right with no crossings, and the text is readable at 1194x834. Edges hug frame borders, the LAN line wraps around under the relay, and the labels are small and crowded at the frame edges.
- **Notation and legend: 2/4.** There is a legend for shapes and line styles, but everything is drawn in one red. The only cues are dashed vs dotted lines and a double border, and these are hard to tell apart at this viewport. Without colour, the sync/async/local distinction is hard to read.
- **Failure modes and non-functional insight: 3/4.** Notes explain the relay fallback, files mode when the daemon is down, and that wait_for_user returns immediately without the daemon. These match src/mcp/backend.ts lines 3, 117, 252 and 275. Token gating is mentioned. Nothing covers concurrency or file locks (files.lock), and no retry details are drawn.
- **Accuracy and freshness: 3/4.** Dated 2026-11-04 with revision dca6c85 plus local edits. States 'Owner: Unassigned' and says the live runtime was not verified. The cap is 3 without production verification.
- **Standalone comprehension: 3/4.** A newcomer could explain the relay/LAN choice, the daemon state and the agent→MCP→daemon/files path. The line-style semantics and the edge start points would still need a walkthrough.

Reviewer-reported inaccuracies:

- The 'LAN canvas' edge starts at the iPad frame and runs under the relay frame, not from the 'iPad browser' node. This is a small mismatch with map edge browser→daemon.
- Showing 'Dev machine: daemon' and 'Dev machine: agent' as separate frames suggests two separate zones. Both run on the same developer host; src/mcp/backend.ts reads the local .vibeprint/ directly.
- The diagram doesn't show the files-mode lock (FILES.runtime/files.lock, defined at src/mcp/backend.ts:106), so it implies that MCP writing files directly has no coordination.
- The HTTP: tools line's start point sits on the agent frame's border, so it isn't clear that the MCP server (src/mcp/), and not the coding agent, makes the call.

Next changes:

- Add a second non-colour cue, such as a line weight or an arrowhead style, plus colour per mode, so sync, async and local edges can be told apart at iPad size.
- Put both dev-machine zones inside one 'Developer machine' trust frame. Start every edge from a node, not a frame: LAN canvas from the iPad browser, HTTP: tools from the MCP server.
- Show the return path (marks or chat reaching the iPad through the daemon) and the files.lock coordination note, so the full loop and the concurrency behaviour are visible.

### Round 6: 28/40 — Good

[Diagram](vibeprint/round-6/diagram.png) · [Editable canvas](vibeprint/round-6/canvas.json) · [Map](vibeprint/round-6/map.json) · [Review](vibeprint/round-6/review.json) · [Render metrics](vibeprint/round-6/render.json) · [Generation recipe](vibeprint/round-6/recipe.json) · [Exact generator queries](vibeprint/round-6/generator-queries.json) · [Renderer hashes](vibeprint/round-6/render-source.json) · [Judge model receipt](vibeprint/round-6/judge-receipt.json) · [Generator model receipt](vibeprint/round-6/generator-receipt.json) · [Judge prompt](vibeprint/round-6/judge-prompt.txt)

Judge: claude-opus-5-5; reviewed 2026-11-04T04:51:22.958Z; source dca6c85. Browser errors: 0. Fit-to-screen text: 9.8–19.6 px, excluding arrow labels.

Cold read: The iPad's browser (a React app from web/) runs on the same LAN as the developer machine. It opens the daemon's link containing ?t=token, and the daemon swaps the token for a cookie. After that, the browser sends canvas operations to the daemon over a WebSocket. The daemon (src/server/) is the only process that owns state, and it writes canvas, marks, chat and token to plaintext files under .vibeprint/ on a short debounce. The coding agent runs an MCP server (src/mcp/). That server calls the daemon to wait for marks and to turn them into shapes. If no daemon is running, it reads and writes .vibeprint/ itself under a lock file: it waits up to 5s and then fails with 503, and treats locks older than 10s as stale. Callers that aren't local and lack the token get a 401. A new daemon checks /api/health first and reuses an existing daemon if one is alive. The relay for iPads off the LAN and the model-drawn quick map are out of scope.

- **Purpose and audience: 4/4.** The title asks one specific question (how an iPad sketch over the LAN reaches the local coding agent). The subtitle names the audience (new engineers) and the scope (direct LAN path only). The level of detail suits that audience.
- **Abstraction consistency: 3/4.** Three processes and one state store, all at the same runtime level. 'Agent MCP' is described by its role ('Process the coding agent runs for tools') while the coding agent itself is not drawn, so the endpoint of the question is implied rather than shown.
- **Completeness vs. focus: 3/4.** Omissions are deliberate and listed at the bottom (relay path, Claude API quick map). Missing: daemon→browser pushes over the WebSocket (marks and chat from the agent), even though the browser 'shows chat'. Also missing: the coding agent itself, which is the end of the question.
- **Relationships and data flow: 2/4.** Edges are numbered and labelled, and their sync/async/local mode is written out. But two edges are moved into footnotes (F1, F2), so the reader has to look them up. The dotted F2 line runs along the daemon's right edge right next to edge 4's arrowhead, so it is unclear what F2 connects. Ordering is muddled: '4. wait/marks' is a long-poll that MCP starts independently, not step 4 after the save. Daemon-initiated WS pushes to the browser, a separately initiated event, are absent.
- **Boundaries and grouping: 3/4.** Two frames, iPad and Developer machine, are labelled 'user-managed' and 'one local host'. The token gate is described in a note, but the LAN/trust crossing is not drawn as its own boundary, and the frames don't separate local-trusted callers from token-gated ones.
- **Visual clarity and layout: 2/4.** Left-to-right direction with one crossing region. Edge labels are about 10px at 1194x834. The '3. debounced save (local)' label sits on top of its own arrow. The F1/F2 tags are tiny, and the footer text is smaller still. The F2 dotted route hugs the daemon box. There is a lot of empty space while the labels are cramped.
- **Notation and legend: 3/4.** The key explains frames, boxes and the cylinder, and says solid = sync, dashed = async, dotted = local, with the response included. Line style is a non-colour signal, but everything is one red hue and dashed vs dotted is hard to tell apart at this size. The F-footnote convention is an extra layer of indirection.
- **Failure modes and non-functional insight: 3/4.** The notes give real failure behaviour with sources: 401 and refused WS upgrades for callers without a token, the files-mode lock (5s wait then 503, locks stale after 10s), and the single-daemon probe (800ms). The notes don't say what happens when the daemon dies mid-session, or how the iPad recovers if the WS drops.
- **Accuracy and freshness: 3/4.** The diagram is dated and gives the revision (dca6c85 + local edits), and says the live runtime was not verified. Claims match the code: LOCK_STALE_MS=10_000 and LOCK_WAIT_MS=5_000 (src/mcp/backend.ts:107-108); the 800ms health probe (src/server/daemon.ts:162); the 401 responses (daemon.ts:523, 747). The owner is unassigned, and without production verification this caps at 3.
- **Standalone comprehension: 2/4.** A newcomer gets the gist: the browser talks to the daemon, the daemon saves files, and MCP queries the daemon or falls back to the files. But the footnoted edges, the ambiguous F2 route, the missing push from the daemon to the browser and the missing agent mean they would need a walkthrough to explain correctly how the agent's replies get back to the iPad.

Reviewer-reported inaccuracies:

- Edge 4 is numbered as if it follows step 3, but /api/wait is a long-poll that MCP starts independently (src/core/daemon-client.ts:116). It is not a step that comes after the debounced save.
- The daemon→browser WebSocket pushes (agent marks and chat reaching the iPad) are not drawn. With only browser-initiated arrows, the agent's output never visibly gets back to the iPad.
- 'Debounced save' is shown without its interval. The code uses 800ms (src/server/canvas.ts:166), which is minor but not stated.
- The F2 dotted route visually ends next to the Daemon box's right edge and edge 4's arrowhead, so it can be read as touching the daemon. It actually runs MCP→.vibeprint in files mode (src/mcp/backend.ts:106-139), and only when no daemon is running; the diagram doesn't show that condition on the line.

Next changes:

- Draw F1 and F2 inline with their own labels, and route the files-mode edge clear of the Daemon box, labelled 'only if no daemon: locked file I/O'.
- Add the daemon→browser WS push (marks/chat), and show the coding agent above Agent MCP connected by stdio, so the question's endpoint and the return path are both visible.
- Make the edge labels at least 12px, stop the 'debounced save' label overlapping its arrow, and make dashed and dotted lines clearly different (or use a second colour) so they can be told apart at iPad size.

### Round 7: 30/40 — Good

[Diagram](vibeprint/round-7/diagram.png) · [Editable canvas](vibeprint/round-7/canvas.json) · [Map](vibeprint/round-7/map.json) · [Review](vibeprint/round-7/review.json) · [Render metrics](vibeprint/round-7/render.json) · [Generation recipe](vibeprint/round-7/recipe.json) · [Exact generator queries](vibeprint/round-7/generator-queries.json) · [Renderer hashes](vibeprint/round-7/render-source.json) · [Judge model receipt](vibeprint/round-7/judge-receipt.json) · [Generator model receipt](vibeprint/round-7/generator-receipt.json) · [Judge prompt](vibeprint/round-7/judge-prompt.txt)

Judge: claude-opus-5-5; reviewed 2026-11-04T04:54:49.538Z; source dca6c85. Browser errors: 0. Fit-to-screen text: 7.8–15.6 px, excluding arrow labels.

Cold read: You draw on a canvas in the iPad browser. Your edits go over a WebSocket to a Node daemon on the dev machine. The daemon holds the live state and saves it to .vibeprint/ JSON files in the repo after an 800ms debounce. The coding agent (for example Claude Code) runs an MCP server as a stdio child process. When the agent calls a sketch tool, the MCP server makes HTTP calls to the daemon to read the sketch, write marks, or long-poll /api/wait for new edits. The daemon pushes marks and chat back to the iPad over the WebSocket. If no daemon is running, the MCP server reads and writes .vibeprint/ directly under a file lock: it gives up with a 503 after 5s and removes locks older than 10s. If canvas.json is corrupt, the daemon refuses to overwrite it and asks you to restore it from git. The relay path for off-LAN iPads and model interpretation of sketches are out of scope.

- **Purpose and audience: 4/4.** The title asks a specific question ('how does an iPad sketch reach the local coding agent and back?'). The subtitle names the audience (new engineers) and the scope (direct LAN path).
- **Abstraction consistency: 3/4.** Nearly every box is a runtime process, plus one storage cylinder. 'Agent CLI' is an external actor with no code path, which is acceptable. There are no linked zoom-in views, and the relay and interpretation paths are only named in a footer.
- **Completeness vs. focus: 3/4.** Five nodes are enough to answer the question, and omissions are stated ('Outside this view: Hosted relay path…'). The token/cookie auth on the daemon's HTTP and WS endpoints (src/server/daemon.ts:513) is missing. That auth is the main trust control on a LAN path.
- **Relationships and data flow: 3/4.** Every edge is labeled and states sync/async/local. The two separately started WS directions are drawn as separate arrows. The legend says dotted = local, but at this size dotted and dashed look almost the same, so 'local' rests on the text label. The long-poll ordering is explained only in a note, not on the diagram.
- **Boundaries and grouping: 3/4.** 'Dev machine' and 'iPad' frames show the deployment split. The WS edges cross the LAN boundary without marking it as a network/trust edge or saying what is exposed (port, token). Managed vs self-hosted is described in text only.
- **Visual clarity and layout: 2/4.** Flow mostly runs left to right, but the two WS arrows cross each other diagonally between Daemon and iPad browser. The 'no daemon: locked I/O' edge loops over the top. Edge and note text is about 7–8px at 1194x834, which is hard to read. Most of the canvas is empty margin.
- **Notation and legend: 3/4.** The key explains frames, box vs cylinder, and solid/dashed/dotted, and says arrows include responses. Everything is the same red, so line style is the only non-text cue, and dashed vs dotted can't be told apart at this size. Names match the code.
- **Failure modes and non-functional insight: 3/4.** Three notes cover real failure modes: the long-poll timeout clamp, files.lock with the 503 and stale-lock handling, and a corrupt canvas that fails closed. The 800ms debounce is shown. Nothing covers daemon crash or reconnect, or what happens to unsaved edits during the debounce window.
- **Accuracy and freshness: 3/4.** The footer gives the date, revision dca6c85 plus local edits, says 'Owner: Unassigned', and says the live runtime was NOT verified. Most claims match the code. Capped at 3 because there is no production verification and no owner. One detail is off (see inaccuracies).
- **Standalone comprehension: 3/4.** Read cold, the diagram explains the loop correctly. The small type and crossing WS arrows slow reading. The files-mode edge can be mistaken for a step in normal flow, though the note fixes that.

Reviewer-reported inaccuracies:

- The long-poll note gives 'default 120s'. That is the daemon's default (src/server/daemon.ts:689, src/core/daemon-client.ts:114). The MCP wait tool itself says 'Default 50' with max 600 (src/mcp/server.ts:826), so the note misstates the timeout the agent actually uses.
- The daemon's HTTP and WS endpoints need a token (header or HttpOnly cookie, src/server/daemon.ts:162,513). The diagram suggests any LAN client can talk to the daemon.
- The legend says dotted = local, but the local edges (stdio, debounced save, locked I/O) are drawn in a style that can't be told apart from the dashed async WS edges at this size. Line style alone gives the wrong mode.

Next changes:

- Make the text and arrows larger and fix the crossing: run the two WS arrows in parallel lanes between Daemon and iPad browser, and use the empty margin so labels are at least about 11px at 1194x834.
- Show the LAN trust boundary on the WS/HTTP edges: daemon port and token/cookie pairing auth. Correct the wait timeout to the MCP default (50s, max 600s).
- Make the line styles clearly different, or add a second cue such as color or arrowheads for local vs async vs sync. Mark the files-mode edge as a fallback, for example with a 'fallback' tag or a separate inset.

### Round 8: 33/40 — Good

[Diagram](vibeprint/round-8/diagram.png) · [Editable canvas](vibeprint/round-8/canvas.json) · [Map](vibeprint/round-8/map.json) · [Review](vibeprint/round-8/review.json) · [Render metrics](vibeprint/round-8/render.json) · [Generation recipe](vibeprint/round-8/recipe.json) · [Exact generator queries](vibeprint/round-8/generator-queries.json) · [Renderer hashes](vibeprint/round-8/render-source.json) · [Judge model receipt](vibeprint/round-8/judge-receipt.json) · [Generator model receipt](vibeprint/round-8/generator-receipt.json) · [Judge prompt](vibeprint/round-8/judge-prompt.txt)

Judge: claude-opus-5-5; reviewed 2026-11-04T04:58:05.159Z; source dca6c85. Browser errors: 0. Fit-to-screen text: 11.2–22.3 px, excluding arrow labels.

Cold read: Vibeprint's canvas editor runs in the browser on an iPad on the same LAN. It sends shape edits as async WebSocket ops to a token-gated daemon on the developer's machine. The daemon applies them in memory, acks them, and about 800ms after the last edit writes them to .vibeprint/canvas.json in the repo. When the daemon starts it reads the shapes back from that file. When a browser connects, or reloads and connects again, it gets the full snapshot, which is how a sketch survives a page reload. Risks: (1) a daemon crash inside the 800ms window loses the latest edits. (2) Unacked ops live only in page memory. They are replayed after a reconnect (backoff 500ms up to 10s) but lost on a full reload. (3) A corrupt canvas.json stops loading, and the fix is to restore it from git. MCP, AI redraws, the Fly relay, and marks/chat/assets/checkpoints are out of scope. No owner is assigned and the live runtime is not verified.

- **Purpose and audience: 4/4.** The visible title asks a specific question (how does an iPad sketch survive a page reload?). The subtitle names the audience (new engineers) and the scope (direct LAN sync only). The level of detail suits that audience.
- **Abstraction consistency: 4/4.** Three boxes, all at the same level: a client, a process and a stored file. Each has a matching code path in the map. Nothing mixes in teams or concepts.
- **Completeness vs. focus: 3/4.** Omissions are stated in an 'Outside this view' line. The diagram leaves out the token/auth handshake and the broadcast to other clients, which is fine. But the reload path itself (page reload → reconnect → snapshot) is only covered in the notes, not drawn as a numbered step, even though it is the question in the title.
- **Relationships and data flow: 3/4.** Every arrow is labelled and marked async or local. Steps 1 and 2 are numbered, but 'snapshot on connect' and 'shapes read at start' have no numbers. So the order on reload (start read → connect → snapshot → replay) has to be inferred. The snapshot arrow bends through the corner of the iPad frame, which is awkward.
- **Boundaries and grouping: 3/4.** There are two labelled frames: the iPad (user-managed) and the developer machine (self-hosted). The trust boundary is implied by the 'Token-gated' text, not drawn on the LAN crossing. There is no managed vs. external contrast, though the project has no external parts in scope.
- **Visual clarity and layout: 3/4.** The flow runs cleanly left to right and is readable at 1194x834. However, the snapshot arrow takes a detour over the top that clips the iPad frame. The two return arrows ('shapes read at start' and the snapshot) bend at angles. Arrow labels are small, and some overlap dash patterns ('op·acks·(async)').
- **Notation and legend: 3/4.** There is a key for frames, boxes, cylinders, dashed vs. dotted lines and the request-includes-response convention. The dashed and dotted lines are hard to tell apart at this size. Everything is one red colour, so there is no colour coding, but the flow type is also written on each arrow as text.
- **Failure modes and non-functional insight: 4/4.** Three notes, each grounded in source, cover what matters for this question: (1) the 800ms debounce loss window before the save timer fires, (2) unacked ops kept only in memory and the reconnect backoff from 500ms to 10s, and (3) a corrupt canvas.json stops loading while a single bad shape is skipped. This is the right failure analysis for a local app.
- **Accuracy and freshness: 3/4.** The diagram shows a date, revision dca6c85 with local edits, 'Owner: Unassigned' and 'Live runtime NOT verified'. I checked the claims against src/server/canvas.ts:166 (setTimeout 800), :43/:74 (throws with a restore-from-git message), :50 (skipped shape is logged), and web/src/canvas/sync.ts:28/131 (backoff 500ms up to 10s) and :102-103 (replay on snapshot). With no production verification the cap is 3.
- **Standalone comprehension: 3/4.** A newcomer can explain it from the image: edits go over WebSocket, the daemon keeps them in memory and acks them, a debounced save writes them to disk, and on connect the browser gets a snapshot. The reload answer is spread across the arrows and the notes, so a reader has to put it together themselves rather than following a numbered reload sequence.

Reviewer-reported inaccuracies:

- I found no factual errors. The 800ms debounce (src/server/canvas.ts:166), the parse/shape-check throws with restore-from-git messages (:43, :74), the skipped-shape log (:50), the 500ms→10s backoff (web/src/canvas/sync.ts:28, :131) and the replay on snapshot (:102-103) all match the source.
- Small simplification: the snapshot arrow is labelled 'on connect', but sync.ts also filters later remote broadcasts against pending IDs (:110-111). Ops from other clients reaching this browser are not shown.
- The 'Key' says dotted = local I/O, but at viewing size the '2. 800ms debounced save' line is hard to tell apart from the dashed async lines.

Next changes:

- Number the reload path explicitly (for example 3. page reload → reconnect, 4. snapshot from the daemon's memory, 0. shapes read at daemon start) so the title's question can be answered from the arrows alone.
- Route the snapshot arrow directly between the browser and the daemon (for example as a parallel line above the ops arrow) instead of bending it through the corner of the iPad frame. Also make the dashed and dotted lines clearly different, for example by thickness or a second colour.
- Draw the token-gated LAN crossing as an explicit trust boundary on the WebSocket edges, and either name an owner or verify the live runtime to raise the accountability and freshness scores.

### Round 9: 35/40 — Good

[Diagram](vibeprint/round-9/diagram.png) · [Editable canvas](vibeprint/round-9/canvas.json) · [Map](vibeprint/round-9/map.json) · [Review](vibeprint/round-9/review.json) · [Render metrics](vibeprint/round-9/render.json) · [Generation recipe](vibeprint/round-9/recipe.json) · [Exact generator queries](vibeprint/round-9/generator-queries.json) · [Renderer hashes](vibeprint/round-9/render-source.json) · [Judge model receipt](vibeprint/round-9/judge-receipt.json) · [Generator model receipt](vibeprint/round-9/generator-receipt.json) · [Judge prompt](vibeprint/round-9/judge-prompt.txt)

Judge: claude-opus-5-5; reviewed 2026-11-04T05:00:14.712Z; source dca6c85. Browser errors: 0. Fit-to-screen text: 10.7–21.3 px, excluding arrow labels.

Cold read: The iPad browser sends drawing ops over a WebSocket to a local Node daemon on the developer machine. The daemon acks each op once it is in memory. It writes canvas.json 800ms after the last edit and also flushes on shutdown. On a page reload, the browser reopens a token-authenticated WebSocket and gets a full snapshot from the daemon's memory. canvas.json is read only when the daemon starts. Data can be lost in two cases: a daemon crash inside the 800ms window, or a page reload before the daemon has acked pending ops. Socket drops retry with backoff and replay unacked ops. LAN access needs a ?t= token or the cookie it sets. A corrupt canvas.json stops the daemon from starting.

- **Purpose and audience: 4/4.** The title asks one clear question (how does a sketch survive a reload). The subtitle names the audience (new engineers) and the scope (direct LAN only).
- **Abstraction consistency: 4/4.** There are three nodes and all are at the same level: a client process, a daemon process and a stored file. The frames are deployment zones.
- **Completeness vs. focus: 4/4.** Everything shown serves the reload question. The omissions (relay, MCP, AI maps, checkpoints, marks/chat) are listed in the footer.
- **Relationships and data flow: 3/4.** Edges are numbered 0-4, labelled with what flows, and marked sync/async/local. But step 3 is solid while its own label says 'token WS open (sync)', and WS ops are dashed. A WebSocket open is not really sync in the HTTP sense. Step 4 is a separate event, so drawing it separately is correct.
- **Boundaries and grouping: 3/4.** There are clear iPad and Developer machine frames, and the token gate is described in text. The trust boundary itself (the token check) is not drawn as a separate control, and the LAN between the frames is implicit.
- **Visual clarity and layout: 3/4.** The flow runs left to right and is readable at 1194x834. Edge labels are small (about 9px). Edges 1 and 3 leave the browser at odd diagonal kinks, and the 0/2 labels crowd the daemon-to-file curves.
- **Notation and legend: 3/4.** A key explains frames, boxes, cylinders and the dotted/dashed/solid line styles, and the flow type is also written on each arrow. Everything is drawn in a single red, so the distinction depends on dash patterns that are subtle at this size.
- **Failure modes and non-functional insight: 4/4.** Three notes cover the ack-before-durability window, the reconnect backoff and replay, reload dropping pending ops, the 401 token gate, and corrupt-file handling. Each note cites its source file.
- **Accuracy and freshness: 3/4.** The diagram shows a date, a revision (dca6c85 + local edits) and an owner of Unassigned. It states that the live runtime was not verified. The 800ms debounce (canvas.ts:166) and 500ms backoff (sync.ts:28) match the code. Freshness is capped at 3 without production verification, and there is no accountable owner.
- **Standalone comprehension: 4/4.** Using the numbered steps and the notes, a newcomer could correctly explain persistence, the reload path and the loss windows without help.

Reviewer-reported inaccuracies:

- Edge 3 is labelled 'sync' and drawn solid, but a WebSocket open followed by an async snapshot (edge 4) is not synchronous request/response. The key's 'solid = sync' meaning blurs here (web/src/canvas/sync.ts).
- Owner is 'Unassigned', so there is no accountable owner.
- The diagram does not show the shutdown flush as its own path. It appears only in note text (src/server/canvas.ts save timer at line 166).

Next changes:

- Draw the token gate as an explicit boundary or marker on the daemon's ingress, and label the LAN link between the frames.
- Show the reconnect path (and replay of unacked ops) as an edge from the browser to the daemon. Make edge 3's mode consistent with WS semantics, or justify 'sync'.
- Use a second non-red colour or heavier line weights so dotted, dashed and solid are easy to tell apart, enlarge the edge labels, and straighten the kinked browser edges.

### Round 10: 32/40 — Good

[Diagram](vibeprint/round-10/diagram.png) · [Editable canvas](vibeprint/round-10/canvas.json) · [Map](vibeprint/round-10/map.json) · [Review](vibeprint/round-10/review.json) · [Render metrics](vibeprint/round-10/render.json) · [Generation recipe](vibeprint/round-10/recipe.json) · [Exact generator queries](vibeprint/round-10/generator-queries.json) · [Renderer hashes](vibeprint/round-10/render-source.json) · [Judge model receipt](vibeprint/round-10/judge-receipt.json) · [Generator model receipt](vibeprint/round-10/generator-receipt.json) · [Judge prompt](vibeprint/round-10/judge-prompt.txt)

Judge: claude-opus-5-5; reviewed 2026-11-04T05:10:30.626Z; source dca6c85. Browser errors: 0. Fit-to-screen text: 9.4–18.8 px, excluding arrow labels.

Cold read: The diagram shows how ink drawn on an iPad survives a reload when the iPad talks directly to `vibeprint serve` on the same LAN. The iPad browser opens a token-authenticated WebSocket to the Local daemon on the developer machine (B1). The daemon answers with a snapshot of the whole canvas from its memory, which replaces what the page shows (B2). Each pen stroke goes to the daemon as an 'ops' message (C1). The daemon applies it in memory and acks it straight away (C2), but that ack only means 'in memory'. The daemon writes .vibeprint/canvas.json about 800ms after things go quiet, or when it shuts down on SIGINT/SIGTERM (C3). It reads that file only once, at startup (A). So a daemon crash can lose edits that were already acked, and a corrupt canvas.json stops the daemon from starting. In the browser, unacked strokes live only in page memory. After a dropped connection the page reconnects with 500ms–10s backoff, takes a fresh snapshot and replays them. A full page reload throws them away. On reload, the 1-year HttpOnly cookie set by the ?t= link sends the token again, so the page gets back in; the token stays the same across daemon restarts. Not shown: the hosted relay (which the footer says is on by default), MCP, AI mapping, git commits, and other browsers' live ops. The diagram was checked against source at dca6c85 plus local edits; the running system was not checked.

- **Purpose and audience: 4/4.** The title is a single question, 'Vibeprint: how does an iPad sketch survive a page reload?'. The subtitle names the audience ('New engineers') and the narrowed scope ('Direct LAN only: ink ops, daemon memory, canvas.json startup read and debounced save, reconnect snapshot'). The level of detail (ack semantics, 800ms debounce, backoff, cookie) suits new engineers who need to reason about losing data.
- **Abstraction consistency: 4/4.** All three nodes sit at the same runtime level: two processes (iPad browser, Local daemon) and one stored file (canvas.json, drawn as a cylinder). The two frames are machines. Infrastructure, code modules and teams are not mixed together. Each note cites its source file, which works as a zoom-in pointer. A three-node view does not need separate linked diagrams.
- **Completeness vs. focus: 3/4.** Persistence, ack, save and reconnect are all present, and omissions are stated ('Outside this view: Hosted relay (on by default), MCP server, AI mapping, git commits…'). But a page reload starts with an ungated static GET and a token-gated GET /api/config, and neither appears. B1 makes the WebSocket look like the first contact. The omission line, which says the relay is on by default, is in roughly 8px footer text. Rejected ops (canvas full or invalid), another way to lose an edit, are not shown.
- **Relationships and data flow: 3/4.** Every arrow is directed and labelled with what flows. The letters A / B1–B3 / C1–C3 give an order, and dashed (async WebSocket) is distinct from dotted (local I/O). Weaknesses: 'C1/B3. ink ops; replay' merges two phases on one arrow. The key says 'response included', yet ack (C2) and snapshot (B2) get their own reverse arrows; they are separate WebSocket messages, but the key doesn't say so. There is no HTTP leg for the reload.
- **Boundaries and grouping: 3/4.** There are two labelled frames, 'iPad — on same LAN; holds HttpOnly cookie' and 'Developer machine — Local, self-run; token-gated LAN HTTP/WS', and the key calls frames trust/deployment zones. The self-hosted nature is stated. The token gate exists only as subtitle text and is not drawn where arrows cross into the daemon. The LAN itself is not drawn as a zone. Large parts of both frames are empty.
- **Visual clarity and layout: 3/4.** The diagram reads left to right with no crossings. The nodes share a baseline and the three notes are in aligned columns. At 1194x834 the provenance and omission footer lines are about 8px and edge labels about 10px, small for an iPad. C2 and B1 detour through diagonal hexagon-like routes, and A and C3 form two chevrons into the cylinder. The bottom halves of both frames are wasted space that could have held larger text.
- **Notation and legend: 3/4.** There is a visible key: frames are zones, boxes are actors, the cylinder is stored state, dotted is local and dashed is async, and the flow type is also written on each arrow, so meaning doesn't depend on colour. The single red colour is consistent, though it is also the usual error colour. Gaps: the 'response included' rule is contradicted by the separate ack and snapshot arrows, the 'C1/B3' label notation is not explained, and nodes don't show real identifiers (vibeprint serve, CanvasRoom, web/src/canvas/sync.ts).
- **Failure modes and non-functional insight: 3/4.** The notes state the key failure behaviour: acked means in memory only, so a crash can lose acked edits. They also cover the flush on SIGINT/SIGTERM, startup halting on unparseable JSON while bad shapes are skipped, 500ms–10s reconnect backoff, unacked ops being lost on a full reload, a 1-year cookie, and the token surviving restarts. Missing: each new op restarts the debounce, so the loss window can be far longer than 800ms; saves are atomic (no torn file); rejected ops are dropped and trigger a resnapshot. The 401 behaviour is described wrongly (see inaccuracies).
- **Accuracy and freshness: 3/4.** The footer gives 'Source review 2026-11-04 · revision dca6c85 + local edits · Owner: Viraat Das (package.json author) · Live runtime NOT verified'. The owner is backed by package.json:7. Most claims match src/server/canvas.ts, web/src/canvas/sync.ts and src/server/daemon.ts. No production verification was done, so the score is capped at 3. It is held at the cap despite one material error in the reload token note.
- **Standalone comprehension: 3/4.** A newcomer could correctly explain that the daemon's memory is the source of truth, that an ack doesn't mean saved, that canvas.json is written about 800ms after activity stops, and that reconnect brings a snapshot plus a replay. They would likely get two things wrong: they would expect a missing cookie to show 'offline and retries', and they would assume the iPad normally talks to the daemon directly over the LAN, when the default QR link goes through the hosted relay.

Reviewer-reported inaccuracies:

- The 'Token gate on reload' note says 'Without it: 401, page shows offline and retries.' On a reload with no cookie, web/src/App.tsx:57-73 first calls GET /api/config. The daemon returns 401 for that (src/server/daemon.ts:523), and App shows a fixed gate: 'This device needs the link printed by vibeprint serve…'. No WebSocket is opened and nothing retries. The offline-and-retry path (web/src/canvas/sync.ts:124-131, App.tsx:30-37) applies only when the WebSocket fails after config loaded, and after 3 failures it shows 'Can't open the canvas… then reload.'
- 'LAN WS upgrades need the token' and edge B1 suggest the WebSocket is the first gated contact on reload. In fact the static page is served without a token (src/server/daemon.ts:521), and every /api/* and /files/* HTTP request is token-gated (daemon.ts:520-523) before CanvasSync is even created (App.tsx:80). The reload's HTTP leg is missing from the diagram.
- The scope is 'Direct LAN only', but the default iPad path goes through the hosted relay. relayEnabled returns DEFAULT_RELAY unless it is turned off (src/server/relay.ts:58-62; src/cli.ts:10), and the QR code and the 'iPad' banner line use the relay URL when it is available (src/server/daemon.ts:841-845). The diagram says this only in the roughly 8px footer, so the path shown is the --no-relay / same-Wi-Fi link, not what a new user usually hits.
- 'canvas.json is rewritten 800ms after the last op' is literally true, but scheduleSave restarts the timer on every op from any client (src/server/canvas.ts:164-167). Continuous drawing can therefore put the save off indefinitely, and a crash can lose acked edits back to the last 800ms pause, not just the last 800ms.
- The diagram implies every op an iPad sends ends with an ack. In fact the daemon can send 'rejected' instead, for an invalid op or a full canvas (src/server/canvas.ts:139-146). The client then drops that op and closes the socket to resnapshot (web/src/canvas/sync.ts:117-121), which is another way to lose ink that isn't shown.
- Node labels use generic names ('Local daemon', 'iPad browser'). The real identifiers (vibeprint serve, CanvasRoom in src/server/canvas.ts, CanvasSync in web/src/canvas/sync.ts) and the endpoint /api/canvas (daemon.ts:745) are not visible, even though the map JSON has tags and paths for them.

Next changes:

- Fix the reload path: before B1, add an HTTP leg: page reload → GET / (no token needed) → GET /api/config with the cookie. Rewrite the token note to say that a missing or expired cookie gives a 401 on /api/config and shows the fixed message 'needs the link printed by vibeprint serve' with no retry, and that offline-and-retry happens only when the daemon is unreachable after config has loaded.
- Make the diagram readable at 1194x834. Raise the footer (omissions, date, revision, owner, 'NOT verified') and edge labels to at least 11px, using the empty space in both frames. Replace the diagonal detours on C2 and B1 with straight parallel horizontal arrows. Split the merged 'C1/B3' label into clear steps, or add a small numbered sequence strip.
- Be more honest about where data can be lost and which path is the default. Add a short callout that the default QR link goes through the hosted relay, and say the diagram shows the --no-relay / same-Wi-Fi link. Say the loss window is 'since the last 800ms pause', because the debounce restarts on every op. Mention rejected ops (canvas full or invalid) being dropped, and that saves are atomic so a crash can't leave a half-written canvas.json.

### Round 11: 38/40 — Excellent

[Diagram](vibeprint/round-11/diagram.png) · [Editable canvas](vibeprint/round-11/canvas.json) · [Map](vibeprint/round-11/map.json) · [Review](vibeprint/round-11/review.json) · [Render metrics](vibeprint/round-11/render.json) · [Generation recipe](vibeprint/round-11/recipe.json) · [Exact generator queries](vibeprint/round-11/generator-queries.json) · [Renderer hashes](vibeprint/round-11/render-source.json) · [Judge model receipt](vibeprint/round-11/judge-receipt.json) · [Generator model receipt](vibeprint/round-11/generator-receipt.json) · [Judge prompt](vibeprint/round-11/judge-prompt.txt)

Judge: claude-opus-5-5; reviewed 2026-11-04T05:17:13.156Z; source dca6c85. Browser errors: 0. Fit-to-screen text: 9.1–18.1 px, excluding arrow labels.

Cold read: This covers a Vibeprint sketch made on an iPad over the same Wi-Fi (LAN link, relay off). There are two trust zones: the iPad, whose browser holds an HttpOnly token cookie, and the developer's machine, which runs `vibeprint serve` and keeps `.vibeprint/canvas.json`. (A) When the daemon starts, it reads canvas.json into memory once; if the JSON can't be parsed, startup aborts. On a page reload, the static page `/` needs no token. (B1) The browser sends a synchronous GET to /api/config with the cookie. (B2) It opens a token-checked WebSocket to /api/canvas. (B3) The daemon pushes a snapshot of the shapes it holds in memory. (C1) While you draw, the browser streams ink ops and replays any it hasn't had acknowledged after a reconnect. (C2) The daemon applies each op in memory and acks or rejects it. (C3) About 800ms after the last op from any client, or on SIGINT/SIGTERM, the daemon writes canvas.json atomically. So a sketch survives a reload because the daemon re-sends its in-memory copy. But 'acked' means 'in daemon memory', not 'on disk': a daemon crash loses edits since the last pause, and a reload loses ops that were never acked. Reconnects back off from 500ms to 10s. Rejected ops are dropped and the page fetches a fresh snapshot. Without the 1-year cookie from the ?t= link, the API returns 401 and the page shows a fixed 'needs the link' message with no retry.

- **Purpose and audience: 4/4.** Visible one-line title asks an exact question: 'Vibeprint: how does an iPad sketch survive a page reload?'. The subtitle names the audience ('New engineers') and scope ('Same-Wi-Fi link only (--no-relay or LAN URL)…'). The detail (cookie, WS snapshot, ack vs save) suits a new engineer.
- **Abstraction consistency: 4/4.** Three nodes at one runtime level: client runtime (iPad browser), process (vibeprint serve), stored file (canvas.json). Both frames are device/deployment zones. No code classes, teams or concepts mixed in. With three nodes, no zoom-in view is needed.
- **Completeness vs. focus: 4/4.** Shows everything needed to answer the reload question: startup read, cookie-gated config, WS snapshot from memory, ops/ack, debounced save. The 'Outside this view' line explicitly lists what was left out (relay, MCP, AI, git commits, marks/chat/graph, images, other clients' ops). No noise nodes.
- **Relationships and data flow: 4/4.** Every arrow is directed and labelled with what flows. Letters A, B1–B3, C1–C3 give the order, and each label also says sync/async/local. The legend states 'caller → recipient, response included'. Server-initiated WS messages (B3 snapshot, C2 ack/reject) are drawn as separate arrows, which is correct because they are separately sent messages (canvas.ts:125, 143–149).
- **Boundaries and grouping: 4/4.** Two labelled frames match the legend ('frames = trust/deployment zones'). The iPad frame reads 'Same Wi-Fi; holds HttpOnly token cookie'; the Developer machine frame reads 'Local, self-run; token-gated LAN HTTP/WS'. So the self-hosted status, the network and the trust gate are all stated. No managed or external service is in scope, and the relay is noted as omitted.
- **Visual clarity and layout: 3/4.** Left-to-right direction, no crossings, aligned nodes. But at 1194x834 the edge labels sit on top of their dashed or solid lines: the line runs between the two label lines and reads like a strike-through (C2, C1, B3, B2, B1). Group descriptions, note sources and the provenance footer are about 9px. The iPad frame is mostly empty space while the text stays small. The elbowed diagonal routes look a little awkward. Readable, but cluttered in places.
- **Notation and legend: 4/4.** The visible key defines frames, box (runtime actor/process), cylinder (stored state), and dotted/solid/dashed for local/sync/async. Line style plus '(sync)/(async)/(local)' text means meaning does not depend on colour, so a single colour is fine. Real names are used: vibeprint serve, canvas.json, /api/config, /api/canvas.
- **Failure modes and non-functional insight: 4/4.** The notes spell out failure and state behaviour. Ack means memory only, and a crash loses acked edits since the last 800ms pause; writes use a temp file plus rename. Reconnect uses 500ms–10s backoff with replay; a reload drops unacked ops. Rejected ops drop and the page resnapshots. A missing cookie gives a 401 and a fixed page with no retry. Unparseable JSON aborts startup. The token survives restarts. All are confirmed in canvas.ts:146–176, sync.ts:100–131, daemon.ts:175–185, 513, 523, 746 and App.tsx:69.
- **Accuracy and freshness: 3/4.** The visible footer gives date (2026-11-04), revision 'dca6c85 + local edits', owner 'Viraat Das (package.json author)' (package.json:7) and 'Live runtime NOT verified'. Names match the code. Score is capped at 3 because only source was reviewed; the running system was not checked.
- **Standalone comprehension: 4/4.** A newcomer can explain the reload path and the 'acked ≠ saved' / 'unacked lost on reload' distinction from the arrows, the letter ordering, the key and the three notes alone. The legend's response convention prevents misreading the A arrow's direction. Node text is about 11–14px and readable.

Reviewer-reported inaccuracies:

- None reported.

Next changes:

- Make the text easier to read at 1194x834. Move each edge label off its line, onto a background patch above the line, so the line no longer strikes through it. Raise the ~9px group descriptions, note sources and footer to at least 11px, using the empty space in the iPad frame.
- Show the token gate as a step in the diagram, not only in a note. Add a B0 arrow for the static GET / (no token) and the one-time ?t= → 302 Set-Cookie sign-in (daemon.ts:507–516), or put a visible gate marker on the Developer-machine frame where B1/B2 enter. The reload sequence would then start at the true first request.
- Record a live check of the runtime behaviour to move freshness past source review. For example: draw, kill -9 the daemon within 800ms, restart, reload, and note the result with date and revision. Also add a short note that C3 has further save triggers outside this view (git checkpoint beforeCommit, daemon.ts:190–193; daemon-applied changes, canvas.ts:161), so the 'since the last pause' crash window isn't read as the complete list of save triggers.
