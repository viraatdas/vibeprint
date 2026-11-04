// Regenerate measured advances when replacing the bundled face. No font library required.
import fs from 'node:fs'
const font = fs.readFileSync('web/src/fonts/DejaVuSans.ttf')
const u16 = (at: number) => font.readUInt16BE(at), u32 = (at: number) => font.readUInt32BE(at)
const tables = new Map(Array.from({ length: u16(4) }, (_, i) => { const at = 12 + i * 16; return [font.toString('ascii', at, at + 4), u32(at + 8)] as const }))
const cmap = tables.get('cmap')!
const subtable = Array.from({ length: u16(cmap + 2) }, (_, i) => cmap + u32(cmap + 4 + i * 8 + 4)).find(at => u16(at) === 4)
if (!subtable) throw new Error('Expected a format-4 character map')
const count = u16(subtable + 6) / 2, ends = subtable + 14, starts = ends + 2 * count + 2, deltas = starts + 2 * count, ranges = deltas + 2 * count
function glyph(code: number) {
  for (let i = 0; i < count; i++) {
    if (code < u16(starts + i * 2) || code > u16(ends + i * 2)) continue
    const range = u16(ranges + i * 2), delta = font.readInt16BE(deltas + i * 2)
    if (!range) return (code + delta + 65536) % 65536
    const value = u16(ranges + i * 2 + range + (code - u16(starts + i * 2)) * 2)
    return value ? (value + delta + 65536) % 65536 : 0
  }
  return 0
}
const units = u16(tables.get('head')! + 18), metrics = u16(tables.get('hhea')! + 34)
const codes = [...Array.from({ length: 95 }, (_, i) => i + 32), 0x2192, 0x2194, 0xb7, 0x2013, 0x2014, 0x2264, 0x2265]
const advances = Object.fromEntries(codes.map(code => [String.fromCodePoint(code), Number((u16(tables.get('hmtx')! + 4 * Math.min(glyph(code), metrics - 1)) / units).toFixed(5))]))
fs.writeFileSync('src/shared/map-font.ts', `/** Advances from the bundled DejaVu Sans face, in em units. Regenerate: node --import tsx scripts/build-map-font.ts */\nconst advances: Record<string, number> = ${JSON.stringify(advances)}\nexport const mapTextWidth = (text: string, size: number) => [...text].reduce((sum, c) => sum + (advances[c] ?? 1) * size, 0)\n\nexport const MAP_FLOW_SIZE = 20\nexport const MAP_FLOW_LINE = 24\n`)
