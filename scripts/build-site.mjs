import { cpSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
const source = fileURLToPath(new URL('../evaluations/2026-11-04/', import.meta.url))
const target = fileURLToPath(new URL('../site/evaluations/2026-11-04/', import.meta.url))
mkdirSync(target, { recursive: true })
cpSync(source, target, { recursive: true })
console.log('Copied the archived map-quality report into the public site.')
