import { arrowPoints, docBounds, sortedShapes, TEXT_LINE, TEXT_SIZE, type Doc } from '@shared/canvas'
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
export async function exportSketchPng(doc: Doc, ink: string): Promise<string | undefined> {
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
    switch (s.type) {
      case 'draw':
        ctx.fill(new Path2D(drawShapePath(s)))
        break
      case 'arrow': {
        const { a, b: end } = arrowPoints(s, doc)
        const { shaft, head } = arrowPaths(a, end)
        ctx.lineWidth = ARROW_WIDTH
        ctx.stroke(new Path2D(shaft))
        if (head) ctx.stroke(new Path2D(head))
        if (s.text?.trim()) {
          // The label sits on the shaft with a white halo, as on screen.
          ctx.save()
          ctx.font = `${ARROW_LABEL_SIZE}px "VP Hand", cursive`
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.lineWidth = 7
          ctx.strokeStyle = '#ffffff'
          ctx.lineJoin = 'round'
          const mx = (a.x + end.x) / 2
          const my = (a.y + end.y) / 2
          ctx.strokeText(s.text.trim(), mx, my)
          ctx.fillText(s.text.trim(), mx, my)
          ctx.restore()
        }
        break
      }
      case 'text': {
        const size = s.size ?? TEXT_SIZE
        ctx.font = `${size}px "VP Hand", cursive`
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
