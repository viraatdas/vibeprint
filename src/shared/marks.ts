import { nodeLabel, targetName } from './graph.js'
import type { Batch, Graph, Mark, Size, TableSpec } from './types.js'

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

/** "3 adds, 1 strike, 1 question" */
export function summarizeMarks(marks: Pick<Mark, 'type' | 'data'>[]): string {
  let adds = 0
  let strikes = 0
  let rewrites = 0
  let notes = 0
  let questions = 0
  let statuses = 0
  let tables = 0
  for (const m of marks) {
    if (m.type === 'add') adds++
    else if (m.type === 'strike') strikes++
    else if (m.type === 'rewrite') rewrites++
    else if (m.type === 'note') (m.data.question ? questions++ : notes++)
    else if (m.type === 'status') statuses++
    else if (m.type === 'table') tables++
  }
  const parts: string[] = []
  if (adds) parts.push(plural(adds, 'add'))
  if (strikes) parts.push(plural(strikes, 'strike'))
  if (rewrites) parts.push(plural(rewrites, 'rewrite'))
  if (questions) parts.push(plural(questions, 'question'))
  if (notes) parts.push(plural(notes, 'note'))
  if (statuses) parts.push(plural(statuses, 'status update'))
  if (tables) parts.push(plural(tables, 'table'))
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
    case 'table': {
      const t = d.table
      if (!t) return `table on ${on}`
      return `table ${t.name}${mark.target.kind === 'point' ? '' : ` on ${on}`}: ${plural(t.columns.length, 'column')}, ${plural(t.rows.length, 'example row')}${t.source ? ` (${t.source})` : ''}`
    }
  }
}

/** How a table is drawn (page units); the canvas and the placement both use it. */
export const TABLE = {
  title: 34,
  head: 44,
  row: 28,
  pad: 10,
  /** Average character widths: cells (13px mono), column names (13.5px semibold), types (11px mono). */
  char: 7.9,
  nameChar: 8.2,
  typeChar: 6.7,
  /** Room for a PK/FK tag after a column name. */
  keyW: 24,
  minCol: 64,
  maxCol: 240,
  maxColumns: 12,
  maxRows: 8,
}

/** The second header line: the type, and where a foreign key points. */
export const columnTypeLine = (c: TableSpec['columns'][number]) => [c.type, c.references ? `→ ${c.references}` : ''].filter(Boolean).join(' ')

export function tableColumnWidths(t: TableSpec): number[] {
  return t.columns.map((c, i) => {
    const px = Math.max(
      c.name.length * TABLE.nameChar + (c.key ? TABLE.keyW : 0),
      columnTypeLine(c).length * TABLE.typeChar,
      ...t.rows.map((r) => (r[i] ?? '').length * TABLE.char),
    )
    return Math.ceil(Math.min(TABLE.maxCol, Math.max(TABLE.minCol, px + 2 * TABLE.pad)))
  })
}

export function tableSize(t: TableSpec): Size {
  const w = tableColumnWidths(t).reduce((a, b) => a + b, 0)
  return { w: Math.max(w, 160), h: TABLE.title + TABLE.head + t.rows.length * TABLE.row }
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
// The hand font averages ~9px a character at 16px; 18 fit inside the note's padding.
export const NOTE_CHARS_PER_LINE = 18
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
