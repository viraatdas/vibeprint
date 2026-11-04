import fs from 'node:fs'
import path from 'node:path'
import http from 'node:http'
import assert from 'node:assert/strict'
import { chromium } from 'playwright'
const root = path.resolve('evaluations/2026-11-04')
const projects = ['threadline', 'crumb', 'vibeprint']
const reviews = projects.flatMap(project => fs.readdirSync(path.join(root, project)).filter(n => /^round-\d+$/.test(n) && fs.existsSync(path.join(root, project, n, 'review.json'))).map(n => ({ project, dir: path.join(root, project, n), review: JSON.parse(fs.readFileSync(path.join(root, project, n, 'review.json'), 'utf8')) })))
for (const { dir, review } of reviews) {
  assert.equal(review.scores.length, 10)
  assert.equal(new Set(review.scores.map((s: any) => s.id)).size, 10)
  assert.equal(review.total, review.scores.reduce((n: number, s: any) => n + s.score, 0))
  assert.equal(JSON.parse(fs.readFileSync(path.join(dir, 'render.json'), 'utf8')).errors.length, 0)
  if (review.round >= 4) {
    assert.ok(JSON.parse(fs.readFileSync(path.join(dir, 'judge-receipt.json'), 'utf8')).actual.includes('claude-opus-5-5'))
    assert.ok(JSON.parse(fs.readFileSync(path.join(dir, 'generator-receipt.json'), 'utf8')).calls.every((models: string[]) => models.includes('claude-opus-5-5')))
  }
}
const latest = projects.map(project => reviews.filter(r => r.project === project).sort((a, b) => b.review.round - a.review.round)[0].review)
if (process.argv.includes('--excellent')) assert.ok(latest.every(r => r.total >= 36), 'Every latest project must reach Excellent')
const server = http.createServer((req, res) => {
  const relative = decodeURIComponent(new URL(req.url!, 'http://localhost').pathname)
  const file = path.resolve(root, '.' + (relative === '/' ? '/index.html' : relative))
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404).end(); return }
  const type = ({ '.html': 'text/html', '.png': 'image/png', '.json': 'application/json' } as Record<string, string>)[path.extname(file)] || 'text/plain'
  res.writeHead(200, { 'content-type': type }); fs.createReadStream(file).pipe(res)
})
await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
const base = `http://127.0.0.1:${(server.address() as any).port}`
const browser = await chromium.launch()
try {
  const page = await browser.newPage()
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message))
  const viewports = []
  let checkedLinks = 0
  for (const width of [1194, 390]) {
    await page.setViewportSize({ width, height: 834 })
    await page.goto(base)
    assert.equal(await page.locator('article img').count(), reviews.length)
    const metrics = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth }))
    assert.ok(metrics.scroll <= width + 1, `Gallery overflows at ${width}`)
    viewports.push(metrics)
    if (width === 1194) {
      const links = await page.locator('a[href]').evaluateAll(anchors => [...new Set(anchors.map(a => (a as HTMLAnchorElement).href).filter(h => !h.includes('#')))])
      for (const href of links) { const response = await page.request.get(href); assert.ok(response.ok(), href); checkedLinks++ }
      await page.locator('section > article img').evaluateAll(async images => { await Promise.all(images.map(img => new Promise<void>((resolve, reject) => { const el = img as HTMLImageElement; if (el.complete && el.naturalWidth) return resolve(); el.onload = () => resolve(); el.onerror = () => reject(new Error(el.src)); el.loading = 'eager' }))) })
      await page.screenshot({ path: path.join(root, 'gallery-desktop.png') })
    } else await page.screenshot({ path: path.join(root, 'gallery-mobile.png') })
  }
  assert.deepEqual(errors, [])
  const result = { verifiedAt: new Date().toISOString(), reviews: reviews.length, latest: latest.map(r => ({ project: r.project, round: r.round, total: r.total })), checkedLinks, viewports, browserErrors: errors, modelReceiptsVerified: true }
  fs.writeFileSync(path.join(root, 'verification.json'), JSON.stringify(result, null, 2) + '\n')
  console.log(JSON.stringify(result))
} finally { await browser.close(); await new Promise<void>(resolve => server.close(() => resolve())) }
