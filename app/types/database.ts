// ── Abilities ──

export interface AbilityEntry {
  id: string
  name: string
  description: string
  class: string
  mana: string | null
  damage: string | null
  effects: Record<string, string> | null
  range: string | null
  template: string | null
}

export interface AbilitiesDB {
  actives: Set<string>
  passives: Set<string>
  disorders: Set<string>
  basicAttacks: Set<string>
  basicMovement: Set<string>
  passiveTiers: Map<string, number>
  disorderTiers: Map<string, number>
  allAbilities: Map<string, AbilityEntry>
  passivesCatalog: Map<string, PassiveCatalogEntry>
  disordersCatalog: Map<string, DisorderCatalogEntry>
}

export interface PassiveCatalogEntry {
  id: string
  name: string
  class: string
  maxTier: number
  passives: Record<string, string>
}

export interface DisorderCatalogEntry {
  id: string
  name: string
  class: string
  maxTier: number
  passives: Record<string, string>
}

export function abilitiesDBAll(db: AbilitiesDB): Set<string> {
  const all = new Set<string>()
  for (const s of [db.actives, db.passives, db.disorders, db.basicAttacks, db.basicMovement]) {
    for (const v of s) all.add(v)
  }
  return all
}

export function formatAbilityStats(entry: AbilityEntry): string {
  const parts: string[] = []
  if (entry.mana) parts.push(`Mana: ${entry.mana}`)
  if (entry.damage) {
    const dmg = entry.damage.replace(/\+bonus_\w+/g, '')
    parts.push(`Dmg: ${dmg}`)
  }
  if (entry.range) parts.push(`Range: ${entry.range.replace(/\+bonus_\w+/g, '')}`)
  if (entry.effects) {
    for (const [k, v] of Object.entries(entry.effects)) {
      if (k === 'VisualFX' || k === 'VisualFXTile') continue
      parts.push(`${k}: ${v}`)
    }
  }
  return parts.join(' | ')
}

export function formatPassiveStats(passives: Record<string, string>): string {
  return Object.entries(passives)
    .filter(([_, v]) => typeof v === 'string' && !v.startsWith('{'))
    .map(([k, v]) => `${k}: ${v}`)
    .slice(0, 4)
    .join(', ')
}

// ── Items ──

export interface ItemEntry {
  id: string
  name: string
  desc: string
  kind: string
  rarity: string
  cursed: boolean
  stats: Record<string, number>
  shield: number | null
  durability: string | null
}

export interface ItemsDB {
  items: Set<string>
  consumables: Set<string>
  allItems: Map<string, ItemEntry>
  byKind: Map<string, ItemEntry[]>
}

export function formatItemStats(entry: ItemEntry): string {
  const parts: string[] = []
  const statNames = ['str', 'dex', 'con', 'int', 'spd', 'cha', 'lck']
  for (const s of statNames) {
    const v = entry.stats[s]
    if (v && v !== 0) parts.push(`${v > 0 ? '+' : ''}${v} ${s.toUpperCase()}`)
  }
  if (entry.shield) parts.push(`Shield: ${entry.shield}`)
  if (entry.durability) parts.push(`Dur: ${entry.durability}`)
  return parts.join(', ')
}

// ── Mutations ──

export interface MutationEntry {
  name: string | null
  tag: string | null
  desc: string | null
  descResolved: string | null
  stats: Record<string, number>
}

export interface MutationsDB {
  byCategory: Map<string, Map<string, MutationEntry>>
}

export function mutationDescribe(db: MutationsDB, category: string, id: number): string {
  const cat = db.byCategory.get(category)
  if (!cat) return ''
  const info = cat.get(String(id))
  if (!info) return ''
  return info.name || info.desc || info.tag || ''
}

export function formatMutationStats(entry: MutationEntry): string {
  const parts: string[] = []
  const statNames = ['str', 'dex', 'con', 'int', 'spd', 'cha', 'lck']
  for (const s of statNames) {
    const v = entry.stats[s]
    if (v && v !== 0) parts.push(`${v > 0 ? '+' : ''}${v} ${s.toUpperCase()}`)
  }
  if (entry.stats['shield']) parts.push(`Shield: ${entry.stats['shield']}`)
  if (entry.stats['divine_shield']) parts.push(`Divine Shield: ${entry.stats['divine_shield']}`)
  return parts.join(', ')
}

// ── Classes ──

export interface ClassEntry {
  name: string
  description: string
  statMods: Record<string, number>
}

export type ClassesDB = Map<string, ClassEntry>

// ── Furniture ──

export interface FurnitureEntry {
  id: string
  name: string
  desc: string
  special: boolean
  removed: boolean
  set: string | null
  effects: Record<string, number>
}

export type FurnitureDB = Map<string, FurnitureEntry>

export function formatFurnitureEffects(entry: FurnitureEntry): string {
  const parts: string[] = []
  for (const [k, v] of Object.entries(entry.effects)) {
    if (v !== 0) parts.push(`${v > 0 ? '+' : ''}${v} ${k}`)
  }
  return parts.join(', ')
}

// ── Passive/Disorder catalog (raw JSON shape) ──

export interface PassiveEntry {
  class: string
  descToken: string
  maxTier: number
  nameToken: string
  tiers: Record<string, {
    descToken: string
    passives: Record<string, string>
    stats: Record<string, string>
  }>
}

export interface DisorderEntry {
  class: string
  descToken: string
  maxTier: number
  nameToken: string
  tiers: Record<string, {
    descToken: string
    passives: Record<string, string>
    stats: Record<string, string>
  }>
}
