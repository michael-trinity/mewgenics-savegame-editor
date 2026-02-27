import { writeU32LE } from '../binary'

/**
 * Patch the HP value in a decompressed cat blob.
 * Returns a new Uint8Array (does not mutate the input).
 */
export function patchHp(blob: Uint8Array, hpOffset: number, newHp: number): Uint8Array {
  const out = new Uint8Array(blob)
  writeU32LE(out, hpOffset, newHp >>> 0)
  return out
}
