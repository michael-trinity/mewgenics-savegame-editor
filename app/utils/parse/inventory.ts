import { u32LE, readAscii } from '../binary'
import type { InventoryItem } from '~/types/save'

/**
 * Read a length-prefixed ASCII string: [u32 len][u32 pad=0][ASCII chars]
 * Returns the string and the number of bytes consumed.
 */
function readPrefixedString(blob: Uint8Array, off: number): { str: string, bytesRead: number } {
  const len = u32LE(blob, off)
  const str = len > 0 ? readAscii(blob, off + 8, len) : ''
  return { str, bytesRead: 8 + len }
}

/**
 * Parse an inventory blob (backpack, storage, or trash).
 *
 * Format:
 *   [u32 count] [u32 version=5]
 *   Per item:
 *     [u8 flag]
 *     [u32 nameLen][u32 0][ASCII name]
 *     [u32 subNameLen][u32 0][ASCII subName]   ← usually empty
 *     [u32 charges][u32 field1][u32 field2][u32 seqId]
 *     [u8 tailByte]
 *   Separator between items: [u8 pad][u32 5] = 5 bytes
 *   After last item: [u8 trailing]
 */
export function parseInventoryBlob(blob: Uint8Array): InventoryItem[] {
  if (!blob || blob.length < 4) return []

  let off = 0
  const count = u32LE(blob, off)
  off += 4
  if (count === 0) return []

  // skip version/unk u32
  off += 4

  const items: InventoryItem[] = []

  for (let i = 0; i < count; i++) {
    if (off >= blob.length) break

    // flag byte
    off += 1

    const { str: name, bytesRead: nameBytes } = readPrefixedString(blob, off)
    off += nameBytes

    const { str: subName, bytesRead: subBytes } = readPrefixedString(blob, off)
    off += subBytes

    const charges = new DataView(blob.buffer, blob.byteOffset, blob.byteLength).getInt32(off, true)
    off += 4
    const field1 = u32LE(blob, off)
    off += 4
    const field2 = u32LE(blob, off)
    off += 4
    const seqId = u32LE(blob, off)
    off += 4
    const tailByte = blob[off]!
    off += 1

    items.push({
      name,
      subName: subName || null,
      charges,
      field1,
      field2,
      seqId,
      tailByte
    })

    // Inter-item separator (5 bytes) or trailing byte (1 byte)
    if (i < count - 1) {
      off += 5
    } else {
      off += 1
    }
  }

  return items
}
