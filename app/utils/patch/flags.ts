import { u16LE, writeU16LE } from '../binary'

/**
 * Set or clear a specific flag bit in the status flags u16.
 * Returns a new Uint8Array.
 */
export function setFlag(blob: Uint8Array, flagsOffset: number, bit: number, value: boolean): Uint8Array {
  const out = new Uint8Array(blob)
  const current = u16LE(out, flagsOffset)
  const newFlags = value ? (current | bit) : (current & ~bit)
  writeU16LE(out, flagsOffset, newFlags & 0xFFFF)
  return out
}

/**
 * Clear the retired flag (bit 0x0002).
 */
export function clearRetiredFlag(blob: Uint8Array, nameEndRaw: number): Uint8Array {
  return setFlag(blob, nameEndRaw + 0x10, 0x0002, false)
}
