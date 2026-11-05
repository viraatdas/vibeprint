import { z } from 'zod'

const text = (max: number) => z.string().trim().min(1).max(max)
export const projectFactSchema = z.object({ title: text(80), text: text(500), source: text(300) })
export const metricDefinitionSchema = z.object({
  id: z.string().regex(/^[a-z][a-z0-9-]{0,63}$/), label: text(80), definition: text(500), unit: text(40), source: text(300),
})
export const metricReadingSchema = z.object({
  value: z.number().finite(), at: z.iso.datetime({ offset: true }), window: text(160), scope: text(160), source: text(300),
}).strict()
export const projectMetricSchema = metricDefinitionSchema.extend({ reading: metricReadingSchema.optional() })
