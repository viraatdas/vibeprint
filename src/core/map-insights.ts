import crypto from 'node:crypto'
import { docBounds, TEXT_LINE, type Shape, type TextShape } from '../shared/canvas.js'
import { metricValue } from '../shared/project-metrics.js'
import type { RepoMap } from '../shared/types.js'

/** Ordinary, editable text keeps project facts and activity in PNG and canvas exports too. */
export function appendInsightViews<T extends { shapes: Shape[] }>(map: RepoMap, origin: { x: number; y: number }, result: T, wrap: (s: string, w: number, size: number) => string): T {
  const sections = [
    { title: 'Project facts', cards: (map.facts || []).map(f => ({ title: f.title, text: f.text, source: f.source })) },
    { title: 'Project activity', cards: (map.metrics || []).map(m => ({ title: `${m.label}: ${metricValue(m)}`, text: [m.definition,
      m.reading ? `Recorded ${m.reading.at} · ${m.reading.scope} · ${m.reading.window}. Snapshot, not a live counter.` : 'No runtime observation supplied. This is not a zero count.',
    ].join('\n'), source: m.reading ? `Definition: ${m.source}\nObservation: ${m.reading.source}` : m.source })) },
  ]
  if (!sections.some(s => s.cards.length)) return result
  // Older/small diagrams gain a bookmark so their new insight views are navigable as well.
  if (!result.shapes.some(s => s.mapView) && result.shapes.length) {
    const bookmark = { id: result.shapes[0].id, title: map.title || 'Architecture' }
    for (const shape of result.shapes) shape.mapView = bookmark
  }
  let right = docBounds(new Map(result.shapes.map(s => [s.id, s])))!
  for (const section of sections) {
    if (!section.cards.length) continue
    // Keep each page readable at iPad size rather than shrinking a long report.
    for (let offset = 0; offset < section.cards.length; offset += 4) {
      const shapes: Shape[] = []
      const x = right.x + right.w + 1800, y = origin.y
      const text = (body: string, tx: number, ty: number, width: number, size: number) => {
        const value = wrap(body, width, size)
        const shape: TextShape = { id: `shape:insight${crypto.randomBytes(8).toString('hex')}`, type: 'text', author: 'agent', font: 'sans', z: result.shapes.length + shapes.length + 1,
          x: x + tx, y: y + ty, w: width, h: value.split('\n').length * size * TEXT_LINE, size, text: value }
        shapes.push(shape); return shape
      }
      const title = section.title + (section.cards.length > 4 ? ` ${Math.floor(offset / 4) + 1}` : '')
      text(title, 0, 0, 1500, 34)
      const sub = text([map.scope || 'Source-linked product details.', 'Runtime numbers require an explicit, dated observation.'].join('\n'), 0, 58, 1500, 23)
      let cursor = 58 + sub.h + 32
      const cards = section.cards.slice(offset, offset + 4)
      for (let row = 0; row < cards.length; row += 2) {
        let height = 0
        for (const [col, card] of cards.slice(row, row + 2).entries()) {
          const tx = col * 775, heading = text(card.title, tx, cursor, 725, 28)
          const body = text(card.text, tx, cursor + heading.h + 10, 725, 24)
          const source = text(`Source: ${card.source}`, tx, cursor + heading.h + body.h + 22, 725, 20)
          height = Math.max(height, heading.h + body.h + source.h + 46)
        }
        cursor += height + 24
      }
      const id = shapes[0].id
      for (const shape of shapes) shape.mapView = { id, title }
      result.shapes.push(...shapes)
      right = docBounds(new Map(shapes.map(s => [s.id, s])))!
    }
  }
  return result
}
