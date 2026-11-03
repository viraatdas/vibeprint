# Decisions

Shared, agent-authored log of cross-cutting decisions the fleet must honor. The conductor records plan/rebase/steer decisions here; workers record interface contracts + adjustments. Each entry is a `##` heading with **What / Why / By** so it scans. Read entries relevant to this task; revisit when a relevant topic changes or before integration. jj records conflicts on fan-in.
## worker: Built Vibeprint end to end, uncommitted on main: a
- **Did:** Built Vibeprint end to end, uncommitted on main: a tldraw canvas web app (iPad pad view with Submit, laptop view with chat + spec panel, live sync over a local daemon), interpretation of submitted sketches into a private graph bound to stroke ids (Claude API when ANTHROPIC_API_KEY is set, built-in heuristic otherwise, or the coding agent via get_sketch + interpret), an agent mark layer (add/strike/rewrite/note/status records with author, batchId, target, pending|accepted|rejected) drawn as a separate blue hand-drawn overlay that never edits user ink, repo-backed state in .vibeprint/ with git checkpoints that commit only that folder, and one stdio MCP server used by both Claude Code and Codex. Verified: typecheck clean, 66/66 tests pass, production build succeeds, headless-Chromium E2E of sketch→submit→tags→paced marks→accept/reject→dim/drag/collapse/two-tab sync, a real Claude Code session proposed a mark via MCP, a real Codex session set a node status via MCP. Not verified: live Claude API interpretation/chat (no API key here) and a physical iPad + Pencil.
- **Interfaces:** CLI: vibeprint [serve] [--port 4747] [--host] [--no-commit] [--root]; vibeprint init [--register]; vibeprint mcp [--author] | MCP tools: get_architecture, get_node, get_sketch, interpret, add, strike, rewrite, annotate, set_status, propose, finish_batch, list_marks, read_chat, post_chat, wait_for_user | HTTP API on the daemon: GET /api/{health,config,state,events(SSE),architecture,node,sketch,sketch.png,marks,chat,wait}; POST /api/{submit,interpretation,marks,batches/finish,chat,marks/:id/decide,batches/:id/decide}; WS /api/sync (tldraw room). LAN access needs the token (cookie/header/?t=); same-machine same-origin requests do not. | .vibeprint/ files: canvas.json, sketch.json, sketch.png, graph.json, marks.json, chat.json, assets/, runtime/ (git-ignored) | vibeprint init writes the agent rule between <!-- vibeprint:start/end --> in AGENTS.md, @AGENTS.md in CLAUDE.md, and merges .mcp.json
- **Follow-ups:**
  - Commit the work (nothing committed; files are intent-to-add only) — user did not ask for a commit
  - Live-test Claude API interpretation and chat with ANTHROPIC_API_KEY — no ANTHROPIC_API_KEY in this environment; covered only by fake-client tests
  - Try it on a real iPad with Apple Pencil — verified only with an emulated iPad Pro 11 in headless Chromium
  - Publish the CLI to npm and set up vibeprint.viraat.dev (tldraw license key needed only for https on a public domain) — distribution and the domain were not requested
  - Free root disk space (other projects' /tmp data fills it) [out of lane] — not ours to delete; it may block future builds/tests on this machine
- **By:** worker · 2026-11-02T02:06:51.273Z

## worker: Publish pass for Vibeprint 0.1.0. Committed the work on
- **Did:** Publish pass for Vibeprint 0.1.0. Committed the work on branch release-0.1.0 (d0523fe) and opened PR https://github.com/viraatdas/vibeprint/pull/1 into main. Made the package npm-ready: metadata, a LICENSE (MIT, with a note that tldraw has its own license), a prepublishOnly gate, and `init` writing `npx -y vibeprint mcp` when it runs through npx. Verified the packed tarball in a clean install (init, serve, canvas page and assets, 15 MCP tools, canvas still visible past tldraw's 5s license check). Built and deployed a static landing page (site/) to the Vercel project 'vibeprint': https://vibeprint-woad.vercel.app returns 200, and vibeprint.viraat.dev is attached to the project. Blocked on user auth: npm publish (the npm token here returns 401) and the DNS record for vibeprint.viraat.dev (DNS is on Netlify, whose token here returns 401). Answered the API-key question: the key is optional, and without it the coding agent does the interpretation through MCP.
- **Interfaces:** npm package 'vibeprint' (bin vibeprint, files dist/) | site/index.html static page on Vercel project 'vibeprint' | DNS needed: CNAME vibeprint.viraat.dev -> cname.vercel-dns.com (Netlify DNS zone viraat.dev)
- **Delivery:** blocked; release; target=npm:vibeprint@0.1.0 + https://vibeprint.viraat.dev; revision=d0523fe; verifiedAt=2026-11-02T22:41:28Z; checks=7
- **Follow-ups:**
  - npm publish once the user logs in (`npm login`) — the npm token on this machine returns 401
  - Add CNAME vibeprint -> cname.vercel-dns.com in Netlify DNS for viraat.dev, then `vercel domains verify vibeprint.viraat.dev` — the Netlify token here returns 401
  - Merge PR #1 into main — the default-branch rule meant committing on a branch
  - Optional: interpret through the local claude/codex CLI when there's no ANTHROPIC_API_KEY — so handwriting is read on Submit using the user's existing agent login
  - Live-test the Claude API path and a real iPad + Pencil — still unverified
- **By:** worker · 2026-11-02T22:41:29.318Z

## worker: Merged release PR #1 into main (the user asked
- **Did:** Merged release PR #1 into main (the user asked for no PRs going forward), then fixed the landing page 404: the merge had triggered Vercel's Git integration with Root Directory '.', so the project now builds from site/ and https://vibeprint-woad.vercel.app is 200 again. Recorded a clean end-to-end demo (iPad layout, real MCP server as Claude Code: sketch, submit, 1 add/1 strike/1 question drawn on, Accept all, done/building marks, laptop Spec tab) and sent it to the user. Three product fixes found while recording, committed to main as 41b37f7: freehand circles that overshoot their start now count as closed (before, the node was bound to its label); margin-note text wraps at 18 characters so it stays inside the note; an iPad user agent alone selects the pad layout. Tests 67/67, typecheck and build clean. Still blocked on the user: the Netlify approval for the vibeprint.viraat.dev DNS record (viraat.dev is registered at Name.com via Netlify, not Namecheap; a watcher adds the CNAME on approval) and npm publish (npm browser login expires in about 5 minutes, so it needs the user present).
- **Interfaces:** Vercel project 'vibeprint' rootDirectory=site (no build) | git push to main deploys the site | shared/geometry strokeIsClosed(points) used by web extract + heuristic
- **Delivery:** blocked; release; target=npm:vibeprint@0.1.0 + https://vibeprint.viraat.dev; revision=41b37f7; verifiedAt=2026-11-02T23:16:38Z; checks=5
- **Follow-ups:**
  - Publish to npm with the user present (`! npm login`, then npm publish) — npm browser sessions expire in ~5 minutes
  - After the Netlify approval: confirm `vercel domains verify vibeprint.viraat.dev` and HTTPS — the DNS record depends on that approval
  - Optional: interpret through the local claude/codex CLI when there's no ANTHROPIC_API_KEY — so handwriting is read on Submit with the user's existing agent login
- **By:** worker · 2026-11-02T23:16:39.549Z

## worker: vibeprint.viraat.dev is live. After the user approved a Netlify
- **Did:** vibeprint.viraat.dev is live. After the user approved a Netlify login ticket, added CNAME vibeprint.viraat.dev -> cname.vercel-dns.com in the viraat.dev Netlify DNS zone (HTTP 201). Vercel verified the domain and issued a Let's Encrypt certificate (CN vibeprint.viraat.dev, valid to 2027-01-31), and https://vibeprint.viraat.dev returns 200 with the landing page. npm publish still needs the user at the keyboard (`npm login`).
- **Interfaces:** https://vibeprint.viraat.dev -> Vercel project 'vibeprint' (root site/) | Netlify DNS zone viraat.dev: CNAME vibeprint -> cname.vercel-dns.com
- **Delivery:** verified; web; target=https://vibeprint.viraat.dev; revision=bc22be2; verifiedAt=2026-11-03T00:20:16Z; checks=4
- **Follow-ups:**
  - Publish vibeprint@0.1.0 to npm once the user runs `npm login` — npm browser sessions expire in ~5 minutes, so it needs the user present
  - Refresh NETLIFY_AUTH_TOKEN in the Rudder cloud secrets vault — the vault copy is revoked (401); this machine now uses a fresh CLI login in ~/.config/netlify
- **By:** worker · 2026-11-03T00:20:17.575Z

## worker: Redesigned vibeprint.viraat.dev as a shorter page. It now has
- **Did:** Redesigned vibeprint.viraat.dev as a shorter page. It now has a big headline, a single copyable command (`npx vibeprint init`), an iPad that replays a real session, and three one-line facts. The replay draws the sketch in, presses Submit and draws the agent's blue marks (redis cache add, cron strike with a note, retries question); Accept all, Reject all, Replay and Agent ink work. Phones zoom the sketch and move the proposal strip under the device. Reduced motion and no-JS show the finished proposal. Checked locally at 1280px and 390px with no horizontal overflow and no console errors, then pushed to main as da76de3; Vercel auto-deployed it and the live domain renders the same.
- **Interfaces:** site/index.html (generated by the session scratchpad site-gen2.ts; reuses web/src/agent/rough.ts paths) | git push to main deploys site/ via Vercel
- **Delivery:** verified; web; target=https://vibeprint.viraat.dev; revision=da76de3; verifiedAt=2026-11-03T00:50:26Z; checks=3
- **Follow-ups:**
  - Publish vibeprint@0.1.0 to npm with the user present — the landing page's `npx vibeprint init` fails until the package exists on npm; npm browser login expires in ~5 minutes
  - Optional: interpret through the local claude/codex CLI when there's no ANTHROPIC_API_KEY — handwriting would be read on Submit using the user's existing agent login
- **By:** worker · 2026-11-03T00:50:27.006Z

## worker: Published vibeprint@0.1.0 to npm (maintainer viraatdas). The account's 2FA
- **Did:** Published vibeprint@0.1.0 to npm (maintainer viraatdas). The account's 2FA is a security key, so publishing needs a browser approval link, which only appears when npm runs in a terminal (ran it under script). Rudder's dotfile sync had overwritten ~/.npmrc with the laptop's expired token, so the login now lives in ~/.npm-publish-rc. Verified from the registry in a clean repo with an empty cache and home: npx -y vibeprint@0.1.0 init writes .mcp.json (npx -y vibeprint mcp), AGENTS.md, CLAUDE.md and .vibeprint/; npx vibeprint serves the canvas (200, app bundle loads, prints the iPad URL and QR code); npx vibeprint mcp lists 15 tools.
- **Interfaces:** npm package vibeprint@0.1.0 (bin vibeprint -> dist/cli.js), dist-tag latest | https://vibeprint.viraat.dev install command npx vibeprint init now resolves
- **Delivery:** verified; release; target=npm:vibeprint@0.1.0; revision=3a68b8c; verifiedAt=2026-11-03T21:16:21Z; checks=4
- **Follow-ups:**
  - Run npm login on the laptop — Rudder copies the laptop's ~/.npmrc to cloud machines, and that copy holds an expired token
  - Try it on a real iPad with Apple Pencil — testing so far used an emulated iPad in headless Chromium
  - Optional: interpret through the local claude/codex CLI when there's no ANTHROPIC_API_KEY — handwriting would be read on Submit using the user's existing agent login
- **By:** worker · 2026-11-03T21:16:21.977Z

## worker: Added a hosted relay so the iPad reaches vibeprint
- **Did:** Added a hosted relay so the iPad reaches vibeprint from any network, including when vibeprint runs on a cloud VM. vibeprint keeps one outbound WebSocket to the relay and replays its requests (streamed HTTP + the canvas WebSocket) against the local server. The relay runs on Fly as vibeprint-relay (exla org, one always-on shared-cpu machine, sjc); each session gets https://<id>.live.vibeprint.viraat.dev. DNS: live, *.live and _acme-challenge.live CNAMEs added in the Netlify viraat.dev zone; both Fly certs issued. Relayed requests are marked forwarded so the access token is always required. The token now survives clean restarts, and the relay id is kept per repo. Verified: 76/76 tests (9 new relay tests), and an emulated iPad loaded the canvas through the live relay; a stroke drawn there synced to the laptop view. Blocked: tldraw removes the canvas 5s after mount on the relay domain until there's a license, so the relay link isn't the default yet and npm 0.2.0 isn't published.
- **Interfaces:** vibeprint serve [--no-relay] / VIBEPRINT_RELAY (default https://live.vibeprint.viraat.dev) | relay protocol v1 in relay/server.mjs | .vibeprint/runtime/token, runtime/relay.json | Fly app vibeprint-relay (org exla), secret TLDRAW_LICENSE_KEY turns on the relay link as the main iPad link
- **Delivery:** blocked; web; target=https://live.vibeprint.viraat.dev + npm:vibeprint@0.2.0; revision=fd7ba03; verifiedAt=2026-11-03T21:48:18Z; checks=6
- **Follow-ups:**
  - Get a tldraw hobby license for *.live.vibeprint.viraat.dev and set it on Fly — without it tldraw hides the canvas after 5s on the relay domain; fly secrets set TLDRAW_LICENSE_KEY=... -a vibeprint-relay
  - Publish vibeprint 0.2.0 with the relay — npm users only get the relay with a new version; needs one security-key approval
  - Run netlify login and npm login on the laptop — Rudder copies the laptop's stale logins over fresh ones on cloud machines, forcing re-approvals
- **By:** worker · 2026-11-03T21:48:18.904Z


## worker: Released vibeprint@0.2.0 with the relay link as the default
- **Did:** Released vibeprint@0.2.0 with the relay link as the default iPad link, and set up automatic npm releases. The user's tldraw trial key (expires 2026-11-17) is set on the relay as a Fly secret, so tldraw stays up there; the relay health check reports licensed:true. Releases need no approvals now: .github/workflows/publish.yml publishes through npm trusted publishing (OIDC) whenever main has a version that isn't on npm yet. Verified from the registry with an empty home and cache: npx -y vibeprint@0.2.0 printed iPad https://<id>.live.vibeprint.viraat.dev/?t=… (any network). From the public internet, that link returned 401 without the token, 302 plus a cookie with it, then 200 on /api/state with the license present in /api/config. The test server stopped cleanly, and the relay dropped the session.
- **Interfaces:** npm vibeprint@0.2.0 (latest) | .github/workflows/publish.yml: push to main touching package.json -> npm publish via trusted publishing (trust id 5c94212d) | Fly secret TLDRAW_LICENSE_KEY on vibeprint-relay (trial, expires 2026-11-17)
- **Delivery:** verified; release; target=npm:vibeprint@0.2.0; revision=576b3f9; verifiedAt=2026-11-03T22:06:57Z; checks=5
- **Follow-ups:**
  - Replace tldraw with vibeprint's own canvas before 2026-11-17 — the trial key on the relay expires then and tldraw would hide the canvas on the relay domain again; the user wants no tldraw license or dependency
  - Run netlify login and npm login on the laptop — Rudder copies the laptop's stale logins over fresh ones on cloud machines, forcing re-approvals
  - Try it on a real iPad with Apple Pencil — testing so far used an emulated iPad in headless Chromium
- **By:** worker · 2026-11-03T22:06:57Z

## worker: Replaced tldraw with vibeprint's own canvas (0.3.0)
- **Did:** Replaced tldraw with vibeprint's own MIT canvas and released it as 0.3.0 (0.3.1 adds the font's OFL license to the package). No tldraw dependency, license key or expiry. The canvas is SVG plus perfect-freehand: Pencil pressure, arrows that bind to boxes and follow them, text that works with the iPad keyboard and Scribble, eraser, select/move, pan, pinch, two-finger-tap undo, image paste/drop, and PNG export. The daemon syncs one document per repo over /api/canvas and saves canvas.json one shape per line. A tldraw canvas.json from 0.1/0.2 is converted on first start, keeping every shape id. Verified: 86/86 tests, including a fixture captured from the real 0.2.0 app. A browser run passed 24/24 checks across an emulated iPad (Pencil and touch), a laptop and a phone: sync, binding, text, pinch, eraser, undo/redo, move, submit, agent marks, dimming and reload. 0.3.0 was published from GitHub Actions with provenance and no approvals. npx -y vibeprint@0.3.0 from a clean folder printed the relay link; a Pencil stroke drawn on that public https link was saved, and the canvas stayed up past 9s.
- **Interfaces:** WebSocket /api/canvas (protocol 1: snapshot/ops/ack/rejected/tick) replaces /api/sync | .vibeprint/canvas.json format vibeprint-canvas v1 | ClientConfig.tldrawLicenseKey and the TLDRAW_LICENSE_KEY env var removed | relay still sends its license in 'ready' for 0.2.0 clients
- **Delivery:** verified; release; target=npm:vibeprint@0.3.0; revision=a153322; verifiedAt=2026-11-03T22:39:39Z; checks=5
- **Follow-ups:**
  - Try 0.3 on a real iPad with an Apple Pencil — Safari-only paths (gesture events, keyboard and Scribble focus, palm resting) were only emulated in Chromium
  - Unset TLDRAW_LICENSE_KEY on the relay after 2026-11-17 — only 0.2.0 installs read it; the trial key expires then anyway
  - Run netlify login and npm login on the laptop — Rudder copies the laptop's stale logins over fresh ones on cloud machines
- **By:** worker · 2026-11-03T22:39:39Z
