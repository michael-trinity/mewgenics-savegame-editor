import { u32LE, writeU32LE } from '../binary'

/**
 * Patch the coat ID and propagate to entries that match the old coat.
 * Port of Python's patch_mut_coat.
 */
export function patchMutCoat(dec: Uint8Array, baseOff: number, oldCoat: number, newCoat: number): Uint8Array {
  const out = new Uint8Array(dec)
  writeU32LE(out, baseOff + 4, newCoat)

  // Propagate coat field in entries 1-14 where it matches old coat
  for (let i = 0; i < 14; i++) {
    const off = baseOff + 16 + i * 20 + 4
    const cur = u32LE(out, off)
    if (cur === oldCoat) {
      writeU32LE(out, off, newCoat)
    }
  }

  return out
}

/**
 * Patch a specific mutation slot (1-14).
 * Port of Python's patch_mut_slot.
 */
export function patchMutSlot(dec: Uint8Array, baseOff: number, slotIdx: number, newId: number): Uint8Array {
  if (slotIdx < 1 || slotIdx > 14) {
    throw new Error('Slot index must be 1..14')
  }

  const off = baseOff + 16 + (slotIdx - 1) * 20
  const out = new Uint8Array(dec)
  writeU32LE(out, off, newId)
  return out
}
