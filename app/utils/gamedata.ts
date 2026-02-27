import type {
  AbilitiesDB, AbilityEntry, PassiveCatalogEntry, DisorderCatalogEntry,
  ItemsDB, ItemEntry,
  MutationsDB, MutationEntry,
  ClassesDB, ClassEntry
} from '~/types/database'

const IDENT_RE = /^[A-Za-z_][A-Za-z0-9_]*$/

function asSet(data: any, key: string): Set<string> {
  const v = data?.[key]
  if (!Array.isArray(v)) return new Set()
  return new Set(v.filter((x: any) => typeof x === 'string'))
}

function asIntMap(data: any, key: string): Map<string, number> {
  const v = data?.[key]
  const out = new Map<string, number>()
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    for (const [k, val] of Object.entries(v)) {
      if (typeof val === 'number') out.set(k, val)
      else if (typeof val === 'string' && /^\d+$/.test(val)) out.set(k, parseInt(val))
    }
  }
  return out
}

// ── Abilities ──

const ABILITY_CLASS_FILES = [
  'fighter', 'mage', 'medic', 'thief', 'monk', 'tinkerer',
  'necromancer', 'druid', 'hunter', 'tank', 'psychic',
  'butcher', 'colorless', 'jester', 'terminator'
]

function parseAbilityEntry(id: string, raw: any): AbilityEntry | null {
  if (!raw || typeof raw !== 'object') return null
  // Skip variant entries that just override a parent — they often lack name/desc
  if (raw.variant_of && !raw.name) return null

  return {
    id,
    name: raw.name || id,
    description: raw.description || '',
    class: raw.class || '',
    mana: raw.cost?.mana || null,
    damage: raw.damage_instance?.damage || null,
    effects: raw.damage_instance?.effects && typeof raw.damage_instance.effects === 'object'
      ? Object.fromEntries(
        Object.entries(raw.damage_instance.effects)
          .filter(([k]) => k !== 'VisualFX' && k !== 'VisualFXTile')
          .map(([k, v]) => [k, String(v)])
      )
      : null,
    range: raw.target?.max_range || null,
    template: raw.template || null
  }
}

export async function loadAbilitiesDB(): Promise<AbilitiesDB> {
  // Load original abilities.json for sets
  const data = await $fetch('/data/abilities.json')

  let passiveTiers = asIntMap(data, 'passive_tiers')
  if (passiveTiers.size === 0) passiveTiers = asIntMap(data, 'passive_max_tiers')
  let disorderTiers = asIntMap(data, 'disorder_tiers')
  if (disorderTiers.size === 0) disorderTiers = asIntMap(data, 'disorder_max_tiers')

  const actives = asSet(data, 'actives')
  const passives = asSet(data, 'passives')
  const disorders = asSet(data, 'disorders')

  // Load per-class ability files for rich data
  const allAbilities = new Map<string, AbilityEntry>()

  const classFiles = ABILITY_CLASS_FILES.map(c =>
    $fetch(`/data/${c}_abilities.json`).catch(() => null)
  )
  const results = await Promise.all(classFiles)

  for (const classData of results) {
    if (!classData || typeof classData !== 'object') continue
    for (const [id, raw] of Object.entries(classData as Record<string, any>)) {
      const entry = parseAbilityEntry(id, raw)
      if (entry) {
        allAbilities.set(id, entry)
        // Auto-populate actives set from loaded data
        if (!passives.has(id) && !disorders.has(id)) {
          actives.add(id)
        }
      }
    }
  }

  // Load passives catalog
  const passivesCatalog = new Map<string, PassiveCatalogEntry>()
  try {
    const pData: any = await $fetch('/data/passives_catalog.json')
    if (pData && typeof pData === 'object') {
      for (const [id, raw] of Object.entries(pData as Record<string, any>)) {
        if (!raw || typeof raw !== 'object') continue
        const tier1 = raw.tiers?.['1']
        passivesCatalog.set(id, {
          id,
          name: raw.name_token?.replace(/^PASSIVE_/, '').replace(/_NAME$/, '') || id,
          class: raw.class || '',
          maxTier: raw.max_tier || 1,
          passives: tier1?.passives || {}
        })
        passives.add(id)
        if (!passiveTiers.has(id) && raw.max_tier) {
          passiveTiers.set(id, raw.max_tier)
        }
      }
    }
  } catch { /* optional */ }

  // Load disorders catalog
  const disordersCatalog = new Map<string, DisorderCatalogEntry>()
  try {
    const dData: any = await $fetch('/data/disorders_catalog.json')
    if (dData && typeof dData === 'object') {
      for (const [id, raw] of Object.entries(dData as Record<string, any>)) {
        if (!raw || typeof raw !== 'object') continue
        const tier1 = raw.tiers?.['1']
        disordersCatalog.set(id, {
          id,
          name: raw.name_token?.replace(/^DISORDER_/, '').replace(/_NAME$/, '') || id,
          class: raw.class || '',
          maxTier: raw.max_tier || 1,
          passives: tier1?.passives || {}
        })
        disorders.add(id)
        if (!disorderTiers.has(id) && raw.max_tier) {
          disorderTiers.set(id, raw.max_tier)
        }
      }
    }
  } catch { /* optional */ }

  return {
    actives,
    passives,
    disorders,
    basicAttacks: asSet(data, 'basic_attacks'),
    basicMovement: asSet(data, 'basic_movement'),
    passiveTiers,
    disorderTiers,
    allAbilities,
    passivesCatalog,
    disordersCatalog
  }
}

// ── Items ──

const ITEM_FILES = [
  'head_items', 'face_items', 'neck_items', 'weapons', 'trinkets',
  'consumables', 'armor_sets', 'legendary_items', 'special_class_items',
  'cursed_items', 'parasites'
]

function parseItemEntry(id: string, raw: any): ItemEntry | null {
  if (!raw || typeof raw !== 'object') return null
  if (raw.variant_of && !raw.name_resolved) return null

  const stats: Record<string, number> = {}
  for (const s of ['str', 'dex', 'con', 'int', 'spd', 'cha', 'lck']) {
    const v = raw[s]
    if (v !== undefined) stats[s] = typeof v === 'number' ? v : parseInt(v) || 0
  }

  let durStr: string | null = null
  if (raw.durability !== undefined) {
    durStr = Array.isArray(raw.durability) ? raw.durability.join('-').replace(/,/g, '') : String(raw.durability)
  }

  // Resolve {aux} placeholder and strip game markup
  let desc = raw.desc_resolved || ''
  if (raw.aux !== undefined && raw.aux !== '-1') {
    desc = desc.replace(/\{aux\}/g, String(raw.aux))
  }
  // Strip [s:.7]...[/s] size tags, [img:...] image tags, \n → space
  desc = desc
    .replace(/\[s:[^\]]*\](.*?)\[\/s\]/g, '$1')
    .replace(/\[img:([^\]]*)\]/g, (_m: string, v: string) => v.charAt(0).toUpperCase() + v.slice(1))
    .replace(/\\n/g, ' ')
    .trim()

  return {
    id,
    name: raw.name_resolved || id,
    desc,
    kind: raw.kind || 'trinket',
    rarity: raw.rarity || 'common',
    cursed: raw.cursed === 'true' || raw.cursed === true,
    stats,
    shield: raw.shield ? (typeof raw.shield === 'number' ? raw.shield : parseInt(raw.shield) || null) : null,
    durability: durStr
  }
}

export async function loadItemsDB(): Promise<ItemsDB> {
  const data: any = await $fetch('/data/items.json')

  const items = new Set<string>()
  const consumables = new Set<string>()

  function addList(dst: Set<string>, v: any) {
    if (Array.isArray(v)) {
      for (const x of v) {
        if (typeof x === 'string') dst.add(x)
      }
    }
  }

  if (Array.isArray(data)) {
    addList(items, data)
  } else if (data && typeof data === 'object') {
    addList(items, data.items)
    addList(items, data.all)
    for (const [k, v] of Object.entries(data)) {
      if (k === 'meta') continue
      if (k === 'consumables') addList(consumables, v)
      addList(items, v)
    }
  }

  for (const id of items) {
    if (!IDENT_RE.test(id)) items.delete(id)
  }
  for (const id of consumables) {
    if (!items.has(id)) consumables.delete(id)
  }

  // Load rich item data from json/items/ files
  const allItems = new Map<string, ItemEntry>()
  const byKind = new Map<string, ItemEntry[]>()

  const itemFiles = ITEM_FILES.map(f =>
    $fetch(`/data/items/${f}.json`).catch(() => null)
  )
  const results = await Promise.all(itemFiles)

  for (const fileData of results) {
    if (!fileData || typeof fileData !== 'object') continue
    for (const [id, raw] of Object.entries(fileData as Record<string, any>)) {
      const entry = parseItemEntry(id, raw)
      if (entry) {
        allItems.set(id, entry)
        items.add(id)
        const kindList = byKind.get(entry.kind) || []
        kindList.push(entry)
        byKind.set(entry.kind, kindList)
      }
    }
  }

  // Sort each kind list by name
  for (const list of byKind.values()) {
    list.sort((a, b) => a.name.localeCompare(b.name))
  }

  return { items, consumables, allItems, byKind }
}

// ── Mutations ──

export async function loadMutationsDB(): Promise<MutationsDB> {
  const data: any = await $fetch('/data/mutations.json')

  const byCategory = new Map<string, Map<string, MutationEntry>>()

  let source = data?.mutations ?? data?.by_category
  if (!source || typeof source !== 'object') {
    return { byCategory }
  }

  const STAT_KEYS = ['str', 'dex', 'con', 'int', 'spd', 'cha', 'lck', 'shield', 'divine_shield']

  for (const [cat, mp] of Object.entries(source)) {
    if (typeof cat !== 'string' || !mp || typeof mp !== 'object') continue
    const catMap = new Map<string, MutationEntry>()
    for (const [k, v] of Object.entries(mp as Record<string, any>)) {
      if (typeof v === 'object' && v !== null) {
        // Parse stats from the entry (may be in v.stats object or as top-level keys)
        const stats: Record<string, number> = {}
        if (v.stats && typeof v.stats === 'object') {
          for (const s of STAT_KEYS) {
            const sv = v.stats[s]
            if (sv !== undefined) {
              const n = typeof sv === 'number' ? sv : parseInt(sv)
              if (!isNaN(n)) stats[s] = n
            }
          }
        }
        catMap.set(k, {
          name: typeof v.name === 'string' ? v.name : null,
          tag: typeof v.tag === 'string' ? v.tag : null,
          desc: typeof v.desc === 'string' ? v.desc : null,
          descResolved: typeof v.desc_resolved === 'string' ? v.desc_resolved : null,
          stats
        })
      } else {
        catMap.set(k, { name: null, tag: null, desc: null, descResolved: null, stats: {} })
      }
    }
    byCategory.set(cat, catMap)
  }

  return { byCategory }
}

// ── Classes ──

export async function loadClassesDB(): Promise<ClassesDB> {
  const data: any = await $fetch('/data/classes.json')
  const classes: ClassesDB = new Map()

  const source = data?.classes
  if (!source || typeof source !== 'object') return classes

  const STAT_KEYS = ['str', 'dex', 'con', 'int', 'spd', 'cha', 'lck']

  for (const [classId, raw] of Object.entries(source as Record<string, any>)) {
    if (!raw || typeof raw !== 'object') continue
    const statMods: Record<string, number> = {}
    if (raw.statMods && typeof raw.statMods === 'object') {
      for (const s of STAT_KEYS) {
        const v = raw.statMods[s]
        if (v !== undefined) {
          const n = typeof v === 'number' ? v : parseInt(v)
          if (!isNaN(n) && n !== 0) statMods[s] = n
        }
      }
    }
    classes.set(classId, {
      name: typeof raw.name === 'string' ? raw.name : classId,
      description: typeof raw.description === 'string' ? raw.description : '',
      statMods
    })
  }

  return classes
}
