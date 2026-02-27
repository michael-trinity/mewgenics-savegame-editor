import { u64LE, isAsciiIdent, readAscii, findBytes } from '../binary'
import type { EquipSlot } from '~/types/save'

const EQUIP_HDR_PAT = new Uint8Array([0x01, 0x00, 0x00, 0x00, 0x05, 0x00, 0x00, 0x00])
const EMPTY_MARKER = new Uint8Array([0x00, 0x05, 0x00, 0x00, 0x00])

function sliceBytesEqual(a: Uint8Array, aOff: number, b: Uint8Array, len: number): boolean {
  for (let i = 0; i < len; i++) {
    if (a[aOff + i] !== b[i]) return false
  }
  return true
}

/**
 * Read an item/class string that may be length-prefixed (u64) or null-terminated.
 * Some save format variants write u64=0 but still have the string as null-terminated bytes.
 * Returns { id, len } where len is the actual string length, or null if no valid string.
 */
function readItemString(dec: Uint8Array, u64Off: number, maxLen = 128): { id: string, len: number } | null {
  if (u64Off + 8 > dec.length) return null

  // Try length-prefixed first (standard format)
  const ln = Number(u64LE(dec, u64Off))
  if (ln > 0 && ln <= maxLen && u64Off + 8 + ln <= dec.length && isAsciiIdent(dec, u64Off + 8, ln)) {
    return { id: readAscii(dec, u64Off + 8, ln), len: ln }
  }

  // Fallback: null-terminated string starting at u64Off + 8
  const strStart = u64Off + 8
  let end = strStart
  while (end < dec.length && end < strStart + maxLen && dec[end] !== 0) end++
  const ntLen = end - strStart
  if (ntLen > 0 && isAsciiIdent(dec, strStart, ntLen)) {
    return { id: readAscii(dec, strStart, ntLen), len: ntLen }
  }

  return null
}

/**
 * Find the boundary marker for slots 0-3.
 * Marker: 0xFF <flag> 0x05 0x00 0x00 0x00
 * Returns offset where the NEXT slot starts (after u32(5)).
 */
function findSlotBoundary(dec: Uint8Array, searchStart: number, maxSearch = 800): number | null {
  const n = dec.length
  const end = Math.min(n - 6, searchStart + maxSearch)

  for (let p = searchStart; p < end; p++) {
    if (dec[p] === 0xFF && dec[p + 2] === 0x05 && dec[p + 3] === 0x00 && dec[p + 4] === 0x00 && dec[p + 5] === 0x00) {
      return p + 6
    }
  }
  return null
}

/**
 * Find the boundary for the last slot (slot 4).
 * After the last slot record, there's a class/tag string record:
 *   0xFF <tag u8 0..3> <u64 len> <ASCII>
 * Some format variants have u64=0 with null-terminated class string.
 */
function findLastSlotBoundary(dec: Uint8Array, searchStart: number, maxSearch = 1400): number | null {
  const n = dec.length
  const end = Math.min(n - 10, searchStart + maxSearch)

  for (let p = searchStart; p < end; p++) {
    if (dec[p] !== 0xFF) continue
    const tag = dec[p + 1]!
    if (tag > 3) continue
    if (p + 10 > n) continue

    // Try length-prefixed
    const ln = Number(u64LE(dec, p + 2))
    if (ln > 0 && ln <= 32 && p + 10 + ln <= n && isAsciiIdent(dec, p + 10, ln)) {
      return p + 1
    }

    // Fallback: null-terminated at p+10
    let e = p + 10
    while (e < n && e < p + 42 && dec[e]! >= 0x20 && dec[e]! < 0x7F) e++
    const ntLen = e - (p + 10)
    if (ntLen >= 2 && ntLen <= 32 && isAsciiIdent(dec, p + 10, ntLen)) {
      return p + 1
    }
  }
  return null
}

/**
 * Try to parse 5 equipment slots starting from a given header offset.
 * Returns null if any slot fails validation (indicating a false-positive header).
 */
function tryParseSlotsFromHeader(dec: Uint8Array, hdr: number): EquipSlot[] | null {
  let pos = hdr + 8
  const slots: EquipSlot[] = []

  // Slots 0-3
  for (let bslot = 0; bslot < 4; bslot++) {
    // Check for empty marker
    if (pos + 5 <= dec.length && sliceBytesEqual(dec, pos, EMPTY_MARKER, 5)) {
      slots.push({ blobSlot: bslot, start: pos, end: pos + 5, itemId: null, implicitEmpty: false })
      pos += 5
      continue
    }

    // Present item: u8=1, then u64 len + ASCII id (or null-terminated fallback)
    if (pos >= dec.length || dec[pos] !== 1) return null

    const item = readItemString(dec, pos + 1)
    if (!item) return null

    const nxt = findSlotBoundary(dec, pos + 9 + item.len)
    if (nxt === null) return null

    slots.push({ blobSlot: bslot, start: pos, end: nxt, itemId: item.id, implicitEmpty: false })
    pos = nxt
  }

  // Slot 4 (trinket/consumable)
  // Check explicit empty
  if (pos + 5 <= dec.length && sliceBytesEqual(dec, pos, EMPTY_MARKER, 5)) {
    slots.push({ blobSlot: 4, start: pos, end: pos + 5, itemId: null, implicitEmpty: false })
    return slots
  }

  // Check present item
  if (pos < dec.length && dec[pos] === 1) {
    const item = readItemString(dec, pos + 1)
    if (!item) return null

    const nxt = findLastSlotBoundary(dec, pos + 9 + item.len)
    if (nxt === null) return null

    slots.push({ blobSlot: 4, start: pos, end: nxt, itemId: item.id, implicitEmpty: false })
    return slots
  }

  // Implicit empty: no bytes for slot, we're already at class/tag record
  if (pos + 9 <= dec.length && dec[pos]! <= 3) {
    // Try length-prefixed
    const ln = Number(u64LE(dec, pos + 1))
    if (ln > 0 && ln <= 32 && pos + 9 + ln <= dec.length && isAsciiIdent(dec, pos + 9, ln)) {
      slots.push({ blobSlot: 4, start: pos, end: pos, itemId: null, implicitEmpty: true })
      return slots
    }
    // Fallback: null-terminated class string at pos+9
    let e = pos + 9
    while (e < dec.length && e < pos + 41 && dec[e]! >= 0x20 && dec[e]! < 0x7F) e++
    const ntLen = e - (pos + 9)
    if (ntLen >= 2 && ntLen <= 32 && isAsciiIdent(dec, pos + 9, ntLen)) {
      slots.push({ blobSlot: 4, start: pos, end: pos, itemId: null, implicitEmpty: true })
      return slots
    }
  }

  return null
}

/**
 * Parse the 5 equipment slots from the decompressed cat blob.
 * Returns slots in BLOB ORDER: [Hat, Glasses, Necklace, Weapon, Trinket/Consumable]
 *
 * Searches for the equipment header pattern and tries to parse slots.
 * If a header match is a false positive, continues searching for the next one.
 */
export function parseEquipmentSlots(dec: Uint8Array): EquipSlot[] | null {
  let searchStart = 0
  while (true) {
    const hdr = findBytes(dec, EQUIP_HDR_PAT, searchStart)
    if (hdr < 0) return null

    const result = tryParseSlotsFromHeader(dec, hdr)
    if (result !== null) return result

    // False positive — try next occurrence
    searchStart = hdr + 1
  }
}
