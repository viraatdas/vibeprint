import { createContext, memo, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import { arrowPoints, TEXT_SIZE, type DrawShape, type ImageShape, type TextShape } from '@shared/canvas'
import type { Point, Rect } from '@shared/types'
import { attachInput } from './input'
import { ARROW_LABEL_SIZE, arrowPaths, drawShapePath } from './ink'
import { uid, type Editor } from './editor'

const EditorContext = createContext<Editor | null>(null)
const ContainerContext = createContext<HTMLElement | null>(null)

export function useEditor(): Editor {
  const e = useContext(EditorContext)
  if (!e) throw new Error('useEditor outside <Board>')
  return e
}

/** Re-render when the selected value changes. Selectors must return stored values or primitives. */
export function useEditorValue<T>(select: (e: Editor) => T, editor?: Editor): T {
  const ctx = useContext(EditorContext)
  const e = editor ?? ctx!
  return useSyncExternalStore(e.subscribe, () => select(e))
}

/** The board element, for UI that must sit above the canvas and its chrome. */
export function useContainer(): HTMLElement | null {
  return useContext(ContainerContext)
}

async function upload(file: File): Promise<string> {
  const ext = (file.name.split('.').pop() || file.type.split('/')[1] || 'bin').replace(/[^a-z0-9]/gi, '').slice(0, 8) || 'bin'
  const name = `${uid('').slice(0, 16)}.${ext}`
  const res = await fetch(`/files/${name}`, { method: 'PUT', body: file, credentials: 'same-origin' })
  if (!res.ok) throw new Error(`upload failed (${res.status})`)
  return `/files/${name}`
}

const cameraKey = (project: string) => `vp:camera:${project}`

export function Board({ editor, project, onError, children }: { editor: Editor; project: string; onError: (msg: string) => void; children?: ReactNode }) {
  const [container, setContainer] = useState<HTMLDivElement | null>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const liveRef = useRef<SVGPathElement>(null)
  const cam = useEditorValue((e) => e.camera, editor)
  const docVersion = useEditorValue((e) => e.docVersion, editor)
  const liveId = useEditorValue((e) => e.liveId, editor)
  const erasing = useEditorValue((e) => e.erasing, editor)
  const editing = useEditorValue((e) => e.editing, editor)
  const tool = useEditorValue((e) => e.tool, editor)
  const shapes = useMemo(() => editor.shapes(), [editor, docVersion])

  // Input.
  useEffect(() => {
    const stage = stageRef.current!
    return attachInput(editor, { stage, paintLive: (d) => liveRef.current?.setAttribute('d', d), upload, onError })
  }, [editor, onError])

  // The live stroke hands over to the committed shape in the same frame.
  useLayoutEffect(() => {
    if (!liveId) liveRef.current?.setAttribute('d', '')
  }, [liveId, docVersion])

  // Viewport size.
  useLayoutEffect(() => {
    const stage = stageRef.current!
    const ro = new ResizeObserver(() => {
      editor.viewport = { w: stage.clientWidth, h: stage.clientHeight }
      editor.emit()
    })
    ro.observe(stage)
    editor.viewport = { w: stage.clientWidth, h: stage.clientHeight }
    return () => ro.disconnect()
  }, [editor])

  // Each device keeps its own camera; the first visit fits the drawing on screen.
  useEffect(() => {
    let saved: { x: number; y: number; z: number } | null = null
    try {
      saved = JSON.parse(localStorage.getItem(cameraKey(project)) ?? 'null')
    } catch {}
    const valid = saved && [saved.x, saved.y, saved.z].every((n) => typeof n === 'number' && Number.isFinite(n))
    if (valid) editor.setCamera(saved!)
    let fitted = !!valid
    let timer: ReturnType<typeof setTimeout> | null = null
    let last = editor.camera
    const unsub = editor.subscribe(() => {
      if (!fitted && editor.loaded) {
        fitted = true
        if (!editor.isEmpty()) editor.zoomToFit()
      }
      if (editor.camera === last) return
      last = editor.camera
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => {
        try {
          localStorage.setItem(cameraKey(project), JSON.stringify(editor.camera))
        } catch {}
      }, 400)
    })
    return () => {
      unsub()
      if (timer) clearTimeout(timer)
    }
  }, [editor, project])

  const transform = `scale(${cam.z}) translate(${cam.x} ${cam.y})`
  const texts = shapes.filter((s): s is TextShape => s.type === 'text')

  return (
    <EditorContext.Provider value={editor}>
      <ContainerContext.Provider value={container}>
        <div className="vp-board" ref={setContainer}>
          <div className="vp-stage" ref={stageRef} data-tool={tool}>
            <svg className="vp-ink-layer" aria-hidden="true">
              <g transform={transform}>
                {shapes.map((s) => {
                  if (s.id === liveId || s.type === 'text') return null
                  const faded = erasing.has(s.id)
                  if (s.type === 'draw') return <Stroke key={s.id} shape={s} faded={faded} />
                  if (s.type === 'image') return <Picture key={s.id} shape={s} faded={faded} />
                  const { a, b } = arrowPoints(s, editor.doc)
                  return <Arrow key={s.id} id={s.id} ax={a.x} ay={a.y} bx={b.x} by={b.y} text={s.text} faded={faded} />
                })}
                <path ref={liveRef} className="vp-ink" />
              </g>
            </svg>
            <div className="vp-text-layer" style={{ transform: `scale(${cam.z}) translate(${cam.x}px, ${cam.y}px)` }}>
              {texts.map((s) => (s.id === editing?.id ? null : <Text key={s.id} shape={s} faded={erasing.has(s.id)} />))}
              <TextEditor editor={editor} />
            </div>
            <SelectionOverlay editor={editor} />
          </div>
          {children}
        </div>
      </ContainerContext.Provider>
    </EditorContext.Provider>
  )
}

const Stroke = memo(function Stroke({ shape, faded }: { shape: DrawShape; faded: boolean }) {
  return <path className={`vp-shape vp-ink${faded ? ' is-erasing' : ''}`} data-shape-id={shape.id} d={drawShapePath(shape)} />
})

const Arrow = memo(function Arrow({ id, ax, ay, bx, by, text, faded }: { id: string; ax: number; ay: number; bx: number; by: number; text?: string; faded: boolean }) {
  const { shaft, head } = arrowPaths({ x: ax, y: ay }, { x: bx, y: by })
  return (
    <g className={`vp-shape vp-arrow${faded ? ' is-erasing' : ''}`} data-shape-id={id}>
      <path d={shaft} />
      {head && <path d={head} />}
      {text?.trim() && (
        <text className="vp-arrow-label" x={(ax + bx) / 2} y={(ay + by) / 2} fontSize={ARROW_LABEL_SIZE}>
          {text.trim()}
        </text>
      )}
    </g>
  )
})

const Picture = memo(function Picture({ shape, faded }: { shape: ImageShape; faded: boolean }) {
  return (
    <image
      className={`vp-shape${faded ? ' is-erasing' : ''}`}
      data-shape-id={shape.id}
      href={shape.src}
      x={shape.x}
      y={shape.y}
      width={shape.w}
      height={shape.h}
      preserveAspectRatio="none"
    />
  )
})

const Text = memo(function Text({ shape, faded }: { shape: TextShape; faded: boolean }) {
  return (
    <div
      className={`vp-shape vp-text-shape${faded ? ' is-erasing' : ''}`}
      data-shape-id={shape.id}
      style={{ left: shape.x, top: shape.y, fontSize: shape.size ?? TEXT_SIZE }}
    >
      {shape.text}
    </div>
  )
})

/**
 * One textarea that is always mounted, so a tap can focus it synchronously (iPadOS only shows
 * the keyboard, or Scribble, for a focus that happens inside the tap itself).
 */
function TextEditor({ editor }: { editor: Editor }) {
  const ref = useRef<HTMLTextAreaElement>(null)
  const mirror = useRef<HTMLDivElement>(null)
  const editing = useEditorValue((e) => e.editing, editor)

  const fit = () => {
    const ta = ref.current
    const m = mirror.current
    if (!ta || !m) return
    m.style.fontSize = ta.style.fontSize
    m.textContent = ta.value + '​'
    ta.style.width = `${Math.max(m.offsetWidth + 4, 12)}px`
    ta.style.height = `${m.offsetHeight}px`
  }

  useLayoutEffect(() => {
    const place = (shape: TextShape) => {
      const ta = ref.current!
      ta.style.left = `${shape.x}px`
      ta.style.top = `${shape.y}px`
      ta.style.fontSize = `${shape.size ?? TEXT_SIZE}px`
      ta.classList.add('is-on')
    }
    editor.focusText = (shape) => {
      const ta = ref.current
      if (!ta) return
      ta.value = shape.text
      place(shape)
      fit()
      ta.focus({ preventScroll: true })
      ta.setSelectionRange(ta.value.length, ta.value.length)
    }
    editor.commitText = () => {
      const shape = editor.editing
      const ta = ref.current
      if (!shape || !ta) return
      editor.editing = null
      fit()
      const text = ta.value.replace(/\s+$/, '')
      const m = mirror.current!
      const w = Math.round(m.offsetWidth * 10) / 10
      const h = Math.round(m.offsetHeight * 10) / 10
      ta.classList.remove('is-on')
      ta.value = ''
      ta.blur()
      const prior = editor.getShape(shape.id)
      if (!text.trim()) {
        if (prior) editor.change([], [shape.id])
        else editor.emit()
        return
      }
      if (prior?.type === 'text' && prior.text === text) return editor.emit()
      editor.change([{ ...shape, text, w, h }])
    }
    return () => {
      editor.focusText = null
      editor.commitText = null
    }
  }, [editor])

  return (
    <>
      <div ref={mirror} className="vp-text-shape vp-text-mirror" aria-hidden="true" />
      <textarea
        ref={ref}
        className="vp-text-input"
        aria-label="Text"
        aria-hidden={!editing}
        tabIndex={editing ? 0 : -1}
        spellCheck={false}
        autoCapitalize="off"
        autoComplete="off"
        autoCorrect="off"
        rows={1}
        onInput={fit}
        onBlur={() => editor.complete()}
        onPointerDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'Escape' || (e.key === 'Enter' && (e.metaKey || e.ctrlKey))) {
            e.preventDefault()
            editor.complete()
          }
          e.stopPropagation()
        }}
      />
    </>
  )
}

function SelectionOverlay({ editor }: { editor: Editor }) {
  const selection = useEditorValue((e) => e.selection, editor)
  const marquee = useEditorValue((e) => e.marquee, editor)
  useEditorValue((e) => e.camera, editor)
  useEditorValue((e) => e.docVersion, editor)
  if (!selection.size && !marquee) return null
  const toScreen = (r: Rect, pad: number): Rect => {
    const a: Point = editor.pageToScreen({ x: r.x, y: r.y })
    const z = editor.camera.z
    return { x: a.x - pad, y: a.y - pad, w: r.w * z + pad * 2, h: r.h * z + pad * 2 }
  }
  const boxes = [...selection].map((id) => editor.getShapePageBounds(id)).filter((r): r is Rect => !!r)
  return (
    <svg className="vp-overlay" aria-hidden="true">
      {boxes.map((r, i) => {
        const s = toScreen(r, 6)
        return <rect key={i} className="vp-sel" x={s.x} y={s.y} width={s.w} height={s.h} rx={6} />
      })}
      {marquee && (() => {
        const s = toScreen(marquee, 0)
        return <rect className="vp-marquee" x={s.x} y={s.y} width={s.w} height={s.h} />
      })()}
    </svg>
  )
}
