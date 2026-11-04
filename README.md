# vibeprint

Draw your architecture on an iPad. Your coding agent reads it, marks it up in its own blue pen, and then tracks the build against it on the same canvas.

- **You sketch** boxes, arrows and words with the Pencil, then tap **Submit**.
- **The agent reads it** into a private graph (nodes, edges, labels), each node bound to the strokes it came from. Faint tags like "Postgres" or "queue" appear on your shapes. Ignore them, or correct them by scribbling and submitting again.
- **The agent proposes, you decide.** Every agent action is a mark: add, strike, rewrite, note, or status. Proposals arrive in small batches ("3 adds, 1 strike, 1 question") that you accept with one tap or review one by one.
- **Your ink is never touched.** The agent draws beside your shapes, strikes through them, or writes a corrected label next to yours. An accepted strike dims the shape instead of deleting it. One button hides all agent ink.
- **The build shows up on the sketch.** As code lands, agents flip node statuses and boxes go from dashed to solid with a check.
- **It lives in the repo.** The graph, marks and canvas are plain JSON in `.vibeprint/`, committed to git at each checkpoint, so the spec travels with the code and has history.
- **Start from the code you already have.** **Map this repo** draws the project's existing architecture (apps, services, workers, databases, third-party APIs, and how they connect) as boxes and arrows you can edit like your own, all marked as built, then has Claude Code, Codex or the Claude API read the code and redraw it accurately. Sketch the changes on top.
- **One MCP server, any agent.** Claude Code and Codex both talk to it; no custom integration.

## Quick start

Requires Node 20+.

```sh
npm install -g vibeprint

# In the project you're building
cd ~/code/my-app
vibeprint init        # .vibeprint/, the agent rule in AGENTS.md, .mcp.json for Claude Code
vibeprint             # starts the canvas; prints a laptop URL, an iPad URL and a QR code
```

Or without installing: `npx vibeprint@latest init`, then `npx vibeprint@latest`. Keep the `@latest`: without it npx keeps running the copy it cached the first time. When a newer release is out, the banner and the canvas say so.

Run it from the checkout you're working in. Each folder (a clone, or a `git worktree`) gets its own canvas, map and `.vibeprint/`; the top bar shows the folder and its branch.

Scan the QR code with the iPad, then **Share → Add to Home Screen** for a full-screen canvas. The iPad link carries an access token; the laptop link at `localhost` doesn't need one. The token and the link stay the same across restarts, so the home-screen icon keeps working.

### iPad on a different network

`vibeprint` also connects out to a hosted relay, so the iPad can reach it from any network: a cloud VM, office Wi-Fi with client isolation, or a phone hotspot. The banner prints a second link, `https://<id>.live.vibeprint.viraat.dev/?t=…`. Each repo gets its own subdomain, so sessions can't see each other's cookies or API. The relay keeps nothing; it forwards requests to your machine, and your machine still checks the access token on every one. `--no-relay` (or `VIBEPRINT_RELAY=off`) keeps everything on your network. The relay's source is in [`relay/`](relay/server.mjs).

### Connect your agents

`vibeprint init` writes `.mcp.json`, which Claude Code picks up for the project. For Codex:

```sh
codex mcp add vibeprint -- vibeprint mcp     # or: vibeprint init --register
```

Both agents get the same tools and follow the same rule, which `init` puts in `AGENTS.md` (and `CLAUDE.md` imports):

> Read the architecture through the Vibeprint tools before starting work. If the build needs a structural change, propose it as a mark and wait for approval. Never deviate silently.

The MCP server works with or without the canvas running. With `vibeprint serve` up, marks stream onto the iPad live; without it, the server reads and writes `.vibeprint/` directly and the canvas picks the changes up next time it starts.

## How a session goes

1. Sketch on the iPad and tap **Submit**. The PNG plus the stroke and text data go to the interpreter.
2. The interpreter fills in the graph. With `ANTHROPIC_API_KEY` set, Claude reads your handwriting directly. Without it, a built-in heuristic reads shapes, arrows and typed text (handwritten labels come out as "Box 1", "Box 2"), and your coding agent does the full read with `get_sketch` + `interpret` the next time it checks the architecture, using whatever model it runs on.
3. Your agent calls `get_architecture` and builds against it. It calls `set_status` as work lands, and when the code needs a structural change it proposes marks and waits.
4. Marks appear only after your pen has been idle for a moment, one at a time, drawn on like a second pen. Pending marks are ghosted and dashed; accepted marks turn solid.
5. Accept or reject from the iPad (tap a numbered badge, or **Review** / **Accept all** on the batch strip) or from the laptop's chat panel. The agent sees the outcome through `list_marks` or `wait_for_user`.
6. Questions arrive as margin notes pinned near a shape. Answer by writing beside them and submitting again.

### Starting from an existing codebase

Tap **Map this repo** (top bar, or the card on an empty canvas). It happens in two steps:

1. **A quick map, at once.** Without any model, in well under a second: components from the folder layout and package manifests (a Next.js or Vite app at the root is one component; a folder with its own `package.json` is another), connections from the imports between them, and databases, queues and third-party APIs from the packages each component uses.
2. **The real map, about a minute later.** A model reads the code and redraws the map in place: the Claude API if `ANTHROPIC_API_KEY` is set, otherwise the Claude Code or Codex you already have installed, run headless and read-only in the repo (Claude Code gets only its Read, Grep and Glob tools; Codex runs in its read-only sandbox). The top bar shows **Reading the code…** meanwhile. If you edit the quick map before it finishes, your edits win and the reading is dropped.

The map lands as ordinary ink beside anything you've drawn, laid out with callers above what they call, and becomes the architecture with every component marked done. Boxes you draw afterwards come in as planned work next to what's built. Mapping again replaces the previous map if nobody has edited it; an edited map stays and the new one goes beside it. Connected agents hear about the map and can correct it with marks, or redraw it with `map_architecture`.

### Drawing

Tools: pen, arrow, text, eraser, select, pan, plus undo and redo. With an Apple Pencil the Pencil draws with pressure and fingers move the canvas: one finger pans, two pinch to zoom, and a quick two-finger tap undoes. Without a stylus a finger draws. Arrows that start or end inside a box stay attached to it when you move the box. Tap with the text tool to type (Scribble works too). Paste or drop an image to put it on the canvas. On a keyboard: `D` `A` `T` `E` `V` `H` pick tools, space-drag pans, ⌘/Ctrl-scroll or a pinch zooms, ⌘Z / ⇧⌘Z undo and redo, ⇧1 fits the drawing on screen. Every open device shows the same drawing live.

The laptop view is the same canvas plus a panel: **Chat** (talk to the built-in assistant if an API key is set, or to your coding agent through `read_chat` / `post_chat`) and **Spec** (the approved architecture with build progress).

## MCP tools

| Tool | What it does |
| --- | --- |
| `get_architecture` | The approved architecture: nodes, edges, statuses, pending proposals, open questions, recent decisions. |
| `get_node` | One node or edge with its connections, ink and marks. Ids or labels work. |
| `get_sketch` | The latest sketch as an image plus shape data, for agents doing the interpretation. |
| `interpret` | Set the graph for the latest sketch (nodes bound to shape ids, edges, tags, up to two questions). |
| `map_architecture` | Draw the code's existing components and connections on the canvas as the architecture, marked done. Pass what the agent read from the code, or nothing to use the built-in scan. |
| `add` | Propose a new component next to a node, optionally wired in, or a new edge between existing nodes. |
| `strike` | Propose removing a node or edge. Accepted strikes dim the ink. |
| `rewrite` | Propose a corrected label or kind. |
| `annotate` | Pin a margin note or question to a node, edge, or spot. |
| `set_status` | Report progress: `planned`, `building`, `done`, `blocked`. Lands immediately. |
| `propose` | Several marks as one batch. |
| `finish_batch` | Mark your current batch ready for review. |
| `list_marks` | Marks and their outcomes. |
| `read_chat`, `post_chat` | Talk with the user through the laptop panel. |
| `wait_for_user` | Block until the user submits, chats, or decides on your marks. |

Batches hold at most 6 marks, and an agent can have at most 12 waiting for review. The server tells the agent to wait rather than pile on.

## What's in `.vibeprint/`

| File | Contents |
| --- | --- |
| `canvas.json` | Your ink: one shape per line, sorted by id, so diffs show which shapes changed. A canvas saved by 0.1 or 0.2 (tldraw format) is converted on the first start, keeping every shape id. |
| `sketch.json`, `sketch.png` | What was sent at the last submit. |
| `graph.json` | The interpreted architecture: nodes bound to shape ids, edges, statuses, accepted changes. |
| `marks.json` | Every agent mark (`author`, `batchId`, `type`, `target`, `status`) and the batches they came in. |
| `chat.json` | The chat panel history. |
| `assets/` | Images pasted onto the canvas. |
| `runtime/` | Port, access token and relay address of the canvas, and which shapes the last code map drew. Git-ignored. |

The canvas commits `.vibeprint/` (and nothing else) after a submit, an interpretation, and each round of decisions. Anything else you have staged stays staged. It skips commits during a merge or rebase; turn it off with `vibeprint serve --no-commit`.

## Configuration

| | |
| --- | --- |
| `vibeprint serve --port 4747 --host 0.0.0.0` | Where the canvas listens. Use `--host 127.0.0.1` to keep it off the network. |
| `--no-commit` | Write `.vibeprint/` but never commit. |
| `--no-relay`, `VIBEPRINT_RELAY` | Turn off the hosted relay, or point it at your own (`VIBEPRINT_RELAY=https://relay.example.com`). |
| `ANTHROPIC_API_KEY` | Enables Claude for the first interpretation pass and the chat panel. |
| `VIBEPRINT_MODEL` | Model for interpretation and chat (default `claude-opus-5-5`). |
| `VIBEPRINT_MAPPER` | What reads the code for **Map this repo**: `api`, `claude`, `codex`, or `off` for the quick map only (default: the first available, in that order). |
| `VIBEPRINT_AUTHOR` | Override the author name an MCP client's marks carry (default: detected `claude` / `codex`). |

## Development

```sh
npm install
npm run dev        # daemon on :4747 (tsx watch) + Vite on :5173 with HMR
npm test           # node:test via tsx
npm run typecheck
npm run build      # dist/cli.js + dist/web
```

Layout: `src/core` (state, merge, placement), `src/server` (HTTP + canvas sync + git checkpoints), `src/interpret` (heuristic and Claude interpreters), `src/mcp` (MCP server), `src/cli` (`init`), `web/` (the canvas app), `src/shared` (types used everywhere).

## License

Vibeprint is MIT licensed, canvas included: pen strokes come from [perfect-freehand](https://github.com/steveruizok/perfect-freehand) (MIT) and text uses Shantell Sans (SIL OFL 1.1). No license keys anywhere.
