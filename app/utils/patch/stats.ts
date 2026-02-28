import { writeI32LE } from '../binary'
import type { CatStats } from '~/types/save'
import { statsToArray } from '~/types/save'

/**
 * Patch the 7 base stats in a decompressed cat blob.
 * Returns a new Uint8Array (does not mutate the input).
 */
export function patchStats(blob: Uint8Array, statsOffset: number, newStats: CatStats): Uint8Array {
  const out = new Uint8Array(blob)
  const vals = statsToArray(newStats)
  for (let i = 0; i < 7; i++) {
    writeI32LE(out, statsOffset + i * 4, vals[i]!)
  }
  return out
}

/**
 * Patch the level integer stored right after the class name string.
 * levelOffset is returned by findBirthdayInfo as cat.levelOffset.
 */
export function patchLevel(blob: Uint8Array, levelOffset: number, newLevel: number): Uint8Array {
  const out = new Uint8Array(blob)
  writeI32LE(out, levelOffset, Math.max(1, newLevel))
  return out
}
