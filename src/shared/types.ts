// Shared data model for Vibeprint. Used by the daemon, the MCP server, the
// interpreters and the web app. Everything here is plain JSON so it can be
// written to `.vibeprint/` and committed to git.

export interface Point {
  x: number
  y: number
}

export interface Size {
  w: number
  h: number
}

/** Axis-aligned rectangle in tldraw page space. */
export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

// ---------------------------------------------------------------------------
// Sketch: what the iPad sends on submit (the user's ink, flattened)
// ---------------------------------------------------------------------------

export type SketchShapeType =
  | 'draw'
  | 'geo'
  | 'text'
  | 'arrow'
  | 'line'
  | 'note'
  | 'frame'
  | 'highlight'
  | 'image'
  | 'other'

export interface SketchShape {
  /** tldraw shape id, e.g. "shape:abc123". Graph nodes bind to these. */
  id: string
  type: SketchShapeType
  /** Page-space bounds. */
  bounds: Rect
  /** Typed text: text shapes, geo labels, sticky notes, arrow labels. */
  text?: string
  /** Geo kind for geo shapes (rectangle, ellipse, cloud, ...). */
  geo?: string
  /** For draw strokes: whether the stroke closes on itself (a hand-drawn box/circle). */
  closed?: boolean
  /** For draw/line strokes: simplified page-space polyline (at most ~48 points). */
  points?: Point[]
  /** For arrows: page-space endpoints and the shapes they are bound to, if any. */
  arrow?: {
    start: Point
    end: Point
    startShapeId?: string
    endShapeId?: string
  }
  /** Parent frame id, if the shape sits in a frame. */
  parentId?: string
}

export interface Sketch {
  /** Monotonic submit counter for this repo. */
  seq: number
  createdAt: string
  shapes: SketchShape[]
  /** Union of all shape bounds, or null for an empty canvas. */
  bounds: Rect | null
  /** Whether `.vibeprint/sketch.png` was written for this submit. */
  hasImage: boolean
  /** Optional message typed alongside the submit. */
  note?: string
}

// ---------------------------------------------------------------------------
// Graph: the private architecture the agent infers. Users never edit it.
// ---------------------------------------------------------------------------

export type NodeStatus = 'planned' | 'building' | 'done' | 'blocked'
export const NODE_STATUSES: NodeStatus[] = ['planned', 'building', 'done', 'blocked']

export interface GraphNode {
  /** Stable id, e.g. "n_api". Survives re-interpretation when the ink overlaps. */
  id: string
  label: string
  /** service | database | queue | cache | client | storage | worker | external | model | ... */
  kind?: string
  /** Faint interpretation tags rendered on the canvas ("Postgres", "queue"). */
  tags: string[]
  /** The user's ink this node came from. Empty for agent-added nodes. */
  shapeIds: string[]
  /** Region at last interpretation (page space). Live position comes from shapeIds. */
  bounds: Rect
  origin: 'ink' | 'agent'
  /** Agent nodes are placed relative to another node so they follow it. */
  anchor?: { nodeId: string; dx: number; dy: number }
  status: NodeStatus
  statusDetail?: string
  /** Set by an accepted strike. The ink is dimmed, never deleted. */
  removed?: boolean
  /** Set by an accepted rewrite. Re-interpretation keeps it. */
  override?: { label?: string; kind?: string }
  description?: string
}

export interface GraphEdge {
  id: string
  from: string
  to: string
  label?: string
  shapeIds: string[]
  origin: 'ink' | 'agent'
  removed?: boolean
  override?: { label?: string }
}

export interface Graph {
  /** Increments on every change. */
  version: number
  /** The submit this graph was last interpreted from (0 = never). */
  sketchSeq: number
  interpretedBy?: string
  updatedAt: string
  /** One-line description of the system, if the interpreter gave one. */
  summary?: string
  nodes: GraphNode[]
  edges: GraphEdge[]
}

// ---------------------------------------------------------------------------
// Marks: every agent action is a record in its own color.
// ---------------------------------------------------------------------------

export type MarkType = 'add' | 'strike' | 'rewrite' | 'note' | 'status'
export const MARK_TYPES: MarkType[] = ['add', 'strike', 'rewrite', 'note', 'status']
export type MarkStatus = 'pending' | 'accepted' | 'rejected'
export type Decision = 'accept' | 'reject'

export type MarkTarget =
  | { kind: 'node'; id: string }
  | { kind: 'edge'; id: string }
  /** A free region of the page (page coordinates). */
  | { kind: 'point'; x: number; y: number }

export interface MarkEdgeSpec {
  from: string
  to: string
  label?: string
}

export interface MarkData {
  // add: a new node (nodeId + label) and/or new edges
  nodeId?: string
  label?: string
  kind?: string
  edges?: MarkEdgeSpec[]
  // add + note placement, relative to the target's top-left (or the point)
  offset?: Point
  size?: Size
  // note
  text?: string
  question?: boolean
  /** The user's answer, filled in when a later interpretation reads it. */
  answer?: string
  // status
  nodeStatus?: NodeStatus
  detail?: string
}

export interface Mark {
  id: string
  /** Who made it: "claude", "codex", "vibeprint" (built-in interpreter), ... */
  author: string
  batchId: string
  type: MarkType
  target: MarkTarget
  status: MarkStatus
  createdAt: string
  decidedAt?: string
  /** One line explaining why. Shown when the user taps the mark. */
  reason?: string
  data: MarkData
}

export interface Batch {
  id: string
  author: string
  createdAt: string
  /** Set when the batch hit the cap or the agent finished it. */
  closedAt?: string
  /** "3 adds, 1 strike, 1 question" */
  summary: string
  /** Optional one-line message from the agent. */
  message?: string
  markIds: string[]
  /** Status-only batches are auto-accepted progress reports. */
  kind: 'proposal' | 'progress'
}

/** What an agent sends to create a mark. Targets may be ids or labels. */
export interface MarkInput {
  type: MarkType
  /** Node or edge id (or node label). Required for strike, rewrite and status; anchor for add/note. */
  target?: string
  /** Page coordinate for add/note marks that are not anchored to a node. */
  at?: Point
  /** add: label of the new node. rewrite: the corrected label. */
  label?: string
  kind?: string
  /** add: draw edges from these nodes to the new node. */
  connectFrom?: string[]
  /** add: draw edges from the new node to these nodes. */
  connectTo?: string[]
  edgeLabel?: string
  /** add: an edge between two existing nodes (no new node). */
  edge?: MarkEdgeSpec
  /** note: the text of the margin note. */
  text?: string
  /** note: whether it is a question the user should answer. */
  question?: boolean
  /** status: the node's new build status. */
  status?: NodeStatus
  detail?: string
  reason?: string
}

// ---------------------------------------------------------------------------
// Chat + interpretation
// ---------------------------------------------------------------------------

export interface ChatMessage {
  id: string
  role: 'user' | 'agent' | 'system'
  author: string
  text: string
  createdAt: string
  batchId?: string
}

/** What an interpreter (heuristic, Claude API, or a coding agent via MCP) returns. */
export interface InterpretationResult {
  nodes: Array<{
    /** Reuse an existing node id when this is the same component; otherwise any temp id. */
    id?: string
    label: string
    kind?: string
    tags?: string[]
    /** The sketch shape ids this node was drawn with (box + handwriting inside it). */
    shapeIds: string[]
    description?: string
  }>
  edges: Array<{
    id?: string
    /** Node ids from `nodes` above. */
    from: string
    to: string
    label?: string
    shapeIds?: string[]
  }>
  /** At most a couple of real questions. Each becomes a margin note. */
  questions?: Array<{ target?: string; at?: Point; text: string }>
  /** Answers the user wrote beside earlier question notes. */
  answers?: Array<{ markId: string; answer: string }>
  summary?: string
}

export interface OpenQuestion {
  markId: string
  text: string
  target: MarkTarget
  /** Page-space position of the note, so handwriting beside it can be matched. */
  at: Point
}

export interface InterpretInput {
  sketch: Sketch
  /** PNG of the canvas at submit time. */
  image?: Buffer
  previous: Graph
  openQuestions: OpenQuestion[]
}

// ---------------------------------------------------------------------------
// Live state broadcast to the canvas
// ---------------------------------------------------------------------------

export interface InterpreterInfo {
  /** Which interpreter runs on submit. */
  mode: 'claude-api' | 'heuristic'
  model?: string
  active: boolean
  startedAt?: string
  lastError?: string
}

export interface VibeprintState {
  project: { name: string; root: string }
  graph: Graph
  marks: Mark[]
  batches: Batch[]
  chat: ChatMessage[]
  sketch: { seq: number; createdAt: string | null; shapeCount: number; hasImage: boolean }
  interpreter: InterpreterInfo
  /** Agents seen through MCP recently (author -> last seen ISO time). */
  agents: Record<string, string>
}

/** Compact view handed to coding agents by get_architecture. */
export interface ArchitectureView {
  project: string
  summary?: string
  sketchSeq: number
  graphVersion: number
  nodes: Array<{
    id: string
    label: string
    kind?: string
    status: NodeStatus
    statusDetail?: string
    origin: 'ink' | 'agent'
    tags: string[]
    description?: string
    connectsTo: string[]
  }>
  edges: Array<{ id: string; from: string; to: string; label?: string }>
  removed: Array<{ id: string; label: string }>
  pending: Array<{ batchId: string; author: string; summary: string; marks: Array<{ id: string; type: MarkType; describe: string }> }>
  openQuestions: Array<{ markId: string; text: string; target: string }>
  recentDecisions: Array<{ markId: string; author: string; status: MarkStatus; describe: string; decidedAt?: string }>
  rule: string
}

export const AGENT_RULE =
  'Read the architecture through the Vibeprint tools before starting work. If the build needs a structural change, propose it as a mark and wait for approval. Never deviate silently.'

export const LIMITS = {
  /** Proposal marks per batch ("a handful"). */
  marksPerBatch: 6,
  /** Unreviewed proposal marks one author may have outstanding. */
  pendingPerAuthor: 12,
  /** A batch stays open for more marks for this long after its last mark. */
  batchOpenMs: 90_000,
  /** Questions the interpreter may ask per submit. */
  questionsPerSubmit: 2,
  chatHistory: 400,
} as const
