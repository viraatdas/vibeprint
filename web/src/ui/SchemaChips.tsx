import { api } from '../api'
import { toast, useUi } from '../store'
import type { NodeGeom } from '../agent/layout'

type Cam = { x: number; y: number; z: number }

/**
 * A "Tables" chip under each database: one tap has the coding agent on this machine read the
 * schema from the code and draw its tables, with example rows, beside it.
 */
export function SchemaChips({ nodes, cam }: { nodes: NodeGeom[]; cam: Cam }) {
  const vp = useUi((s) => s.vp)
  if (!vp || vp.mapper.mode === 'none') return null
  const busy = vp.mapper.active
  const shown = new Set(vp.marks.filter((m) => m.type === 'table' && m.status === 'accepted' && m.target.kind === 'node').map((m) => (m.target as { id: string }).id))
  const dbs = nodes.filter((n) => n.node.kind === 'database' && !n.node.removed && !shown.has(n.node.id))
  if (!dbs.length) return null
  const reading = busy && vp.mapper.task === 'schema'
  const run = async (id: string) => {
    try {
      const res = await api.showSchema(id)
      toast(`${res.reading} is reading the schema…`)
    } catch (err) {
      toast((err as Error).message, 7000)
    }
  }
  return (
    <div className="vp-chips">
      {dbs.map(({ node, rect }) => (
        <button
          key={node.id}
          className="vp-chip"
          style={{ left: (rect.x + rect.w / 2 + cam.x) * cam.z, top: (rect.y + rect.h + cam.y) * cam.z + 10 }}
          disabled={busy}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => run(node.id)}
          title={`Read ${node.label}'s tables from the code and show them with example rows`}
        >
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
            <path d="M4 5h16v14H4zM4 10h16M10 10v9" />
          </svg>
          {reading ? 'Reading…' : 'Tables'}
        </button>
      ))}
    </div>
  )
}
