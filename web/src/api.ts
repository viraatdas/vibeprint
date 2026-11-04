import { useEffect, useState } from 'react'
import type { ClientConfig, MapResult } from '@shared/api'
import type { Decision, VibeprintState } from '@shared/types'

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
  }
}

async function call<T>(method: string, url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    credentials: 'same-origin',
    headers: body === undefined ? undefined : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const text = await res.text()
  let data: any = {}
  try {
    data = text ? JSON.parse(text) : {}
  } catch {
    data = { error: text }
  }
  if (!res.ok) throw new ApiError(data?.error ?? `Request failed (${res.status})`, res.status)
  return data as T
}

export const api = {
  config: () => call<ClientConfig>('GET', '/api/config'),
  submit: (body: { shapes: unknown[]; image?: string; note?: string }) => call<{ seq: number; interpreter: string }>('POST', '/api/submit', body),
  decideMark: (id: string, decision: Decision) => call('POST', `/api/marks/${id}/decide`, { decision }),
  decideBatch: (id: string, decision: Decision) => call('POST', `/api/batches/${id}/decide`, { decision }),
  chat: (text: string) => call('POST', '/api/chat', { text }),
  /** Scan the repo and draw what is already built. */
  mapRepo: () => call<MapResult>('POST', '/api/map', {}),
  showSchema: (target?: string) => call<{ reading: string; target?: string }>('POST', '/api/schema', target ? { target } : {}),
}

export type Connection = 'connecting' | 'live' | 'offline'

/** Live Vibeprint state over server-sent events. */
export function useVibeprintState(enabled: boolean): { state: VibeprintState | null; connection: Connection } {
  const [state, setState] = useState<VibeprintState | null>(null)
  const [connection, setConnection] = useState<Connection>('connecting')
  useEffect(() => {
    if (!enabled) return
    const es = new EventSource('/api/events', { withCredentials: true })
    es.addEventListener('state', (e) => {
      setState(JSON.parse((e as MessageEvent).data))
      setConnection('live')
    })
    es.onerror = () => setConnection(es.readyState === EventSource.CLOSED ? 'offline' : 'connecting')
    es.onopen = () => setConnection('live')
    return () => es.close()
  }, [enabled])
  return { state, connection }
}
