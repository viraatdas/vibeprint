import { useEffect, useRef, useState } from 'react'
import { edgeLabel, nodeKind, nodeLabel } from '@shared/graph'
import { batchIsPending, marksOfBatch, summarizeMarks } from '@shared/marks'
import type { Batch, ChatMessage, GraphNode, NodeStatus, VibeprintState } from '@shared/types'
import { api } from '../api'
import { toast, useUi } from '../store'

export function SidePanel() {
  const [tab, setTab] = useState<'chat' | 'spec'>('chat')
  const vp = useUi((s) => s.vp)
  if (!vp) return <aside className="vp-side" />
  return (
    <aside className="vp-side">
      <div className="vp-tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'chat'} className={tab === 'chat' ? 'is-on' : ''} onClick={() => setTab('chat')}>
          Chat
        </button>
        <button role="tab" aria-selected={tab === 'spec'} className={tab === 'spec' ? 'is-on' : ''} onClick={() => setTab('spec')}>
          Spec
        </button>
      </div>
      {tab === 'chat' ? <Chat vp={vp} /> : <Spec vp={vp} />}
    </aside>
  )
}

function time(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

function Chat({ vp }: { vp: VibeprintState }) {
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const list = useRef<HTMLDivElement>(null)
  const count = vp.chat.length
  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight, behavior: 'smooth' })
  }, [count])

  const send = async () => {
    const t = text.trim()
    if (!t || sending) return
    setSending(true)
    try {
      await api.chat(t)
      setText('')
    } catch (err) {
      toast((err as Error).message)
    } finally {
      setSending(false)
    }
  }

  const hasAssistant = vp.interpreter.mode === 'claude-api'
  return (
    <div className="vp-chat">
      <div className="vp-chat-list" ref={list}>
        {vp.chat.length === 0 && (
          <div className="vp-empty">
            <p>Sketch on the canvas and hit Submit. What your agent reads, proposes and builds shows up here.</p>
          </div>
        )}
        {vp.chat.map((m) => (
          <Message key={m.id} m={m} vp={vp} />
        ))}
        {vp.interpreter.active && <div className="vp-msg vp-msg-agent vp-typing">reading…</div>}
      </div>
      <form
        className="vp-chat-input"
        onSubmit={(e) => {
          e.preventDefault()
          void send()
        }}
      >
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              void send()
            }
          }}
          placeholder={hasAssistant ? 'Ask about the architecture…' : 'Message your coding agent…'}
          rows={2}
        />
        <button type="submit" className="vp-btn vp-btn-ink" disabled={!text.trim() || sending}>
          Send
        </button>
      </form>
      {!hasAssistant && <p className="vp-chat-hint">Connected agents read this with read_chat. Set ANTHROPIC_API_KEY for a built-in reply.</p>}
    </div>
  )
}

function Message({ m, vp }: { m: ChatMessage; vp: VibeprintState }) {
  const batch = m.batchId ? vp.batches.find((b) => b.id === m.batchId) : undefined
  if (m.role === 'system') {
    return (
      <div className="vp-msg vp-msg-system">
        <span>{m.text}</span>
        <time>{time(m.createdAt)}</time>
      </div>
    )
  }
  return (
    <div className={`vp-msg vp-msg-${m.role}`}>
      {m.role === 'agent' && (
        <div className="vp-msg-who">
          <span className="vp-dot" />
          {m.author} <time>{time(m.createdAt)}</time>
        </div>
      )}
      <div className="vp-msg-text">{m.text}</div>
      {batch && <BatchCard batch={batch} vp={vp} />}
    </div>
  )
}

function BatchCard({ batch, vp }: { batch: Batch; vp: VibeprintState }) {
  const marks = marksOfBatch(batch, vp.marks)
  const pending = batchIsPending(batch, vp.marks)
  const accepted = marks.filter((m) => m.status === 'accepted')
  const decide = async (decision: 'accept' | 'reject') => {
    try {
      await api.decideBatch(batch.id, decision)
    } catch (err) {
      toast((err as Error).message)
    }
  }
  return (
    <div className="vp-batch">
      <div className="vp-batch-summary">{summarizeMarks(marks)}</div>
      {pending ? (
        <div className="vp-batch-actions">
          <button className="vp-btn" onClick={() => decide('reject')}>
            Reject all
          </button>
          <button className="vp-btn vp-btn-agent" onClick={() => decide('accept')}>
            Accept all
          </button>
        </div>
      ) : (
        <div className="vp-batch-outcome">
          {accepted.length === marks.length ? 'Accepted' : accepted.length === 0 ? 'Rejected' : `Accepted ${accepted.length} of ${marks.length}`}
        </div>
      )}
    </div>
  )
}

const ORDER: NodeStatus[] = ['building', 'blocked', 'planned', 'done']
const STATUS_TEXT: Record<NodeStatus, string> = { building: 'Building', blocked: 'Blocked', planned: 'Planned', done: 'Done' }

function Spec({ vp }: { vp: VibeprintState }) {
  const g = vp.graph
  const live = g.nodes.filter((n) => !n.removed)
  const removed = g.nodes.filter((n) => n.removed)
  const byId = new Map(g.nodes.map((n) => [n.id, n]))
  const doneCount = live.filter((n) => n.status === 'done').length

  if (!g.nodes.length) {
    return (
      <div className="vp-spec">
        <div className="vp-empty">
          <p>No architecture yet. Draw boxes and arrows, then hit Submit so your agent can read them.</p>
        </div>
      </div>
    )
  }
  const outs = (n: GraphNode) =>
    g.edges
      .filter((e) => e.from === n.id && !e.removed && !byId.get(e.to)?.removed)
      .map((e) => `${nodeLabel(byId.get(e.to)!)}${edgeLabel(e) ? ` (${edgeLabel(e)})` : ''}`)

  return (
    <div className="vp-spec">
      {g.summary && <p className="vp-spec-summary">{g.summary}</p>}
      <div className="vp-progress" aria-label={`${doneCount} of ${live.length} built`}>
        <div className="vp-progress-bar" style={{ width: `${live.length ? (doneCount / live.length) * 100 : 0}%` }} />
      </div>
      <p className="vp-spec-meta">
        {doneCount} of {live.length} built · sketch #{g.sketchSeq}
      </p>
      {ORDER.map((status) => {
        const list = live.filter((n) => n.status === status)
        if (!list.length) return null
        return (
          <section key={status} className="vp-spec-group">
            <h3>{STATUS_TEXT[status]}</h3>
            <ul>
              {list.map((n) => (
                <li key={n.id} className={n.origin === 'agent' ? 'is-agent' : ''}>
                  <div className="vp-spec-node">
                    <span className="vp-spec-label">{nodeLabel(n)}</span>
                    {nodeKind(n) && <span className="vp-spec-kind">{nodeKind(n)}</span>}
                  </div>
                  {outs(n).length > 0 && <div className="vp-spec-edges">→ {outs(n).join(', ')}</div>}
                  {n.statusDetail && <div className="vp-spec-detail">{n.statusDetail}</div>}
                  <code className="vp-spec-id">{n.id}</code>
                </li>
              ))}
            </ul>
          </section>
        )
      })}
      {removed.length > 0 && (
        <section className="vp-spec-group">
          <h3>Struck</h3>
          <ul>
            {removed.map((n) => (
              <li key={n.id} className="is-removed">
                <span className="vp-spec-label">{nodeLabel(n)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
