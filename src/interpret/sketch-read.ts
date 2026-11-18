// Reading a submitted sketch with the coding agent installed on this machine (Claude Code
// or Codex, headless and read-only) when there is no API key: the same instructions,
// picture and checks as the Claude API path, through the runner that maps the code.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import type { InterpretationResult, InterpretInput } from '../shared/types.js'
import { describeInput, INTERPRET_SYSTEM, INTERPRETATION_SCHEMA, validateInterpretation } from './claude.js'
import { askWithModel, type AskOpts, type Mapper } from './code-map.js'

type Schema = { [key: string]: unknown }

const nullable = (s: Schema): Schema =>
  typeof s.type === 'string' && s.type !== 'object' && s.type !== 'array'
    ? { ...s, type: [s.type, 'null'], ...(Array.isArray(s.enum) ? { enum: [...s.enum, null] } : {}) }
    : { anyOf: [s, { type: 'null' }] }

/**
 * The schema with every property required, as Codex's structured output wants; a property
 * that was optional may be null instead. validateInterpretation reads null as absent.
 */
export function requireEveryField(schema: unknown): unknown {
  if (Array.isArray(schema)) return schema.map(requireEveryField)
  if (!schema || typeof schema !== 'object') return schema
  const src = schema as Schema
  const out: Schema = {}
  for (const [k, v] of Object.entries(src)) out[k] = requireEveryField(v)
  if (out.type === 'object' && out.properties && typeof out.properties === 'object') {
    const required = new Set(Array.isArray(src.required) ? (src.required as string[]) : [])
    const props = out.properties as Record<string, Schema>
    for (const k of Object.keys(props)) if (!required.has(k)) props[k] = nullable(props[k])
    out.required = Object.keys(props)
  }
  return out
}

export function sketchPrompt(input: InterpretInput, readsFiles: boolean, imagePath: string): string {
  return `${INTERPRET_SYSTEM}

${readsFiles ? `The PNG of the canvas is at ${imagePath}: read it first with your file reading tool, handwriting included. You have read-only access: do not edit files or run commands.` : ''}

${describeInput(input)}
Reply with JSON matching the schema only.`
}

/** One read of the sketch by the agent on this machine. Throws with a short reason when it can't. */
export async function interpretWithModel(root: string, input: InterpretInput, mapper: Mapper, opts: AskOpts = {}): Promise<InterpretationResult> {
  if (!input.image?.length) throw new Error('the submit carried no picture of the sketch')
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vibeprint-sketch-'))
  const imagePath = path.join(dir, 'sketch.png')
  fs.writeFileSync(imagePath, input.image, { mode: 0o600 })
  try {
    const raw = await askWithModel(root, mapper, {
      prompt: (reads) => sketchPrompt(input, reads, imagePath),
      digest: () => '',
      schema: requireEveryField(INTERPRETATION_SCHEMA) as object,
      what: 'sketch interpretation',
    }, { ...opts, image: input.image, imagePath })
    return validateInterpretation(raw, input)
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
}
