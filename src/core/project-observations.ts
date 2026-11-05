import fs from 'node:fs'
import path from 'node:path'
import { z } from 'zod'
import { metricDefinitionSchema, metricReadingSchema } from '../shared/project-insights.js'
import type { ProjectMetric } from '../shared/types.js'

const observationSchema = z.object({ metrics: z.array(metricDefinitionSchema.extend({ reading: metricReadingSchema }).strict()).max(12) }).strict()

/** Only explicit aggregate snapshots are accepted. Never open credentials or run a collector. */
export function readProjectObservations(root: string): { metrics: ProjectMetric[]; warning?: string } {
  try {
    const canonicalRoot = fs.realpathSync(root)
    const dir = path.join(canonicalRoot, '.vibeprint')
    if (!fs.existsSync(dir)) return { metrics: [] }
    if (fs.lstatSync(dir).isSymbolicLink()) throw new Error('linked directory')
    const file = path.join(dir, 'observations.json')
    // lstat also detects a dangling symlink; never follow one outside this input file.
    let stat: fs.Stats
    try { stat = fs.lstatSync(file) } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { metrics: [] }
      throw error
    }
    if (!stat.isFile() || stat.size > 65_536) throw new Error('not a bounded regular file')
    const data = observationSchema.parse(JSON.parse(fs.readFileSync(file, 'utf8')))
    const ids = new Set<string>()
    for (const metric of data.metrics) {
      if (ids.has(metric.id) || Date.parse(metric.reading.at) > Date.now() + 300_000) throw new Error('duplicate or future observation')
      ids.add(metric.id)
    }
    return data
  } catch {
    return { metrics: [], warning: 'Activity snapshot unavailable: .vibeprint/observations.json is invalid or unreadable.' }
  }
}

/** Model replies provide definitions, never observations. Explicit snapshots retain their own meaning. */
export function mergeProjectObservations(definitions: unknown, observations: ProjectMetric[]): ProjectMetric[] {
  const result = new Map<string, ProjectMetric>()
  for (const item of Array.isArray(definitions) ? definitions.slice(0, 12) : []) {
    const parsed = metricDefinitionSchema.safeParse(item)
    if (parsed.success && !result.has(parsed.data.id)) result.set(parsed.data.id, parsed.data)
  }
  // Replace the entire definition when ids match, so a model cannot relabel a recorded count.
  for (const metric of observations) result.set(metric.id, metric)
  return [...result.values()]
}
