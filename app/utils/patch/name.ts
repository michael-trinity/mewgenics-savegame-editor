import { writeU32LE } from '../binary'

/**
 * Encode a string as UTF-16LE bytes.
 */
function encodeUtf16LE(str: string): Uint8Array {
  const buf = new Uint8Array(str.length * 2)
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i)
    buf[i * 2] = code & 0xFF
    buf[i * 2 + 1] = (code >> 8) & 0xFF
  }
  return buf
}

/**
 * Patch the cat name in a decompressed blob.
 * The name is UTF-16LE starting at offset 0x14, with length (in code units) at 0x0C.
 * Since the name length may change, all offsets after the name shift — the caller
 * MUST re-parse all fields from the returned blob.
 */
export function patchName(blob: Uint8Array, oldNameEndRaw: number, newName: string): Uint8Array {
  const nameStart = 0x14
  const newNameUtf16 = encodeUtf16LE(newName)
  const newNameLen = newName.length // code units

  const prefix = blob.slice(0, nameStart)
  const suffix = blob.slice(oldNameEndRaw)

  const result = new Uint8Array(prefix.length + newNameUtf16.length + suffix.length)
  result.set(prefix)
  result.set(newNameUtf16, nameStart)
  result.set(suffix, nameStart + newNameUtf16.length)

  // Update name length at 0x0C
  writeU32LE(result, 0x0C, newNameLen)

  return result
}
