import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { mapCode } from '../src/core/map.js'
import { VibeprintCore } from '../src/core/core.js'
import { wrapMapText } from '../src/core/map-presentation.js'
import { mapTextWidth, MAP_FLOW_SIZE, MAP_FLOW_LINE } from '../src/shared/map-font.js'
import type { Rect } from '../src/shared/types.js'
import { drawPresentedMap } from '../src/core/map-presentation.js'
import { arrowRoute, distToShape, shapeBounds, type ArrowShape } from '../src/shared/canvas.js'
import { shapeSchema } from '../src/server/canvas.js'

test('bundled map font wraps punctuation, wide glyphs and long source paths without overflow', () => {
  for (const value of ['NEEDS_LOGIN Every 30s', 'WWWMMM', 'src/interpret/long-filename-that-must-wrap.ts', '127.0.0.1 → cookie']) {
    for (const line of wrapMapText(value, 135, 21).split('\n')) assert.ok(mapTextWidth(line, 21) <= 135)
  }
})

test('routed arrow bends and line semantics survive validation, bounds and hit testing', () => {
  const arrow: ArrowShape = { id: 'shape:route', z: 1, type: 'arrow', author: 'agent', font: 'sans', start: { x: 0, y: 0 }, end: { x: 300, y: 0 }, route: [{ x: 0, y: 200 }, { x: 300, y: 200 }], mode: 'async', labelAt: { x: 150, y: 200 }, text: 'work queued' }
  assert.deepEqual(shapeSchema.parse(JSON.parse(JSON.stringify(arrow))), arrow)
  const doc = new Map([[arrow.id, arrow]])
  assert.deepEqual(shapeBounds(arrow, doc), { x: 0, y: 0, w: 300, h: 200 })
  assert.equal(distToShape({ x: 150, y: 200 }, arrow, doc), 0)
  assert.equal(distToShape({ x: 150, y: 0 }, arrow, doc), 150)
  assert.equal(arrowRoute(arrow, doc).length, 4)
})

for (const project of ['threadline', 'crumb', 'vibeprint']) {
  test(`${project}: crowded real map retains every unit and flow with visible labels`, () => {
    const map = JSON.parse(fs.readFileSync(new URL(`../evaluations/2026-11-04/${project}/round-2/map.json`, import.meta.url), 'utf8'))
    const result = drawPresentedMap(map, { x: 100, y: 200 })
    assert.equal(result.nodeShapes.size, map.nodes.length)
    assert.equal(result.edges.length, map.edges.length)
    for (const shape of result.shapes) assert.ok(shapeSchema.safeParse(shape).success, shape.id)
    const arrows = result.shapes.filter((s): s is ArrowShape => s.type === 'arrow')
    assert.ok(arrows.every(a => a.text && a.labelAt && a.route?.length && a.mode))
    for (const s of result.shapes.filter(s => s.type === 'text')) {
      if (s.type !== 'text') continue
      for (const line of s.text.split('\n')) assert.ok(mapTextWidth(line, s.size ?? 28) <= s.w + 1, line)
    }
    const bounds = new Map([...result.nodeShapes].map(([node, ids]) => [node, shapeBounds(result.shapes.find(s => s.id === ids[0])!, new Map(result.shapes.map(s => [s.id, s])))]))
    for (const arrow of arrows) {
      const edge = result.edges.find(e => e.shapeId === arrow.id)!
      const lines = arrow.text!.split('\n'), w = Math.max(...lines.map(l => mapTextWidth(l, MAP_FLOW_SIZE))), h = lines.length * MAP_FLOW_LINE
      const label: Rect = { x: arrow.labelAt!.x - w / 2, y: arrow.labelAt!.y - h / 2, w, h }
      for (const [node, r] of bounds) {
        assert.ok(!(label.x < r.x + r.w && r.x < label.x + label.w && label.y < r.y + r.h && r.y < label.y + label.h), `label overlaps ${node}`)
      }
      assert.ok(arrow.text!.replace(/\s/g, '').includes(edge.label!.replace(/\s/g, '')), 'every flow keeps its concrete payload inline')
    }
    for (const s of result.shapes.filter(s => s.type === 'draw')) {
      if (s.type !== 'draw') continue
      assert.ok(s.points.length > 30, 'rectangle outlines must be sampled for perfect-freehand')
    }
  })
}

// The legacy quick-map sanitizer used to silently discard this periodic trigger.
test('real periodic autosave map retains its self-loop through the complete map pipeline', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vp-timer-map-'))
  try {
    const map = JSON.parse(fs.readFileSync(new URL('../evaluations/2026-11-04/crumb/round-10/map.json', import.meta.url), 'utf8'))
    const result = mapCode(new VibeprintCore(root), [], map, 'claude')
    const arrows = result.put.filter(s => s.type === 'arrow')
    assert.equal(arrows.length, map.edges.length)
    const loop = arrows.find(s => s.type === 'arrow' && s.start.id === s.end.id && s.text?.includes('timer'))!
    assert.ok(loop)
    const doc = new Map(result.put.map(s => [s.id, s]))
    const route = arrowRoute(loop, doc)
    assert.equal(route.length, 4, 'self-loop is a U, never a folded Dagre triangle')
    assert.ok(Math.hypot(route[0].x - route.at(-1)!.x, route[0].y - route.at(-1)!.y) > 30, 'ports are distinct so the arrowhead is visible')
    const frame = result.put.filter(s => s.type === 'draw').map(s => shapeBounds(s, doc)).find(r => route.every(p => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h))
    assert.ok(frame, 'every self-loop segment stays inside its host frame')
  } finally { fs.rmSync(root, { recursive: true, force: true }) }
})
