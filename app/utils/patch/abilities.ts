import { concatBytes, packU64, writeU32LE } from '../binary'
import { parseU64Run } from '../parse/abilities'

/**
 * Build a u64-string run from an array of strings.
 */
function buildU64RunBytes(strings: string[]): Uint8Array {
  const parts: Uint8Array[] = []
  for (const s of strings) {
    const encoded = new TextEncoder().encode(s)
    parts.push(packU64(BigInt(encoded.length)))
    parts.push(encoded)
  }
  return concatBytes(...parts)
}

/**
 * Patch an entry inside the u64-string run by rebuilding the whole run.
 * Port of Python's patch_u64_run_entry.
 */
export function patchU64RunEntry(
  dec: Uint8Array,
  runStart: number,
  runEnd: number,
  idx: number,
  newS: string
): Uint8Array {
  const { items, end: end2 } = parseU64Run(dec, runStart, 96, 64)
  if (!items.length || end2 !== runEnd) {
    throw new Error('Could not re-parse u64-run consistently')
  }

  const strs = items.map(it => it.value)
  if (idx < 0 || idx >= strs.length) {
    throw new Error('Bad u64-run index')
  }

  // Validate ASCII
  new TextEncoder().encode(newS)
  strs[idx] = newS

  const newRun = buildU64RunBytes(strs)
  return concatBytes(dec.slice(0, runStart), newRun, dec.slice(runEnd))
}

/**
 * Patch a [u64 len][ASCII][u32 tier] entry.
 * Port of Python's patch_u64_tier_entry.
 */
export function patchU64TierEntry(
  dec: Uint8Array,
  entryOffset: number,
  entryByteLen: number,
  newS: string,
  newTier: number
): Uint8Array {
  if (newTier <= 0 || newTier > 50) {
    throw new Error('Tier out of range (1..50)')
  }

  const encoded = new TextEncoder().encode(newS)
  const newRec = new Uint8Array(8 + encoded.length + 4)

  // u64 length
  const view = new DataView(newRec.buffer)
  view.setBigUint64(0, BigInt(encoded.length), true)
  newRec.set(encoded, 8)
  // u32 tier
  writeU32LE(newRec, 8 + encoded.length, newTier)

  const oldTotal = 8 + entryByteLen + 4
  return concatBytes(dec.slice(0, entryOffset), newRec, dec.slice(entryOffset + oldTotal))
}

/**
 * Patch a StringRec: [u32=1][u64 len][ASCII bytes].
 * Port of Python's patch_string_record.
 */
export function patchStringRecord(
  dec: Uint8Array,
  recOffset: number,
  recByteLen: number,
  newS: string
): Uint8Array {
  const encoded = new TextEncoder().encode(newS)
  const marker = new Uint8Array([0x01, 0x00, 0x00, 0x00])
  const lenBuf = packU64(BigInt(encoded.length))

  const newRec = concatBytes(marker, lenBuf, encoded)
  const oldTotal = 12 + recByteLen

  return concatBytes(dec.slice(0, recOffset), newRec, dec.slice(recOffset + oldTotal))
}
