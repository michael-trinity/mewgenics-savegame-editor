import { writeI64LE } from '../binary'

/**
 * Patch the birthday value (i64) at the given offset.
 * Port of Python's birthday patching.
 */
export function patchBirthday(blob: Uint8Array, birthdayOffset: number, newBirthdayDay: number): Uint8Array {
  const out = new Uint8Array(blob)
  writeI64LE(out, birthdayOffset, BigInt(newBirthdayDay))
  return out
}
