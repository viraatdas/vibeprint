// The canvas as plain text for a coding agent that has no Vibeprint tools, such as an agent
// Rudder runs. The user sends it as an ordinary message when they choose to; nothing here
// reaches an agent on its own.
import type { ArchitectureView } from '../shared/types.js'

export interface Brief {
  text: string
  /** When the brief was made: pass it back as `since` next time to list only newer decisions. */
  at: string
  /** Components on the canvas. Zero means there is nothing to send yet. */
  components: number
}

const STATUS: Record<string, string> = { planned: 'planned', building: 'in progress', done: 'built', blocked: 'blocked' }

export function makeBrief(view: ArchitectureView, since?: string, now = new Date()): Brief {
  const byId = new Map(view.nodes.map((n) => [n.id, n.label]))
  const lines: string[] = [`This is the architecture I drew for ${view.project} on the Vibeprint canvas.`]
  if (view.summary) lines.push('', view.summary)
  if (view.nodes.length) {
    lines.push('', 'Components:')
    for (const n of view.nodes) {
      const about = [n.kind, STATUS[n.status] ?? n.status].filter(Boolean).join(', ')
      const detail = [n.description, n.statusDetail && n.statusDetail !== n.description ? n.statusDetail : ''].filter(Boolean).join('; ')
      lines.push(`- ${n.label} (${about})${detail ? `: ${detail}` : ''}`)
    }
  }
  if (view.edges.length) {
    lines.push('', 'Connections:')
    for (const e of view.edges) lines.push(`- ${byId.get(e.from) ?? e.from} → ${byId.get(e.to) ?? e.to}${e.label ? `: ${e.label}` : ''}`)
  }
  if (view.removed.length) lines.push('', `Removed: ${view.removed.map((r) => r.label).join(', ')}`)
  const decided = view.recentDecisions.filter((d) => !since || (d.decidedAt ?? '') > since)
  const accepted = decided.filter((d) => d.status === 'accepted')
  const rejected = decided.filter((d) => d.status === 'rejected')
  const when = since ? ' since my last message about it' : ''
  if (accepted.length) lines.push('', `Changes I accepted${when}:`, ...accepted.map((d) => `- ${d.describe}`))
  if (rejected.length) lines.push('', `Changes I rejected${when} (don't build these):`, ...rejected.map((d) => `- ${d.describe}`))
  if (view.openQuestions.length) lines.push('', 'Open questions on the canvas:', ...view.openQuestions.map((q) => `- ${q.target ? `${q.target}: ` : ''}${q.text}`))
  lines.push('', 'Build against this. If the code needs a structural change (a new component or connection, or removing or renaming one), tell me before you make it.')
  return { text: lines.join('\n'), at: now.toISOString(), components: view.nodes.length }
}
