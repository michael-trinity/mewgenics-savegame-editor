import { writeU32LE, writeU64LE } from '../binary'
import type { FurnitureItem } from '~/types/save'

const textEncoder = new TextEncoder()

/**
 * Build a furniture blob from a FurnitureItem.
 *
 * Format:
 *   [u32 header=1]
 *   [u32 nameLen][u32 pad=0][ASCII name]
 *   [u64 unkValue]
 *   [u32 roomLen][u32 pad=0][ASCII room]
 *   [i32 x][i32 y][u32 z][u32 flag1][u32 flag2]
 */
export function buildFurnitureBlob(item: FurnitureItem): Uint8Array {
  const nameBytes = textEncoder.encode(item.name)
  const roomBytes = textEncoder.encode(item.room)

  // Total size: 4 (header) + 8 (nameLen+pad) + nameLen + 8 (unkU64)
  //           + 8 (roomLen+pad) + roomLen + 4*5 (x,y,z,flag1,flag2)
  const size = 4 + 8 + nameBytes.length + 8 + 8 + roomBytes.length + 20
  const buf = new Uint8Array(size)
  const dv = new DataView(buf.buffer)
  let off = 0

  // Header
  writeU32LE(buf, off, 1)
  off += 4

  // Name
  writeU32LE(buf, off, nameBytes.length)
  writeU32LE(buf, off + 4, 0)
  off += 8
  buf.set(nameBytes, off)
  off += nameBytes.length

  // Unknown u64
  writeU64LE(buf, off, item.unkU64)
  off += 8

  // Room
  writeU32LE(buf, off, roomBytes.length)
  writeU32LE(buf, off + 4, 0)
  off += 8
  buf.set(roomBytes, off)
  off += roomBytes.length

  // Position + flags
  dv.setInt32(off, item.x, true)
  off += 4
  dv.setInt32(off, item.y, true)
  off += 4
  writeU32LE(buf, off, item.z)
  off += 4
  writeU32LE(buf, off, item.flag1)
  off += 4
  writeU32LE(buf, off, item.flag2)

  return buf
}
