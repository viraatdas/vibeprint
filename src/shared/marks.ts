import { nodeLabel, targetName } from './graph.js'
import type { Batch, Graph, Mark, Size } from './types.js'

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

/** "3 adds, 1 strike, 1 question" */
export function summarizeMarks(marks: Pick<Mark, 'type' | 'data'>[]): string {
  let adds = 0
  let strikes = 0
  let rewrites = 0
  let notes = 0
  let questions = 0
  let statuses = 0
  for (const m of marks) {
    if (m.type === 'add') adds++
    else if (m.type === 'strike') strikes++
    else if (m.type === 'rewrite') rewrites++
    else if (m.type === 'note') (m.data.question ? questions++ : notes++)
    else if (m.type === 'status') statuses++
  }
  const parts: string[] = []
  if (adds) parts.push(plural(adds, 'add'))
  if (strikes) parts.push(plural(strikes, 'strike'))
  if (rewrites) parts.push(plural(rewrites, 'rewrite'))
  if (questions) parts.push(plural(questions, 'question'))
  if (notes) parts.push(plural(notes, 'note'))
  if (statuses) parts.push(plural(statuses, 'status update'))
  return parts.join(', ') || 'nothing'
}

/** One human line describing a mark, e.g. `add "Redis cache" next to API`. */
export function describeMark(mark: Mark, graph: Graph): string {
  const on = targetName(graph, mark.target)
  const d = mark.data
  switch (mark.type) {
    case 'add': {
      const edges = (d.edges ?? []).map((e) => `${refName(graph, e.from, mark)} → ${refName(graph, e.to, mark)}`)
      if (d.nodeId) {
        return `add "${d.label}"${d.kind ? ` (${d.kind})` : ''} near ${on}${edges.length ? `, wired ${edges.join(', ')}` : ''}`
      }
      return `connect ${edges.join(', ')}${d.edges?.[0]?.label ? ` ("${d.edges[0].label}")` : ''}`
    }
    case 'strike':
      return `strike ${on}`
    case 'rewrite':
      return `rewrite ${on} → "${d.label}"${d.kind ? ` (${d.kind})` : ''}`
    case 'note':
      return `${d.question ? 'question' : 'note'} on ${on}: ${d.text}`
    case 'status':
      return `${on} → ${d.nodeStatus}${d.detail ? ` (${d.detail})` : ''}`
  }
}

function refName(graph: Graph, id: string, mark: Mark): string {
  if (id === mark.data.nodeId) return `"${mark.data.label}"`
  const n = graph.nodes.find((x) => x.id === id)
  return n ? nodeLabel(n) : id
}

/** Size of an agent-drawn box for a label (page units). */
export function addBoxSize(label: string): Size {
  return { w: Math.round(Math.min(280, Math.max(120, label.length * 11 + 44))), h: 68 }
}

export const NOTE_WIDTH = 190
export const NOTE_CHARS_PER_LINE = 22
export const NOTE_LINE_HEIGHT = 20

export function wrapText(text: string, maxChars = NOTE_CHARS_PER_LINE): string[] {
  const words = text.replace(/\s+/g, ' ').trim().split(' ')
  const lines: string[] = []
  let line = ''
  for (const w of words) {
    if (!line) line = w
    else if ((line + ' ' + w).length <= maxChars) line += ' ' + w
    else {
      lines.push(line)
      line = w
    }
  }
  if (line) lines.push(line)
  return lines.length ? lines : ['']
}

export function noteSize(text: string): Size {
  const lines = wrapText(text).length
  return { w: NOTE_WIDTH, h: Math.round(lines * NOTE_LINE_HEIGHT + 22) }
}

export function batchIsPending(batch: Batch, marks: Mark[]): boolean {
  return batch.markIds.some((id) => marks.find((m) => m.id === id)?.status === 'pending')
}

export function marksOfBatch(batch: Batch, marks: Mark[]): Mark[] {
  const byId = new Map(marks.map((m) => [m.id, m]))
  return batch.markIds.map((id) => byId.get(id)).filter((m): m is Mark => !!m)
}
