// MCP server for coding agents (Claude Code, Codex CLI). Reads the user's
// drawn architecture, reports build progress on it, and proposes changes to it
// as marks the user accepts or rejects on the canvas.
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { z } from 'zod'
import type { ActivityEvent } from '../shared/api.js'
import { targetOrigin } from '../shared/graph.js'
import {
  AGENT_RULE,
  LIMITS,
  NODE_STATUSES,
  type ArchitectureView,
  type ChatMessage,
  type Graph,
  type InterpretationResult,
  type MarkInput,
  type Sketch,
  type SketchShape,
} from '../shared/types.js'
import { VibeprintError } from '../core/core.js'
import { resolveBackend, type AddMarksResult, type Backend, type DescribedMark } from './backend.js'

const VERSION = '0.3.1'

export interface McpServerOptions {
  root: string
  /** Who the marks are from. Defaults to $VIBEPRINT_AUTHOR, then the MCP client's name. */
  author?: string
  /** How to reach state for each tool call. Defaults to the daemon if running, else the files. */
  backend?: () => Promise<Backend>
}

export const SERVER_INSTRUCTIONS = `Vibeprint: the user draws this project's architecture on an iPad canvas. You read it, build against it, report progress on it, and propose changes to it as marks the user accepts or rejects.

Rule: ${AGENT_RULE}

Workflow:
1. Before starting work, call get_architecture. Use get_node for one component's detail and get_sketch to see the drawing itself.
2. If the latest sketch is not interpreted yet and no interpreter is running, interpret it yourself: read get_sketch (image + shapes), then call interpret.
3. As work lands, call set_status on the node (planned → building → done, or blocked with a detail). Status updates are progress reports and land immediately.
4. If the build needs a structural change (a new component or connection, removing or renaming one), propose it as marks: add, strike, rewrite, annotate (notes and questions), or several at once with propose. A batch holds at most ${LIMITS.marksPerBatch} marks, so keep it to what matters. Call finish_batch when a pass is done.
5. Proposals are not part of the architecture until the user accepts them. Wait for the decision with wait_for_user (needs \`vibeprint serve\`) or check list_marks, then build on what was accepted. Rejected means don't do it.
6. Never deviate silently. read_chat and post_chat talk to the user on the canvas.`

const PROPOSAL_REMINDER =
  "Proposals wait for the user's approval on the iPad: nothing changes in the architecture until they accept. Don't build against them yet; check list_marks or wait_for_user for the decision."
const FILES_NOTE =
  '(The Vibeprint daemon is not running, so this was written to .vibeprint/ directly. The canvas shows it the next time `vibeprint serve` runs.)'

/** "claude-code" → "claude", "codex-mcp-client" → "codex", else the lowercased name. */
export function authorFromClientName(name?: string): string | undefined {
  const n = name?.trim().toLowerCase()
  if (!n) return undefined
  if (n.includes('claude')) return 'claude'
  if (n.includes('codex')) return 'codex'
  return n
}

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const point = z.object({ x: z.number(), y: z.number() }).describe('Page coordinate on the canvas')
const refs = z.union([z.string(), z.array(z.string())])
const nodeStatus = z.enum(NODE_STATUSES as [string, ...string[]])
const edgeSpec = z.object({
  from: z.string().describe('Node id or label'),
  to: z.string().describe('Node id or label'),
  label: z.string().optional(),
})
const reason = z.string().min(1).describe('One line explaining why. Shown when the user taps the mark.')

const markInput = z
  .looseObject({
    type: z.enum(['add', 'strike', 'rewrite', 'note', 'status']),
    target: z.string().optional().describe('Node/edge id or node label. Required for strike, rewrite, status; anchor for add/note.'),
    at: point.optional(),
    label: z.string().optional().describe('add: new node label. rewrite: corrected label.'),
    kind: z.string().optional(),
    connectFrom: refs.optional().describe('add: edges from these nodes to the new node'),
    connectTo: refs.optional().describe('add: edges from the new node to these nodes'),
    edgeLabel: z.string().optional(),
    edge: edgeSpec.optional().describe('add: an edge between two existing nodes (no label → no new node)'),
    text: z.string().optional().describe('note: the text'),
    question: z.boolean().optional().describe('note: a question the user should answer'),
    status: nodeStatus.optional().describe('status: the new build status'),
    detail: z.string().optional(),
    reason: z.string().optional(),
  })
  .describe('A MarkInput (camelCase fields; snake_case aliases accepted)')

const interpNode = z.looseObject({
  id: z.string().optional().describe('Reuse an existing node id for the same component; otherwise any temp id that edges can refer to'),
  label: z.string(),
  kind: z.string().optional().describe('service | database | queue | cache | client | storage | worker | external | model | ...'),
  tags: z.array(z.string()).optional(),
  shapeIds: z.array(z.string()).optional().describe('Sketch shape ids this node was drawn with (box + handwriting inside it), from get_sketch'),
  description: z.string().optional(),
})
const interpEdge = z.looseObject({
  id: z.string().optional(),
  from: z.string().describe('Node id from `nodes`'),
  to: z.string().describe('Node id from `nodes`'),
  label: z.string().optional(),
  shapeIds: z.array(z.string()).optional().describe('The arrow/line shape ids'),
})

// ---------------------------------------------------------------------------
// Input normalization (forgive snake_case inside nested objects)
// ---------------------------------------------------------------------------

type Loose = Record<string, unknown>
const toList = (v: unknown): string[] | undefined =>
  v === undefined || v === null || v === '' ? undefined : (Array.isArray(v) ? v : [v]).map(String).filter((s) => s.trim())
const pick = (o: Loose, camel: string, snake: string) => (o[camel] !== undefined ? o[camel] : o[snake])

export function normalizeMarkInput(raw: Loose): MarkInput {
  const m: MarkInput = { type: raw.type as MarkInput['type'] }
  const str = (k: string, snake = k) => {
    const v = pick(raw, k, snake)
    return typeof v === 'string' ? v : undefined
  }
  if (str('target')) m.target = str('target')
  if (raw.at && typeof raw.at === 'object') m.at = raw.at as MarkInput['at']
  if (str('label')) m.label = str('label')
  if (str('kind')) m.kind = str('kind')
  const from = toList(pick(raw, 'connectFrom', 'connect_from'))
  const to = toList(pick(raw, 'connectTo', 'connect_to'))
  if (from?.length) m.connectFrom = from
  if (to?.length) m.connectTo = to
  if (str('edgeLabel', 'edge_label')) m.edgeLabel = str('edgeLabel', 'edge_label')
  if (raw.edge && typeof raw.edge === 'object') m.edge = raw.edge as MarkInput['edge']
  if (str('text')) m.text = str('text')
  if (typeof raw.question === 'boolean') m.question = raw.question
  if (str('status')) m.status = str('status') as MarkInput['status']
  if (str('detail')) m.detail = str('detail')
  if (str('reason')) m.reason = str('reason')
  return m
}

function normalizeInterpretation(args: {
  nodes: Loose[]
  edges: Loose[]
  questions?: Array<{ target?: string; at?: { x: number; y: number }; text: string }>
  answers?: Loose[]
  summary?: string
}): InterpretationResult {
  return {
    nodes: args.nodes.map((n) => ({
      ...(n.id ? { id: String(n.id) } : {}),
      label: String(n.label ?? ''),
      ...(n.kind ? { kind: String(n.kind) } : {}),
      ...(Array.isArray(n.tags) ? { tags: n.tags.map(String) } : {}),
      shapeIds: toList(pick(n, 'shapeIds', 'shape_ids')) ?? [],
      ...(n.description ? { description: String(n.description) } : {}),
    })),
    edges: args.edges.map((e) => ({
      ...(e.id ? { id: String(e.id) } : {}),
      from: String(e.from),
      to: String(e.to),
      ...(e.label ? { label: String(e.label) } : {}),
      shapeIds: toList(pick(e, 'shapeIds', 'shape_ids')) ?? [],
    })),
    ...(args.questions?.length ? { questions: args.questions } : {}),
    ...(args.answers?.length
      ? {
          answers: args.answers
            .map((a) => ({ markId: String(pick(a, 'markId', 'mark_id') ?? ''), answer: String(a.answer ?? '') }))
            .filter((a) => a.markId && a.answer.trim()),
        }
      : {}),
    ...(args.summary?.trim() ? { summary: args.summary.trim() } : {}),
  }
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

const text = (...parts: Array<string | false | undefined | null>): CallToolResult => ({
  content: [{ type: 'text', text: parts.filter(Boolean).join('\n\n') }],
})
const json = (v: unknown) => JSON.stringify(v, null, 2)
const r = (n: number) => Math.round(n)

function errorResult(err: unknown): CallToolResult {
  let message: string
  if (err instanceof VibeprintError) message = err.message
  else if (err instanceof Error && err.name === 'AbortError') message = 'The Vibeprint daemon did not answer in time. Try again.'
  else if (err instanceof TypeError && /fetch failed/i.test(err.message)) message = `Could not reach the Vibeprint daemon (${(err.cause as Error)?.message ?? err.message}). Try again.`
  else message = `Vibeprint error: ${err instanceof Error ? err.message : String(err)}`
  return { content: [{ type: 'text', text: message }], isError: true }
}

function isConnectionRefused(err: unknown): boolean {
  const code = (err as { cause?: { code?: string } })?.cause?.code
  return err instanceof TypeError && code === 'ECONNREFUSED'
}

export function formatArchitecture(a: ArchitectureView, ctx: { mode: Backend['mode']; latestSketch?: Sketch | null }): string {
  const L: string[] = []
  const label = new Map(a.nodes.map((n) => [n.id, n.label]))
  const name = (id: string) => (label.has(id) ? `${label.get(id)} (${id})` : id)
  L.push(`Vibeprint architecture · ${a.project}${a.summary ? ` — ${a.summary}` : ''}`)
  L.push(`Interpreted from sketch #${a.sketchSeq} · graph v${a.graphVersion} · ${ctx.mode === 'daemon' ? 'live (vibeprint serve is running)' : 'from .vibeprint/ files (daemon not running)'}`)
  const latest = ctx.latestSketch
  if (latest && latest.seq > a.sketchSeq) {
    L.push(
      `⚠ Sketch #${latest.seq} (submitted ${latest.createdAt}) is newer than this graph and has not been interpreted yet. ` +
        `An interpreter may be on it; if not, call get_sketch and then interpret.`,
    )
  }
  if (!a.nodes.length) {
    L.push(
      latest
        ? '\nNo components yet.'
        : '\nNothing has been drawn yet. Ask the user to run `vibeprint serve`, draw the architecture on the canvas and tap Submit.',
    )
  } else {
    L.push(`\nNodes (${a.nodes.length}):`)
    for (const n of a.nodes) {
      const bits = [`- ${n.id} · ${n.label}`, n.kind, `${n.status}${n.statusDetail ? `: ${n.statusDetail}` : ''}`]
      if (n.origin === 'agent') bits.push('agent-added')
      if (n.tags.length && n.tags.join() !== n.kind) bits.push(`tags: ${n.tags.join(', ')}`)
      let line = bits.filter(Boolean).join(' · ')
      if (n.connectsTo.length) line += ` → ${n.connectsTo.map((id) => label.get(id) ?? id).join(', ')}`
      if (n.description) line += `\n    ${n.description}`
      L.push(line)
    }
    L.push(`\nEdges (${a.edges.length}):`)
    if (!a.edges.length) L.push('- (none)')
    for (const e of a.edges) L.push(`- ${e.id}: ${name(e.from)} → ${name(e.to)}${e.label ? ` "${e.label}"` : ''}`)
  }
  if (a.removed.length) L.push(`\nStruck (no longer part of the design): ${a.removed.map((n) => `${n.label} (${n.id})`).join(', ')}`)
  if (a.pending.length) {
    L.push('\nPending proposals (waiting for the user; not part of the architecture yet):')
    for (const b of a.pending) {
      L.push(`- batch ${b.batchId} by ${b.author}: ${b.summary}`)
      for (const m of b.marks) L.push(`    ${m.id} ${m.describe}`)
    }
  }
  if (a.openQuestions.length) {
    L.push('\nOpen questions for the user:')
    for (const q of a.openQuestions) L.push(`- ${q.markId} on ${q.target}: ${q.text}`)
  }
  if (a.recentDecisions.length) {
    L.push('\nRecent decisions:')
    for (const d of a.recentDecisions) L.push(`- ${d.status} ${d.markId} (${d.author}): ${d.describe}`)
  }
  L.push(`\nRule: ${a.rule}`)
  return L.join('\n')
}

export function shapeLine(s: SketchShape): string {
  const b = s.bounds
  let kind: string = s.type
  if (s.geo) kind += `(${s.geo})`
  if (s.type === 'draw' && s.closed !== undefined) kind += s.closed ? ' closed' : ' open'
  let line = `${s.id} ${kind} @${r(b.x)},${r(b.y)} ${r(b.w)}×${r(b.h)}`
  if (s.arrow) {
    const a = s.arrow
    line += ` (${r(a.start.x)},${r(a.start.y)})→(${r(a.end.x)},${r(a.end.y)})`
    if (a.startShapeId) line += ` from ${a.startShapeId}`
    if (a.endShapeId) line += ` to ${a.endShapeId}`
  }
  if (s.text?.trim()) line += ` "${s.text.trim().replace(/\s+/g, ' ')}"`
  if (s.parentId) line += ` in ${s.parentId}`
  return line
}

function compactGraph(g: Graph) {
  return {
    sketchSeq: g.sketchSeq,
    version: g.version,
    nodes: g.nodes.map((n) => ({
      id: n.id,
      label: n.override?.label ?? n.label,
      ...(n.override?.label ? { drawnLabel: n.label } : {}),
      kind: n.override?.kind ?? n.kind,
      origin: n.origin,
      status: n.status,
      shapeIds: n.shapeIds,
      ...(n.removed ? { removed: true } : {}),
    })),
    edges: g.edges.map((e) => ({ id: e.id, from: e.from, to: e.to, label: e.override?.label ?? e.label, shapeIds: e.shapeIds, ...(e.removed ? { removed: true } : {}) })),
  }
}

function formatMarkResult(res: AddMarksResult, author: string, mode: Backend['mode']): string {
  const L: string[] = []
  for (const m of res.marks) L.push(`${m.status === 'accepted' ? 'Landed' : 'Proposed'} ${m.id}: ${m.describe}`)
  if (res.batch) {
    const b = res.batch
    const state = b.closedAt
      ? 'finished, shown to the user as ready for review'
      : `open (${b.markIds.length}/${LIMITS.marksPerBatch}); marks you add in the next ${LIMITS.batchOpenMs / 1000}s join it. Call finish_batch when this pass is done`
    L.push(`\nBatch ${b.id} from ${author}: ${b.summary} — ${state}.`)
    L.push(PROPOSAL_REMINDER)
  }
  if (res.progress) L.push(`${res.batch ? '' : '\n'}Status updates are progress reports: they landed immediately (auto-accepted).`)
  if (mode === 'files') L.push(FILES_NOTE)
  return L.join('\n')
}

function formatMark(m: DescribedMark): string {
  let line = `${m.id} [${m.author} · batch ${m.batchId}] ${m.describe}`
  if (m.reason) line += ` — ${m.reason}`
  if (m.data.answer) line += `\n    answer: ${m.data.answer}`
  if (m.decidedAt && m.status !== 'pending') line += ` (decided ${m.decidedAt})`
  return line
}

function formatChat(messages: ChatMessage[]): string {
  return messages.map((m) => `${m.createdAt} ${m.role}${m.author && m.author !== m.role ? `:${m.author}` : ''} — ${m.text}`).join('\n')
}

function formatEvent(e: ActivityEvent): string {
  switch (e.type) {
    case 'submit':
      return `${e.at} The user submitted sketch #${e.seq} (${e.shapeCount} shapes)${e.note ? `: "${e.note}"` : ''}. Call get_architecture (or get_sketch if it needs interpreting).`
    case 'chat':
      return `${e.at} Chat from ${e.message.role === 'user' ? 'the user' : e.message.author}: ${e.message.text}`
    case 'decision':
      return `${e.at} Decisions:\n${e.marks.map((m) => `    ${m.status} ${m.id} (${m.author}): ${m.describe}`).join('\n')}`
  }
}

// ---------------------------------------------------------------------------
// Server
// ---------------------------------------------------------------------------

export function createMcpServer(opts: McpServerOptions): McpServer {
  const server = new McpServer({ name: 'vibeprint', version: VERSION }, { instructions: SERVER_INSTRUCTIONS })
  const envAuthor = process.env.VIBEPRINT_AUTHOR?.trim() || undefined
  const getBackend = opts.backend ?? (() => resolveBackend(opts.root))
  const author = () => (opts.author?.trim() || envAuthor || authorFromClientName(server.server.getClientVersion()?.name) || 'agent').toLowerCase()

  /** Run against the current backend; if the daemon vanished mid-session, retry once (it will fall back to files). */
  async function withBackend<T>(fn: (b: Backend) => Promise<T>): Promise<T> {
    const b = await getBackend()
    try {
      return await fn(b)
    } catch (err) {
      if (b.mode === 'daemon' && isConnectionRefused(err)) return fn(await getBackend())
      throw err
    }
  }
  const safe = async (fn: () => Promise<CallToolResult>): Promise<CallToolResult> => {
    try {
      return await fn()
    } catch (err) {
      return errorResult(err)
    }
  }
  const markTool = (inputs: MarkInput[], extra: { message?: string; finish?: boolean } = {}) =>
    safe(() =>
      withBackend(async (b) => {
        const res = await b.addMarks(author(), inputs, extra)
        return text(formatMarkResult(res, author(), b.mode))
      }),
    )

  const READ = { readOnlyHint: true, openWorldHint: false } as const
  const WRITE = { readOnlyHint: false, destructiveHint: false, openWorldHint: false } as const

  server.registerTool(
    'get_architecture',
    {
      title: 'Get the approved architecture',
      description:
        'The architecture the user drew and approved: components (id, label, kind, build status), connections, pending proposals, open questions and recent decisions. Call this before starting work.',
      inputSchema: {},
      annotations: READ,
    },
    () =>
      safe(() =>
        withBackend(async (b) => {
          const [view, sk] = await Promise.all([b.architecture(), b.sketch()])
          return {
            content: [
              { type: 'text', text: formatArchitecture(view, { mode: b.mode, latestSketch: sk.sketch }) },
              { type: 'text', text: `JSON:\n${JSON.stringify(view)}` },
            ],
          }
        }),
      ),
  )

  server.registerTool(
    'get_node',
    {
      title: 'Get one component or connection',
      description: 'Detail for one node or edge: ink it was drawn with, incoming/outgoing edges, and marks on it. Accepts ids, node labels, or "A -> B" for an edge.',
      inputSchema: { ref: z.string().describe('Node or edge id, node label, or "A -> B"') },
      annotations: READ,
    },
    ({ ref }) => safe(() => withBackend(async (b) => text(json(await b.node(ref))))),
  )

  server.registerTool(
    'get_sketch',
    {
      title: 'Get the latest sketch',
      description:
        "The user's latest submitted drawing: the PNG, a listing of its shapes (ids, types, bounds, text, arrow bindings) and the current graph. Use it to interpret a sketch that hasn't been interpreted yet.",
      inputSchema: {},
      annotations: READ,
    },
    () =>
      safe(() =>
        withBackend(async (b) => {
          const [{ sketch, graph }, image] = await Promise.all([b.sketch(), b.sketchImage()])
          if (!sketch) {
            return text('Nothing has been submitted yet. Ask the user to run `vibeprint serve`, draw on the canvas and tap Submit.')
          }
          const head = [
            `Sketch #${sketch.seq} · submitted ${sketch.createdAt} · ${sketch.shapes.length} shapes${sketch.note ? ` · note: "${sketch.note}"` : ''}`,
          ]
          if (graph.sketchSeq < sketch.seq) {
            head.push(
              `This sketch is not interpreted yet (the graph is from sketch #${graph.sketchSeq}). If no interpreter is running, interpret it yourself: ` +
                'look at the image and shapes, then call interpret with nodes (label, kind, shapeIds = the box/outline plus the handwriting or text inside it; reuse an existing node id when it is the same component) ' +
                'and edges (from/to = node ids from your nodes, shapeIds = the arrow or line). Ask at most a couple of real questions via `questions`; ' +
                'if the user wrote answers beside open questions, pass them as `answers`.',
            )
          } else {
            head.push(`Interpreted (graph v${graph.version}). Call get_architecture for the readable view.`)
          }
          const content: CallToolResult['content'] = [{ type: 'text', text: head.join('\n') }]
          if (image && sketch.hasImage && image.length <= 4_500_000) content.push({ type: 'image', data: image.toString('base64'), mimeType: 'image/png' })
          else if (image && sketch.hasImage) head.push('(The PNG is too large to attach; use the shape listing.)')
          else head.push('(No PNG was captured with this submit; use the shape listing.)')
          content[0] = { type: 'text', text: head.join('\n') }

          const MAX_SHAPES = 400
          const lines = sketch.shapes.slice(0, MAX_SHAPES).map(shapeLine)
          if (sketch.shapes.length > MAX_SHAPES) lines.push(`… ${sketch.shapes.length - MAX_SHAPES} more shapes`)
          content.push({ type: 'text', text: `Shapes (id type @x,y w×h):\n${lines.join('\n')}` })

          // Open questions with their page position, so handwriting beside them can be matched to answers.
          let questions: Array<{ markId: string; text: string; at: { x: number; y: number } }> = []
          try {
            const { marks } = await b.listMarks({ status: 'pending' })
            questions = marks
              .filter((m) => m.type === 'note' && m.data.question)
              .map((m) => {
                const o = targetOrigin(graph, m.target) ?? { x: 0, y: 0 }
                return { markId: m.id, text: m.data.text ?? '', at: { x: r(o.x + (m.data.offset?.x ?? 0)), y: r(o.y + (m.data.offset?.y ?? 0)) } }
              })
          } catch {
            // Questions are a nicety here; the sketch is what matters.
          }
          content.push({ type: 'text', text: `Current graph:\n${json(compactGraph(graph))}${questions.length ? `\n\nOpen questions (answers may be handwritten beside them):\n${json(questions)}` : ''}` })
          return { content }
        }),
      ),
  )

  server.registerTool(
    'interpret',
    {
      title: 'Interpret the latest sketch',
      description:
        'Set the interpretation of the latest sketch: which shapes form which components and connections. For when no interpreter has read the sketch yet (see get_sketch). Nested fields use camelCase (shapeIds, markId).',
      inputSchema: {
        nodes: z.array(interpNode).describe('Components. Each needs a label and the shapeIds it was drawn with.'),
        edges: z.array(interpEdge).describe('Connections between nodes (ids from `nodes`).'),
        questions: z
          .array(z.object({ target: z.string().optional().describe('Node id or label'), at: point.optional(), text: z.string() }))
          .optional()
          .describe(`At most ${LIMITS.questionsPerSubmit} real questions; each becomes a margin note for the user.`),
        answers: z
          .array(z.looseObject({ markId: z.string().optional(), answer: z.string() }))
          .optional()
          .describe('Answers the user wrote beside earlier question notes ({markId, answer}).'),
        summary: z.string().optional().describe('One line describing the system.'),
      },
      annotations: WRITE,
    },
    (args) =>
      safe(() =>
        withBackend(async (b) => {
          const result = normalizeInterpretation(args as Parameters<typeof normalizeInterpretation>[0])
          const { graph, questions } = await b.interpret(author(), result)
          const live = graph.nodes.filter((n) => !n.removed)
          const labels = new Map(graph.nodes.map((n) => [n.id, n.override?.label ?? n.label]))
          const dropped = result.nodes.length - graph.nodes.filter((n) => n.origin === 'ink').length
          return text(
            `Interpreted sketch #${graph.sketchSeq}: ${live.length} nodes, ${graph.edges.filter((e) => !e.removed).length} edges (graph v${graph.version}).`,
            `Nodes:\n${live.map((n) => `- ${n.id} · ${labels.get(n.id)}${n.kind ? ` · ${n.kind}` : ''} · ${n.status}`).join('\n') || '- (none)'}`,
            graph.edges.length > 0 && `Edges:\n${graph.edges.filter((e) => !e.removed).map((e) => `- ${e.id}: ${labels.get(e.from) ?? e.from} → ${labels.get(e.to) ?? e.to}${e.label ? ` "${e.label}"` : ''}`).join('\n')}`,
            dropped > 0 && `${dropped} node(s) were dropped because none of their shapeIds exist in the sketch and they matched no existing node.`,
            questions.length > 0 && `Questions posted as margin notes: ${questions.map((q) => `${q.id} "${q.data.text}"`).join('; ')}`,
            b.mode === 'files' && FILES_NOTE,
          )
        }),
      ),
  )

  server.registerTool(
    'add',
    {
      title: 'Propose a new component or connection',
      description:
        'Propose a new component, optionally wired to existing ones, or (with `edge` and no label) a connection between two existing components. Waits for the user to accept on the canvas.',
      inputSchema: {
        near: z.string().optional().describe('Existing node (id or label) to place the new component beside'),
        at: point.optional(),
        label: z.string().optional().describe('Label of the new component'),
        kind: z.string().optional().describe('service | database | queue | cache | client | storage | worker | external | model | ...'),
        connect_from: refs.optional().describe('Draw edges from these nodes to the new one'),
        connect_to: refs.optional().describe('Draw edges from the new node to these'),
        edge_label: z.string().optional(),
        edge: edgeSpec.optional().describe('An edge between two existing nodes'),
        reason,
      },
      annotations: WRITE,
    },
    (a) =>
      markTool([
        normalizeMarkInput({
          type: 'add',
          target: a.near,
          at: a.at,
          label: a.label,
          kind: a.kind,
          connect_from: a.connect_from,
          connect_to: a.connect_to,
          edge_label: a.edge_label,
          edge: a.edge,
          reason: a.reason,
        }),
      ]),
  )

  server.registerTool(
    'strike',
    {
      title: 'Propose removing a component or connection',
      description: "Propose striking a node or edge from the architecture. The user's ink is dimmed, never deleted. Waits for the user to accept.",
      inputSchema: { target: z.string().describe('Node/edge id, node label, or "A -> B"'), reason },
      annotations: WRITE,
    },
    ({ target, reason }) => markTool([{ type: 'strike', target, reason }]),
  )

  server.registerTool(
    'rewrite',
    {
      title: 'Propose renaming a component',
      description: "Propose a corrected label (and optionally kind) for a node or edge, e.g. when the drawing's wording doesn't match what's being built. Waits for the user to accept.",
      inputSchema: { target: z.string().describe('Node/edge id or node label'), label: z.string().min(1), kind: z.string().optional(), reason },
      annotations: WRITE,
    },
    ({ target, label, kind, reason }) => markTool([{ type: 'rewrite', target, label, ...(kind ? { kind } : {}), reason }]),
  )

  server.registerTool(
    'annotate',
    {
      title: 'Write a margin note or question',
      description: 'Write a note in the margin beside a node/edge (or at a point). Set question: true to ask the user something; their answer comes back in list_marks.',
      inputSchema: {
        target: z.string().optional().describe('Node/edge id or node label'),
        at: point.optional(),
        text: z.string().min(1),
        question: z.boolean().optional(),
        reason: z.string().optional(),
      },
      annotations: WRITE,
    },
    (a) => markTool([normalizeMarkInput({ type: 'note', target: a.target, at: a.at, text: a.text, question: a.question, reason: a.reason })]),
  )

  server.registerTool(
    'set_status',
    {
      title: 'Report build progress on a component',
      description: 'Set a node\'s build status as work lands. Progress reports are auto-accepted and show on the canvas immediately.',
      inputSchema: {
        node: z.string().describe('Node id or label'),
        status: nodeStatus.describe(NODE_STATUSES.join(' | ')),
        detail: z.string().optional().describe('Short detail, e.g. what is blocking it'),
      },
      annotations: { ...WRITE, idempotentHint: true },
    },
    ({ node, status, detail }) => markTool([{ type: 'status', target: node, status: status as MarkInput['status'], ...(detail ? { detail } : {}) }]),
  )

  server.registerTool(
    'propose',
    {
      title: 'Propose several changes as one batch',
      description: `Propose several marks as one atomic batch (all land or none), finished on return so the user sees it as ready. At most ${LIMITS.marksPerBatch} proposal marks; status marks may ride along and land immediately.`,
      inputSchema: {
        marks: z.array(markInput).min(1),
        message: z.string().optional().describe('One line for the user about this batch'),
      },
      annotations: WRITE,
    },
    ({ marks, message }) =>
      safe(async () => {
        const inputs = marks.map((m) => normalizeMarkInput(m as Loose))
        const proposals = inputs.filter((m) => m.type !== 'status').length
        if (proposals > LIMITS.marksPerBatch) {
          throw new VibeprintError(
            `A batch holds at most ${LIMITS.marksPerBatch} marks; you sent ${proposals}. Keep only the marks that matter, propose them, and wait for review before sending the rest.`,
            429,
          )
        }
        return withBackend(async (b) => {
          // A propose is its own batch: close whatever single marks were still collecting.
          if (proposals) await b.finishBatch(author())
          const res = await b.addMarks(author(), inputs, { message, finish: true })
          return text(formatMarkResult(res, author(), b.mode))
        })
      }),
  )

  server.registerTool(
    'finish_batch',
    {
      title: 'Finish your open batch',
      description: 'Close your open batch of proposals so the user sees it as ready for review.',
      inputSchema: { message: z.string().optional().describe('One line for the user about this batch') },
      annotations: WRITE,
    },
    ({ message }) =>
      safe(() =>
        withBackend(async (b) => {
          const { batch } = await b.finishBatch(author(), message)
          if (!batch) return text(`${author()} has no open batch. (Marks join a batch automatically; propose finishes its batch on return.)`)
          return text(`Batch ${batch.id} finished: ${batch.summary}. It is shown to the user as ready for review.`, PROPOSAL_REMINDER, b.mode === 'files' && FILES_NOTE)
        }),
      ),
  )

  server.registerTool(
    'list_marks',
    {
      title: 'List marks and decisions',
      description: 'Marks with their status: pending proposals, and accepted/rejected decisions so you learn the outcome (plus answers to questions). Progress (status) updates are omitted.',
      inputSchema: {
        status: z.enum(['pending', 'accepted', 'rejected']).optional(),
        mine: z.boolean().optional().describe('Only marks from you'),
      },
      annotations: READ,
    },
    ({ status, mine }) =>
      safe(() =>
        withBackend(async (b) => {
          const { marks } = await b.listMarks({ ...(status ? { status } : {}), ...(mine ? { author: author() } : {}) })
          const shown = marks.filter((m) => m.type !== 'status')
          const progress = marks.length - shown.length
          const filter = [status, mine && `from ${author()}`].filter(Boolean).join(', ')
          if (!shown.length) return text(`No marks${filter ? ` (${filter})` : ''}.${progress ? ` (${progress} progress updates omitted.)` : ''}`)
          const MAX = 80
          const pending = shown.filter((m) => m.status === 'pending')
          const decided = shown.filter((m) => m.status !== 'pending').sort((x, y) => (y.decidedAt ?? '').localeCompare(x.decidedAt ?? ''))
          const L: string[] = [`${shown.length} marks${filter ? ` (${filter})` : ''}${progress ? `; ${progress} progress updates omitted` : ''}.`]
          let budget = MAX
          const section = (title: string, list: DescribedMark[]) => {
            if (!list.length || budget <= 0) return
            const take = list.slice(0, budget)
            budget -= take.length
            L.push(`\n${title} (${list.length}):`, ...take.map((m) => `- ${formatMark(m)}`))
            if (take.length < list.length) L.push(`  … ${list.length - take.length} more`)
          }
          section('Pending (waiting for the user)', pending)
          section('Accepted (part of the architecture now; build it)', decided.filter((m) => m.status === 'accepted'))
          section("Rejected (don't do these)", decided.filter((m) => m.status === 'rejected'))
          return text(L.join('\n'))
        }),
      ),
  )

  server.registerTool(
    'read_chat',
    {
      title: 'Read the canvas chat',
      description: 'Messages from the chat panel on the canvas (user, agents, and system events).',
      inputSchema: { since: z.string().optional().describe('Only messages after this message id or ISO time') },
      annotations: READ,
    },
    ({ since }) =>
      safe(() =>
        withBackend(async (b) => {
          const { messages } = await b.chat(since)
          if (!messages.length) return text(since ? `No new messages since ${since}.` : 'No chat messages yet.')
          const MAX = 50
          const shown = messages.slice(-MAX)
          const last = shown[shown.length - 1]
          return text(
            messages.length > MAX ? `(${messages.length - MAX} earlier messages omitted)` : '',
            formatChat(shown),
            `To read only newer messages, pass since: "${last.createdAt}".`,
          )
        }),
      ),
  )

  server.registerTool(
    'post_chat',
    {
      title: 'Post to the canvas chat',
      description: 'Say something to the user in the chat panel on the canvas. Use marks, not chat, for structural changes.',
      inputSchema: { text: z.string().min(1) },
      annotations: WRITE,
    },
    ({ text: msg }) =>
      safe(() =>
        withBackend(async (b) => {
          const { message } = await b.postChat(msg, author())
          return text(`Posted to the canvas chat as ${message.author} (${message.id}).`, b.mode === 'files' && FILES_NOTE)
        }),
      ),
  )

  server.registerTool(
    'wait_for_user',
    {
      title: 'Wait for the user',
      description:
        'Long-poll until the user does something: submits a sketch, sends a chat message, or accepts/rejects marks. Needs `vibeprint serve`. Pass the returned cursor as `since` next time so nothing is missed. Keep timeout_seconds under your MCP tool timeout (Codex defaults to 60s).',
      inputSchema: {
        timeout_seconds: z.number().int().min(1).max(600).optional().describe('Default 50'),
        since: z.string().optional().describe('Cursor from the previous wait_for_user'),
      },
      annotations: READ,
    },
    ({ timeout_seconds, since }, extra) =>
      safe(() =>
        withBackend(async (b) => {
          const timeoutMs = (timeout_seconds ?? 50) * 1000
          // Keep clients that reset their timeout on progress from giving up early.
          const token = extra._meta?.progressToken
          let tick = 0
          const timer =
            token !== undefined && b.mode === 'daemon'
              ? setInterval(() => {
                  extra
                    .sendNotification({ method: 'notifications/progress', params: { progressToken: token, progress: ++tick, message: 'Waiting for the user…' } })
                    .catch(() => {})
                }, 15_000)
              : undefined
          try {
            const res = await b.wait({ since, timeoutMs, author: author() })
            const L: string[] = []
            if (res.note) L.push(res.note)
            if (res.events.length) L.push(res.events.map(formatEvent).join('\n'))
            else if (b.mode === 'daemon') L.push(`No activity in ${timeoutMs / 1000}s.`)
            else L.push(since ? `Nothing recorded since ${since}.` : 'Pass `since` (an ISO time) to see what happened after it.')
            L.push(`Cursor: ${res.cursor} — pass it as since on the next wait_for_user.`)
            return text(...L)
          } finally {
            if (timer) clearInterval(timer)
          }
        }),
      ),
  )

  return server
}

/** Run over stdio. Claude Code and Codex launch this as `vibeprint mcp`. */
export async function runMcpServer(opts: McpServerOptions): Promise<void> {
  const server = createMcpServer(opts)
  const transport = new StdioServerTransport()
  await server.connect(transport)
  process.stderr.write(`vibeprint mcp: serving ${opts.root}\n`)
  const close = () => {
    server.close().finally(() => process.exit(0))
  }
  process.on('SIGINT', close)
  process.on('SIGTERM', close)
}
