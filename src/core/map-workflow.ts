import crypto from 'node:crypto'
import { mapBoxPoints } from './map-shapes.js'
import type { RepoMap, RepoMapEdge } from '../shared/types.js'
import { TEXT_LINE, type Shape, type TextShape } from '../shared/canvas.js'

/** Interaction views: actors stay in columns, so parallel calls never merge. */
export function drawWorkflow(map: RepoMap, origin: { x: number; y: number }, wrap: (s: string, w: number, size: number) => string) {
  const shapes: Shape[] = [], nodeShapes = new Map<string, string[]>(), edges: Array<RepoMapEdge & { shapeId: string }> = []
  const id = () => `shape:map${crypto.randomBytes(8).toString('hex')}`
  const text = (body: string, x: number, y: number, w: number, size = 24) => {
    const value = wrap(body, w, size)
    const s: TextShape = { id: id(), type: 'text', author: 'agent', font: 'sans', z: shapes.length + 1, x: origin.x + x, y: origin.y + y, w, h: value.split('\n').length * size * TEXT_LINE, size, text: value }
    shapes.push(s); return s
  }
  const box = (x: number, y: number, w: number, h: number, kind?: string, boundary = false) => {
    const s: Shape = { id: id(), type: 'draw', author: 'agent', z: shapes.length + 1,
      closed: true, points: mapBoxPoints(origin.x + x, origin.y + y, w, h, kind),
      ...(boundary ? { mapRole: 'boundary' as const } : {}) }
    shapes.push(s)
    return s.id
  }
  const groups = [...new Set(map.nodes.map(n=>n.group))].map(id=>map.groups!.find(g=>g.id===id)).filter((g): g is NonNullable<typeof g> => !!g)
  const nodes = groups.flatMap(g => map.nodes.filter(n => n.group === g.id))
  for (const n of map.nodes) if (!nodes.includes(n)) nodes.push(n)
  const column = nodes.length <= 3 ? 500 : 440, width = Math.max(1500, nodes.length * column)
  const title = text(map.title!, 0, 0, width, 34)
  const scope = text(`${map.audience || 'Engineers'} · ${map.scope || ''}`, 0, title.h + 10, width, 23)
  const top = scope.y - origin.y + scope.h + 24
  const headerHeight = Math.max(80, ...groups.map(g => (wrap(g.label, map.nodes.filter(n=>n.group===g.id).length*column-40, 25).split('\n').length*25 + wrap(g.description,map.nodes.filter(n=>n.group===g.id).length*column-40,22).split('\n').length*22)*TEXT_LINE+20))
  const actorTop = top + headerHeight + 12
  const actorHeight = Math.max(135, ...nodes.map(n => 36 + wrap(n.kind === 'external' ? `${n.label} (external)` : n.label,column-80,28).split('\n').length*28*TEXT_LINE + wrap(n.description || n.kind || 'Runtime actor',column-80,24).split('\n').length*24*TEXT_LINE))
  // Sort only explicit workflow stages. Unnumbered, independently initiated calls
  // follow them, and equally numbered alternative branches retain source order.
  const stages = (e: RepoMapEdge) => [...(e.label || '').matchAll(/(?:^|\/)([A-Z])(\d+)/g)]
  const counts = new Map<string, number>()
  for (const edge of map.edges) for (const stage of stages(edge)) counts.set(stage[1], (counts.get(stage[1]) || 0) + 1)
  const primary = [...counts].sort((a,b)=>b[1]-a[1])[0]?.[0]
  const ordered = map.edges.map((edge,index)=>({edge,index})).sort((a,b)=>{
    const key=(e:RepoMapEdge)=> { const all=stages(e),m=all.find(s=>s[1]===primary)||all[0];return m ? (m[1]===primary?0:m[1].charCodeAt(0)*1000)+Number(m[2]) : Infinity }
    const x=key(a.edge),y=key(b.edge);return x===y ? a.index-b.index : x-y
  })
  const columnX = (id: string) => nodes.findIndex(n => n.id === id) * column + column / 2
  let cursor = actorTop + actorHeight + 24
  const rows = ordered.map(({edge}) => {
    const span = edge.from === edge.to ? column-80 : Math.max(200,Math.abs(columnX(edge.from)-columnX(edge.to))-32)
    const labelHeight = wrap(`${edge.label || 'request'} (${edge.mode || 'sync'})`,span,24).split('\n').length * 24 * TEXT_LINE
    cursor += labelHeight + 10
    const y=cursor;cursor+=edge.from===edge.to?70:18
    return y
  })
  const bottom = cursor
  for (const g of groups) {
    const members = nodes.filter(n=>n.group===g.id), start=nodes.indexOf(members[0])*column
    // Boundaries contain the actor headers. Extending their walls through every
    // message adds false lifelines and obscures cross-boundary interactions.
    box(start+8,top,members.length*column-16,actorTop+actorHeight-top+14,undefined,true)
    const label=text(g.label,start+20,top+12,members.length*column-40,25)
    text(g.description,start+20,top+16+label.h,members.length*column-40,22)
  }
  const lanes = new Map<string,{shapeId:string;x:number}>()
  for(const [i,node] of nodes.entries()) {
    const x=i*column+column/2, first=shapes.length
    box(i*column+26,actorTop,column-52,actorHeight,node.kind)
    const heading=text(node.kind === 'external' ? `${node.label} (external)` : node.label,i*column+40,actorTop+12,column-80,28)
    text(node.description || node.kind || 'Runtime actor',i*column+40,actorTop+heading.h+18,column-80,24)
    const lane: Shape={id:id(),type:'draw',author:'agent',mapRole:'lifeline',z:shapes.length+1,points:[[origin.x+x,origin.y+actorTop+actorHeight+12,.5],[origin.x+x,origin.y+bottom,.5]]}
    shapes.push(lane);lanes.set(node.id,{shapeId:lane.id,x})
    nodeShapes.set(node.id,shapes.slice(first).map(s=>s.id))
  }
  for(const [row,{edge}] of ordered.entries()) {
    const a=lanes.get(edge.from),b=lanes.get(edge.to)
    if(!a||!b)continue
    const y=rows[row],shapeId=id()
    const y0=actorTop+actorHeight+12,ny=(y-y0)/(bottom-y0)
    const self=edge.from===edge.to
    const s: Shape={id:shapeId,type:'arrow',author:'agent',font:'sans',z:shapes.length+1,
      start:{id:a.shapeId,x:origin.x+a.x,y:origin.y+y,nx:.5,ny},
      end:{id:b.shapeId,x:origin.x+b.x,y:origin.y+y+(self?35:0),nx:.5,ny:self?(y+35-y0)/(bottom-y0):ny},
      route:self?[{x:origin.x+a.x+100,y:origin.y+y},{x:origin.x+a.x+100,y:origin.y+y+35}]:[],mode:edge.mode||'sync'}
    shapes.push(s)
    const labelWidth=self?column-80:Math.max(200,Math.abs(a.x-b.x)-32)
    const labelX=self?a.x+12:Math.min(a.x,b.x)+16
    const label= text(`${edge.label || 'request'} (${edge.mode || 'sync'})`,labelX,y-66,labelWidth,24)
    // A separate ordinary text shape keeps flow labels typeset at the same size
    // as actor roles, with explicit geometry included in fit and export bounds.
    label.y=origin.y+y-label.h-8
    edges[map.edges.indexOf(edge)]={...edge,shapeId}
  }
  const annotationStart = shapes.length
  let footer=bottom+40
  const legend=text('Interaction view · columns = actors; frames = trust/deployment boundaries; vertical lines identify actors, not calls. Read labeled arrows caller → recipient, response included. Solid = sync request; dashed = async delivery; dotted = local I/O. Numbered stages define order; equal stages are alternatives; unnumbered calls are independent.',0,footer,width,22)
  footer+=legend.h+16
  const notes=(map.notes||[]).slice(0,2),noteWidth=(width-30)/Math.max(1,notes.length)
  let height=0
  for(const [i,note] of notes.entries()) {
    const h=text(note.title,i*(noteWidth+30),footer,noteWidth,25)
    const b=text(note.text,i*(noteWidth+30),footer+h.h+4,noteWidth,23)
    const s=text(`Source: ${note.source}`,i*(noteWidth+30),footer+h.h+b.h+10,noteWidth,21)
    height=Math.max(height,h.h+b.h+s.h+16)
  }
  footer+=height
  const excluded=text(`Other workflows: Diagram view selector. Excluded: ${(map.omissions||[]).filter(s=>!s.startsWith('Other workflows:')).join('; ')}.`,0,footer,width,21)
  const v=map.verification
  text(`Source review ${v?.at.slice(0,10)||'undated'} · ${v?.revision||'revision unknown'}${v?.dirty?' + local edits':''} · Owner: ${map.owner||'Unassigned'} · Live runtime NOT verified`,0,footer+excluded.h+8,width,21)
  for (const shape of shapes.slice(annotationStart)) shape.mapAnnotation = true
  return {shapes,nodeShapes,edges}
}
