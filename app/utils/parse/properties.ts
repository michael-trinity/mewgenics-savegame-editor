import type { Database } from 'sql.js'
import { u32LE, u64LE } from '../binary'

function decodePropertiesInt(blob: Uint8Array): number | null {
  if (!blob || blob.length === 0) return null

  // Try ASCII digits
  try {
    const s = new TextDecoder('ascii').decode(blob).replace(/\0/g, '').trim()
    if (/^\d+$/.test(s)) {
      const v = parseInt(s)
      return v >= 0 ? v : null
    }
  } catch { /* ignore */ }

  // Try binary widths (little-endian)
  const candidates: number[] = []
  if (blob.length >= 4) candidates.push(u32LE(blob, 0))
  if (blob.length >= 8) candidates.push(Number(u64LE(blob, 0)))

  for (const v of candidates) {
    if (v >= 0 && v <= 10_000_000) return v
  }

  return candidates.length > 0 ? candidates[0]! : null
}

export function readCurrentDay(db: Database): number | null {
  // Try 'data' column first, then 'value'
  for (const col of ['data', 'value']) {
    try {
      const stmt = db.prepare(`SELECT ${col} FROM properties WHERE key=?`)
      stmt.bind(['current_day'])
      if (stmt.step()) {
        const row = stmt.get()
        stmt.free()
        const v = row[0]

        if (v === null || v === undefined) continue

        // Native integer
        if (typeof v === 'number') {
          return Number.isInteger(v) && v >= 0 ? v : null
        }

        // String
        if (typeof v === 'string') {
          const s = v.replace(/\0/g, '').trim()
          if (/^\d+$/.test(s)) return parseInt(s)
          continue
        }

        // Blob
        if (v instanceof Uint8Array) {
          return decodePropertiesInt(v)
        }

        // Try int conversion
        try {
          const iv = Number(v)
          return iv >= 0 && Number.isInteger(iv) ? iv : null
        } catch {
          continue
        }
      }
      stmt.free()
    } catch {
      continue
    }
  }
  return null
}
