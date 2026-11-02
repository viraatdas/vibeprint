# vibeprint

Draw your architecture on an iPad. Your coding agent reads it, marks it up in its own blue pen, and then tracks the build against it on the same canvas.

- **You sketch** boxes, arrows and words with the Pencil, then tap **Submit**.
- **The agent reads it** into a private graph (nodes, edges, labels), each node bound to the strokes it came from. Faint tags like "Postgres" or "queue" appear on your shapes. Ignore them, or correct them by scribbling and submitting again.
- **The agent proposes, you decide.** Every agent action is a mark: add, strike, rewrite, note, or status. Proposals arrive in small batches ("3 adds, 1 strike, 1 question") that you accept with one tap or review one by one.
- **Your ink is never touched.** The agent draws beside your shapes, strikes through them, or writes a corrected label next to yours. An accepted strike dims the shape instead of deleting it. One button hides all agent ink.
- **The build shows up on the sketch.** As code lands, agents flip node statuses and boxes go from dashed to solid with a check.
- **It lives in the repo.** The graph, marks and canvas are plain JSON in `.vibeprint/`, committed to git at each checkpoint, so the spec travels with the code and has history.
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

Or without installing: `npx vibeprint init`, then `npx vibeprint`.

Scan the QR code with the iPad (same Wi-Fi), then **Share → Add to Home Screen** for a full-screen canvas. The iPad link carries an access token; the laptop link at `localhost` doesn't need one.

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

The laptop view is the same canvas plus a panel: **Chat** (talk to the built-in assistant if an API key is set, or to your coding agent through `read_chat` / `post_chat`) and **Spec** (the approved architecture with build progress).

## MCP tools

| Tool | What it does |
| --- | --- |
| `get_architecture` | The approved architecture: nodes, edges, statuses, pending proposals, open questions, recent decisions. |
| `get_node` | One node or edge with its connections, ink and marks. Ids or labels work. |
| `get_sketch` | The latest sketch as an image plus shape data, for agents doing the interpretation. |
| `interpret` | Set the graph for the latest sketch (nodes bound to shape ids, edges, tags, up to two questions). |
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
| `canvas.json` | Your ink: the tldraw document, records sorted so diffs show which shapes changed. |
| `sketch.json`, `sketch.png` | What was sent at the last submit. |
| `graph.json` | The interpreted architecture: nodes bound to shape ids, edges, statuses, accepted changes. |
| `marks.json` | Every agent mark (`author`, `batchId`, `type`, `target`, `status`) and the batches they came in. |
| `chat.json` | The chat panel history. |
| `assets/` | Images pasted onto the canvas. |
| `runtime/` | Port and access token of the running canvas. Git-ignored. |

The canvas commits `.vibeprint/` (and nothing else) after a submit, an interpretation, and each round of decisions. Anything else you have staged stays staged. It skips commits during a merge or rebase; turn it off with `vibeprint serve --no-commit`.

## Configuration

| | |
| --- | --- |
| `vibeprint serve --port 4747 --host 0.0.0.0` | Where the canvas listens. Use `--host 127.0.0.1` to keep it off the network. |
| `--no-commit` | Write `.vibeprint/` but never commit. |
| `ANTHROPIC_API_KEY` | Enables Claude for the first interpretation pass and the chat panel. |
| `VIBEPRINT_MODEL` | Model for interpretation and chat (default `claude-opus-5-5`). |
| `VIBEPRINT_AUTHOR` | Override the author name an MCP client's marks carry (default: detected `claude` / `codex`). |
| `TLDRAW_LICENSE_KEY` | Only needed if you serve the canvas over HTTPS on a public domain, where tldraw hides the editor without a key. Local and LAN use runs as tldraw development mode. |

## Development

```sh
npm install
npm run dev        # daemon on :4747 (tsx watch) + Vite on :5173 with HMR
npm test           # node:test via tsx
npm run typecheck
npm run build      # dist/cli.js + dist/web
```

Layout: `src/core` (state, merge, placement), `src/server` (HTTP + tldraw sync + git checkpoints), `src/interpret` (heuristic and Claude interpreters), `src/mcp` (MCP server), `src/cli` (`init`), `web/` (the canvas app), `src/shared` (types used everywhere).

## License

Vibeprint is MIT licensed. The canvas is built on [tldraw](https://tldraw.dev), which has [its own license](https://github.com/tldraw/tldraw/blob/main/LICENSE.md): it is free in development, and production deployments need a key from tldraw.
