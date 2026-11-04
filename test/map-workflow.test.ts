import { test } from 'node:test'
import assert from 'node:assert/strict'
import { drawWorkflow } from '../src/core/map-workflow.js'
import { wrapMapText } from '../src/core/map-presentation.js'
import { arrowRoute, shapeBounds } from '../src/shared/canvas.js'
import { shapeSchema } from '../src/server/canvas.js'
import type { RepoMap } from '../src/shared/types.js'

test('workflow rows preserve edge identity, order stages and reserve actual label height', () => {
  const map: RepoMap = {
    title: 'How does a worker process a request?',
    groups: [{ id: 'runtime', label: 'Runtime', description: 'Local processes' }],
    nodes: ['client', 'worker', 'store'].map(id => ({ id, label: id, description: 'A meaningful responsibility that wraps within the actor header', group: 'runtime' })),
    edges: [
      { from: 'worker', to: 'store', label: 'A2 persist the complete request and its processing result', mode: 'local' },
      { from: 'client', to: 'worker', label: 'A1 submit request with caller identity and idempotency key', mode: 'sync' },
      { from: 'worker', to: 'client', label: 'Independently initiated completion event', mode: 'async' },
    ],
  }
  const result = drawWorkflow(map, { x: 170, y: 230 }, wrapMapText)
  const doc = new Map(result.shapes.map(s => [s.id, s]))
  const y: number[] = []
  for (const [index, edge] of result.edges.entries()) {
    assert.equal(edge.label, map.edges[index].label, 'sorting visual rows must not change architecture edge identity')
    const arrow = doc.get(edge.shapeId)!
    assert.equal(arrow.type, 'arrow')
    if (arrow.type !== 'arrow') continue
    const route = arrowRoute(arrow, doc)
    y.push(route[0].y)
    assert.ok(result.nodeShapes.get(edge.from)!.includes(arrow.start.id!))
    assert.ok(result.nodeShapes.get(edge.to)!.includes(arrow.end.id!))
    const label = result.shapes.find(s => s.type === 'text' && s.text.replace(/\s+/g, ' ') === `${edge.label} (${edge.mode})`)
    assert.ok(label?.type === 'text')
    if (label.type !== 'text') continue
    assert.ok(label.y + label.h <= route[0].y - 7)
    for (const ids of result.nodeShapes.values()) {
      const actor = shapeBounds(doc.get(ids[0])!, doc)
      assert.ok(label.y > actor.y + actor.h, 'first label stays below every actor header')
    }
  }
  assert.ok(y[1] < y[0] && y[0] < y[2], 'explicit A1 precedes A2; independent call follows')
  for (const shape of result.shapes) assert.ok(shapeSchema.safeParse(shape).success)
  for (const ids of result.nodeShapes.values()) {
    const actor = shapeBounds(doc.get(ids[0])!, doc)
    for (const id of ids) {
      const text = doc.get(id)!
      if (text.type === 'text') assert.ok(text.y + text.h <= actor.y + actor.h, 'roles fit inside their actor')
    }
  }
})

test('shared stages follow the active workflow and self calls keep their loop', () => {
  const map: RepoMap = {
    title: 'How does an agent execute?',
    groups: [{ id: 'runtime', label: 'Runtime', description: 'Local processes' }],
    nodes: ['runner', 'slot'].map(id => ({ id, label: id, group: 'runtime' })),
    edges: [
      { from: 'runner', to: 'slot', label: 'B5/C6 reset' },
      { from: 'runner', to: 'slot', label: 'B3/C3 execute' },
      { from: 'runner', to: 'slot', label: 'C2 receive op' },
      { from: 'slot', to: 'slot', label: 'C4 local timer', mode: 'local' },
    ],
  }
  const result = drawWorkflow(map, { x: 0, y: 0 }, wrapMapText)
  const doc = new Map(result.shapes.map(s => [s.id, s]))
  const routes = result.edges.map(e => {
    const s = doc.get(e.shapeId)!
    assert.equal(s.type, 'arrow')
    return s.type === 'arrow' ? arrowRoute(s, doc) : []
  })
  assert.ok(routes[2][0].y < routes[1][0].y && routes[1][0].y < routes[3][0].y && routes[3][0].y < routes[0][0].y)
  assert.equal(routes[3].length, 4)
  assert.ok(routes[3][1].x > routes[3][0].x)
  assert.ok(routes[3].at(-1)!.y > routes[3][0].y)
})
