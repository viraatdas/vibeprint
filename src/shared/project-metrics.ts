import type { ProjectMetric } from './types.js'

/** Definitions alone cannot supply a current count. Zero must be an explicit observation. */
export function metricValue(metric: ProjectMetric): string {
  return metric.reading ? `${metric.reading.value.toLocaleString('en-US')} ${metric.unit}` : 'Not measured'
}
