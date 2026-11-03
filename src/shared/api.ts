// HTTP contract between the daemon, the web app and the MCP server.
import type { ChatMessage, Decision, InterpretationResult, MarkInput, MarkStatus, SketchShape } from './types.js'

export const TOKEN_HEADER = 'x-vibeprint-token'
export const TOKEN_COOKIE = 'vp_token'
export const DEFAULT_PORT = 4747

export interface DaemonInfo {
  pid: number
  port: number
  host: string
  token: string
  startedAt: string
  root: string
  urls: string[]
}

export interface SubmitBody {
  shapes: SketchShape[]
  /** PNG, base64 (no data: prefix). */
  image?: string
  note?: string
}

export interface MarksBody {
  author: string
  marks: MarkInput[]
  message?: string
  finish?: boolean
}

export interface InterpretationBody {
  author: string
  result: InterpretationResult
}

export interface MapResult {
  seq: number
  nodes: number
  edges: number
  /** Whether it replaced an earlier map nobody had edited. */
  replaced: boolean
  shapeIds: string[]
  /** Set when a model is now reading the code to redraw this quick map ("Claude Code"). */
  reading?: string
}

export interface DecideBody {
  decision: Decision
}

export interface ChatBody {
  text: string
  author?: string
  role?: ChatMessage['role']
}

export type ActivityEvent =
  | { type: 'submit'; at: string; seq: number; shapeCount: number; note?: string }
  /** The existing code was drawn onto the canvas (by the scanner or an agent). */
  | { type: 'map'; at: string; seq: number; author: string; nodes: number; edges: number }
  | { type: 'chat'; at: string; message: ChatMessage }
  | { type: 'decision'; at: string; marks: Array<{ id: string; author: string; status: MarkStatus; describe: string }> }

export interface WaitResult {
  events: ActivityEvent[]
  /** Pass back as `since` on the next wait. */
  cursor: string
  timedOut: boolean
}

/** Runtime config the daemon injects into the web page. */
export interface ClientConfig {
  project: string
  agentColor: string
  inkColor: string
}
