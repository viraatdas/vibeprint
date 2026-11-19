// Takes the README screenshots in docs/images at iPad landscape size.
//   node --import tsx scripts/screenshots.ts sketch|review|tables
//   MAP_REPO=$PWD node --import tsx scripts/screenshots.ts map   (needs Claude Code, Codex or ANTHROPIC_API_KEY; a few minutes)
// The map scene keeps the canvas state in a temp folder, so the mapped repo is only read.
import { chromium, type Page } from 'playwright'
import { execSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { startDaemon } from '../src/server/daemon.ts'

const OUT = process.env.OUT ?? 'docs/images'
const scene = process.argv[2]
if (!['sketch', 'review', 'tables', 'map'].includes(scene)) throw new Error('Pass a scene: sketch, review, tables or map.')
fs.mkdirSync(OUT, { recursive: true })

const mapRepo = process.env.MAP_REPO
const root = mapRepo ?? fs.mkdtempSync(path.join(os.tmpdir(), 'vp-shot-'))
if (!mapRepo) execSync('git init -q && git commit -q --allow-empty -m init', { cwd: root })
const state = mapRepo ? fs.mkdtempSync(path.join(os.tmpdir(), 'vp-state-')) : undefined
const d = await startDaemon({ root, port: 0, quiet: true, ...(mapRepo ? { state } : { mapper: null }), relay: null, commit: false })
const base = `http://127.0.0.1:${d.port}`
const H = { 'content-type': 'application/json', 'x-vibeprint-token': d.token }
const post = async (p: string, body: unknown) => {
  const r = await fetch(base + p, { method: 'POST', headers: H, body: JSON.stringify(body) })
  const j = await r.json()
  if (!r.ok) throw new Error(`${p}: ${JSON.stringify(j)}`)
  return j
}
const get = async (p: string) => (await fetch(base + p, { headers: H })).json()

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1366, height: 1024 }, deviceScaleFactor: 2 })
await page.addInitScript('window.__name = (f) => f')
await page.goto(base + '/')
await page.waitForSelector('.vp-stage')
await page.waitForTimeout(500)

async function tool(p: Page, label: string) {
  await p.click(`.vp-tools button[aria-label="${label}"]`)
}
// A wobbly hand-drawn rectangle.
async function box(p: Page, x: number, y: number, w: number, h: number) {
  const pts: [number, number][] = []
  const j = (n: number) => n + (Math.random() - 0.5) * 3
  const seg = (ax: number, ay: number, bx: number, by: number) => {
    for (let i = 0; i <= 12; i++) pts.push([j(ax + ((bx - ax) * i) / 12), j(ay + ((by - ay) * i) / 12)])
  }
  seg(x, y, x + w, y); seg(x + w, y, x + w, y + h); seg(x + w, y + h, x, y + h); seg(x, y + h, x, y + 4)
  await p.mouse.move(pts[0][0], pts[0][1])
  await p.mouse.down()
  for (const [a, b] of pts.slice(1)) await p.mouse.move(a, b, { steps: 2 })
  await p.mouse.up()
}
async function arrow(p: Page, ax: number, ay: number, bx: number, by: number) {
  await tool(p, 'Arrow')
  await p.mouse.move(ax, ay); await p.mouse.down(); await p.mouse.move(bx, by, { steps: 12 }); await p.mouse.up()
}
async function text(p: Page, x: number, y: number, s: string) {
  await tool(p, 'Text')
  await p.mouse.click(x, y)
  await p.keyboard.type(s)
  await p.keyboard.press('Escape')
}

if (scene !== 'map') {
  await tool(page, 'Pen')
  await box(page, 150, 330, 170, 100)
  await box(page, 430, 330, 170, 100)
  await box(page, 430, 580, 170, 100)
  await text(page, 180, 365, 'Web app')
  await text(page, 490, 365, 'API')
  await text(page, 455, 615, 'Postgres')
  await arrow(page, 330, 380, 420, 380)
  await arrow(page, 515, 440, 515, 570)
  await page.waitForTimeout(600)
  if (scene === 'sketch') await page.screenshot({ path: path.join(OUT, 'sketch.png') })
  else {
    // Submit, then read the sketch the way an agent would.
    await page.click('button:has-text("Submit")')
    await page.waitForTimeout(1500)
    const labels = (await get('/api/state')).graph.nodes.map((n: { label: string }) => n.label).sort().join(', ')
    if (labels !== 'API, Postgres, Web app') throw new Error(`The sketch read as: ${labels}`)
    const marks = [
      { type: 'add', label: 'Job queue', kind: 'queue', connectFrom: ['API'], edgeLabel: 'enqueue' },
      { type: 'add', label: 'Email worker', kind: 'worker', connectFrom: ['API'], edgeLabel: 'jobs' },
      { type: 'note', target: 'Postgres', text: 'One database for sessions and orders?', question: true },
    ]
    await post('/api/marks', { author: 'claude', marks, message: 'Sends receipts off the request path.', finish: true })
    await page.waitForTimeout(5000)
    await tool(page, 'Pen')
    await page.waitForTimeout(800)
    if (scene === 'review') await page.screenshot({ path: path.join(OUT, 'review.png') })
    if (scene === 'tables') {
      await page.click('.vp-batch button:has-text("Accept all"), button:has-text("Accept all") >> nth=0')
      await page.waitForTimeout(1500)
      await post('/api/marks', { author: 'claude', marks: [
        { type: 'status', target: 'Web app', status: 'done' },
        { type: 'status', target: 'API', status: 'done' },
        { type: 'status', target: 'Postgres', status: 'done' },
        { type: 'status', target: 'Job queue', status: 'building' },
      ], finish: true })
      await page.waitForTimeout(3000)
      await post('/api/marks', { author: 'claude', message: 'Here are the two tables behind orders.', marks: [
          { type: 'table', target: 'Postgres', table: { name: 'users', source: 'db/schema.sql', columns: [
            { name: 'id', type: 'uuid', key: 'primary' }, { name: 'email', type: 'text' }, { name: 'created_at', type: 'timestamptz' }],
            rows: [['7f3c…', 'ada@example.com', '2026-11-02'], ['a91e…', 'lin@example.com', '2026-11-09'], ['c04b…', 'sam@example.com', '2026-11-12']] } },
          { type: 'table', target: 'Postgres', table: { name: 'orders', source: 'db/schema.sql', columns: [
            { name: 'id', type: 'bigint', key: 'primary' }, { name: 'user_id', type: 'uuid', key: 'foreign', references: 'users.id' },
            { name: 'total_cents', type: 'int' }, { name: 'receipt_sent_at', type: 'timestamptz' }],
            rows: [['1042', '7f3c…', '4900', '2026-11-12 09:14'], ['1043', 'a91e…', '1250', 'NULL'], ['1044', '7f3c…', '18000', '2026-11-13 17:02']] } },
        ], finish: true })
      await page.waitForTimeout(5000)
      await page.screenshot({ path: path.join(OUT, 'tables.png') })
    }
  }
}

if (scene === 'map') {
  await page.click('button[aria-label="Toggle chat panel"]')
  await page.click('button:has-text("Map this repo") >> nth=0')
  await page.waitForTimeout(3000)
  const t0 = Date.now()
  for (;;) {
    await page.waitForTimeout(10000)
    const st = await get('/api/state')
    const m = st.mapper ?? {}
    console.log(Math.round((Date.now() - t0) / 1000), m.active, m.outcome, m.lastError ?? '')
    if (!m.active) break
    if (Date.now() - t0 > 15 * 60_000) throw new Error('model map timed out')
  }
  await page.waitForTimeout(4000)
  // The first view, without the notes panel and view picker along the bottom.
  await page.screenshot({ path: path.join(OUT, 'map.png'), clip: { x: 0, y: 0, width: 1366, height: 735 } })
}

await browser.close()
await d.close()
fs.rmSync(mapRepo ? state! : root, { recursive: true, force: true })
process.exit(0)
