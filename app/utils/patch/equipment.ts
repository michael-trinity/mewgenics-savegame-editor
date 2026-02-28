import { concatBytes } from '../binary'
import type { EquipSlot } from '~/types/save'

const EMPTY_MARKER = new Uint8Array([0x00, 0x05, 0x00, 0x00, 0x00])

/**
 * Unequip a slot (delete the equipped item).
 * Port of Python's patch_delete_equipment_slot.
 */
export function patchDeleteEquipmentSlot(dec: Uint8Array, slot: EquipSlot): Uint8Array {
  // Slots 0-3: replace with empty marker
  if (slot.blobSlot !== 4) {
    if (slot.itemId === null && slot.end - slot.start === 5) {
      return dec // Already empty
    }
    return concatBytes(dec.slice(0, slot.start), EMPTY_MARKER, dec.slice(slot.end))
  }

  // Slot 4: implicit empty
  if (slot.itemId === null && slot.implicitEmpty) {
    if (slot.start < dec.length && dec[slot.start] !== 0) {
      const out = new Uint8Array(dec)
      out[slot.start] = 0
      return out
    }
    return dec
  }

  // Slot 4: remove slot bytes and flip tag to 0
  const out = concatBytes(dec.slice(0, slot.start), dec.slice(slot.end))
  if (slot.start < out.length) {
    const mutable = new Uint8Array(out)
    mutable[slot.start] = 0
    return mutable
  }
  return out
}

/**
 * Replace an equipped item's ID (slot must have an item).
 * Port of Python's patch_replace_equipment_slot_id.
 */
export function patchReplaceEquipmentSlotId(dec: Uint8Array, slot: EquipSlot, newId: string): Uint8Array {
  if (slot.itemId === null) {
    throw new Error('Slot is empty; cannot replace ID')
  }

  // Patch the u8=1 + u64(len) + ASCII record at slot.start
  const encoded = new TextEncoder().encode(newId)
  const newRec = new Uint8Array(1 + 8 + encoded.length)
  newRec[0] = 1
  const view = new DataView(newRec.buffer)
  view.setBigUint64(1, BigInt(encoded.length), true)
  newRec.set(encoded, 9)

  // Use the known item ID length from parsing, not u64LE from the blob.
  // Some save variants store u64=0 with the string null-terminated,
  // so reading u64LE would return 0 and miss the actual string bytes.
  const oldIdLen = slot.itemId.length
  const oldTotal = 1 + 8 + oldIdLen

  return concatBytes(dec.slice(0, slot.start), newRec, dec.slice(slot.start + oldTotal))
}

/**
 * Default equipment metadata (24 bytes) inserted after the item ID when equipping into an empty slot.
 * Format: [8 zeros][FF FF FF FF][4 zeros][4 zeros][7F 96 98 00 = 9999999 durability]
 */
const DEFAULT_EQUIP_META = new Uint8Array([
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, // 8 bytes unknown (zeros)
  0xFF, 0xFF, 0xFF, 0xFF, // durability marker
  0x00, 0x00, 0x00, 0x00, // modifier count (0)
  0x00, 0x00, 0x00, 0x00, // unknown (zeros)
  0x7F, 0x96, 0x98, 0x00 // max durability (9999999)
])

/** Slot boundary: 0xFF 0x00 0x05 0x00 0x00 0x00 */
const SLOT_BOUNDARY = new Uint8Array([0xFF, 0x00, 0x05, 0x00, 0x00, 0x00])

/**
 * Equip an item into an empty slot.
 */
export function patchEquipToEmptySlot(dec: Uint8Array, slot: EquipSlot, itemId: string): Uint8Array {
  if (slot.itemId !== null) {
    throw new Error('Slot already has an item; use replace instead')
  }

  const encoded = new TextEncoder().encode(itemId)

  // Build item record: [u8=1][u64 len][ASCII id][24-byte meta]
  const itemRec = new Uint8Array(1 + 8 + encoded.length + DEFAULT_EQUIP_META.length)
  itemRec[0] = 1
  const view = new DataView(itemRec.buffer)
  view.setBigUint64(1, BigInt(encoded.length), true)
  itemRec.set(encoded, 9)
  itemRec.set(DEFAULT_EQUIP_META, 9 + encoded.length)

  if (slot.blobSlot !== 4) {
    // Slots 0-3: replace EMPTY_MARKER with item record + boundary
    return concatBytes(
      dec.slice(0, slot.start),
      itemRec,
      SLOT_BOUNDARY,
      dec.slice(slot.end)
    )
  }

  // Slot 4
  if (slot.implicitEmpty) {
    // No bytes allocated — insert item record before class/tag record
    return concatBytes(
      dec.slice(0, slot.start),
      itemRec,
      SLOT_BOUNDARY,
      dec.slice(slot.start)
    )
  }

  // Explicit empty — replace EMPTY_MARKER
  return concatBytes(
    dec.slice(0, slot.start),
    itemRec,
    SLOT_BOUNDARY,
    dec.slice(slot.end)
  )
}
