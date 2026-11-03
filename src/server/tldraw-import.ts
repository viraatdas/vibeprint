// Reads a canvas.json written by vibeprint 0.1/0.2 (a tldraw store snapshot) into
// Vibeprint's own shapes, keeping every shape id so graph bindings survive. Plain JSON
// reading; no tldraw code is involved.
import type { ArrowEnd, InkPoint, Shape } from '../shared/canvas.js'
import { TEXT_LINE } from '../shared/canvas.js'

type Rec = Record<string, any>
type Affine = [number, number, number, number, number, number] // a b c d e f

const identity: Affine = [1, 0, 0, 1, 0, 0]
const mul = (m: Affine, n: Affine): Affine => [
  m[0] * n[0] + m[2] * n[1],
  m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3],
  m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4],
  m[1] * n[4] + m[3] * n[5] + m[5],
]
const apply = (m: Affine, x: number, y: number) => ({ x: m[0] * x + m[2] * y + m[4], y: m[1] * x + m[3] * y + m[5] })
const local = (r: Rec): Affine => {
  const c = Math.cos(r.rotation ?? 0)
  const s = Math.sin(r.rotation ?? 0)
  return [c, s, -s, c, r.x ?? 0, r.y ?? 0]
}

function half(bits: number): number {
  const sign = bits & 0x8000 ? -1 : 1
  const exp = (bits >> 10) & 0x1f
  const frac = bits & 0x3ff
  if (exp === 0) return sign * 2 ** -14 * (frac / 1024)
  if (exp === 31) return frac ? NaN : sign * Infinity
  return sign * 2 ** (exp - 15) * (1 + frac / 1024)
}

/**
 * tldraw 5 packs a stroke as base64: the first point as float32s, then float16 deltas.
 * Three numbers per point (x, y, pressure), or two when the segment says dim: 2.
 */
export function decodeTldrawPath(b64: string, dim = 3): Array<{ x: number; y: number; z: number }> {
  const buf = Buffer.from(b64, 'base64')
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength)
  const out: Array<{ x: number; y: number; z: number }> = []
  if (buf.length < dim * 4) return out
  let x = dv.getFloat32(0, true)
  let y = dv.getFloat32(4, true)
  let z = dim === 3 ? dv.getFloat32(8, true) : 0.5
  out.push({ x, y, z })
  const step = dim * 2
  for (let o = dim * 4; o + step <= buf.length; o += step) {
    x += half(dv.getUint16(o, true))
    y += half(dv.getUint16(o + 2, true))
    if (dim === 3) z += half(dv.getUint16(o + 4, true))
    out.push({ x, y, z })
  }
  return out
}

function richTextPlain(rt: Rec | undefined): string {
  if (!rt) return ''
  const walk = (n: Rec): string => (n.type === 'hardBreak' ? '\n' : typeof n.text === 'string' ? n.text : (n.content ?? []).map(walk).join(''))
  return (rt.content ?? []).map(walk).join('\n').trim()
}

const FONT_SIZES: Record<string, number> = { s: 18, m: 24, l: 36, xl: 44 }
const r2 = (n: number) => Math.round(n * 100) / 100

function densify(corners: Array<{ x: number; y: number }>, per = 8): Array<{ x: number; y: number }> {
  const out: Array<{ x: number; y: number }> = []
  for (let i = 1; i < corners.length; i++) {
    const a = corners[i - 1]
    const b = corners[i]
    for (let k = 0; k < per; k++) out.push({ x: a.x + ((b.x - a.x) * k) / per, y: a.y + ((b.y - a.y) * k) / per })
  }
  out.push(corners[corners.length - 1])
  return out
}

function geoOutline(geo: string, w: number, h: number): Array<{ x: number; y: number }> {
  if (geo === 'ellipse' || geo === 'oval' || geo === 'cloud') {
    return Array.from({ length: 41 }, (_, i) => {
      const t = (i / 40) * Math.PI * 2
      return { x: w / 2 + (w / 2) * Math.cos(t), y: h / 2 + (h / 2) * Math.sin(t) }
    })
  }
  if (geo === 'diamond' || geo === 'rhombus') return densify([{ x: w / 2, y: 0 }, { x: w, y: h / 2 }, { x: w / 2, y: h }, { x: 0, y: h / 2 }, { x: w / 2, y: 0 }])
  if (geo === 'triangle') return densify([{ x: w / 2, y: 0 }, { x: w, y: h }, { x: 0, y: h }, { x: w / 2, y: 0 }])
  return densify([{ x: 0, y: 0 }, { x: w, y: 0 }, { x: w, y: h }, { x: 0, y: h }, { x: 0, y: 0 }])
}

/** Convert tldraw store records to Vibeprint shapes. Unknown shape types are dropped. */
export function importTldraw(records: Rec[]): Shape[] {
  const byId = new Map<string, Rec>(records.map((r) => [r.id, r]))
  const transforms = new Map<string, Affine>()
  const pageTransform = (r: Rec): Affine => {
    const hit = transforms.get(r.id)
    if (hit) return hit
    const parent = byId.get(r.parentId)
    const m = parent?.typeName === 'shape' ? mul(pageTransform(parent), local(r)) : local(r)
    transforms.set(r.id, m)
    return m
  }
  const shapes = records.filter((r) => r.typeName === 'shape').sort((a, b) => (a.index < b.index ? -1 : a.index > b.index ? 1 : 0))
  const bindings = records.filter((r) => r.typeName === 'binding' && r.type === 'arrow')
  const out: Shape[] = []
  let z = 0
  const ink = (m: Affine, pts: Array<{ x: number; y: number; z?: number }>, sx = 1, sy = sx): InkPoint[] =>
    pts.map((p) => {
      const q = apply(m, p.x * sx, p.y * sy)
      return [r2(q.x), r2(q.y), r2(p.z ?? 0.5)]
    })
  const text = (id: string, x: number, y: number, body: string, size: number, w?: number) => {
    const lines = body.split('\n')
    const width = w ?? Math.max(...lines.map((l) => l.length)) * size * 0.55
    out.push({ id, z: z++, type: 'text', x: r2(x), y: r2(y), w: r2(width), h: r2(lines.length * size * TEXT_LINE), text: body, size })
  }

  for (const r of shapes) {
    const p = r.props ?? {}
    const m = pageTransform(r)
    const scale = p.scale ?? 1
    switch (r.type) {
      case 'draw':
      case 'highlight': {
        const pts = (p.segments ?? []).flatMap((s: Rec) => (typeof s.path === 'string' ? decodeTldrawPath(s.path, s.dim ?? 3) : Array.isArray(s.points) ? s.points : []))
        if (!pts.length) break
        out.push({ id: r.id, z: z++, type: 'draw', points: ink(m, pts, scale * (p.scaleX ?? 1), scale * (p.scaleY ?? 1)), ...(p.isPen ? { pen: true } : {}), ...(p.isClosed ? { closed: true } : {}) })
        break
      }
      case 'line': {
        const pts = Object.values(p.points ?? {}).sort((a: any, b: any) => (a.index < b.index ? -1 : 1)) as Array<{ x: number; y: number }>
        if (pts.length) out.push({ id: r.id, z: z++, type: 'draw', points: ink(m, densify(pts, 6), scale) })
        break
      }
      case 'geo':
      case 'note':
      case 'frame': {
        const w = (r.type === 'note' ? 200 : p.w ?? 100) * scale
        const h = (r.type === 'note' ? 200 + (p.growY ?? 0) : (p.h ?? 100) + (p.growY ?? 0)) * scale
        out.push({ id: r.id, z: z++, type: 'draw', points: ink(m, geoOutline(r.type === 'geo' ? p.geo : 'rectangle', w, h)), closed: true })
        const label = r.type === 'frame' ? String(p.name ?? '').trim() : richTextPlain(p.richText)
        if (label) {
          const size = (FONT_SIZES[p.size] ?? 24) * scale
          const lines = label.split('\n')
          const lw = Math.max(...lines.map((l) => l.length)) * size * 0.55
          const at = r.type === 'frame' ? apply(m, 0, -size * TEXT_LINE - 6) : apply(m, w / 2 - lw / 2, h / 2 - (lines.length * size * TEXT_LINE) / 2)
          text(`${r.id}-label`, at.x, at.y, label, size, lw)
        }
        break
      }
      case 'text': {
        const body = richTextPlain(p.richText) || String(p.text ?? '').trim()
        if (!body) break
        const at = apply(m, 0, 0)
        text(r.id, at.x, at.y, body, (FONT_SIZES[p.size] ?? 24) * scale, p.w ? p.w * scale : undefined)
        break
      }
      case 'arrow': {
        const endOf = (terminal: 'start' | 'end'): ArrowEnd => {
          const free = apply(m, p[terminal]?.x ?? 0, p[terminal]?.y ?? 0)
          const b = bindings.find((x) => x.fromId === r.id && x.props?.terminal === terminal)
          const target = b && byId.get(b.toId)
          if (!target) return { x: r2(free.x), y: r2(free.y) }
          const a = b.props?.normalizedAnchor ?? { x: 0.5, y: 0.5 }
          return { x: r2(free.x), y: r2(free.y), id: b.toId, nx: r2(a.x), ny: r2(a.y) }
        }
        const label = richTextPlain(p.richText) || String(p.text ?? '').trim()
        out.push({ id: r.id, z: z++, type: 'arrow', start: endOf('start'), end: endOf('end'), ...(label ? { text: label } : {}) })
        break
      }
      case 'image': {
        const asset = byId.get(p.assetId)
        const src = asset?.props?.src
        if (typeof src !== 'string' || !/^\/files\/[\w.-]{1,128}$/.test(src)) break
        const at = apply(m, 0, 0)
        out.push({ id: r.id, z: z++, type: 'image', x: r2(at.x), y: r2(at.y), w: r2(p.w ?? 100), h: r2(p.h ?? 100), src })
        break
      }
    }
  }
  return out
}
