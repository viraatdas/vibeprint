// Continue generate → render → fresh Opus 5.5 review until every latest view is Excellent.
// Run with the same Playwright library/font environment as evaluate-maps.ts.
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
const root = path.resolve('evaluations/2026-11-04')
const projects = ['threadline', 'crumb', 'vibeprint']
function runs(project: string) {
  return fs.readdirSync(path.join(root, project)).filter(n => /^round-\d+$/.test(n)).map(n => ({ round: Number(n.slice(6)), review: path.join(root, project, n, 'review.json') })).sort((a, b) => a.round - b.round)
}
for (;;) {
  const latest = projects.map(project => ({ project, ...runs(project).filter(r => fs.existsSync(r.review)).at(-1)! }))
  console.log(latest.map(r => `${r.project}: ${JSON.parse(fs.readFileSync(r.review, 'utf8')).total}/40`).join(' · '))
  if (latest.every(r => JSON.parse(fs.readFileSync(r.review, 'utf8')).total >= 36)) break
  const pending = latest.filter(r => JSON.parse(fs.readFileSync(r.review, 'utf8')).total < 36).map(r => r.project)
  const unfinished = pending.flatMap(runs).filter(r => !fs.existsSync(r.review))
  const round = unfinished.length ? Math.min(...unfinished.map(r => r.round)) : Math.max(...projects.flatMap(runs).map(r => r.round)) + 1
  const result = spawnSync(process.execPath, ['--import', 'tsx', 'scripts/evaluate-maps.ts', String(round), '--pending-only'], { stdio: 'inherit', env: process.env })
  if (result.status !== 0) throw new Error(`Round ${round} failed; repair before resuming (${result.signal || result.status})`)
  const report = spawnSync(process.execPath, ['--import', 'tsx', 'scripts/build-map-report.ts'], { stdio: 'inherit' })
  if (report.status !== 0) throw new Error('Could not build report')
}
console.log('All latest views reach 36/40. Original trials and receipts remain unchanged.')
