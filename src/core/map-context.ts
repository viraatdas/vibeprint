import crypto from 'node:crypto'
import { mapBoxPoints } from './map-shapes.js'
import { arrowPoints, TEXT_LINE, type Shape, type TextShape, type ArrowShape } from '../shared/canvas.js'
import type { RepoMap, RepoMapEdge } from '../shared/types.js'

/** A small system-context view, separate from the detailed interaction rows. */
export function drawContext(map: RepoMap, origin: { x: number; y: number }, wrap: (s: string,w: number,size: number)=>string) {
  const shapes: Shape[]=[],nodeShapes=new Map<string,string[]>(),edges:Array<RepoMapEdge&{shapeId:string}>=[]
  const id=()=>`shape:map${crypto.randomBytes(8).toString('hex')}`
  const text=(body:string,x:number,y:number,w:number,size:number)=>{
    const value=wrap(body,w,size),s:TextShape={id:id(),type:'text',author:'agent',font:'sans',z:shapes.length+1,x:origin.x+x,y:origin.y+y,w,h:value.split('\n').length*size*TEXT_LINE,size,text:value};shapes.push(s);return s
  }
  const width=1500,title=text(map.title!,0,0,width,34),scope=text(`${map.audience||'Engineers'} · ${map.scope||''}`,0,title.h+10,width,23)
  const top=title.h+scope.h+40
  const central=[...map.nodes].sort((a,b)=>map.edges.filter(e=>e.from===b.id||e.to===b.id).length-map.edges.filter(e=>e.from===a.id||e.to===a.id).length)[0]
  const rest=map.nodes.filter(n=>n!==central),left=rest.filter(n=>map.edges.some(e=>e.from===n.id&&e.to===central.id)),right=rest.filter(n=>!left.includes(n))
  const rows = Math.max(1, left.length, right.length)
  const cardHeight = Math.max(170, ...map.nodes.map(node => {
    const location = map.groups?.find(group => group.id === node.group)?.label || node.kind || 'Runtime actor'
    return 34 + wrap(node.kind === 'external' ? `${node.label} (external)` : node.label, 252, 28).split('\n').length * 28 * TEXT_LINE
      + wrap(location, 252, 22).split('\n').length * 22 * TEXT_LINE
  }))
  const step = cardHeight + 50, bottom = top + (rows - 1) * step + cardHeight
  const positions=new Map<string,{x:number;y:number;shapeId:string}>()
  const nodes=[{node:central,x:610,y:top+(rows-1)*step/2},...left.map((node,i)=>({node,x:0,y:top+i*step})),...right.map((node,i)=>({node,x:1220,y:top+i*step}))]
  for(const {node,x,y} of nodes) {
    const first = shapes.length
    const s: Shape = { id: id(), type: 'draw', author: 'agent', z: shapes.length + 1,
      closed: true, points: mapBoxPoints(origin.x + x, origin.y + y, 280, cardHeight, node.kind) }
    shapes.push(s)
    const heading = text(node.kind === 'external' ? `${node.label} (external)` : node.label, x+14,y+12,252,28)
    const group=map.groups?.find(g=>g.id===node.group)
    text(group?.label||node.kind||'Runtime actor',x+14,y+heading.h+22,252,22)
    nodeShapes.set(node.id,shapes.slice(first).map(s=>s.id));positions.set(node.id,{x:x+140,y:y+cardHeight/2,shapeId:s.id})
  }
  for(const edge of map.edges){
    const a=positions.get(edge.from),b=positions.get(edge.to);if(!a||!b)continue
    const self=edge.from===edge.to,shapeId=id()
    const arrow:ArrowShape={id:shapeId,type:'arrow',author:'agent',font:'sans',z:shapes.length+1,start:{id:a.shapeId,x:origin.x+a.x,y:origin.y+a.y},end:{id:b.shapeId,x:origin.x+b.x,y:origin.y+b.y},route:self?[{x:origin.x+a.x+220,y:origin.y+a.y},{x:origin.x+a.x+220,y:origin.y+a.y+100}]:[],mode:edge.mode||'sync',text:wrap(`${edge.label||'request'} (${edge.mode||'sync'})`,280,20)}
    const doc=new Map(shapes.map(s=>[s.id,s])),{a:start,b:end}=arrowPoints(arrow,doc)
    arrow.labelAt={x:(start.x+end.x)/2,y:(start.y+end.y)/2};shapes.push(arrow);edges.push({...edge,shapeId})
  }
  const annotationStart = shapes.length
  let footer=bottom+30
  const key=text('Context: boxes = runtime actors; subtitles = deployment locations. Arrows = caller → recipient, response included; protocol is labeled. Detailed roles, boundaries and failures are in the workflow views.',0,footer,width,22);footer+=key.h+18
  let h=0
  for(const [i,note] of (map.notes||[]).slice(0,2).entries()){
    const heading=text(note.title,i*765,footer,735,25),body=text(note.text,i*765,footer+heading.h+6,735,23),source=text(`Source: ${note.source}`,i*765,footer+heading.h+body.h+12,735,21)
    h=Math.max(h,heading.h+body.h+source.h+24)
  }
  const v=map.verification
  text(`Source review ${v?.at.slice(0,10)||'undated'} · ${v?.revision||'unknown revision'}${v?.dirty?' + local edits':''} · Owner: ${map.owner||'Unassigned'} · Live runtime NOT verified`,0,footer+h,width,21)
  for (const shape of shapes.slice(annotationStart)) shape.mapAnnotation = true
  return {shapes,nodeShapes,edges}
}
