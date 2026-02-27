import { u32LE, readAscii } from '../binary'
import type { CatCombatState } from '~/types/save'

/**
 * Parse HP and status effect from a decompressed cat blob.
 *
 * Layout at statsOffset + 84:
 *   [u64 statusStringLen][ASCII statusString][u32 HP]
 *
 * The status string is typically "none", or a stat name like "dex", "int", "str",
 * or a condition like "poisoned", "burned", "bleeding".
 *
 * House cats not on adventure have HP = 0x3FFFFFFF (sentinel for "full/default").
 * Adventure cats have actual HP values.
 */
export function parseCombatState(
  dec: Uint8Array,
  statsOffset: number
): CatCombatState | null {
  // Status/HP structure starts at stats + 84 (after the 7 stats + 14 combat modifier i32s)
  const statusStart = statsOffset + 84

  // Need at least u64 + 1 byte string + u32 HP
  if (statusStart + 8 + 1 + 4 > dec.length) return null

  // Read status string length as u64 (only low u32 matters, strings are short)
  const statusLen = u32LE(dec, statusStart)
  const statusLenHi = u32LE(dec, statusStart + 4)

  // Sanity check: string length should be small and high u32 should be 0
  if (statusLenHi !== 0 || statusLen > 64 || statusLen === 0) return null

  const stringStart = statusStart + 8

  // Bounds check for string + HP u32
  if (stringStart + statusLen + 4 > dec.length) return null

  const statusEffect = readAscii(dec, stringStart, statusLen)
  const hpOffset = stringStart + statusLen
  const hp = u32LE(dec, hpOffset)

  return {
    statusEffect,
    hp,
    hpOffset,
    statusOffset: statusStart
  }
}
