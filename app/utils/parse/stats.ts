import type { CatStats } from '~/types/save'
import { arrayToStats } from '~/types/save'
import { u32LE } from '../binary'

/**
 * Read 7 i32 level-up bonuses starting at the given offset (stats + 28).
 * Values are typically 0–10; negative or very large values indicate bad data.
 */
function readLevelBonuses(view: DataView, off: number, n: number): CatStats | null {
  if (off + 28 > n) return null
  const vals: number[] = []
  for (let i = 0; i < 7; i++) {
    const v = view.getInt32(off + i * 4, true)
    if (v < -10 || v > 50) return null // sanity bound
    vals.push(v)
  }
  return {
    str: vals[0]!,
    dex: vals[1]!,
    con: vals[2]!,
    int: vals[3]!,
    spd: vals[4]!,
    cha: vals[5]!,
    luck: vals[6]!
  }
}

/**
 * Check if the combat state structure at statsOff + 84 looks valid.
 * Layout: [u64 statusStringLen][ASCII statusString][u32 HP]
 * A valid match has statusLenHi=0, 0 < statusLen <= 64, and ASCII text.
 */
function hasCombatState(dec: Uint8Array, statsOff: number): boolean {
  const csOff = statsOff + 84
  if (csOff + 13 > dec.length) return false

  const statusLen = u32LE(dec, csOff)
  const statusLenHi = u32LE(dec, csOff + 4)
  if (statusLenHi !== 0 || statusLen === 0 || statusLen > 64) return false

  const strStart = csOff + 8
  if (strStart + statusLen + 4 > dec.length) return false

  // Verify the status string is printable ASCII
  for (let i = 0; i < statusLen; i++) {
    const c = dec[strStart + i]!
    if (c < 0x20 || c >= 0x7F) return false
  }
  return true
}

/**
 * Find the 7 base stats (7x i32 in [1..10]) in a decompressed cat blob.
 * Also reads 7 level-up bonus i32s immediately after (at stats + 28).
 * Port of Python's find_stats — heuristic scoring prefers offsets near 0x1CC.
 *
 * When multiple candidates score similarly, validates the combat state at
 * statsOff + 84 to disambiguate (avoids shifted false matches from uniform stats).
 */
export function findStats(
  dec: Uint8Array,
  expectedOff = 0x1CC,
  window = 0x140
): { stats: CatStats | null, levelBonuses: CatStats | null, offset: number | null } {
  const n = dec.length
  if (n < 28) return { stats: null, levelBonuses: null, offset: null }

  const view = new DataView(dec.buffer, dec.byteOffset, dec.byteLength)

  // Collect all valid candidates
  const candidates: { off: number, vals: number[], score: number }[] = []

  const lo = Math.max(0, expectedOff - window)
  const hi = Math.min(n - 28, expectedOff + window)

  for (let off = lo; off <= hi; off++) {
    let valid = true
    const vals: number[] = []

    for (let i = 0; i < 7; i++) {
      const v = view.getInt32(off + i * 4, true)
      if (v < 1 || v > 10) {
        valid = false
        break
      }
      vals.push(v)
    }

    if (!valid) continue

    const dist = Math.abs(off - expectedOff)
    const s = vals.reduce((a, b) => a + b, 0)
    const score = (1000 - dist) + (s * 0.1)
    candidates.push({ off, vals, score })
  }

  if (candidates.length === 0) return { stats: null, levelBonuses: null, offset: null }

  // Sort by score descending
  candidates.sort((a, b) => b.score - a.score)

  // If top candidate doesn't have a valid combat state, try others that do
  let best = candidates[0]!
  if (!hasCombatState(dec, best.off)) {
    const withCombat = candidates.find(c => hasCombatState(dec, c.off))
    if (withCombat) best = withCombat
  }

  const levelBonuses = readLevelBonuses(view, best.off + 28, n)
  return { stats: arrayToStats(best.vals), levelBonuses, offset: best.off }
}
