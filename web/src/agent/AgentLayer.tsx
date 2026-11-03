import { memo, useMemo, type CSSProperties, type ReactNode } from 'react'
import { useEditor, useEditorValue } from '../canvas/Board'
import { nodeLabel } from '@shared/graph'
import type { Rect } from '@shared/types'
import { useUi } from '../store'
import { computeLayout, type MarkGeom, type Part } from './layout'
import { DRAW_MS } from './pacing'
import { checkMark, crossAt, hashSeed, roughArrow, roughLine, roughRect, strikeThrough, underline } from './rough'
import { MarkBadges } from '../ui/MarkPopover'

const PAD = 10

/** Rendered in front of the canvas: everything the agent has drawn. */
export function AgentLayer() {
  const editor = useEditor()
  const vp = useUi((s) => s.vp)
  const collapsed = useUi((s) => s.collapsed)
  const revealed = useUi((s) => s.revealed)
  const animating = useUi((s) => s.animating)
  const shownTags = useUi((s) => s.shownTags)
  const selected = useUi((s) => s.selected)
  const cam = useEditorValue((e) => e.camera)
  // Marks follow the user's shapes, so the layout reruns whenever the document changes.
  const docVersion = useEditorValue((e) => e.docVersion)
  const layout = useMemo(() => (vp ? computeLayout(vp, (id) => editor.getShapePageBounds(id)) : null), [editor, vp, docVersion])

  const dimCss = useMemo(() => {
    if (!layout || collapsed || !layout.dimmed.length) return ''
    return layout.dimmed.map((id) => `.vp-shape[data-shape-id="${CSS.escape(id)}"]`).join(',\n') + ' { opacity: 0.22 !important; transition: opacity .4s; }'
  }, [layout, collapsed])

  if (!vp || !layout || collapsed) return null
  const marks = layout.marks.filter((m) => revealed.has(m.mark.id))

  return (
    <>
      {dimCss && <style>{dimCss}</style>}
      <svg className="vp-layer" aria-hidden="true">
        <g transform={`scale(${cam.z}) translate(${cam.x} ${cam.y})`}>
          {/* Agent nodes and edges the user accepted */}
          {layout.agentEdges.map((e) => (
            <g key={e.id} className={e.removed ? 'vp-ghost-faint' : undefined}>
              <Arrow a={e.a} b={e.b} seed={hashSeed(e.id)} dashed={false} />
              {e.label && <HandText x={(e.a.x + e.b.x) / 2 + 6} y={(e.a.y + e.b.y) / 2 - 8} size={15} text={e.label} />}
            </g>
          ))}
          {layout.nodes
            .filter((n) => n.node.origin === 'agent')
            .map(({ node, rect }) => (
              <g key={node.id} className={node.removed ? 'vp-ghost-faint' : undefined}>
                <path d={roughRect(rect, hashSeed(node.id))} className="vp-stroke" />
                <HandText x={rect.x + rect.w / 2} y={rect.y + rect.h / 2 + 7} size={20} text={nodeLabel(node)} anchor="middle" />
              </g>
            ))}

          {/* Progress: boxes go from dashed to solid with a check */}
          {layout.nodes
            .filter((n) => n.node.status !== 'planned' && !n.node.removed)
            .map(({ node, rect }) => (
              <StatusMark key={`s-${node.id}-${node.status}`} id={node.id} rect={rect} status={node.status} />
            ))}

          {/* Faint interpretation tags */}
          {layout.nodes
            .filter((n) => !n.node.removed && shownTags[n.node.id]?.length)
            .map(({ node, rect }) => (
              <text key={`t-${node.id}-${shownTags[node.id].join()}`} className="vp-tag" x={rect.x + 2} y={rect.y + rect.h + 20}>
                {shownTags[node.id].join('  ·  ')}
              </text>
            ))}

          {marks.map((g) => (
            <MarkView key={g.mark.id} geom={g} animate={animating === g.mark.id} selected={selected === g.mark.id} />
          ))}
        </g>
      </svg>
      <MarkBadges marks={marks} cam={cam} />
    </>
  )
}

const StatusMark = memo(function StatusMark({ id, rect, status }: { id: string; rect: Rect; status: string }) {
  const r = { x: rect.x - PAD, y: rect.y - PAD, w: rect.w + PAD * 2, h: rect.h + PAD * 2 }
  const seed = hashSeed(id + status)
  return (
    <g className={`vp-status vp-status-${status}`}>
      {status === 'done' && <rect x={r.x} y={r.y} width={r.w} height={r.h} rx={6} className="vp-fill" />}
      <path d={roughRect(r, seed)} className={status === 'building' ? 'vp-stroke vp-dashed' : 'vp-stroke'} />
      {status === 'done' && <path d={checkMark({ x: r.x + r.w - 2, y: r.y + 2 }, 22, seed)} className="vp-stroke vp-bold" />}
      {status === 'building' && <HandText x={r.x + r.w - 4} y={r.y - 6} size={13} text="building" anchor="end" />}
      {status === 'blocked' && <HandText x={r.x + r.w - 4} y={r.y - 6} size={14} text="blocked !" anchor="end" />}
    </g>
  )
})

function MarkView({ geom, animate, selected }: { geom: MarkGeom; animate: boolean; selected: boolean }) {
  const { mark } = geom
  const pending = mark.status === 'pending'
  const seed = hashSeed(mark.id)
  let step = 0
  // Parts draw in sequence, like a pen moving from one stroke to the next.
  const nextDelay = (weight = 1) => {
    const d = step
    step += weight
    return d
  }
  const total = geom.parts.reduce((n, p) => n + (p.t === 'text' ? 0.8 : 1), 0) || 1
  const unit = DRAW_MS / total
  const cls = ['vp-mark', pending ? 'vp-pending' : 'vp-accepted', mark.type === 'note' && !pending ? 'vp-ghost-faint' : '', animate ? 'vp-anim' : '', selected ? 'vp-selected' : '']
    .filter(Boolean)
    .join(' ')

  return (
    <g className={cls} data-mark-id={mark.id}>
      {geom.parts.map((p, i) => {
        const delay = nextDelay(p.t === 'text' ? 0.8 : 1) * unit
        return <PartView key={i} part={p} seed={seed + i * 13} delay={delay} dur={unit * (p.t === 'text' ? 0.8 : 1)} animate={animate} id={`${mark.id}-${i}`} />
      })}
    </g>
  )
}

function PartView({ part: p, seed, delay, dur, animate, id }: { part: Part; seed: number; delay: number; dur: number; animate: boolean; id: string }) {
  const s = { animate, delay, dur, id }
  switch (p.t) {
    case 'box':
      return <Stroke d={roughRect(p.rect, seed)} dashed={p.dashed} {...s} />
    case 'arrow':
      return <Arrow a={p.a} b={p.b} seed={seed} dashed={p.dashed} anim={s} />
    case 'text':
      return <HandText x={p.x} y={p.y} size={p.size} text={p.text} anchor={p.anchor} anim={s} />
    case 'strike':
      return <Stroke d={strikeThrough(p.rect, seed)} bold {...s} />
    case 'cross':
      return (
        <>
          {crossAt(p.c, 11, seed).map((d, i) => (
            <Stroke key={i} d={d} bold {...s} id={`${id}-${i}`} delay={delay + (dur / 2) * i} dur={dur / 2} />
          ))}
        </>
      )
    case 'underline':
      return <Stroke d={underline(p.x, p.y, p.w, seed)} {...s} />
    case 'leader':
      return <Stroke d={roughLine(p.a, p.b, seed, 0.8)} thin dashed {...s} />
    case 'note':
      return <Note part={p} seed={seed} anim={s} />
  }
}

interface Anim {
  animate: boolean
  delay: number
  dur: number
  id: string
}

function animStyle(a: Anim): CSSProperties {
  return { ['--d' as string]: `${Math.round(a.delay)}ms`, ['--dur' as string]: `${Math.round(Math.max(a.dur, 160))}ms` }
}

/** One pen stroke. Draws on when animating; dashed strokes are revealed through a mask. */
function Stroke({ d, dashed, bold, thin, animate, delay, dur, id }: { d: string; dashed?: boolean; bold?: boolean; thin?: boolean } & Anim) {
  const cls = ['vp-stroke', dashed ? 'vp-dashed' : '', bold ? 'vp-bold' : '', thin ? 'vp-thin' : ''].filter(Boolean).join(' ')
  if (!animate) return <path d={d} className={cls} />
  if (!dashed) return <path d={d} className={cls + ' vp-draw'} pathLength={1} style={animStyle({ animate, delay, dur, id })} />
  const maskId = `vpm-${id}`
  return (
    <>
      <mask id={maskId} maskUnits="userSpaceOnUse" x={-1e6} y={-1e6} width={2e6} height={2e6}>
        <path d={d} pathLength={1} className="vp-draw vp-mask-stroke" style={animStyle({ animate, delay, dur, id })} />
      </mask>
      <path d={d} className={cls} mask={`url(#${maskId})`} />
    </>
  )
}

function Arrow({ a, b, seed, dashed, anim }: { a: { x: number; y: number }; b: { x: number; y: number }; seed: number; dashed: boolean; anim?: Anim }) {
  const { body, head } = roughArrow(a, b, seed)
  const base = anim ?? { animate: false, delay: 0, dur: 0, id: '' }
  return (
    <>
      <Stroke d={body} dashed={dashed} {...base} id={`${base.id}-b`} dur={base.dur * 0.75} />
      <Stroke d={head} {...base} id={`${base.id}-h`} delay={base.delay + base.dur * 0.75} dur={base.dur * 0.25} />
    </>
  )
}

function HandText({ x, y, size, text, anchor, anim }: { x: number; y: number; size: number; text: string; anchor?: 'start' | 'middle' | 'end'; anim?: Anim }) {
  const node = (
    <text x={x} y={y} className="vp-text" style={{ fontSize: size }} textAnchor={anchor ?? 'start'}>
      {text}
    </text>
  )
  if (!anim?.animate) return node
  const w = text.length * size * 0.6 + 12
  const x0 = anchor === 'middle' ? x - w / 2 : anchor === 'end' ? x - w : x - 4
  return (
    <Wipe anim={anim} rect={{ x: x0, y: y - size * 1.2, w, h: size * 1.7 }}>
      {node}
    </Wipe>
  )
}

/** Reveals its children left to right, like handwriting. */
function Wipe({ anim, rect, children }: { anim: Anim; rect: Rect; children: ReactNode }) {
  const maskId = `vpw-${anim.id}`
  return (
    <>
      <mask id={maskId} maskUnits="userSpaceOnUse" x={-1e6} y={-1e6} width={2e6} height={2e6}>
        <rect x={rect.x} y={rect.y} width={rect.w} height={rect.h} fill="#fff" className="vp-wipe" style={animStyle(anim)} />
      </mask>
      <g mask={`url(#${maskId})`}>{children}</g>
    </>
  )
}

function Note({ part, seed, anim }: { part: Extract<Part, { t: 'note' }>; seed: number; anim: Anim }) {
  const { rect, lines, question, answer } = part
  const body = (
    <>
      <rect x={rect.x} y={rect.y} width={rect.w} height={rect.h} rx={4} className="vp-note-bg" />
      {lines.map((l, i) => (
        <text key={i} x={rect.x + 12} y={rect.y + 26 + i * 20} className="vp-text" style={{ fontSize: 16 }}>
          {l}
        </text>
      ))}
      {answer && (
        <text x={rect.x + 12} y={rect.y + rect.h + 18} className="vp-text vp-answer" style={{ fontSize: 14 }}>
          you: {answer}
        </text>
      )}
    </>
  )
  return (
    <g className="vp-note">
      <Stroke d={roughRect(rect, seed)} {...anim} dur={anim.dur * 0.5} />
      {anim.animate ? (
        <Wipe anim={{ ...anim, delay: anim.delay + anim.dur * 0.4, dur: anim.dur * 0.6 }} rect={{ x: rect.x - 2, y: rect.y - 2, w: rect.w + 4, h: rect.h + 30 }}>
          {body}
        </Wipe>
      ) : (
        body
      )}
      {question && (
        <g>
          <circle cx={rect.x} cy={rect.y} r={11} className="vp-q-bg" />
          <text x={rect.x} y={rect.y + 6} className="vp-text vp-q" textAnchor="middle" style={{ fontSize: 17 }}>
            ?
          </text>
        </g>
      )}
    </g>
  )
}
