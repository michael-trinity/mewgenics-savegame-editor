export type CatSex = 'Male' | 'Female' | 'Ditto' | 'Unknown'

export const SEX_MAP: Record<number, CatSex> = {
  0: 'Male',
  1: 'Female',
  2: 'Ditto'
}

export const STAT_NAMES = ['STR', 'DEX', 'CON', 'INT', 'SPD', 'CHA', 'LUCK'] as const

export interface CatStats {
  str: number
  dex: number
  con: number
  int: number
  spd: number
  cha: number
  luck: number
}

export function statsToArray(s: CatStats): number[] {
  return [s.str, s.dex, s.con, s.int, s.spd, s.cha, s.luck]
}

export function arrayToStats(arr: number[]): CatStats {
  return {
    str: arr[0] ?? 1,
    dex: arr[1] ?? 1,
    con: arr[2] ?? 1,
    int: arr[3] ?? 1,
    spd: arr[4] ?? 1,
    cha: arr[5] ?? 1,
    luck: arr[6] ?? 1
  }
}

export interface CatFlags {
  raw: number
  offset: number
  retired: boolean
  dead: boolean
  donated: boolean
}

export interface EquipSlot {
  blobSlot: number
  start: number
  end: number
  itemId: string | null
  implicitEmpty: boolean
}

export const BLOB_SLOT_NAMES = ['Hat', 'Glasses', 'Necklace', 'Weapon', 'Trinket/Consumable']
export const UI_SLOT_NAMES = ['Weapon', 'Hat', 'Necklace', 'Glasses', 'Trinket/Consumable']
export const UI_TO_BLOB = [3, 0, 2, 1, 4]

export interface MutationSlot {
  slotIndex: number
  label: string
  category: string
  slotId: number
  offset: number
}

export const MUT_SLOT_INFO: Record<number, { label: string, category: string }> = {
  1: { label: 'Body', category: 'body' },
  2: { label: 'Head', category: 'head' },
  3: { label: 'Tail', category: 'tail' },
  4: { label: 'RearLeg_L', category: 'legs' },
  5: { label: 'RearLeg_R', category: 'legs' },
  6: { label: 'FrontLeg_L', category: 'legs' },
  7: { label: 'FrontLeg_R', category: 'legs' },
  8: { label: 'Eye_L', category: 'eyes' },
  9: { label: 'Eye_R', category: 'eyes' },
  10: { label: 'Brow_L', category: 'eyebrows' },
  11: { label: 'Brow_R', category: 'eyebrows' },
  12: { label: 'Ear_L', category: 'ears' },
  13: { label: 'Ear_R', category: 'ears' },
  14: { label: 'Mouth', category: 'mouth' }
}

export const MUT_PAIRS: Record<number, number> = {
  4: 5, 5: 4,
  6: 7, 7: 6,
  8: 9, 9: 8,
  10: 11, 11: 10,
  12: 13, 13: 12
}

export interface U64Str {
  offset: number
  byteLength: number
  value: string
}

export interface U64StrTier extends U64Str {
  tier: number
}

export type AbilitySlotKind = 'u64run' | 'u64tier' | 'stringrec'

export interface AbilitySlot {
  label: string
  kind: AbilitySlotKind
  abilityId: string
  tier?: number
  runStart?: number
  runEnd?: number
  runIndex?: number
  recordOffset?: number
  byteLength?: number
}

export type LZ4Variant = 'A' | 'B'

export const HP_SENTINEL = 0x3FFFFFFF // 1073741823 — means "full/default HP"

type StatSources = Pick<ParsedCat, 'stats' | 'levelBonuses' | 'className' | 'equipment' | 'mutations'>
type ItemsMap = ReadonlyMap<string, { stats: Readonly<Record<string, number>> }>
type MutationsMap = ReadonlyMap<string, ReadonlyMap<string, { stats: Readonly<Record<string, number>> }>>
type ClassesMap = ReadonlyMap<string, { statMods: Readonly<Record<string, number>> }>

/** Sum total effective stat value: base + class mods + equipment bonuses + mutation bonuses.
 *  Use item/mutation stat keys: str, dex, con, int, spd, cha, lck */
export function getEffectiveStat(
  cat: StatSources,
  stat: string,
  itemsMap?: ItemsMap,
  mutationsMap?: MutationsMap,
  classesMap?: ClassesMap
): number | null {
  if (!cat.stats) return null
  // CatStats uses 'luck' while items/mutations use 'lck'
  const statKey = stat === 'lck' ? 'luck' : stat
  const s = cat.stats
  const base = statKey === 'str'
    ? s.str
    : statKey === 'dex'
      ? s.dex
      : statKey === 'con'
        ? s.con
        : statKey === 'int'
          ? s.int
          : statKey === 'spd'
            ? s.spd
            : statKey === 'cha'
              ? s.cha
              : statKey === 'luck' ? s.luck : undefined
  if (base === undefined) return null
  let total = base
  // Level-up bonuses
  if (cat.levelBonuses) {
    const lb = cat.levelBonuses
    const bonus = statKey === 'str'
      ? lb.str
      : statKey === 'dex'
        ? lb.dex
        : statKey === 'con'
          ? lb.con
          : statKey === 'int'
            ? lb.int
            : statKey === 'spd'
              ? lb.spd
              : statKey === 'cha'
                ? lb.cha
                : statKey === 'luck' ? lb.luck : 0
    total += bonus
  }
  // Class stat modifiers
  if (classesMap && cat.className) {
    const cls = classesMap.get(cat.className)
    if (cls?.statMods[stat]) total += cls.statMods[stat]
  }
  if (itemsMap && cat.equipment) {
    for (const slot of cat.equipment) {
      if (slot.itemId) {
        const item = itemsMap.get(slot.itemId)
        if (item?.stats[stat]) total += item.stats[stat]
      }
    }
  }
  if (mutationsMap && cat.mutations) {
    for (const slot of cat.mutations.slots) {
      if (slot.slotId === 0) continue
      const catEntries = mutationsMap.get(slot.category)
      if (!catEntries) continue
      const entry = catEntries.get(String(slot.slotId))
      if (entry?.stats[stat]) total += entry.stats[stat]
    }
  }
  return total
}

/** Max HP = CON * 4 (min 1) */
export function getMaxHp(
  cat: StatSources, itemsMap?: ItemsMap, mutationsMap?: MutationsMap, classesMap?: ClassesMap
): number | null {
  const con = getEffectiveStat(cat, 'con', itemsMap, mutationsMap, classesMap)
  if (con === null) return null
  return Math.max(1, con * 4)
}

/** Max Mana = CHA * 3 */
export function getMaxMana(
  cat: StatSources, itemsMap?: ItemsMap, mutationsMap?: MutationsMap, classesMap?: ClassesMap
): number | null {
  const cha = getEffectiveStat(cat, 'cha', itemsMap, mutationsMap, classesMap)
  if (cha === null) return null
  return Math.max(0, cha * 3)
}

/** Mana regen per turn = INT */
export function getManaRegen(
  cat: StatSources, itemsMap?: ItemsMap, mutationsMap?: MutationsMap, classesMap?: ClassesMap
): number | null {
  return getEffectiveStat(cat, 'int', itemsMap, mutationsMap, classesMap)
}

export interface CatCombatState {
  statusEffect: string // "none", "dex", "int", "str", "poisoned", "burned", "bleeding", etc.
  hp: number // current HP (HP_SENTINEL = full/default)
  hpOffset: number // absolute offset of the HP u32 in the decompressed blob
  statusOffset: number // absolute offset of the status u64+string
}

export interface ParsedCat {
  key: number
  id64: bigint
  name: string
  sex: CatSex
  nameEndRaw: number
  flags: CatFlags
  stats: CatStats | null
  levelBonuses: CatStats | null
  statsOffset: number | null
  combat: CatCombatState | null
  className: string
  level: number | null
  levelOffset: number | null
  birthdayDay: number | null
  birthdayOffset: number | null
  mutations: {
    baseOffset: number | null
    coatId: number | null
    coatOffset: number | null
    slots: MutationSlot[]
  }
  equipment: EquipSlot[] | null
  abilities: AbilitySlot[]
  decompressedBlob: Uint8Array
  lz4Variant: LZ4Variant
}

export interface HouseCatEntry {
  key: number
  room: string
  unkU32: number
  p0: number
  p1: number
  p2: number
}

// ── Inventory ──

export interface InventoryItem {
  name: string
  subName: string | null
  charges: number // -1 = infinite/not applicable
  field1: number // usage counter / food value
  field2: number // category type (0=consumable, 4=equipment-like)
  seqId: number // sequential item ID
  tailByte: number // trailing byte (0xFF for most items)
}

export interface Inventory {
  backpack: InventoryItem[]
  storage: InventoryItem[]
  trash: InventoryItem[]
  originalBackpackBlob: Uint8Array | null
  originalStorageBlob: Uint8Array | null
  originalTrashBlob: Uint8Array | null
}

// ── Furniture ──

export interface FurnitureItem {
  key: number
  name: string
  unkU64: bigint
  room: string
  x: number
  y: number
  z: number
  flag1: number
  flag2: number
}

// ── Game Properties ──

export interface GameProperties {
  currentDay: number
  houseGold: number
  houseFood: number
  blankCollars: number
  adventureCoins: number
  adventureFood: number
  onAdventure: boolean
  saveFilePercent: number
  houseStorageUpgrades: number
  adventureFurnitureBoxes: number
  minStraysTomorrow: number
  /** All raw properties from the save (for display and editing) */
  raw: Map<string, string | number | Uint8Array>
}

// ── Save State ──

export interface SaveState {
  fileName: string
  originalBytes: Uint8Array
  currentDay: number | null
  cats: ParsedCat[]
  deadCats: ParsedCat[]
  houseCats: HouseCatEntry[]
  adventureKeys: number[]
  inventory: Inventory
  furniture: FurnitureItem[]
  properties: GameProperties
}
