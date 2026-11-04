import { test } from 'node:test'
import assert from 'node:assert/strict'
import { avoidMapCaptions, crossesMapRect } from '../src/core/map-routing.js'

test('caption intersections distinguish crossing from touching an edge', () => {
  const rect = { x: 40, y: 40, w: 20, h: 20 }
  assert.equal(crossesMapRect({ x: 0, y: 50 }, { x: 100, y: 50 }, rect), true)
  assert.equal(crossesMapRect({ x: 0, y: 40 }, { x: 100, y: 40 }, rect), false)
  assert.equal(crossesMapRect({ x: 0, y: 0 }, { x: 39, y: 39 }, rect), false)
})

test('caption detours preserve endpoints and avoid adjacent actor ink', () => {
  const start = { x: 0, y: 50 }, end = { x: 100, y: 50 }
  const caption = { x: 40, y: 40, w: 20, h: 20 }
  const actor = { x: 30, y: 0, w: 40, h: 35 }
  const obstacles = [caption, actor]
  const result = avoidMapCaptions([start, end], [caption], obstacles)
  assert.deepEqual(result[0], start)
  assert.deepEqual(result.at(-1), end)
  assert.ok(result.length > 2)
  for (let i = 1; i < result.length; i++) {
    for (const rect of obstacles) assert.equal(crossesMapRect(result[i - 1], result[i], rect), false)
  }
  assert.deepEqual(avoidMapCaptions([start, end], [], []), [start, end])
})
