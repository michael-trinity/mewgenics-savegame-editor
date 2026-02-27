import { u32LE, f32LE } from '../binary'
import { MUT_SLOT_INFO } from '~/types/save'
import type { MutationSlot } from '~/types/save'

const MUT_TABLE_SIZE = 16 + 14 * 20

/**
 * Locate the fixed-size mutations/appearance table in the decompressed blob.
 * Port of Python's _find_mutation_table.
 *
 * Entry0: 16 bytes (f32 scale, u32 coat_id, u32 small, u32 sentinel)
 * Entries 1-14: 20 bytes each (u32 slot_id, u32 coat_id_or_0, ...)
 */
function findMutationTable(dec: Uint8Array): number | null {
  const n = dec.length
  if (n < MUT_TABLE_SIZE) return null

  let bestScore = -1
  let bestOff: number | null = null

  for (let base = 0; base <= n - MUT_TABLE_SIZE; base++) {
    const s = f32LE(dec, base)
    const coat = u32LE(dec, base + 4)
    const t1 = u32LE(dec, base + 8)
    const t2 = u32LE(dec, base + 12)

    // Loose plausibility checks
    if (s < 0.05 || s > 20.0) continue
    if (coat === 0 || coat > 20000) continue
    if (t1 > 500) continue
    if (t2 !== 0xFFFFFFFF && t2 > 5000) continue

    let ok = 0
    for (let i = 0; i < 14; i++) {
      const off = base + 16 + i * 20
      const c = u32LE(dec, off + 4)
      if (c === coat || c === 0) ok++
    }

    if (ok < 10) continue

    const score = ok * 1000 + base
    if (score > bestScore) {
      bestScore = score
      bestOff = base
    }
  }

  return bestOff
}

export interface MutationParseResult {
  baseOffset: number | null
  coatId: number | null
  coatOffset: number | null
  slots: MutationSlot[]
}

/**
 * Parse the mutation table from a decompressed cat blob.
 * Port of Python's parse_mutation_table.
 */
export function parseMutationTable(dec: Uint8Array): MutationParseResult {
  const base = findMutationTable(dec)
  if (base === null) {
    return { baseOffset: null, coatId: null, coatOffset: null, slots: [] }
  }

  const coatOff = base + 4
  const coatId = u32LE(dec, coatOff)

  const slots: MutationSlot[] = []
  for (let i = 0; i < 14; i++) {
    const off = base + 16 + i * 20
    const slotIndex = i + 1
    const info = MUT_SLOT_INFO[slotIndex]!
    slots.push({
      slotIndex,
      label: info.label,
      category: info.category,
      slotId: u32LE(dec, off),
      offset: off
    })
  }

  return { baseOffset: base, coatId, coatOffset: coatOff, slots }
}

/**
 * Count active mutations (coat >= 300 or slot >= 300).
 */
export function mutationCount(coatId: number | null, slots: MutationSlot[]): number {
  let c = 0
  if (coatId !== null && coatId >= 300) c++
  for (const s of slots) {
    if (s.slotId >= 300) c++
  }
  return c
}
