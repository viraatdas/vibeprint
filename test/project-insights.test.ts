import { after, test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { mergeProjectObservations, readProjectObservations } from '../src/core/project-observations.js'
import { drawMap, cleanMap } from '../src/core/map.js'
import { shapeSchema } from '../src/server/canvas.js'
import { metricValue } from '../src/shared/project-metrics.js'
import type { ProjectMetric, RepoMap } from '../src/shared/types.js'

const roots: string[] = []
after(() => roots.forEach(root => fs.rmSync(root, { recursive: true, force: true })))
function root() { const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vp-observations-')); roots.push(dir); fs.mkdirSync(path.join(dir, '.vibeprint')); return dir }
const metric: ProjectMetric = { id: 'slot-logins', label: 'Slot logins this boot', definition: 'Distinct slot UIDs whose login was attempted during this boot; survives runner restarts.', unit: 'logins', source: 'src/fleet/login-budget.ts' }
const observation: ProjectMetric = { ...metric, reading: { value: 0, at: '2026-11-05T00:00:00Z', window: 'since boot', scope: 'test fixture Mac', source: 'fixture of fleet-logins.json, not a production observation' } }

test('observations retain zero, time, environment and exact counting semantics; absent data stays unknown', () => {
  const dir = root(), file = path.join(dir, '.vibeprint/observations.json')
  assert.deepEqual(readProjectObservations(dir), { metrics: [] })
  fs.writeFileSync(file, JSON.stringify({ metrics: [observation] }))
  const result = readProjectObservations(dir)
  assert.deepEqual(result.metrics, [observation])
  assert.equal(result.warning, undefined)
  assert.equal(metricValue(result.metrics[0]), '0 logins')
  assert.equal(metricValue(metric), 'Not measured')
})

test('model-invented readings are discarded; observations cannot be relabeled by the model', () => {
  const guessed = { ...observation, label: 'Successful customer sign-ins', definition: 'All-time customer sign-ins', reading: { ...observation.reading!, value: 999 } }
  assert.deepEqual(mergeProjectObservations([guessed], []), [{ ...guessed, reading: undefined }].map(({ reading: _, ...m }) => m))
  assert.deepEqual(mergeProjectObservations([guessed], [observation]), [observation])
  assert.deepEqual(mergeProjectObservations([{ id: 'bad' }], []), [])
})

test('invalid, unbounded, duplicate, future or linked snapshots produce an explicit warning, not a count', () => {
  const dir = root(), file = path.join(dir, '.vibeprint/observations.json')
  const cases = ['broken json', JSON.stringify({ metrics: [{ ...observation, reading: { value: 5 } }] }),
    JSON.stringify({ metrics: [observation, observation] }),
    JSON.stringify({ metrics: [{ ...observation, reading: { ...observation.reading!, at: '2999-01-01T00:00:00Z' } }] }),
    JSON.stringify({ metrics: [observation], token: 'must not enter the model context' }), ' '.repeat(65_537)]
  for (const content of cases) {
    fs.writeFileSync(file, content)
    const result = readProjectObservations(dir)
    assert.deepEqual(result.metrics, [])
    assert.match(result.warning!, /unavailable/)
  }
  const outside = path.join(root(), 'aggregate.json')
  fs.writeFileSync(outside, JSON.stringify({ metrics: [observation] }))
  fs.unlinkSync(file); fs.symlinkSync(outside, file)
  assert.match(readProjectObservations(dir).warning!, /unavailable/)
})

test('project details remain navigable, editable and serializable without adding architecture actors', () => {
  const map: RepoMap = { title: 'How does work reach a Mac?', audience: 'Offstage operators', scope: 'Source audit incomplete; verify operational claims.', owner: 'Unassigned',
    nodes: [{ id: 'fleet', label: 'Fleet runner', group: 'mac' }], edges: [], groups: [{ id: 'mac', label: 'Mac', description: 'Fleet host' }],
    facts: [{ title: 'Default budget, not a live count', text: 'The default is 28 slot logins per boot; configuration may override it.', source: 'src/fleet/login-budget.ts' }], metrics: [metric, { ...observation, id: 'observed-slot-logins' }] }
  const result = drawMap(cleanMap(map), { x: 0, y: 0 })
  assert.equal(result.nodeShapes.size, 1)
  assert.equal(result.edges.length, 0)
  const saved = result.shapes.map(s => shapeSchema.parse(JSON.parse(JSON.stringify(s))))
  assert.deepEqual([...new Set(saved.map(s => s.mapView?.title))], [map.title, 'Project facts', 'Project activity'])
  const text = saved.filter(s => s.type === 'text').map(s => s.text).join('\n').replace(/\n/g, ' ')
  assert.match(text, /Not measured/)
  assert.match(text, /0 logins/)
  assert.match(text, /2026-11-05T00:00:00Z/)
  assert.match(text, /test fixture Mac/)
  assert.match(text, /default is 28/)
  const factPage = saved.flatMap(s => s.type === 'text' && s.mapView?.title === 'Project facts' ? [s.text] : []).join(' ').replace(/\n/g, ' ')
  assert.match(factPage, /Source audit incomplete/)
  // Agents using the legacy nodes/edges-only map still get an activity view.
  const legacy = drawMap(cleanMap({ nodes: map.nodes, edges: [], metrics: [metric] }), { x: 0, y: 0 })
  assert.deepEqual([...new Set(legacy.shapes.map(s => s.mapView?.title))], ['Architecture', 'Project activity'])
  // Malformed optional sections from external callers cannot break rendering.
  const invalid = cleanMap({ ...map, facts: {}, metrics: {} } as unknown as RepoMap)
  assert.deepEqual(invalid.facts, [])
  assert.deepEqual(invalid.metrics, [])
  assert.doesNotThrow(() => drawMap(invalid, { x: 0, y: 0 }))
})
