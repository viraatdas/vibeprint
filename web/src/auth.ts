// A canvas shown in another site's frame (the Rudder app, started with --embed-origin) gets no
// cookies: browsers keep them from third-party frames. Its link carries the access token in the
// fragment instead (#t=…), which never reaches a server or a log; the page then sends it with
// every request. A normal link signs in with ?t= and a cookie, and this stays empty.
const fragment = new URLSearchParams(location.hash.slice(1))
const token = fragment.get('t') || null
if (token) {
  fragment.delete('t')
  const rest = fragment.toString()
  history.replaceState(history.state, '', location.pathname + location.search + (rest ? `#${rest}` : ''))
}

/** Headers for a fetch to the daemon. */
export const authHeaders: Record<string, string> = token ? { 'x-vibeprint-token': token } : {}

/** A daemon URL with the token attached, for what can't send headers (EventSource, WebSocket, images). */
export function withToken(url: string): string {
  if (!token) return url
  const u = new URL(url, location.href)
  u.searchParams.set('t', token)
  return u.origin === location.origin && !/^wss?:/.test(url) ? u.pathname + u.search : u.toString()
}

/** A canvas image's address: pasted images live on the daemon at /files/…. */
export function assetUrl(src: string): string {
  return src.startsWith('/files/') ? withToken(src) : src
}
