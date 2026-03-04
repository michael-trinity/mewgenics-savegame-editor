import { writeU32LE } from '../binary'
import type { HouseCatEntry } from '~/types/save'

/**
 * Build a house_state blob from an array of HouseCatEntry.
 *
 * Binary format:
 *   [u32 version=0][u32 count]
 *   Per entry:
 *     [u32 key][u32 unkU32][u64 roomNameLen][ASCII roomName]
 *     [f64 p0][f64 p1][f64 p2]
 */
export function buildHouseStateBlob(entries: HouseCatEntry[]): Uint8Array {
  // Calculate total size
  let size = 8 // version + count
  for (const e of entries) {
    size += 4 + 4 + 8 + e.room.length + 24 // key + unk + roomLen(u64) + room + 3×f64
  }

  const buf = new Uint8Array(size)
  const view = new DataView(buf.buffer)

  writeU32LE(buf, 0, 0) // version
  writeU32LE(buf, 4, entries.length)

  let off = 8
  for (const e of entries) {
    writeU32LE(buf, off, e.key)
    writeU32LE(buf, off + 4, e.unkU32)
    // room name length as u64 LE
    view.setBigUint64(off + 8, BigInt(e.room.length), true)
    off += 16

    // ASCII room name
    for (let i = 0; i < e.room.length; i++) {
      buf[off + i] = e.room.charCodeAt(i)
    }
    off += e.room.length

    // 3 f64 position values
    view.setFloat64(off, e.p0, true)
    view.setFloat64(off + 8, e.p1, true)
    view.setFloat64(off + 16, e.p2, true)
    off += 24
  }

  return buf
}
