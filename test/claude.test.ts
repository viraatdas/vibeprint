import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type Anthropic from '@anthropic-ai/sdk'
import { chatWithClaude, claudeConfig, interpretWithClaude, type AnthropicLike } from '../src/interpret/claude.js'
import { emptyGraph } from '../src/shared/graph.js'
import type { ArchitectureView, Graph, InterpretInput } from '../src/shared/types.js'

type Body = Anthropic.Beta.Messages.MessageCreateParamsNonStreaming

/** A fake client that records requests and answers with a structured-output text block. */
function fakeClient(reply: unknown, overrides: Record<string, unknown> = {}) {
  const calls: Array<{ body: Body; options?: { signal?: AbortSignal } }> = []
  const client: AnthropicLike = {
    beta: {
      messages: {
        async create(body, options) {
          calls.push({ body, options })
          return {
            id: 'msg_test',
            type: 'message',
            role: 'assistant',
            model: body.model,
            content: [
              { type: 'thinking', thinking: '', signature: 'sig' },
              { type: 'text', text: typeof reply === 'string' ? reply : JSON.stringify(reply) },
            ],
            stop_reason: 'end_turn',
            stop_details: null,
            ...overrides,
          } as unknown as Anthropic.Beta.Messages.BetaMessage
        },
      },
    },
  }
  return { client, calls }
}

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4])

function sampleInput(): InterpretInput {
  const previous: Graph = {
    ...emptyGraph(),
    version: 2,
    sketchSeq: 1,
    nodes: [
      {
        id: 'n_api',
        label: 'API',
        kind: 'service',
        tags: [],
        shapeIds: ['shape:box1'],
        bounds: { x: 0, y: 0, w: 100, h: 60 },
        origin: 'ink',
        status: 'planned',
      },
    ],
  }
  return {
    sketch: {
      seq: 2,
      createdAt: '2026-11-02T00:00:00.000Z',
      hasImage: true,
      bounds: { x: 0, y: 0, w: 500, h: 200 },
      shapes: [
        { id: 'shape:box1', type: 'draw', closed: true, bounds: { x: 0, y: 0, w: 100, h: 60 } },
        { id: 'shape:hw1', type: 'draw', bounds: { x: 20, y: 20, w: 12, h: 16 }, points: [{ x: 20, y: 20 }, { x: 32, y: 36 }] },
        { id: 'shape:box2', type: 'geo', geo: 'cylinder', bounds: { x: 300, y: 0, w: 100, h: 80 }, text: 'Postgres' },
        {
          id: 'shape:arrow',
          type: 'arrow',
          bounds: { x: 100, y: 30, w: 200, h: 10 },
          arrow: { start: { x: 100, y: 30 }, end: { x: 300, y: 40 }, startShapeId: 'shape:box1', endShapeId: 'shape:box2' },
        },
        {
          id: 'shape:line',
          type: 'draw',
          bounds: { x: 0, y: 100, w: 400, h: 4 },
          points: Array.from({ length: 40 }, (_, i) => ({ x: i * 10.26, y: 100 + (i % 3) })),
        },
      ],
    },
    image: PNG,
    previous,
    openQuestions: [{ markId: 'm_q1', text: 'Which cache?', target: { kind: 'node', id: 'n_api' }, at: { x: 120, y: 150 } }],
  }
}

describe('claudeConfig', () => {
  it('is available only with an API key and defaults to the current Opus', () => {
    assert.deepEqual(claudeConfig({}), { available: false, model: 'claude-opus-5-5' })
    assert.deepEqual(claudeConfig({ ANTHROPIC_API_KEY: '  ' }), { available: false, model: 'claude-opus-5-5' })
    assert.deepEqual(claudeConfig({ ANTHROPIC_API_KEY: 'sk-ant-x', VIBEPRINT_MODEL: 'claude-sonnet-5-5' }), {
      available: true,
      model: 'claude-sonnet-5-5',
    })
  })
})

describe('interpretWithClaude', () => {
  it('sends the image and shape listing and forces a structured result', async () => {
    const { client, calls } = fakeClient({ nodes: [], edges: [], questions: [], answers: [], summary: '' })
    const controller = new AbortController()
    await interpretWithClaude(sampleInput(), { client, model: 'claude-test', signal: controller.signal })

    assert.equal(calls.length, 1)
    const { body, options } = calls[0]
    assert.equal(body.model, 'claude-test')
    assert.equal(options?.signal, controller.signal)

    // Structured output is forced through a JSON schema (forced tool_choice 400s on the default model).
    assert.equal(body.output_config?.format?.type, 'json_schema')
    const schema = body.output_config?.format?.schema as { required: string[] }
    assert.deepEqual(schema.required, ['nodes', 'edges', 'questions', 'answers', 'summary'])
    assert.equal(body.tool_choice, undefined)
    assert.equal(body.tools, undefined)
    assert.deepEqual(body.thinking, { type: 'adaptive' })

    const content = body.messages[0].content as Anthropic.Beta.Messages.BetaContentBlockParam[]
    assert.equal(body.messages.length, 1)
    assert.equal(content[0].type, 'image')
    const img = content[0] as Anthropic.Beta.Messages.BetaImageBlockParam
    assert.deepEqual(img.source, { type: 'base64', media_type: 'image/png', data: PNG.toString('base64') })

    const text = (content[1] as Anthropic.Beta.Messages.BetaTextBlockParam).text
    assert.match(text, /"id":"shape:hw1"/)
    assert.match(text, /"startShape":"shape:box1","endShape":"shape:box2"/)
    assert.match(text, /"id":"n_api"/)
    assert.match(text, /"markId":"m_q1"/)
    // Long stroke paths are decimated.
    const line = text.split('\n').find((l) => l.includes('"shape:line"'))!
    assert.equal((JSON.parse(line).pts as unknown[]).length, 8)
    // Handwriting strokes carry no path.
    assert.equal(JSON.parse(text.split('\n').find((l) => l.includes('"shape:hw1"'))!).pts, undefined)
  })

  it('omits the image block when there is no image', async () => {
    const { client, calls } = fakeClient({ nodes: [], edges: [], questions: [], answers: [], summary: '' })
    await interpretWithClaude({ ...sampleInput(), image: undefined }, { client })
    const content = calls[0].body.messages[0].content as Anthropic.Beta.Messages.BetaContentBlockParam[]
    assert.deepEqual(
      content.map((c) => c.type),
      ['text'],
    )
  })

  it('drops unknown shape ids, inkless nodes, edges to unknown nodes, and caps questions', async () => {
    const { client } = fakeClient({
      nodes: [
        { id: 'n_api', label: 'Orders API', kind: 'service', tags: ['Go', 'Orders API', 'REST', 'extra'], shapeIds: ['shape:box1', 'shape:hw1', 'shape:ghost'] },
        { id: 'new_1', label: 'Postgres', kind: 'database', tags: ['database'], shapeIds: ['shape:box2'] },
        { id: 'new_2', label: 'Invented cache', kind: 'cache', tags: [], shapeIds: ['shape:ghost'] },
        { id: 'new_1', label: 'Duplicate id', tags: [], shapeIds: ['shape:line'] },
      ],
      edges: [
        { from: 'n_api', to: 'new_1', label: 'SQL', shapeIds: ['shape:arrow', 'shape:nope'] },
        { from: 'n_api', to: 'new_1', shapeIds: [] }, // duplicate
        { from: 'n_api', to: 'new_2', shapeIds: [] }, // node dropped
        { from: 'n_api', to: 'n_missing', shapeIds: [] }, // unknown node
        { from: 'new_1', to: 'new_1', shapeIds: [] }, // self-loop
      ],
      questions: [{ text: 'Q1?', target: 'n_api' }, { text: 'Q2?', at: { x: 1, y: 2 } }, { text: 'Q3?' }],
      answers: [
        { markId: 'm_q1', answer: 'Redis' },
        { markId: 'm_unknown', answer: 'nope' },
      ],
      summary: 'An API backed by Postgres.',
    })
    const result = await interpretWithClaude(sampleInput(), { client })

    assert.deepEqual(
      result.nodes.map((n) => [n.id, n.label, n.shapeIds]),
      [
        ['n_api', 'Orders API', ['shape:box1', 'shape:hw1']],
        ['new_1', 'Postgres', ['shape:box2']],
        ['new_3', 'Duplicate id', ['shape:line']],
      ],
    )
    assert.deepEqual(result.nodes[0].tags, ['Go', 'REST'])
    assert.deepEqual(result.edges, [{ from: 'n_api', to: 'new_1', label: 'SQL', shapeIds: ['shape:arrow'] }])
    assert.equal(result.questions?.length, 2)
    assert.deepEqual(result.questions?.[0], { text: 'Q1?', target: 'n_api' })
    assert.deepEqual(result.questions?.[1], { text: 'Q2?', at: { x: 1, y: 2 } })
    assert.deepEqual(result.answers, [{ markId: 'm_q1', answer: 'Redis' }])
    assert.equal(result.summary, 'An API backed by Postgres.')
  })

  it('rejects on a refusal or an unparseable reply', async () => {
    const refused = fakeClient('', { stop_reason: 'refusal', stop_details: { type: 'refusal', category: 'cyber', explanation: null } })
    await assert.rejects(interpretWithClaude(sampleInput(), { client: refused.client }), /declined.*cyber/)
    const garbled = fakeClient('not json')
    await assert.rejects(interpretWithClaude(sampleInput(), { client: garbled.client }), /unparseable/)
  })
})

describe('chatWithClaude', () => {
  const architecture: ArchitectureView = {
    project: 'demo',
    sketchSeq: 2,
    graphVersion: 3,
    nodes: [{ id: 'n_api', label: 'API', status: 'planned', origin: 'ink', tags: [], connectsTo: [] }],
    edges: [],
    removed: [],
    pending: [],
    openQuestions: [],
    recentDecisions: [],
    rule: 'rule',
  }

  it('returns the reply and only valid, non-status marks (at most 6)', async () => {
    const { client, calls } = fakeClient({
      reply: 'Added a cache in front of the API.',
      marks: [
        { type: 'add', label: 'Redis', kind: 'Cache', connectFrom: ['n_api'], target: 'n_api', reason: 'Hot reads' },
        { type: 'status', target: 'n_api', reason: 'not allowed' },
        { type: 'strike', reason: 'missing target' },
        { type: 'rewrite', target: 'n_api', label: 'Orders API', reason: 'clearer' },
        { type: 'note', target: 'n_api', text: 'Rate limit?', question: true, reason: 'abuse' },
        { type: 'add', edge: { from: 'n_api', to: 'n_db' }, reason: 'link' },
        { type: 'strike', target: 'e_1', reason: 'r' },
        { type: 'note', text: 'one', reason: 'r' },
        { type: 'note', text: 'two', reason: 'r' },
      ],
    })
    const out = await chatWithClaude(
      {
        architecture,
        history: [
          { id: '1', role: 'user', author: 'user', text: 'hi', createdAt: '' },
          { id: '2', role: 'agent', author: 'claude', text: 'hello', createdAt: '' },
          { id: '3', role: 'user', author: 'user', text: 'Add a cache', createdAt: '' },
        ],
        message: 'Add a cache',
        image: PNG,
      },
      { client, model: 'claude-test' },
    )
    assert.equal(out.text, 'Added a cache in front of the API.')
    assert.equal(out.marks.length, 6)
    assert.ok(out.marks.every((m) => m.type !== 'status'))
    assert.deepEqual(out.marks[0], { type: 'add', target: 'n_api', label: 'Redis', kind: 'cache', connectFrom: ['n_api'], reason: 'Hot reads' })
    assert.deepEqual(out.marks[2], { type: 'note', target: 'n_api', text: 'Rate limit?', question: true, reason: 'abuse' })

    const { body } = calls[0]
    assert.equal(body.output_config?.format?.type, 'json_schema')
    assert.equal(body.tool_choice, undefined)
    const content = body.messages[0].content as Anthropic.Beta.Messages.BetaContentBlockParam[]
    assert.equal(content[0].type, 'image')
    const text = (content[1] as Anthropic.Beta.Messages.BetaTextBlockParam).text
    assert.match(text, /"id":"n_api"/)
    assert.match(text, /claude: hello/)
    // The current message is not repeated from history.
    assert.equal(text.split('Add a cache').length - 1, 1)
  })

  it('stays quiet by default: a plain answer with no marks', async () => {
    const { client } = fakeClient({ reply: 'The API has no dependencies yet.', marks: [] })
    const out = await chatWithClaude({ architecture, history: [], message: 'What does the API talk to?' }, { client })
    assert.deepEqual(out, { text: 'The API has no dependencies yet.', marks: [] })
  })
})
