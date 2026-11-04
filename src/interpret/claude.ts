// Claude API interpreter (reads the sketch image + shape list, handwriting
// included) and the laptop chat panel's assistant.
//
// Both calls use structured outputs (`output_config.format`) rather than a
// forced tool call: the default model rejects forced `tool_choice`, and a JSON
// schema guarantees parseable output on every model that supports it.

import Anthropic from '@anthropic-ai/sdk'
import { LIMITS } from '../shared/types.js'
import type {
  ArchitectureView,
  ChatMessage,
  Graph,
  InterpretInput,
  InterpretationResult,
  MarkInput,
  MarkType,
  OpenQuestion,
  Point,
  RepoMap,
  SketchShape,
} from '../shared/types.js'

// ---------------------------------------------------------------------------
// Config + client
// ---------------------------------------------------------------------------

/** Current default Opus: strongest vision + structured reasoning in the lineup. */
export const DEFAULT_MODEL = 'claude-opus-5-5'

export function claudeConfig(env: NodeJS.ProcessEnv = process.env): { available: boolean; model: string } {
  return {
    available: !!env.ANTHROPIC_API_KEY?.trim(),
    model: env.VIBEPRINT_MODEL?.trim() || DEFAULT_MODEL,
  }
}

type CreateParams = Anthropic.Beta.Messages.MessageCreateParamsNonStreaming
type CreateResult = Anthropic.Beta.Messages.BetaMessage

/** The slice of the Anthropic client this module uses, so tests can inject a fake. */
export interface AnthropicLike {
  beta: {
    messages: {
      create(body: CreateParams, options?: { signal?: AbortSignal }): PromiseLike<CreateResult>
    }
  }
}

let sharedClient: AnthropicLike | undefined
function defaultClient(): AnthropicLike {
  sharedClient ??= new Anthropic()
  return sharedClient
}

/**
 * Settings shared by both calls. `fallbacks: "default"` re-runs a request that
 * a safety classifier declines on Anthropic's recommended fallback model
 * (server-side, same round trip). On models without fallback support the
 * request simply runs on the requested model.
 */
const COMMON = {
  max_tokens: 16000,
  thinking: { type: 'adaptive' },
  betas: ['server-side-fallback-2026-07-01'],
  fallbacks: 'default',
} as const satisfies Partial<CreateParams>

// ---------------------------------------------------------------------------
// Interpretation
// ---------------------------------------------------------------------------

const KINDS = ['service', 'database', 'queue', 'cache', 'client', 'storage', 'worker', 'external', 'model'] as const

const STRING = { type: 'string' } as const
const STRINGS = { type: 'array', items: STRING } as const
const POINT = {
  type: 'object',
  additionalProperties: false,
  required: ['x', 'y'],
  properties: { x: { type: 'number' }, y: { type: 'number' } },
} as const

export const INTERPRETATION_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['nodes', 'edges', 'questions', 'answers', 'summary'],
  properties: {
    nodes: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'label', 'tags', 'shapeIds'],
        properties: {
          id: STRING,
          label: STRING,
          kind: { type: 'string', enum: [...KINDS] },
          tags: STRINGS,
          shapeIds: STRINGS,
          description: STRING,
        },
      },
    },
    edges: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['from', 'to', 'shapeIds'],
        properties: { from: STRING, to: STRING, label: STRING, shapeIds: STRINGS },
      },
    },
    questions: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['text'],
        properties: { text: STRING, target: STRING, at: POINT },
      },
    },
    answers: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['markId', 'answer'],
        properties: { markId: STRING, answer: STRING },
      },
    },
    summary: STRING,
  },
} as const

const INTERPRET_SYSTEM = `You interpret hand-drawn software architecture sketches for Vibeprint. The user draws on an iPad canvas with an Apple Pencil (or a finger or mouse) and hits Submit; you turn the drawing into a graph of components (nodes) and connections (edges). Coding agents build the software from this graph, so stay faithful to what was drawn.

You get a PNG of the canvas, a list of every shape on it (page coordinates, x grows right, y grows down), the graph from the previous submit, and any open question notes Vibeprint placed on the canvas.

Components
- Boxes, circles, cylinders, clouds, sticky notes, frames and closed hand-drawn outlines are components. A label standing on its own, with no outline, can also be a component.
- Read handwriting from the image. Use typed text from the shape list exactly as written.
- shapeIds must list every shape that makes up the component: the outline plus every handwriting stroke and text shape inside it. Handwriting is made of many small draw strokes; include all of them. Use only ids from the shape list.
- If a component is the same one as in the previous graph (same ink, or clearly the same thing redrawn), reuse its id. Give new components fresh ids "new_1", "new_2", ... Never put a previous id on a different component.
- Labels are short and as the user wrote them (fix obvious misspellings only). If the writing is unreadable, keep the previous label; if there is none, use "Box 1", "Box 2", ... numbered top to bottom, left to right.
- kind is one of the schema values; omit it when unsure.
- tags: at most 2 short, faint labels per node (a technology or role such as "Postgres" or "queue"), only when you are confident. Never repeat the label. Usually zero or one.

Connections
- Arrows, lines and hand-drawn strokes that join two components are edges. Direction follows the arrowhead; a line with no head goes the way it was drawn (first point to last point).
- An edge's shapeIds include the arrow or line and any hand-drawn arrowhead strokes. Use the arrow's text, or handwriting written along it, as the label.

Questions and answers
- Ask at most 2 questions, and only when an ambiguity would change what gets built. Most submits need none. Never ask about naming, style, or anything you can reasonably infer. target is a node id from your result.
- If the user wrote next to an open question note and it answers that question, return it in answers as {markId, answer} with the answer as written. Do not also turn that writing into a component.

Never invent components or connections the user did not draw. Scribbles and decoration are not components.
summary: one line describing the system, e.g. "Web app calling an API backed by Postgres and a job queue."`

export async function interpretWithClaude(
  input: InterpretInput,
  opts: { client?: AnthropicLike; model?: string; signal?: AbortSignal } = {},
): Promise<InterpretationResult> {
  const client = opts.client ?? defaultClient()
  const model = opts.model ?? claudeConfig().model

  const content: Anthropic.Beta.Messages.BetaContentBlockParam[] = []
  if (input.image?.length) content.push(imageBlock(input.image))
  content.push({ type: 'text', text: describeInput(input) })

  const response = await client.beta.messages.create(
    {
      ...COMMON,
      model,
      output_config: { effort: 'medium', format: { type: 'json_schema', schema: INTERPRETATION_SCHEMA } },
      system: [{ type: 'text', text: INTERPRET_SYSTEM, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content }],
    },
    opts.signal ? { signal: opts.signal } : undefined,
  )
  return validateInterpretation(readJson(response, 'interpretation'), input)
}

/**
 * Map a repository from a digest of its code (tree, manifests, README, entry points).
 * `prompt` carries the instructions, the quick scan and the digest.
 */
export async function mapRepoWithClaude(
  prompt: string,
  schema: object,
  opts: { client?: AnthropicLike; model?: string; signal?: AbortSignal } = {},
): Promise<RepoMap> {
  return (await askClaudeJson(prompt, schema, 'map', opts)) as RepoMap
}

/** One structured-output request: the reply is JSON matching `schema`. */
export async function askClaudeJson(
  prompt: string,
  schema: object,
  what: string,
  opts: { client?: AnthropicLike; model?: string; signal?: AbortSignal; image?: Buffer } = {},
): Promise<unknown> {
  const client = opts.client ?? defaultClient()
  const response = await client.beta.messages.create(
    {
      ...COMMON,
      model: opts.model ?? claudeConfig().model,
      output_config: { effort: 'medium', format: { type: 'json_schema', schema: schema as Record<string, unknown> } },
      messages: [{ role: 'user', content: [...(opts.image?.length ? [imageBlock(opts.image)] : []), { type: 'text', text: prompt }] }],
    },
    opts.signal ? { signal: opts.signal } : undefined,
  )
  return readJson(response, what)
}

/** The user-turn text: shape listing, previous graph, open questions. */
export function describeInput(input: InterpretInput): string {
  const { sketch } = input
  const lines: string[] = []
  lines.push(`Sketch #${sketch.seq}: ${sketch.shapes.length} shapes.`)
  if (sketch.bounds) {
    const b = sketch.bounds
    lines.push(
      `${input.image?.length ? 'The image shows' : 'No image was captured. The canvas covers'} roughly the page region x=${r(b.x)}..${r(b.x + b.w)}, y=${r(b.y)}..${r(b.y + b.h)}.`,
    )
  }
  if (sketch.note?.trim()) lines.push(`The user typed this note with the submit: ${JSON.stringify(sketch.note.trim())}`)
  lines.push('', 'Shapes, one JSON object per line. b = [x, y, w, h]; pts = simplified stroke path; arrows give their start/end points and the shapes they are bound to.')
  for (const s of sketch.shapes) lines.push(JSON.stringify(compactShape(s)))
  lines.push('', 'Previous graph (reuse these ids for the same components):')
  lines.push(JSON.stringify(compactGraph(input.previous)))
  if (input.openQuestions.length) {
    lines.push('', 'Open question notes on the canvas (at = page position of the note):')
    for (const q of input.openQuestions) lines.push(JSON.stringify(compactQuestion(q)))
  } else {
    lines.push('', 'Open question notes: none.')
  }
  lines.push('', 'Return the interpretation as JSON matching the schema.')
  return lines.join('\n')
}

function compactShape(s: SketchShape): Record<string, unknown> {
  const o: Record<string, unknown> = { id: s.id, type: s.type, b: [r(s.bounds.x), r(s.bounds.y), r(s.bounds.w), r(s.bounds.h)] }
  if (s.geo) o.geo = s.geo
  if (s.text?.trim()) o.text = s.text.trim()
  if (s.closed) o.closed = true
  // Paths matter for connectors; handwriting strokes and outlines are described well enough by their bounds.
  if ((s.type === 'draw' || s.type === 'line') && !s.closed && s.points && s.points.length >= 2 && Math.max(s.bounds.w, s.bounds.h) >= 40) {
    o.pts = decimate(s.points, 8).map((p) => [r(p.x), r(p.y)])
  }
  if (s.arrow) {
    o.start = [r(s.arrow.start.x), r(s.arrow.start.y)]
    o.end = [r(s.arrow.end.x), r(s.arrow.end.y)]
    if (s.arrow.startShapeId) o.startShape = s.arrow.startShapeId
    if (s.arrow.endShapeId) o.endShape = s.arrow.endShapeId
  }
  if (s.parentId) o.parent = s.parentId
  return o
}

function compactGraph(g: Graph): Record<string, unknown> {
  return {
    nodes: g.nodes.map((n) => {
      const o: Record<string, unknown> = { id: n.id, label: n.label }
      if (n.override?.label) o.renamedTo = n.override.label
      if (n.kind) o.kind = n.kind
      if (n.tags.length) o.tags = n.tags
      if (n.origin === 'agent') o.origin = 'agent (added by an agent, not drawn; reuse the id only if the user has now drawn it)'
      else o.shapeIds = n.shapeIds
      if (n.removed) o.removed = true
      return o
    }),
    edges: g.edges.filter((e) => !e.removed).map((e) => ({ from: e.from, to: e.to, ...(e.label ? { label: e.label } : {}) })),
  }
}

function compactQuestion(q: OpenQuestion): Record<string, unknown> {
  const target = q.target.kind === 'point' ? undefined : q.target.id
  return { markId: q.markId, text: q.text, at: [r(q.at.x), r(q.at.y)], ...(target ? { target } : {}) }
}

/**
 * Clean up an interpretation from a model or an agent: drop shape ids that are
 * not in the sketch, nodes with no ink, edges to unknown nodes, self-loops and
 * duplicates; cap tags and questions; keep only answers to open questions.
 */
export function validateInterpretation(raw: unknown, input: InterpretInput): InterpretationResult {
  const obj = isRecord(raw) ? raw : {}
  const shapeIds = new Set(input.sketch.shapes.map((s) => s.id))
  const validShapes = (v: unknown) => [...new Set(strings(v).filter((id) => shapeIds.has(id)))]

  const nodes: InterpretationResult['nodes'] = []
  const ids = new Set<string>()
  const byLabel = new Map<string, string>()
  // Fresh ids must not collide with any id the model used (edges may point at a
  // dropped node) or with a previous node (merge would match it by id).
  const reserved = new Set<string>([
    ...input.previous.nodes.map((n) => n.id),
    ...arrayOf(obj.nodes).flatMap((n) => (isRecord(n) && str(n.id) ? [str(n.id)!] : [])),
  ])
  let fresh = 1
  for (const rn of arrayOf(obj.nodes)) {
    if (!isRecord(rn)) continue
    const label = str(rn.label)
    const shapes = validShapes(rn.shapeIds)
    if (!label || !shapes.length) continue
    let id = str(rn.id)
    if (!id || ids.has(id)) {
      do id = `new_${fresh++}`
      while (ids.has(id) || reserved.has(id))
    }
    ids.add(id)
    byLabel.set(label.toLowerCase(), id)
    const node: InterpretationResult['nodes'][number] = { id, label, tags: cleanTags(rn.tags, label), shapeIds: shapes }
    const kind = str(rn.kind)?.toLowerCase()
    if (kind) node.kind = kind
    const description = str(rn.description)
    if (description) node.description = description.slice(0, 400)
    nodes.push(node)
  }

  const ref = (v: unknown) => {
    const s = str(v)
    if (!s) return undefined
    return ids.has(s) ? s : byLabel.get(s.toLowerCase())
  }
  const edges: InterpretationResult['edges'] = []
  const seen = new Set<string>()
  for (const re of arrayOf(obj.edges)) {
    if (!isRecord(re)) continue
    const from = ref(re.from)
    const to = ref(re.to)
    if (!from || !to || from === to) continue
    const key = `${from}->${to}`
    if (seen.has(key)) continue
    seen.add(key)
    const edge: InterpretationResult['edges'][number] = { from, to, shapeIds: validShapes(re.shapeIds) }
    const label = str(re.label)
    if (label) edge.label = label
    edges.push(edge)
  }

  const questions: NonNullable<InterpretationResult['questions']> = []
  for (const rq of arrayOf(obj.questions)) {
    if (!isRecord(rq) || questions.length >= LIMITS.questionsPerSubmit) continue
    const text = str(rq.text)
    if (!text) continue
    const q: (typeof questions)[number] = { text }
    const target = ref(rq.target) ?? (input.previous.nodes.some((n) => n.id === str(rq.target)) ? str(rq.target) : undefined)
    if (target) q.target = target
    const at = point(rq.at)
    if (at) q.at = at
    questions.push(q)
  }

  const open = new Set(input.openQuestions.map((q) => q.markId))
  const answers: NonNullable<InterpretationResult['answers']> = []
  for (const ra of arrayOf(obj.answers)) {
    if (!isRecord(ra)) continue
    const markId = str(ra.markId)
    const answer = str(ra.answer)
    if (!markId || !answer || !open.has(markId) || answers.some((a) => a.markId === markId)) continue
    answers.push({ markId, answer })
  }

  const result: InterpretationResult = { nodes, edges }
  if (questions.length) result.questions = questions
  if (answers.length) result.answers = answers
  const summary = str(obj.summary)
  if (summary) result.summary = summary.slice(0, 300)
  return result
}

function cleanTags(v: unknown, label: string): string[] {
  const out: string[] = []
  for (const t of strings(v)) {
    const tag = t.trim()
    if (!tag || tag.length > 32 || tag.toLowerCase() === label.toLowerCase()) continue
    if (out.some((o) => o.toLowerCase() === tag.toLowerCase())) continue
    out.push(tag)
  }
  return out.slice(0, 2)
}

// ---------------------------------------------------------------------------
// Chat
// ---------------------------------------------------------------------------

const CHAT_MARK_TYPES = ['add', 'strike', 'rewrite', 'note'] as const satisfies readonly MarkType[]

export const CHAT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['reply', 'marks'],
  properties: {
    reply: STRING,
    marks: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['type', 'reason'],
        properties: {
          type: { type: 'string', enum: [...CHAT_MARK_TYPES] },
          target: STRING,
          at: POINT,
          label: STRING,
          kind: STRING,
          connectFrom: STRINGS,
          connectTo: STRINGS,
          edgeLabel: STRING,
          edge: {
            type: 'object',
            additionalProperties: false,
            required: ['from', 'to'],
            properties: { from: STRING, to: STRING, label: STRING },
          },
          text: STRING,
          question: { type: 'boolean' },
          reason: STRING,
        },
      },
    },
  },
} as const

const CHAT_SYSTEM = `You are the assistant in Vibeprint's chat panel on the user's laptop. The user sketched their software architecture on an iPad; Vibeprint turned the sketch into the architecture you are given, and coding agents build from it.

- Answer about the architecture concisely: a few sentences of plain text, no headings. Refer to components by their labels.
- You can propose changes as marks. The user reviews each mark on the canvas and accepts or rejects it; nothing changes until they do. Propose marks only when the user asks for a change, or when you see a real problem (a component the design clearly needs, a connection that is wrong). Otherwise return an empty marks list. At most ${LIMITS.marksPerBatch} marks.
- Mark types:
  - add: a new component (label, optional kind, connectFrom / connectTo with existing node ids or labels, optional edgeLabel; target = the node to place it beside), or a new connection between two existing components (edge: {from, to, label}).
  - strike: remove a component or connection (target = its id).
  - rewrite: rename or re-kind a component (target, plus label and/or kind).
  - note: a margin note (text) anchored at target; set question to true only if you need the user's answer.
  Give every mark a one-line reason.
- Build status is reported by the coding agents, never by you.
- Don't duplicate pending marks or re-propose something the user rejected (see pending and recentDecisions).
- When you propose marks, say so briefly in your reply.`

export async function chatWithClaude(
  input: { architecture: ArchitectureView; history: ChatMessage[]; message: string; image?: Buffer },
  opts: { client?: AnthropicLike; model?: string; signal?: AbortSignal } = {},
): Promise<{ text: string; marks: MarkInput[] }> {
  const client = opts.client ?? defaultClient()
  const model = opts.model ?? claudeConfig().model

  const history = [...input.history]
  const last = history[history.length - 1]
  if (last?.role === 'user' && last.text.trim() === input.message.trim()) history.pop() // already the current message
  const transcript = history
    .slice(-30)
    .map((m) => `${m.role === 'user' ? 'User' : m.role === 'system' ? 'Vibeprint' : m.author}: ${m.text.slice(0, 2000)}`)
    .join('\n')

  const text = [
    'Architecture (JSON):',
    JSON.stringify(input.architecture),
    '',
    transcript ? `Chat so far:\n${transcript}` : 'Chat so far: (empty)',
    '',
    `User: ${input.message}`,
  ].join('\n')

  const content: Anthropic.Beta.Messages.BetaContentBlockParam[] = []
  if (input.image?.length) content.push(imageBlock(input.image))
  content.push({ type: 'text', text })

  const response = await client.beta.messages.create(
    {
      ...COMMON,
      model,
      output_config: { effort: 'low', format: { type: 'json_schema', schema: CHAT_SCHEMA } },
      system: [{ type: 'text', text: CHAT_SYSTEM, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content }],
    },
    opts.signal ? { signal: opts.signal } : undefined,
  )
  const raw = readJson(response, 'chat reply')
  const obj = isRecord(raw) ? raw : {}
  const marks = validateMarks(obj.marks)
  const reply = str(obj.reply) ?? (marks.length ? `Proposed ${marks.length} mark${marks.length === 1 ? '' : 's'}.` : '')
  return { text: reply, marks }
}

/** Keep well-formed add/strike/rewrite/note marks, at most a batch's worth. Never status marks. */
export function validateMarks(v: unknown): MarkInput[] {
  const out: MarkInput[] = []
  for (const rm of arrayOf(v)) {
    if (out.length >= LIMITS.marksPerBatch) break
    if (!isRecord(rm)) continue
    const type = str(rm.type) as MarkType | undefined
    if (!type || !(CHAT_MARK_TYPES as readonly string[]).includes(type)) continue
    const m: MarkInput = { type }
    const target = str(rm.target)
    if (target) m.target = target
    const at = point(rm.at)
    if (at) m.at = at
    const label = str(rm.label)
    if (label) m.label = label
    const kind = str(rm.kind)
    if (kind) m.kind = kind.toLowerCase()
    const connectFrom = strings(rm.connectFrom).map((s) => s.trim()).filter(Boolean)
    if (connectFrom.length) m.connectFrom = connectFrom
    const connectTo = strings(rm.connectTo).map((s) => s.trim()).filter(Boolean)
    if (connectTo.length) m.connectTo = connectTo
    const edgeLabel = str(rm.edgeLabel)
    if (edgeLabel) m.edgeLabel = edgeLabel
    if (isRecord(rm.edge) && str(rm.edge.from) && str(rm.edge.to)) {
      m.edge = { from: str(rm.edge.from)!, to: str(rm.edge.to)! }
      const el = str(rm.edge.label)
      if (el) m.edge.label = el
    }
    const text = str(rm.text)
    if (text) m.text = text
    if (rm.question === true) m.question = true
    const reason = str(rm.reason)
    if (reason) m.reason = reason

    const ok =
      type === 'add' ? !!(m.label || m.edge) : type === 'strike' ? !!m.target : type === 'rewrite' ? !!(m.target && (m.label || m.kind)) : !!m.text
    if (ok) out.push(m)
  }
  return out
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Join the text blocks of a structured-output response and parse them. */
function readJson(response: CreateResult, what: string): unknown {
  if (response.stop_reason === 'refusal') {
    const category = response.stop_details?.category
    throw new Error(`Claude declined the ${what} request${category ? ` (${category})` : ''}`)
  }
  if (response.stop_reason === 'max_tokens') throw new Error(`Claude's ${what} was cut off at max_tokens`)
  const text = response.content
    .filter((b): b is Anthropic.Beta.Messages.BetaTextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('')
    .trim()
  if (!text) throw new Error(`Claude returned no ${what}`)
  try {
    return JSON.parse(text)
  } catch {
    throw new Error(`Claude returned an unparseable ${what}: ${text.slice(0, 200)}`)
  }
}

function imageBlock(image: Buffer): Anthropic.Beta.Messages.BetaImageBlockParam {
  return { type: 'image', source: { type: 'base64', media_type: sniffImageType(image), data: image.toString('base64') } }
}

function sniffImageType(b: Buffer): 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp' {
  if (b[0] === 0xff && b[1] === 0xd8) return 'image/jpeg'
  if (b.subarray(0, 3).toString('ascii') === 'GIF') return 'image/gif'
  if (b.subarray(0, 4).toString('ascii') === 'RIFF' && b.subarray(8, 12).toString('ascii') === 'WEBP') return 'image/webp'
  return 'image/png'
}

/** Evenly spaced points, always keeping the first and last. */
function decimate(points: Point[], max: number): Point[] {
  if (points.length <= max) return points
  const out: Point[] = []
  for (let i = 0; i < max; i++) out.push(points[Math.round((i * (points.length - 1)) / (max - 1))])
  return out
}

function r(n: number): number {
  return Math.round(n)
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function arrayOf(v: unknown): unknown[] {
  return Array.isArray(v) ? v : []
}

function str(v: unknown): string | undefined {
  if (typeof v !== 'string') return undefined
  const s = v.trim()
  return s ? s : undefined
}

function strings(v: unknown): string[] {
  return arrayOf(v).filter((x): x is string => typeof x === 'string')
}

function point(v: unknown): Point | undefined {
  if (!isRecord(v)) return undefined
  const { x, y } = v
  return typeof x === 'number' && typeof y === 'number' && Number.isFinite(x) && Number.isFinite(y) ? { x, y } : undefined
}
