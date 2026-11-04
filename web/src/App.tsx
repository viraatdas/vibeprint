import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ClientConfig } from '@shared/api'
import { api, ApiError, useVibeprintState } from './api'
import { toast, ui, useUi } from './store'
import { Board, useEditorValue } from './canvas/Board'
import { Editor } from './canvas/editor'
import { CanvasSync } from './canvas/sync'
import { AgentLayer } from './agent/AgentLayer'
import { PacingDriver } from './agent/pacing'
import { BatchStrip, EmptyStart, MapViews, SubmitButton, Toast, Toolbar, TopBar } from './ui/Chrome'
import { SidePanel } from './ui/SidePanel'

function canvasUri() {
  return `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/api/canvas`
}

function Canvas({ config }: { config: ClientConfig }) {
  const editor = useMemo(() => new Editor(), [])
  const [sync, setSync] = useState<CanvasSync | null>(null)
  useEffect(() => {
    const s = new CanvasSync(editor, canvasUri())
    setSync(s)
    ;(window as unknown as { editor: Editor }).editor = editor
    return () => s.close()
  }, [editor])
  const loaded = useEditorValue((e) => e.loaded, editor)
  const status = useEditorValue((e) => e.status, editor)
  const onError = useCallback((msg: string) => toast(msg), [])

  if (!loaded && status === 'offline' && (sync?.failures ?? 0) >= 3) {
    return (
      <div className="vp-gate">
        <p>
          Can't open the canvas. Check that <code>vibeprint serve</code> is still running, then reload.
        </p>
      </div>
    )
  }
  if (!loaded) return <div className="vp-gate vp-gate-quiet">Opening canvas…</div>
  return (
    <Board editor={editor} project={config.project} onError={onError}>
      <AgentLayer />
      <PacingDriver />
      <TopBar />
      <Toolbar />
      <MapViews />
      <BatchStrip />
      <SubmitButton />
      <EmptyStart />
      <Toast />
    </Board>
  )
}

export function App() {
  const [config, setConfig] = useState<ClientConfig | null>(null)
  const [gate, setGate] = useState<string | null>(null)
  useEffect(() => {
    api
      .config()
      .then((c) => {
        ui.set({ config: c })
        document.documentElement.style.setProperty('--vp-agent', c.agentColor)
        document.documentElement.style.setProperty('--vp-ink', c.inkColor)
        document.title = `${c.project} · Vibeprint`
        setConfig(c)
      })
      .catch((err) =>
        setGate(
          err instanceof ApiError && err.status === 401
            ? 'This device needs the link printed by vibeprint serve. Scan the QR code in your terminal or open the iPad link from there.'
            : `Can't reach the Vibeprint daemon (${(err as Error).message}). Start it with vibeprint serve in your repo.`,
        ),
      )
  }, [])
  const { state } = useVibeprintState(!!config)
  useEffect(() => {
    if (state) ui.set({ vp: state })
  }, [state])
  const view = useUi((s) => s.view)
  const canvas = useMemo(() => (config ? <Canvas config={config} /> : null), [config])

  if (gate) {
    return (
      <div className="vp-gate">
        <h1>Vibeprint</h1>
        <p>{gate}</p>
      </div>
    )
  }
  if (!config) return <div className="vp-gate vp-gate-quiet">Connecting…</div>
  return (
    <div className={`vp-app vp-view-${view}`}>
      <main className="vp-canvas">{canvas}</main>
      {view === 'desk' && <SidePanel />}
    </div>
  )
}
