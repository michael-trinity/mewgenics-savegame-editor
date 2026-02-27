import { u32LE, u64LE, f64LE, readAscii } from '../binary'
import type { HouseCatEntry } from '~/types/save'

export function parseHouseState(blob: Uint8Array): HouseCatEntry[] {
  if (blob.length < 8) return []

  const ver = u32LE(blob, 0)
  const cnt = u32LE(blob, 4)

  if (ver !== 0 || cnt > 512) return []

  let off = 8
  const out: HouseCatEntry[] = []

  for (let i = 0; i < cnt; i++) {
    if (off + 16 > blob.length) return []

    const key = u32LE(blob, off)
    const unk = u32LE(blob, off + 4)
    const roomLen = Number(u64LE(blob, off + 8))
    const nameOff = off + 16

    if (nameOff + roomLen > blob.length) return []
    const room = readAscii(blob, nameOff, roomLen)

    const dOff = nameOff + roomLen
    if (dOff + 24 > blob.length) return []

    const p0 = f64LE(blob, dOff)
    const p1 = f64LE(blob, dOff + 8)
    const p2 = f64LE(blob, dOff + 16)

    out.push({ key, room, unkU32: unk, p0, p1, p2 })
    off = dOff + 24
  }

  // Must consume the blob exactly
  if (off !== blob.length) return []
  return out
}

export function parseAdventureStateKeys(blob: Uint8Array): number[] {
  if (!blob || blob.length < 8) return []

  const _ver = u32LE(blob, 0)
  const cnt = u32LE(blob, 4)

  if (cnt > 8) return []

  let off = 8
  const keys: number[] = []

  for (let i = 0; i < cnt; i++) {
    if (off + 8 > blob.length) return []

    const v = u64LE(blob, off)
    off += 8

    const hi = Number((v >> 32n) & 0xFFFFFFFFn)
    const lo = Number(v & 0xFFFFFFFFn)
    const key = hi !== 0 ? hi : lo

    if (key <= 0 || key > 1000000) return []
    keys.push(key)
  }

  return keys
}
