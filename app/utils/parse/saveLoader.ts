import type { Database } from 'sql.js'
import { openDatabase, queryBlob, queryAllRows } from '../sqlite'
import { decompressCatBlob } from '../lz4'
import { u64LE } from '../binary'
import { readCurrentDay } from './properties'
import { readGameProperties } from './gameProperties'
import { parseHouseState, parseAdventureStateKeys } from './houseState'
import { detectNameEndAndSex, readStatusFlags } from './catMeta'
import { findStats } from './stats'
import { findBirthdayInfo } from './birthday'
import { parseCombatState } from './hp'
import { parseEquipmentSlots } from './equipment'
import { buildAbilitySlots } from './abilities'
import { parseMutationTable } from './mutations'
import { parseInventoryBlob } from './inventory'
import { parseFurnitureBlob } from './furniture'
import type { ParsedCat, LZ4Variant, SaveState, HouseCatEntry, Inventory, FurnitureItem } from '~/types/save'

/**
 * Re-parse a decompressed cat blob (e.g. after renaming which shifts all offsets).
 * Does NOT do LZ4 decompression — expects already-decompressed data.
 */
export function reParseCatFromBlob(key: number, dec: Uint8Array, variant: LZ4Variant, currentDay: number | null): ParsedCat {
  const id64 = u64LE(dec, 4)
  const { nameEndRaw, name, sex } = detectNameEndAndSex(dec)
  const flags = readStatusFlags(dec, nameEndRaw)
  const { stats, levelBonuses, offset: statsOffset } = findStats(dec)
  const combat = statsOffset !== null ? parseCombatState(dec, statsOffset) : null
  const { className, birthdayDay, birthdayOffset } = findBirthdayInfo(dec, currentDay)
  const mutations = parseMutationTable(dec)
  const equipment = parseEquipmentSlots(dec)
  const abilities = buildAbilitySlots(dec)

  return {
    key, id64, name, sex, nameEndRaw, flags, stats, levelBonuses, statsOffset, combat,
    className, birthdayDay, birthdayOffset, mutations, equipment, abilities,
    decompressedBlob: dec, lz4Variant: variant
  }
}

async function parseCatBlob(key: number, wrapped: Uint8Array, currentDay: number | null): Promise<ParsedCat> {
  const { data: dec, variant } = await decompressCatBlob(wrapped)

  if (dec.length < 12) {
    throw new Error(`Cat key ${key} blob too small after decompress (${dec.length} bytes)`)
  }

  const id64 = u64LE(dec, 4)
  const { nameEndRaw, name, sex } = detectNameEndAndSex(dec)
  const flags = readStatusFlags(dec, nameEndRaw)
  const { stats, levelBonuses, offset: statsOffset } = findStats(dec)
  const combat = statsOffset !== null ? parseCombatState(dec, statsOffset) : null
  const { className, birthdayDay, birthdayOffset } = findBirthdayInfo(dec, currentDay)
  const mutations = parseMutationTable(dec)
  const equipment = parseEquipmentSlots(dec)
  const abilities = buildAbilitySlots(dec)

  return {
    key,
    id64,
    name,
    sex,
    nameEndRaw,
    flags,
    stats,
    levelBonuses,
    statsOffset,
    combat,
    className,
    birthdayDay,
    birthdayOffset,
    mutations,
    equipment,
    abilities,
    decompressedBlob: dec,
    lz4Variant: variant
  }
}

function parseAllInventory(db: Database): Inventory {
  const backpackBlob = queryBlob(db, "SELECT data FROM files WHERE key='inventory_backpack'")
  const storageBlob = queryBlob(db, "SELECT data FROM files WHERE key='inventory_storage'")
  const trashBlob = queryBlob(db, "SELECT data FROM files WHERE key='inventory_trash'")

  return {
    backpack: backpackBlob ? parseInventoryBlob(backpackBlob) : [],
    storage: storageBlob ? parseInventoryBlob(storageBlob) : [],
    trash: trashBlob ? parseInventoryBlob(trashBlob) : [],
    originalBackpackBlob: backpackBlob,
    originalStorageBlob: storageBlob,
    originalTrashBlob: trashBlob
  }
}

function parseAllFurniture(db: Database): FurnitureItem[] {
  const rows = queryAllRows(db, 'SELECT key, data FROM furniture')
  const items: FurnitureItem[] = []

  for (const [key, data] of rows) {
    if (!(data instanceof Uint8Array) || data.length < 20) continue
    try {
      items.push(parseFurnitureBlob(key as number, data))
    } catch (e) {
      console.warn(`Failed to parse furniture key=${key}:`, e)
    }
  }

  items.sort((a, b) => a.room.localeCompare(b.room) || a.name.localeCompare(b.name))
  return items
}

export async function loadSaveFile(buffer: ArrayBuffer, fileName: string): Promise<SaveState> {
  const db = await openDatabase(buffer)

  try {
    // Read current_day
    const currentDay = readCurrentDay(db)

    // Read game properties
    const properties = readGameProperties(db)

    // Read house_state
    let houseCats: HouseCatEntry[] = []
    const houseBlob = queryBlob(db, "SELECT data FROM files WHERE key='house_state'")
    if (houseBlob) {
      houseCats = parseHouseState(houseBlob)
    }

    // Read adventure_state
    let adventureKeys: number[] = []
    const advBlob = queryBlob(db, "SELECT data FROM files WHERE key='adventure_state'")
    if (advBlob) {
      adventureKeys = parseAdventureStateKeys(advBlob)
    }

    // Read inventory
    const inventory = parseAllInventory(db)

    // Read furniture
    const furniture = parseAllFurniture(db)

    // Determine which cat keys to load
    const activeKeys = new Set<number>()
    for (const h of houseCats) activeKeys.add(h.key)
    for (const k of adventureKeys) activeKeys.add(k)

    // If no active cats found, load all
    let catKeys: number[]
    if (activeKeys.size > 0) {
      catKeys = [...activeKeys]
    } else {
      const allRows = queryAllRows(db, 'SELECT key FROM cats')
      catKeys = allRows.map(r => r[0] as number)
    }

    // Parse each cat
    const cats: ParsedCat[] = []
    for (const key of catKeys) {
      const blob = queryBlob(db, 'SELECT data FROM cats WHERE key=?', [key])
      if (!blob) continue

      try {
        const cat = await parseCatBlob(key, blob, currentDay)
        cats.push(cat)
      } catch (e) {
        console.warn(`Failed to parse cat ${key}:`, e)
      }
    }

    // Sort by name
    cats.sort((a, b) => a.name.localeCompare(b.name))

    return {
      fileName,
      originalBytes: new Uint8Array(buffer),
      currentDay,
      cats,
      houseCats,
      adventureKeys,
      inventory,
      furniture,
      properties
    }
  } finally {
    db.close()
  }
}
