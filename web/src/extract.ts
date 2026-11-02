import {
  getArrowBindings,
  getArrowInfo,
  renderPlaintextFromRichText,
  type Editor,
  type TLArrowShape,
  type TLShape,
} from 'tldraw'
import type { Point, Rect, SketchShape, SketchShapeType } from '@shared/types'

const KNOWN: SketchShapeType[] = ['draw', 'geo', 'text', 'arrow', 'line', 'note', 'frame', 'highlight', 'image']
const r1 = (n: number) => Math.round(n * 10) / 10

function richText(editor: Editor, shape: TLShape): string | undefined {
  const props = shape.props as { richText?: unknown; name?: string; text?: string }
  if (props.richText) {
    try {
      const t = renderPlaintextFromRichText(editor, props.richText as never).trim()
      return t || undefined
    } catch {
      return undefined
    }
  }
  if (typeof props.text === 'string' && props.text.trim()) return props.text.trim()
  if (shape.type === 'frame' && props.name?.trim()) return props.name.trim()
  return undefined
}

/** Reduce a polyline to at most `max` points, keeping the ends. */
function decimate(points: Point[], max = 48): Point[] {
  if (points.length <= max) return points
  const out: Point[] = []
  const step = (points.length - 1) / (max - 1)
  for (let i = 0; i < max; i++) out.push(points[Math.round(i * step)])
  return out
}

function pageRect(editor: Editor, shape: TLShape): Rect | null {
  const b = editor.getShapePageBounds(shape)
  return b ? { x: r1(b.x), y: r1(b.y), w: r1(b.w), h: r1(b.h) } : null
}

/** Flatten the user's ink on the current page into what the interpreter reads. */
export function extractSketch(editor: Editor): SketchShape[] {
  const out: SketchShape[] = []
  for (const shape of editor.getCurrentPageShapesSorted()) {
    const bounds = pageRect(editor, shape)
    if (!bounds) continue
    const type: SketchShapeType = (KNOWN as string[]).includes(shape.type) ? (shape.type as SketchShapeType) : 'other'
    const s: SketchShape = { id: shape.id, type, bounds }
    const text = richText(editor, shape)
    if (text) s.text = text
    if (shape.type === 'geo') s.geo = (shape.props as { geo: string }).geo
    const parent = editor.getShape(shape.parentId as never)
    if (parent?.type === 'frame') s.parentId = parent.id

    if (shape.type === 'draw' || shape.type === 'line' || shape.type === 'highlight') {
      const tf = editor.getShapePageTransform(shape)
      const geom = editor.getShapeGeometry(shape)
      const pts = geom.vertices.map((v) => tf.applyToPoint(v)).map((p) => ({ x: r1(p.x), y: r1(p.y) }))
      if (pts.length) {
        s.points = decimate(pts)
        const first = pts[0]
        const last = pts[pts.length - 1]
        const diag = Math.hypot(bounds.w, bounds.h)
        const isClosedProp = (shape.props as { isClosed?: boolean }).isClosed
        s.closed = !!isClosedProp || (pts.length > 4 && diag > 30 && Math.hypot(first.x - last.x, first.y - last.y) < diag * 0.15)
      }
    }

    if (shape.type === 'arrow') {
      const arrow = shape as TLArrowShape
      const info = getArrowInfo(editor, arrow)
      const bindings = getArrowBindings(editor, arrow)
      const tf = editor.getShapePageTransform(arrow)
      if (info) {
        const a = tf.applyToPoint(info.start.point)
        const b = tf.applyToPoint(info.end.point)
        s.arrow = {
          start: { x: r1(a.x), y: r1(a.y) },
          end: { x: r1(b.x), y: r1(b.y) },
          ...(bindings.start ? { startShapeId: bindings.start.toId } : {}),
          ...(bindings.end ? { endShapeId: bindings.end.toId } : {}),
        }
      }
    }
    out.push(s)
  }
  return out
}

async function blobToBase64(blob: Blob): Promise<string> {
  const buf = new Uint8Array(await blob.arrayBuffer())
  let bin = ''
  for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000))
  return btoa(bin)
}

/** PNG of the whole sketch, capped so the long side stays near 1600px. */
export async function exportSketchPng(editor: Editor): Promise<string | undefined> {
  const ids = [...editor.getCurrentPageShapeIds()]
  if (!ids.length) return undefined
  const bounds = editor.getCurrentPageBounds()
  const longSide = bounds ? Math.max(bounds.w, bounds.h) : 1000
  const scale = Math.max(0.25, Math.min(2, 1600 / Math.max(1, longSide)))
  const { blob } = await editor.toImage(ids, { format: 'png', background: true, padding: 32, scale, pixelRatio: 1, darkMode: false })
  return blobToBase64(blob)
}
