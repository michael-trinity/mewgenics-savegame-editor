import { writeU32LE } from '../binary'
import type { InventoryItem } from '~/types/save'

/**
 * Write a length-prefixed ASCII string: [u32 len][u32 pad=0][ASCII chars]
 */
function writePrefixedString(str: string): Uint8Array {
  const len = str.length
  const buf = new Uint8Array(8 + len)
  writeU32LE(buf, 0, len)
  // pad u32 at offset 4 is already 0
  for (let i = 0; i < len; i++) {
    buf[8 + i] = str.charCodeAt(i)
  }
  return buf
}

/**
 * Build an inventory blob from an array of items.
 * Mirrors the format parsed by parseInventoryBlob():
 *   [u32 count][u32 version=5]
 *   Per item:
 *     [u8 flag=1]
 *     [u32 nameLen][u32 0][ASCII name]
 *     [u32 subNameLen][u32 0][ASCII subName]
 *     [i32 charges][u32 field1][u32 field2][u32 seqId]
 *     [u8 tailByte]
 *   Between items: [u8 0x00][u32 5] separator
 *   After last item: [u8 0x00] trailing
 */
export function buildInventoryBlob(items: InventoryItem[]): Uint8Array {
  const parts: Uint8Array[] = []

  // Header: [u32 count][u32 version=5]
  const header = new Uint8Array(8)
  writeU32LE(header, 0, items.length)
  writeU32LE(header, 4, 5)
  parts.push(header)

  for (let i = 0; i < items.length; i++) {
    const item = items[i]!

    // flag byte
    parts.push(new Uint8Array([1]))

    // name
    parts.push(writePrefixedString(item.name))

    // subName
    parts.push(writePrefixedString(item.subName || ''))

    // charges (i32), field1, field2, seqId (all u32), tailByte
    const fields = new Uint8Array(17)
    const dv = new DataView(fields.buffer)
    dv.setInt32(0, item.charges, true)
    dv.setUint32(4, item.field1, true)
    dv.setUint32(8, item.field2, true)
    dv.setUint32(12, item.seqId, true)
    fields[16] = item.tailByte
    parts.push(fields)

    // Separator or trailing
    if (i < items.length - 1) {
      // Inter-item separator: [u8 0x00][u32 5]
      const sep = new Uint8Array(5)
      writeU32LE(sep, 1, 5)
      parts.push(sep)
    } else {
      // After last item: [u8 0x00]
      parts.push(new Uint8Array([0]))
    }
  }

  // Concatenate all parts
  const totalLen = parts.reduce((sum, p) => sum + p.length, 0)
  const result = new Uint8Array(totalLen)
  let off = 0
  for (const p of parts) {
    result.set(p, off)
    off += p.length
  }
  return result
}
