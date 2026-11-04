import { cpSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
for (const date of ['2026-11-04', '2026-11-05']) {
  const source = fileURLToPath(new URL(`../evaluations/${date}/`, import.meta.url))
  const target = fileURLToPath(new URL(`../site/evaluations/${date}/`, import.meta.url))
  mkdirSync(target, { recursive: true })
  cpSync(source, target, { recursive: true })
}
console.log('Copied the archived map-quality report into the public site.')
