import { u32LE, u64LE, readAscii } from '../binary'
import type { FurnitureItem } from '~/types/save'

/**
 * Parse a single furniture blob.
 *
 * Format:
 *   [u32 header=1]
 *   [u32 nameLen][u32 pad=0][ASCII name]
 *   [u64 unkValue]
 *   [u32 roomLen][u32 pad=0][ASCII room]
 *   [i32 x][i32 y][u32 z][u32 flag1][u32 flag2]
 */
export function parseFurnitureBlob(key: number, blob: Uint8Array): FurnitureItem {
  const dv = new DataView(blob.buffer, blob.byteOffset, blob.byteLength)
  let off = 0

  off += 4 // skip header

  const nameLen = u32LE(blob, off)
  off += 8
  const name = nameLen > 0 ? readAscii(blob, off, nameLen) : ''
  off += nameLen

  const unkU64 = u64LE(blob, off)
  off += 8

  const roomLen = u32LE(blob, off)
  off += 8
  const room = roomLen > 0 ? readAscii(blob, off, roomLen) : ''
  off += roomLen

  const x = dv.getInt32(off, true)
  off += 4
  const y = dv.getInt32(off, true)
  off += 4
  const z = u32LE(blob, off)
  off += 4
  const flag1 = u32LE(blob, off)
  off += 4
  const flag2 = u32LE(blob, off)
  off += 4

  return { key, name, unkU64, room, x, y, z, flag1, flag2 }
}
