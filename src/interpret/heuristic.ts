// Offline, deterministic interpreter. It reads the geometry of the sketch
// (boxes, arrows, strokes, typed text) and never tries to read handwriting.
// Used when no Claude API key is configured, and as a fallback.

import { dist, distToRect, jaccard, rectArea, rectCenter, rectContainsPoint, rectContainsRect, strokeIsClosed } from '../shared/geometry.js'
import type { GraphNode, InterpretInput, InterpretationResult, OpenQuestion, Point, Rect, SketchShape } from '../shared/types.js'

// ---------------------------------------------------------------------------
// Tunables (page-space pixels)
// ---------------------------------------------------------------------------

/** A draw stroke is closed when its ends are this close, relative to its bbox diagonal. */
const CLOSE_RATIO = 0.15
/** Smallest closed stroke that counts as a container (long side x short side). */
const MIN_CONTAINER_LONG = 40
const MIN_CONTAINER_SHORT = 30
/** Closed strokes smaller than this that sit inside another container are handwriting ("o", "D"). */
const SMALL_CLOSED_MAX = 60
/** How far an arrow/line endpoint may be from a component and still attach to it. */
const ENDPOINT_SNAP = 60
/** Shortest stroke (end to end) that can be a connector. */
const MIN_CONNECTOR_LEN = 24
/** Typed text this close to an open question note is an answer. */
const ANSWER_RADIUS = 150
/** Hand-drawn arrowheads: small strokes near a connector's end. */
const ARROWHEAD_MAX = 50
const ARROWHEAD_SNAP = 20
const ARROWHEAD_TOUCH = 6
/** Free text this close to a connector's path labels it. */
const EDGE_LABEL_SNAP = 20
/** A stroke is inside a container when its center is inside and this much of it overlaps. */
const INSIDE_OVERLAP = 0.7
const CONTAIN_PAD = 4

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Comp {
  /** The outline (container) or the text shape (text-only component). */
  primary: SketchShape
  bounds: Rect
  isContainer: boolean
  /** Typed text carried by the primary shape itself (geo/note label, frame name, text shape). */
  ownText?: string
  /** Typed text shapes that sit inside this container. */
  texts: string[]
  shapeIds: string[]
  hasChildren: boolean
}

interface EdgeDraft {
  from: Comp
  to: Comp
  label?: string
  shapeIds: string[]
  /** Path for hand-drawn connectors and arrows; used for arrowheads and free-text labels. */
  path: Point[]
  handDrawn: boolean
  headAtStart: boolean
  headAtEnd: boolean
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export function interpretHeuristic(input: InterpretInput): InterpretationResult {
  const shapes = readingOrder(input.sketch.shapes.filter((s) => validRect(s.bounds)))

  // 1. Containers -----------------------------------------------------------
  const candidates = shapes.filter(isContainerShape)
  const containerShapes = candidates.filter(
    (s) =>
      !(
        s.type === 'draw' &&
        Math.max(s.bounds.w, s.bounds.h) < SMALL_CLOSED_MAX &&
        candidates.some((o) => o !== s && rectArea(o.bounds) > rectArea(s.bounds) && rectContainsRect(o.bounds, s.bounds, CONTAIN_PAD))
      ),
  )
  const comps: Comp[] = containerShapes.map((s) => ({
    primary: s,
    bounds: s.bounds,
    isContainer: true,
    ownText: cleanText(s.text),
    texts: [],
    shapeIds: [s.id],
    hasChildren: false,
  }))
  for (const c of comps) {
    c.hasChildren = comps.some((o) => o !== c && rectArea(o.bounds) < rectArea(c.bounds) && rectContainsRect(c.bounds, o.bounds, CONTAIN_PAD))
  }
  const owner = new Map<string, Comp>()
  for (const c of comps) owner.set(c.primary.id, c)

  const containers = () => comps.filter((c) => c.isContainer)
  const smallestContainerAt = (p: Point) => smallest(containers().filter((c) => rectContainsPoint(c.bounds, p)))
  const smallestContainerAround = (r: Rect) => smallest(containers().filter((c) => isInside(r, c.bounds)))

  // 2. Typed text -------------------------------------------------------------
  const answers = new Map<string, string[]>()
  for (const s of shapes) {
    if (s.type !== 'text') continue
    const text = cleanText(s.text)
    if (!text) continue
    const c = smallestContainerAt(rectCenter(s.bounds))
    if (c) {
      c.texts.push(text)
      c.shapeIds.push(s.id)
      owner.set(s.id, c)
      continue
    }
    const q = nearestQuestion(s.bounds, input.openQuestions)
    if (q) {
      const list = answers.get(q.markId) ?? []
      list.push(text)
      answers.set(q.markId, list)
      continue
    }
    const comp: Comp = { primary: s, bounds: s.bounds, isContainer: false, ownText: text, texts: [], shapeIds: [s.id], hasChildren: false }
    comps.push(comp)
    owner.set(s.id, comp)
  }

  // Resolve a free endpoint to the component it points at.
  const resolveEnd = (p: Point, exclude: Set<Comp>): Comp | undefined => {
    let best: Comp | undefined
    let bestD = Infinity
    let bestA = Infinity
    for (const c of comps) {
      if (exclude.has(c)) continue
      const d = endDistance(p, c)
      if (d > ENDPOINT_SNAP) continue
      const a = rectArea(c.bounds)
      if (d < bestD - 0.5 || (Math.abs(d - bestD) <= 0.5 && a < bestA)) {
        best = c
        bestD = d
        bestA = a
      }
    }
    return best
  }
  // Components that fully contain a connector (a frame around both ends) can't be its endpoint.
  const enclosing = (r: Rect) => new Set(comps.filter((c) => c.isContainer && rectContainsRect(c.bounds, r, CONTAIN_PAD)))

  const edges: EdgeDraft[] = []
  const used = new Set<string>(owner.keys())

  // 3. Hand-drawn connectors (open draw strokes and line shapes) --------------
  for (const s of shapes) {
    if ((s.type !== 'draw' && s.type !== 'line') || used.has(s.id)) continue
    const around = smallestContainerAround(s.bounds)
    if (around && !around.hasChildren) continue // a stroke inside a plain box is handwriting
    const ends = connectorEnds(s)
    if (!ends) continue
    const exclude = enclosing(s.bounds)
    const from = resolveEnd(ends.start, exclude)
    const to = resolveEnd(ends.end, exclude)
    if (!from || !to || from === to) continue
    edges.push({ from, to, shapeIds: [s.id], path: ends.path, handDrawn: true, headAtStart: false, headAtEnd: false })
    used.add(s.id)
  }

  // 4. Hand-drawn arrowheads ----------------------------------------------------
  for (const s of shapes) {
    if (s.type !== 'draw' || used.has(s.id)) continue
    if (Math.max(s.bounds.w, s.bounds.h) > ARROWHEAD_MAX) continue
    let best: { edge: EdgeDraft; atEnd: boolean; d: number } | undefined
    for (const e of edges) {
      if (!e.handDrawn) continue
      const dStart = distToRect(e.path[0], s.bounds)
      const dEnd = distToRect(e.path[e.path.length - 1], s.bounds)
      const atEnd = dEnd <= dStart
      const d = Math.min(dStart, dEnd)
      if (!best || d < best.d) best = { edge: e, atEnd, d }
    }
    if (!best || best.d > ARROWHEAD_SNAP) continue
    const around = smallestContainerAround(s.bounds)
    if (best.d > ARROWHEAD_TOUCH && around && !around.hasChildren) continue // likely handwriting inside the box
    best.edge.shapeIds.push(s.id)
    if (best.atEnd) best.edge.headAtEnd = true
    else best.edge.headAtStart = true
    used.add(s.id)
  }
  // A head drawn only at the start means the stroke was drawn from target to source.
  for (const e of edges) {
    if (e.headAtStart && !e.headAtEnd) {
      ;[e.from, e.to] = [e.to, e.from]
      e.path = [...e.path].reverse()
    }
  }

  // 5. Handwriting inside containers -------------------------------------------
  for (const s of shapes) {
    if (s.type !== 'draw' || used.has(s.id)) continue
    const c = smallestContainerAround(s.bounds)
    if (!c) continue
    c.shapeIds.push(s.id)
    owner.set(s.id, c)
    used.add(s.id)
  }

  // 6. Arrows -------------------------------------------------------------------
  for (const s of shapes) {
    if (s.type !== 'arrow' || !s.arrow) continue
    const a = s.arrow
    const exclude = enclosing(s.bounds)
    const from = (a.startShapeId ? owner.get(a.startShapeId) : undefined) ?? resolveEnd(a.start, exclude)
    const to = (a.endShapeId ? owner.get(a.endShapeId) : undefined) ?? resolveEnd(a.end, exclude)
    if (!from || !to || from === to) continue
    edges.push({
      from,
      to,
      label: cleanText(s.text),
      shapeIds: [s.id],
      path: [a.start, a.end],
      handDrawn: false,
      headAtStart: false,
      headAtEnd: true,
    })
  }

  // 7. Free text sitting on a connector labels it (instead of becoming a component)
  const endpoints = new Set<Comp>(edges.flatMap((e) => [e.from, e.to]))
  for (const c of [...comps]) {
    if (c.isContainer || endpoints.has(c)) continue
    const center = rectCenter(c.bounds)
    const snap = Math.max(EDGE_LABEL_SNAP, c.bounds.h / 2 + 12)
    let best: { edge: EdgeDraft; d: number } | undefined
    for (const e of edges) {
      if (e.label) continue
      const d = distToPolyline(center, e.path)
      if (d <= snap && (!best || d < best.d)) best = { edge: e, d }
    }
    if (!best) continue
    best.edge.label = c.ownText
    best.edge.shapeIds.push(...c.shapeIds)
    comps.splice(comps.indexOf(c), 1)
  }

  // 8. Ids, labels, kinds ------------------------------------------------------
  const finalComps = [...comps.filter((c) => c.isContainer), ...comps.filter((c) => !c.isContainer)]
  const prevNodes = input.previous.nodes.filter((n) => n.shapeIds.length > 0)
  const claimed = new Set<string>()
  const ids = new Map<Comp, string>()
  const reused = new Map<Comp, GraphNode>()
  finalComps.forEach((c, i) => {
    const prev = matchPrevious(c, prevNodes, claimed)
    if (prev) {
      claimed.add(prev.id)
      reused.set(c, prev)
      ids.set(c, prev.id)
    } else {
      ids.set(c, `tmp_${i + 1}`)
    }
  })

  const labels = new Map<Comp, string>()
  const descriptions = new Map<Comp, string>()
  const unlabeled: Comp[] = []
  for (const c of finalComps) {
    const typed = [c.ownText, ...c.texts].filter((t): t is string => !!t)
    if (typed.length) {
      labels.set(c, typed[0])
      if (typed.length > 1) descriptions.set(c, typed.slice(1).join('; '))
    } else if (reused.get(c)?.label.trim()) {
      labels.set(c, reused.get(c)!.label.trim())
    } else {
      unlabeled.push(c)
    }
  }
  const takenLabels = new Set([...labels.values()].map(norm))
  let boxNo = 1
  for (const c of unlabeled) {
    while (takenLabels.has(norm(`Box ${boxNo}`))) boxNo++
    const label = `Box ${boxNo++}`
    takenLabels.add(norm(label))
    labels.set(c, label)
  }

  const nodes: InterpretationResult['nodes'] = finalComps.map((c) => {
    const label = labels.get(c)!
    const typedAll = [c.ownText, ...c.texts].filter(Boolean).join(' ')
    const prev = reused.get(c)
    let kind: string | undefined
    let tags: string[] = []
    if (typedAll) {
      const k = inferKind(typedAll, c.primary.geo)
      kind = k.kind
      tags = makeTags(label, k.techs, k.kind)
    } else if (prev && labels.get(c) === prev.label.trim()) {
      // Keep what an earlier (possibly AI) interpretation knew about this box.
      kind = prev.kind
      tags = prev.tags.filter((t) => norm(t) !== norm(label)).slice(0, 2)
    } else {
      kind = inferKind('', c.primary.geo).kind
      tags = makeTags(label, [], kind)
    }
    const node: InterpretationResult['nodes'][number] = { id: ids.get(c)!, label, tags, shapeIds: c.shapeIds }
    if (kind) node.kind = kind
    const description = descriptions.get(c)
    if (description) node.description = description
    return node
  })

  const out: InterpretationResult['edges'] = []
  const seen = new Map<string, InterpretationResult['edges'][number]>()
  for (const e of edges) {
    const from = ids.get(e.from)
    const to = ids.get(e.to)
    if (!from || !to || from === to) continue
    const key = `${from}->${to}`
    const dup = seen.get(key)
    if (dup) {
      for (const id of e.shapeIds) if (!dup.shapeIds!.includes(id)) dup.shapeIds!.push(id)
      if (!dup.label && e.label) dup.label = e.label
      continue
    }
    const edge: InterpretationResult['edges'][number] = { from, to, shapeIds: [...e.shapeIds] }
    if (e.label) edge.label = e.label
    seen.set(key, edge)
    out.push(edge)
  }

  const result: InterpretationResult = { nodes, edges: out }
  if (answers.size) result.answers = [...answers].map(([markId, parts]) => ({ markId, answer: parts.join(' ') }))
  // No summary: it would surface as the architecture's headline and only repeat the counts.
  return result
}

// ---------------------------------------------------------------------------
// Shape classification
// ---------------------------------------------------------------------------

function isContainerShape(s: SketchShape): boolean {
  if (s.type === 'geo' || s.type === 'note' || s.type === 'frame') return true
  if (s.type !== 'draw') return false
  const { w, h } = s.bounds
  if (Math.max(w, h) < MIN_CONTAINER_LONG || Math.min(w, h) < MIN_CONTAINER_SHORT) return false
  if (s.closed) return true
  const pts = s.points
  if (!pts || pts.length < 3) return false
  return strokeIsClosed(pts, CLOSE_RATIO)
}

/** Start/end of an open stroke that is long and thin enough to be a connector. */
function connectorEnds(s: SketchShape): { start: Point; end: Point; path: Point[] } | null {
  if (s.closed) return null
  const pts = s.points
  if (pts && pts.length >= 2) {
    const start = pts[0]
    const end = pts[pts.length - 1]
    const chord = dist(start, end)
    if (chord < MIN_CONNECTOR_LEN) return null
    // Mostly end-to-end (lines, elbows, gentle curves), not a letter or a scribble.
    if (chord < 0.6 * Math.hypot(s.bounds.w, s.bounds.h)) return null
    let length = 0
    for (let i = 1; i < pts.length; i++) length += dist(pts[i - 1], pts[i])
    if (length > 2.5 * chord) return null
    return { start, end, path: pts }
  }
  // No polyline: only clearly elongated bounds can be read as a straight line.
  const { x, y, w, h } = s.bounds
  if (Math.max(w, h) < MIN_CONNECTOR_LEN || Math.max(w, h) < 3 * Math.min(w, h)) return null
  const path =
    w >= h
      ? [{ x, y: y + h / 2 }, { x: x + w, y: y + h / 2 }]
      : [{ x: x + w / 2, y }, { x: x + w / 2, y: y + h }]
  return { start: path[0], end: path[1], path }
}

/**
 * Distance used to snap an endpoint to a component. A point inside a plain box
 * is at distance 0; a point inside a container that holds other boxes (a frame)
 * measures to its border, so boxes inside the frame win over the frame.
 */
function endDistance(p: Point, c: Comp): number {
  const r = c.bounds
  if (c.hasChildren && rectContainsPoint(r, p)) {
    return Math.min(p.x - r.x, r.x + r.w - p.x, p.y - r.y, r.y + r.h - p.y)
  }
  return distToRect(p, r)
}

function isInside(inner: Rect, outer: Rect): boolean {
  if (!rectContainsPoint(outer, rectCenter(inner))) return false
  if (rectContainsRect(outer, inner, CONTAIN_PAD)) return true
  return overlapRatio(inner, outer) >= INSIDE_OVERLAP
}

function overlapRatio(inner: Rect, outer: Rect): number {
  const w = Math.min(inner.x + inner.w, outer.x + outer.w) - Math.max(inner.x, outer.x)
  const h = Math.min(inner.y + inner.h, outer.y + outer.h) - Math.max(inner.y, outer.y)
  if (w < 0 || h < 0) return 0
  const area = Math.max(inner.w, 1) * Math.max(inner.h, 1)
  return (Math.max(w, 1) * Math.max(h, 1)) / area
}

function smallest(cs: Comp[]): Comp | undefined {
  let best: Comp | undefined
  for (const c of cs) if (!best || rectArea(c.bounds) < rectArea(best.bounds)) best = c
  return best
}

function nearestQuestion(r: Rect, questions: OpenQuestion[]): OpenQuestion | undefined {
  let best: OpenQuestion | undefined
  let bestD = Infinity
  for (const q of questions) {
    const d = distToRect(q.at, r)
    if (d <= ANSWER_RADIUS && d < bestD) {
      best = q
      bestD = d
    }
  }
  return best
}

function matchPrevious(c: Comp, prev: GraphNode[], claimed: Set<string>): GraphNode | undefined {
  let best: GraphNode | undefined
  let bestScore = 0
  for (const n of prev) {
    if (claimed.has(n.id)) continue
    const hasPrimary = n.shapeIds.includes(c.primary.id)
    const score = jaccard(n.shapeIds, c.shapeIds) + (hasPrimary ? 1 : 0)
    if (!hasPrimary && score < 0.25) continue
    if (score > bestScore) {
      best = n
      bestScore = score
    }
  }
  return best
}

function distToPolyline(p: Point, path: Point[]): number {
  if (path.length === 1) return dist(p, path[0])
  let best = Infinity
  for (let i = 1; i < path.length; i++) best = Math.min(best, distToSegment(p, path[i - 1], path[i]))
  return best
}

function distToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len2 = dx * dx + dy * dy
  if (len2 === 0) return dist(p, a)
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2))
  return dist(p, { x: a.x + t * dx, y: a.y + t * dy })
}

/** Top-to-bottom rows, left-to-right within a row. Deterministic. */
function readingOrder<T extends { id: string; bounds: Rect }>(items: T[]): T[] {
  const byTop = [...items].sort((a, b) => a.bounds.y - b.bounds.y || a.bounds.x - b.bounds.x || cmp(a.id, b.id))
  const out: T[] = []
  let i = 0
  while (i < byTop.length) {
    const head = byTop[i].bounds
    const limit = head.y + Math.max(head.h / 2, 10)
    let j = i + 1
    while (j < byTop.length && byTop[j].bounds.y < limit) j++
    out.push(...byTop.slice(i, j).sort((a, b) => a.bounds.x - b.bounds.x || a.bounds.y - b.bounds.y || cmp(a.id, b.id)))
    i = j
  }
  return out
}

// ---------------------------------------------------------------------------
// Kinds and tags from keywords
// ---------------------------------------------------------------------------

/** Named technologies: [keyword, kind, display tag]. */
const TECH: Array<[string, string, string]> = [
  ['postgres', 'database', 'Postgres'],
  ['postgresql', 'database', 'Postgres'],
  ['mysql', 'database', 'MySQL'],
  ['sqlite', 'database', 'SQLite'],
  ['mongo', 'database', 'MongoDB'],
  ['mongodb', 'database', 'MongoDB'],
  ['dynamo', 'database', 'DynamoDB'],
  ['dynamodb', 'database', 'DynamoDB'],
  ['redis', 'cache', 'Redis'],
  ['memcache', 'cache', 'Memcached'],
  ['memcached', 'cache', 'Memcached'],
  ['kafka', 'queue', 'Kafka'],
  ['sqs', 'queue', 'SQS'],
  ['rabbit', 'queue', 'RabbitMQ'],
  ['rabbitmq', 'queue', 'RabbitMQ'],
  ['pubsub', 'queue', 'Pub/Sub'],
  ['pub sub', 'queue', 'Pub/Sub'],
  ['nats', 'queue', 'NATS'],
  ['s3', 'storage', 'S3'],
  ['gcs', 'storage', 'GCS'],
  ['openai', 'model', 'OpenAI'],
  ['anthropic', 'model', 'Anthropic'],
  ['claude', 'model', 'Claude'],
  ['gpt', 'model', 'GPT'],
  ['stripe', 'external', 'Stripe'],
  ['auth0', 'external', 'Auth0'],
  ['twilio', 'external', 'Twilio'],
  ['ios', 'client', 'iOS'],
  ['android', 'client', 'Android'],
]

/** Role keywords that beat a named technology ("Kafka consumer" is a worker). */
const STRONG: Array<[string, string[]]> = [
  ['database', ['db', 'database', 'sql']],
  ['cache', ['cache']],
  ['queue', ['queue']],
  ['storage', ['bucket', 'blob', 'storage']],
  ['model', ['llm', 'model']],
  ['external', ['external', '3rd party', 'third party']],
  ['worker', ['worker', 'job', 'cron', 'consumer']],
]

/** Weak role keywords: used only when nothing more specific matched ("OpenAI API" is a model). */
const WEAK: Array<[string, string[]]> = [
  ['service', ['api', 'server', 'service', 'backend', 'gateway']],
  ['client', ['web', 'ui', 'frontend', 'app', 'mobile', 'client', 'browser']],
]

const GEO_KIND: Record<string, string> = { cylinder: 'database', cloud: 'external' }

export function inferKind(text: string, geo?: string): { kind?: string; techs: string[] } {
  const tokens = tokenize(text)
  const phrase = ` ${tokenizeRaw(text).join(' ')} `
  const has = (word: string) =>
    word.includes(' ') ? phrase.includes(` ${word} `) : tokens.has(word) || tokens.has(`${word}s`) || tokens.has(`${word}es`)

  const techs: string[] = []
  let techKind: string | undefined
  for (const [word, kind, display] of TECH) {
    if (!has(word)) continue
    if (!techs.includes(display)) techs.push(display)
    techKind ??= kind
  }
  const strong = STRONG.find(([, words]) => words.some(has))?.[0]
  const weak = WEAK.find(([, words]) => words.some(has))?.[0]
  const kind = strong ?? techKind ?? weak ?? (geo ? GEO_KIND[geo] : undefined)
  return { kind, techs }
}

function makeTags(label: string, techs: string[], kind: string | undefined): string[] {
  const out: string[] = []
  for (const t of [...techs, ...(kind ? [kind] : [])]) {
    if (norm(t) === norm(label) || out.some((o) => norm(o) === norm(t))) continue
    out.push(t)
  }
  return out.slice(0, 2)
}

/** Lowercase tokens, split both on punctuation ("s3", "auth0") and on camelCase/digits ("UsersDB", "gpt4o"). */
function tokenize(text: string): Set<string> {
  const split = text
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .replace(/([a-zA-Z])(\d)/g, '$1 $2')
    .replace(/(\d)([a-zA-Z])/g, '$1 $2')
  return new Set([...tokenizeRaw(text), ...tokenizeRaw(split)])
}

function tokenizeRaw(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

function cleanText(t: string | undefined): string | undefined {
  const s = t?.replace(/\s+/g, ' ').trim()
  return s ? s : undefined
}

function norm(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ')
}

function cmp(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

function validRect(r: Rect | undefined): r is Rect {
  return !!r && [r.x, r.y, r.w, r.h].every(Number.isFinite)
}
