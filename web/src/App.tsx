import { useEffect, useMemo, useState } from 'react'
import {
  DefaultColorStyle,
  DefaultDashStyle,
  DefaultFontStyle,
  DefaultSizeStyle,
  Tldraw,
  uniqueId,
  type Editor,
  type TLAssetStore,
  type TLComponents,
} from 'tldraw'
import { useSync } from '@tldraw/sync'
import { getAssetUrlsByImport } from '@tldraw/assets/imports.vite'
import 'tldraw/tldraw.css'
import type { ClientConfig } from '@shared/api'
import { api, ApiError, useVibeprintState } from './api'
import { ui, useUi } from './store'
import { AgentLayer } from './agent/AgentLayer'
import { PacingDriver } from './agent/pacing'
import { BatchStrip, SubmitButton, Toast, Toolbar, TopBar } from './ui/Chrome'
import { SidePanel } from './ui/SidePanel'

const assetUrls = getAssetUrlsByImport()

const assets: TLAssetStore = {
  async upload(_asset, file) {
    const ext = (file.name.split('.').pop() ?? 'bin').replace(/[^a-z0-9]/gi, '').slice(0, 8) || 'bin'
    const name = `${uniqueId()}.${ext}`
    const res = await fetch(`/files/${name}`, { method: 'PUT', body: file, credentials: 'same-origin' })
    if (!res.ok) throw new Error(`Upload failed (${res.status})`)
    return { src: `/files/${name}` }
  },
  resolve(asset) {
    return asset.props.src
  },
}

const components: TLComponents = {
  InFrontOfTheCanvas: AgentLayer,
}

function syncUri() {
  return `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/api/sync`
}

function onMount(editor: Editor) {
  // Your ink is always one color and one pen.
  editor.setStyleForNextShapes(DefaultColorStyle, 'black')
  editor.setStyleForNextShapes(DefaultSizeStyle, 'm')
  editor.setStyleForNextShapes(DefaultDashStyle, 'draw')
  editor.setStyleForNextShapes(DefaultFontStyle, 'draw')
  editor.user.updateUserPreferences({ colorScheme: 'light' })
  editor.setCurrentTool('draw')
  ;(window as unknown as { editor: Editor }).editor = editor
}

function Canvas({ config }: { config: ClientConfig }) {
  const store = useSync({ uri: syncUri, assets })
  if (store.status === 'error') {
    return (
      <div className="vp-gate">
        <p>Lost the connection to the canvas. Check that <code>vibeprint serve</code> is still running, then reload.</p>
      </div>
    )
  }
  if (store.status === 'loading') return <div className="vp-gate vp-gate-quiet">Opening canvas…</div>
  return (
    <Tldraw store={store.store} hideUi components={components} onMount={onMount} assetUrls={assetUrls} licenseKey={config.tldrawLicenseKey}>
      <PacingDriver />
      <TopBar />
      <Toolbar />
      <BatchStrip />
      <SubmitButton />
      <Toast />
    </Tldraw>
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
