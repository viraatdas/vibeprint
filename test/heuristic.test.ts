import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { mergeInterpretation } from '../src/core/merge.js'
import { interpretHeuristic } from '../src/interpret/heuristic.js'
import { unionRects } from '../src/shared/geometry.js'
import { emptyGraph } from '../src/shared/graph.js'
import type { Graph, InterpretInput, InterpretationResult, OpenQuestion, Point, SketchShape } from '../src/shared/types.js'

// ---------------------------------------------------------------------------
// Builders
// ---------------------------------------------------------------------------

function input(shapes: SketchShape[], opts: { previous?: Graph; openQuestions?: OpenQuestion[] } = {}): InterpretInput {
  return {
    sketch: {
      seq: 1,
      createdAt: '2026-11-02T00:00:00.000Z',
      shapes,
      bounds: unionRects(shapes.map((s) => s.bounds)),
      hasImage: false,
    },
    previous: opts.previous ?? emptyGraph(),
    openQuestions: opts.openQuestions ?? [],
  }
}

function geo(id: string, x: number, y: number, w: number, h: number, text?: string, kind = 'rectangle'): SketchShape {
  return { id, type: 'geo', bounds: { x, y, w, h }, geo: kind, ...(text ? { text } : {}) }
}

function text(id: string, x: number, y: number, t: string, w = 80, h = 24): SketchShape {
  return { id, type: 'text', bounds: { x, y, w, h }, text: t }
}

function stroke(id: string, points: Point[], extra: Partial<SketchShape> = {}): SketchShape {
  const xs = points.map((p) => p.x)
  const ys = points.map((p) => p.y)
  const x = Math.min(...xs)
  const y = Math.min(...ys)
  return { id, type: 'draw', bounds: { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y }, points, ...extra }
}

/** A hand-drawn rectangle whose last point lands near (not on) its first. */
function drawnBox(id: string, x: number, y: number, w: number, h: number, closedFlag = false): SketchShape {
  return stroke(
    id,
    [
      { x: x + 4, y },
      { x: x + w, y },
      { x: x + w, y: y + h },
      { x, y: y + h },
      { x, y: y + 6 },
    ],
    closedFlag ? { closed: true } : {},
  )
}

/** A small zig-zag, like one stroke of handwriting. */
function scribble(id: string, x: number, y: number): SketchShape {
  return stroke(id, [
    { x, y },
    { x: x + 5, y: y + 14 },
    { x: x + 10, y },
    { x: x + 14, y: y + 14 },
  ])
}

function arrow(id: string, start: Point, end: Point, bind: { from?: string; to?: string; text?: string } = {}): SketchShape {
  const b = unionRects([
    { x: start.x, y: start.y, w: 0, h: 0 },
    { x: end.x, y: end.y, w: 0, h: 0 },
  ])!
  return {
    id,
    type: 'arrow',
    bounds: b,
    arrow: { start, end, ...(bind.from ? { startShapeId: bind.from } : {}), ...(bind.to ? { endShapeId: bind.to } : {}) },
    ...(bind.text ? { text: bind.text } : {}),
  }
}

function byLabel(result: InterpretationResult, label: string) {
  const n = result.nodes.find((x) => x.label === label)
  assert.ok(n, `expected a node labeled ${label}; got ${result.nodes.map((x) => x.label).join(', ')}`)
  return n
}

function edgeBetween(result: InterpretationResult, fromLabel: string, toLabel: string) {
  const from = byLabel(result, fromLabel).id
  const to = byLabel(result, toLabel).id
  return result.edges.find((e) => e.from === from && e.to === to)
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('interpretHeuristic', () => {
  it('turns a labeled geo box into a node', () => {
    const result = interpretHeuristic(input([geo('shape:api', 0, 0, 160, 80, 'API')]))
    assert.equal(result.nodes.length, 1)
    const n = result.nodes[0]
    assert.equal(n.label, 'API')
    assert.equal(n.kind, 'service')
    assert.deepEqual(n.shapeIds, ['shape:api'])
    assert.deepEqual(n.tags, ['service'])
    assert.equal(result.summary, undefined)
    assert.equal(result.questions, undefined)
  })

  it('labels a box with the typed text whose center sits inside it (smallest container wins)', () => {
    const result = interpretHeuristic(
      input([
        { id: 'shape:frame', type: 'frame', bounds: { x: 0, y: 0, w: 600, h: 400 }, text: 'Backend' },
        geo('shape:box', 50, 50, 200, 100),
        text('shape:label', 80, 80, 'Billing service'),
      ]),
    )
    const box = byLabel(result, 'Billing service')
    assert.deepEqual(box.shapeIds.sort(), ['shape:box', 'shape:label'])
    assert.ok(byLabel(result, 'Backend'))
  })

  it('reads a closed draw stroke as a container and puts the handwriting inside it into shapeIds', () => {
    const result = interpretHeuristic(
      input([
        drawnBox('shape:outline', 0, 0, 200, 120), // closed by endpoints
        scribble('shape:h1', 40, 40),
        scribble('shape:h2', 60, 40),
        scribble('shape:h3', 80, 40),
        drawnBox('shape:outline2', 400, 0, 200, 120, true), // closed flag
      ]),
    )
    assert.equal(result.nodes.length, 2)
    const first = byLabel(result, 'Box 1')
    assert.deepEqual(first.shapeIds, ['shape:outline', 'shape:h1', 'shape:h2', 'shape:h3'])
    assert.deepEqual(byLabel(result, 'Box 2').shapeIds, ['shape:outline2'])
  })

  it('numbers unlabeled boxes top-to-bottom, left-to-right', () => {
    const result = interpretHeuristic(
      input([geo('shape:c', 0, 300, 100, 60), geo('shape:b', 300, 10, 100, 60), geo('shape:a', 0, 0, 100, 60)]),
    )
    assert.deepEqual(
      result.nodes.map((n) => [n.label, n.shapeIds[0]]),
      [
        ['Box 1', 'shape:a'],
        ['Box 2', 'shape:b'],
        ['Box 3', 'shape:c'],
      ],
    )
  })

  it('does not treat a tiny closed stroke (a letter "o") inside a box as a container', () => {
    const result = interpretHeuristic(
      input([geo('shape:box', 0, 0, 200, 120), stroke('shape:o', [{ x: 50, y: 40 }, { x: 90, y: 40 }, { x: 90, y: 80 }, { x: 50, y: 80 }, { x: 51, y: 41 }])]),
    )
    assert.equal(result.nodes.length, 1)
    assert.deepEqual(result.nodes[0].shapeIds, ['shape:box', 'shape:o'])
  })

  it('maps an arrow bound at both ends to an edge with its label', () => {
    const result = interpretHeuristic(
      input([
        geo('shape:web', 0, 0, 120, 60, 'Web app'),
        geo('shape:api', 300, 0, 120, 60, 'API'),
        text('shape:inner', 320, 20, 'Node', 40, 20), // text shape inside API, arrows can bind to it too
        arrow('shape:arr', { x: 120, y: 30 }, { x: 300, y: 30 }, { from: 'shape:web', to: 'shape:inner', text: 'REST' }),
      ]),
    )
    assert.equal(result.edges.length, 1)
    const e = edgeBetween(result, 'Web app', 'API')
    assert.ok(e)
    assert.equal(e.label, 'REST')
    assert.deepEqual(e.shapeIds, ['shape:arr'])
    assert.equal(result.summary, undefined)
  })

  it('attaches an unbound arrow to the nearest boxes within reach, and skips far ones', () => {
    const near = interpretHeuristic(
      input([
        geo('shape:a', 0, 0, 100, 60, 'Worker'),
        geo('shape:b', 300, 0, 100, 60, 'Queue'),
        arrow('shape:arr', { x: 130, y: 30 }, { x: 270, y: 30 }),
      ]),
    )
    assert.ok(edgeBetween(near, 'Worker', 'Queue'))

    const far = interpretHeuristic(
      input([
        geo('shape:a', 0, 0, 100, 60, 'Worker'),
        geo('shape:b', 500, 0, 100, 60, 'Queue'),
        arrow('shape:arr', { x: 200, y: 30 }, { x: 350, y: 30 }),
      ]),
    )
    assert.equal(far.edges.length, 0)
  })

  it('reads an open draw stroke between two boxes as a connector in the drawn direction, with its arrowhead', () => {
    const result = interpretHeuristic(
      input([
        geo('shape:a', 0, 0, 100, 60, 'Client'),
        geo('shape:b', 300, 0, 100, 60, 'Server'),
        // drawn right-to-left: Server -> Client
        stroke('shape:line', [{ x: 295, y: 32 }, { x: 200, y: 28 }, { x: 106, y: 30 }]),
        // hand-drawn head at the end of the stroke (next to Client)
        stroke('shape:head', [{ x: 120, y: 18 }, { x: 107, y: 30 }, { x: 120, y: 42 }]),
      ]),
    )
    assert.equal(result.edges.length, 1)
    const e = edgeBetween(result, 'Server', 'Client')
    assert.ok(e)
    assert.deepEqual(e.shapeIds, ['shape:line', 'shape:head'])
  })

  it('flips a connector whose only arrowhead is at the start of the stroke', () => {
    const result = interpretHeuristic(
      input([
        geo('shape:a', 0, 0, 100, 60, 'Client'),
        geo('shape:b', 300, 0, 100, 60, 'Server'),
        stroke('shape:line', [{ x: 106, y: 30 }, { x: 200, y: 28 }, { x: 295, y: 32 }]), // drawn Client -> Server
        stroke('shape:head', [{ x: 120, y: 18 }, { x: 107, y: 30 }, { x: 120, y: 42 }]), // head points at Client
      ]),
    )
    assert.ok(edgeBetween(result, 'Server', 'Client'))
    assert.equal(edgeBetween(result, 'Client', 'Server'), undefined)
  })

  it('does not read handwriting strokes inside a box as connectors to a neighbor', () => {
    const result = interpretHeuristic(
      input([
        geo('shape:a', 0, 0, 200, 100),
        geo('shape:b', 240, 0, 200, 100),
        stroke('shape:l', [{ x: 170, y: 20 }, { x: 172, y: 80 }]), // an "l" near A's right edge
      ]),
    )
    assert.equal(result.edges.length, 0)
    assert.ok(byLabel(result, 'Box 1').shapeIds.includes('shape:l'))
  })

  it('connects boxes inside a frame rather than the frame itself', () => {
    const result = interpretHeuristic(
      input([
        { id: 'shape:frame', type: 'frame', bounds: { x: 0, y: 0, w: 600, h: 300 }, text: 'VPC' },
        geo('shape:a', 40, 100, 120, 60, 'API'),
        geo('shape:b', 400, 100, 120, 60, 'Postgres'),
        stroke('shape:line', [{ x: 165, y: 130 }, { x: 280, y: 128 }, { x: 395, y: 131 }]),
      ]),
    )
    assert.equal(result.edges.length, 1)
    assert.ok(edgeBetween(result, 'API', 'Postgres'))
  })

  it('makes free-standing typed text a text-only component', () => {
    const result = interpretHeuristic(
      input([geo('shape:api', 0, 0, 120, 60, 'API'), text('shape:stripe', 400, 0, 'Stripe'), arrow('shape:arr', { x: 120, y: 20 }, { x: 400, y: 12 }, { from: 'shape:api', to: 'shape:stripe' })]),
    )
    const stripe = byLabel(result, 'Stripe')
    assert.deepEqual(stripe.shapeIds, ['shape:stripe'])
    assert.equal(stripe.kind, 'external')
    assert.deepEqual(stripe.tags, ['external'])
    assert.ok(edgeBetween(result, 'API', 'Stripe'))
  })

  it('uses free text lying on a connector as the edge label', () => {
    const result = interpretHeuristic(
      input([
        geo('shape:a', 0, 0, 100, 60, 'API'),
        geo('shape:b', 400, 0, 100, 60, 'Redis'),
        stroke('shape:line', [{ x: 104, y: 30 }, { x: 250, y: 30 }, { x: 396, y: 30 }]),
        text('shape:lbl', 220, 8, 'cache', 50, 18),
      ]),
    )
    assert.equal(result.nodes.length, 2)
    const e = edgeBetween(result, 'API', 'Redis')
    assert.ok(e)
    assert.equal(e.label, 'cache')
    assert.ok(e.shapeIds?.includes('shape:lbl'))
  })

  it('infers kinds and short tags from keywords and geo hints', () => {
    const result = interpretHeuristic(
      input([
        geo('shape:1', 0, 0, 120, 60, 'Orders DB (Postgres)'),
        geo('shape:2', 200, 0, 120, 60, 'Redis'),
        geo('shape:3', 400, 0, 120, 60, 'Kafka consumer'),
        geo('shape:4', 600, 0, 120, 60, 'Web app'),
        geo('shape:5', 0, 200, 120, 60, 'API Gateway'),
        geo('shape:6', 200, 200, 120, 60, 'Orders', 'cylinder'),
        geo('shape:7', 400, 200, 120, 60, 'Payments', 'cloud'),
        geo('shape:8', 600, 200, 120, 60, 'OpenAI API'),
        geo('shape:9', 0, 400, 120, 60, 'UsersDB'),
        geo('shape:10', 200, 400, 120, 60, 'S3 bucket'),
        geo('shape:11', 400, 400, 120, 60, 'Job queue (SQS)'),
        geo('shape:12', 600, 400, 120, 60, 'iOS'),
        geo('shape:13', 0, 600, 120, 60, 'Notes'),
      ]),
    )
    const expect: Array<[string, string | undefined, string[]]> = [
      ['Orders DB (Postgres)', 'database', ['Postgres', 'database']],
      ['Redis', 'cache', ['cache']],
      ['Kafka consumer', 'worker', ['Kafka', 'worker']],
      ['Web app', 'client', ['client']],
      ['API Gateway', 'service', ['service']],
      ['Orders', 'database', ['database']],
      ['Payments', 'external', ['external']],
      ['OpenAI API', 'model', ['OpenAI', 'model']],
      ['UsersDB', 'database', ['database']],
      ['S3 bucket', 'storage', ['S3', 'storage']],
      ['Job queue (SQS)', 'queue', ['SQS', 'queue']],
      ['iOS', 'client', ['client']],
      ['Notes', undefined, []],
    ]
    for (const [label, kind, tags] of expect) {
      const n = byLabel(result, label)
      assert.equal(n.kind, kind, `kind of ${label}`)
      assert.deepEqual(n.tags, tags, `tags of ${label}`)
      assert.ok((n.tags ?? []).length <= 2)
      assert.ok(!(n.tags ?? []).some((t) => t.toLowerCase() === label.toLowerCase()), `tags of ${label} repeat the label`)
    }
  })

  it('reads typed text beside an open question as its answer, not a component', () => {
    const q: OpenQuestion = { markId: 'm_1', text: 'Which database?', target: { kind: 'node', id: 'n_db' }, at: { x: 500, y: 100 } }
    const result = interpretHeuristic(
      input([geo('shape:db', 0, 0, 120, 60, 'DB'), text('shape:ans', 520, 140, 'Postgres'), text('shape:far', 1200, 900, 'Admin UI')], {
        openQuestions: [q],
      }),
    )
    assert.deepEqual(result.answers, [{ markId: 'm_1', answer: 'Postgres' }])
    assert.equal(result.nodes.find((n) => n.label === 'Postgres'), undefined)
    assert.ok(byLabel(result, 'Admin UI'))
  })

  it('typed text inside a box near a question still labels the box', () => {
    const q: OpenQuestion = { markId: 'm_1', text: '?', target: { kind: 'point', x: 0, y: 0 }, at: { x: 150, y: 0 } }
    const result = interpretHeuristic(input([geo('shape:a', 0, 0, 120, 60), text('shape:t', 20, 20, 'Search')], { openQuestions: [q] }))
    assert.equal(result.answers, undefined)
    assert.ok(byLabel(result, 'Search'))
  })

  it('reuses the previous node id, label, kind and tags for an unlabeled box drawn with the same ink', () => {
    const previous: Graph = {
      ...emptyGraph(),
      version: 3,
      sketchSeq: 2,
      nodes: [
        {
          id: 'n_auth',
          label: 'Auth Service',
          kind: 'service',
          tags: ['Auth0'],
          shapeIds: ['shape:outline', 'shape:h1', 'shape:h2'],
          bounds: { x: 0, y: 0, w: 200, h: 120 },
          origin: 'ink',
          status: 'building',
        },
        {
          id: 'n_box_1',
          label: 'Box 1',
          tags: [],
          shapeIds: ['shape:other'],
          bounds: { x: 0, y: 300, w: 200, h: 120 },
          origin: 'ink',
          status: 'planned',
        },
      ],
    }
    const result = interpretHeuristic(
      input(
        [
          drawnBox('shape:outline', 0, 0, 200, 120),
          scribble('shape:h1', 40, 40),
          scribble('shape:h2', 60, 40),
          scribble('shape:h3', 80, 40), // a new stroke since last time
          drawnBox('shape:other', 0, 300, 200, 120),
          drawnBox('shape:new', 400, 300, 200, 120),
        ],
        { previous },
      ),
    )
    const auth = result.nodes.find((n) => n.id === 'n_auth')
    assert.ok(auth)
    assert.equal(auth.label, 'Auth Service')
    assert.equal(auth.kind, 'service')
    assert.deepEqual(auth.tags, ['Auth0'])
    assert.deepEqual(auth.shapeIds, ['shape:outline', 'shape:h1', 'shape:h2', 'shape:h3'])
    assert.equal(result.nodes.find((n) => n.id === 'n_box_1')?.label, 'Box 1')
    // The new box does not collide with the reused "Box 1".
    assert.equal(result.nodes.find((n) => n.shapeIds[0] === 'shape:new')?.label, 'Box 2')
  })

  it('returns empty lists for an empty canvas', () => {
    const result = interpretHeuristic(input([]))
    assert.deepEqual(result, { nodes: [], edges: [] })
  })

  it('round-trips through mergeInterpretation with stable ids across submits', () => {
    const shapes = [
      geo('shape:web', 0, 0, 120, 60, 'Web app'),
      drawnBox('shape:api', 300, 0, 160, 100),
      scribble('shape:h1', 340, 30),
      geo('shape:db', 600, 0, 120, 80, 'Postgres', 'cylinder'),
      arrow('shape:a1', { x: 120, y: 30 }, { x: 300, y: 40 }, { from: 'shape:web', to: 'shape:api', text: 'HTTPS' }),
      stroke('shape:l1', [{ x: 465, y: 50 }, { x: 530, y: 45 }, { x: 595, y: 40 }]),
    ]
    const first = input(shapes)
    const r1 = interpretHeuristic(first)
    const m1 = mergeInterpretation(first.previous, r1, first.sketch, 'vibeprint', '2026-11-02T00:00:00.000Z')
    const g1 = m1.graph
    assert.equal(g1.nodes.length, 3)
    assert.equal(g1.edges.length, 2)
    assert.ok(g1.nodes.every((n) => n.id.startsWith('n_') && n.origin === 'ink'))
    const id = (label: string) => g1.nodes.find((n) => n.label === label)!.id
    const edgeKey = (e: { from: string; to: string; label?: string }) => `${e.from}->${e.to}:${e.label ?? ''}`
    assert.deepEqual(g1.edges.map(edgeKey).sort(), [`${id('Box 1')}->${id('Postgres')}:`, `${id('Web app')}->${id('Box 1')}:HTTPS`])
    assert.deepEqual(g1.nodes.find((n) => n.label === 'Box 1')!.shapeIds, ['shape:api', 'shape:h1'])
    assert.equal(g1.summary, undefined)

    // Simulate an AI interpretation having named the hand-drawn box, then a heuristic re-submit.
    const named: Graph = { ...g1, nodes: g1.nodes.map((n) => (n.label === 'Box 1' ? { ...n, label: 'Orders API', kind: 'service' } : n)) }
    const second = { ...input(shapes, { previous: named }), sketch: { ...first.sketch, seq: 2 } }
    const r2 = interpretHeuristic(second)
    const m2 = mergeInterpretation(named, r2, second.sketch, 'vibeprint', '2026-11-02T00:01:00.000Z')
    assert.deepEqual(
      m2.graph.nodes.map((n) => [n.id, n.label]).sort(),
      named.nodes.map((n) => [n.id, n.label]).sort(),
    )
    assert.deepEqual(m2.graph.edges.map((e) => e.id).sort(), g1.edges.map((e) => e.id).sort())
    assert.deepEqual(m2.dropped, [])
  })
})
