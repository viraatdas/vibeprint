import { MAP_FLOW_SIZE, MAP_FLOW_LINE } from '@shared/map-font'
import { AGENT_COLOR, arrowLabelPoint, arrowPoints, docBounds, sortedShapes, TEXT_LINE, TEXT_SIZE, type Doc } from '@shared/canvas'
import { ARROW_LABEL_SIZE, arrowPaths, ARROW_WIDTH, drawShapePath } from './ink'

const PAD = 32

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = src
  })
}

async function toBase64(canvas: HTMLCanvasElement): Promise<string> {
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
  if (!blob) throw new Error('could not encode the sketch')
  const buf = new Uint8Array(await blob.arrayBuffer())
  let bin = ''
  for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000))
  return btoa(bin)
}

/** PNG (base64) of the whole sketch on white, with the long side near 1600px. */
export async function exportSketchPng(doc: Doc, ink: string, agent = AGENT_COLOR): Promise<string | undefined> {
  await Promise.all([document.fonts.load('20px "VP Map"'), document.fonts.load('20px "VP Hand"')])
  const b = docBounds(doc)
  if (!b) return undefined
  const scale = Math.max(0.25, Math.min(2, 1600 / Math.max(1, b.w, b.h)))
  const canvas = document.createElement('canvas')
  canvas.width = Math.ceil((b.w + PAD * 2) * scale)
  canvas.height = Math.ceil((b.h + PAD * 2) * scale)
  const ctx = canvas.getContext('2d')
  if (!ctx) return undefined
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.scale(scale, scale)
  ctx.translate(PAD - b.x, PAD - b.y)
  ctx.fillStyle = ink
  ctx.strokeStyle = ink
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  const images = new Map<string, HTMLImageElement | null>()
  for (const s of doc.values()) if (s.type === 'image' && !images.has(s.src)) images.set(s.src, await loadImage(s.src))

  for (const s of sortedShapes(doc)) {
    ctx.fillStyle = s.author === 'agent' ? agent : ink
    ctx.strokeStyle = ctx.fillStyle
    switch (s.type) {
      case 'draw':
        ctx.save()
        ctx.globalAlpha = s.mapRole === 'boundary' ? .45 : s.mapRole === 'lifeline' ? .25 : 1
        ctx.fill(new Path2D(drawShapePath(s)))
        ctx.restore()
        break
      case 'arrow': {
        const { a, b: end } = arrowPoints(s, doc)
        const { shaft, head } = arrowPaths(a, end, s.route)
        ctx.lineWidth = ARROW_WIDTH
        ctx.setLineDash(s.mode === 'async' ? [16, 8] : s.mode === 'local' ? [2, 8] : [])
        ctx.stroke(new Path2D(shaft))
        ctx.setLineDash([])
        if (head) ctx.stroke(new Path2D(head))
        if (s.text?.trim()) {
          // Routed labels mask the complete line behind them, as on screen.
          ctx.save()
          ctx.font = `${s.route ? MAP_FLOW_SIZE : ARROW_LABEL_SIZE}px ${s.font === 'sans' ? '"VP Map", Arial, sans-serif' : '"VP Hand", cursive'}`
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.lineWidth = 7
          ctx.strokeStyle = '#ffffff'
          ctx.lineJoin = 'round'
          const { x: mx, y: my } = s.labelAt ?? arrowLabelPoint([a, ...(s.route ?? []), end])
          if (s.route) {
            const lines = s.text.trim().split('\n'), width = Math.max(...lines.map(line => ctx.measureText(line).width)) + 16
            const previousFill = ctx.fillStyle
            ctx.fillStyle = '#ffffff'
            ctx.fillRect(mx - width / 2, my - lines.length * MAP_FLOW_LINE / 2 - 4, width, lines.length * MAP_FLOW_LINE + 8)
            ctx.fillStyle = previousFill
          }
          s.text.trim().split('\n').forEach((line, i, lines) => {
            const y = my + (i - (lines.length - 1) / 2) * MAP_FLOW_LINE
            ctx.strokeText(line, mx, y)
            ctx.fillText(line, mx, y)
          })
          ctx.restore()
        }
        break
      }
      case 'text': {
        const size = s.size ?? TEXT_SIZE
        ctx.font = `${size}px ${s.font === 'sans' ? '"VP Map", Arial, sans-serif' : '"VP Hand", cursive'}`
        if (s.mapView && s.font === 'sans') {
          const previousFill = ctx.fillStyle
          ctx.fillStyle = '#ffffff'
          ctx.fillRect(s.x - 4, s.y - 4, Math.max(...s.text.split('\n').map(line => ctx.measureText(line).width)) + 8, s.h + 8)
          ctx.fillStyle = previousFill
        }
        ctx.textBaseline = 'middle'
        s.text.split('\n').forEach((line, i) => ctx.fillText(line, s.x, s.y + (i + 0.5) * size * TEXT_LINE))
        break
      }
      case 'image': {
        const img = images.get(s.src)
        if (img) ctx.drawImage(img, s.x, s.y, s.w, s.h)
        break
      }
    }
  }
  return toBase64(canvas)
}
