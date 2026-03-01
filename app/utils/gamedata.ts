import type {
  AbilitiesDB, AbilityEntry, PassiveCatalogEntry, DisorderCatalogEntry,
  ItemsDB, ItemEntry,
  MutationsDB, MutationEntry,
  ClassesDB,
  FurnitureDB, FurnitureEntry
} from '~/types/database'

const IDENT_RE = /^[A-Za-z_][A-Za-z0-9_]*$/

function asSet(data: unknown, key: string): Set<string> {
  const v = (data as Record<string, unknown>)?.[key]
  if (!Array.isArray(v)) return new Set()
  return new Set(v.filter((x: unknown) => typeof x === 'string'))
}

function asIntMap(data: unknown, key: string): Map<string, number> {
  const v = (data as Record<string, unknown>)?.[key]
  const out = new Map<string, number>()
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
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

function parseAbilityEntry(id: string, raw: unknown): AbilityEntry | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  // Skip variant entries that just override a parent — they often lack name/desc
  if (r.variant_of && !r.name) return null

  const cost = r.cost && typeof r.cost === 'object' ? r.cost as Record<string, unknown> : null
  const dmg = r.damage_instance && typeof r.damage_instance === 'object' ? r.damage_instance as Record<string, unknown> : null
  const tgt = r.target && typeof r.target === 'object' ? r.target as Record<string, unknown> : null

  return {
    id,
    name: typeof r.name === 'string' ? r.name : id,
    description: typeof r.description === 'string' ? r.description : '',
    class: typeof r.class === 'string' ? r.class : '',
    mana: cost && typeof cost.mana === 'string' ? cost.mana : null,
    damage: dmg && typeof dmg.damage === 'string' ? dmg.damage : null,
    effects: dmg?.effects && typeof dmg.effects === 'object'
      ? Object.fromEntries(
          Object.entries(dmg.effects as Record<string, unknown>)
            .filter(([k]) => k !== 'VisualFX' && k !== 'VisualFXTile')
            .map(([k, v]) => [k, String(v)])
        )
      : null,
    range: tgt && typeof tgt.max_range === 'string' ? tgt.max_range : null,
    template: typeof r.template === 'string' ? r.template : null
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
    for (const [id, raw] of Object.entries(classData as Record<string, unknown>)) {
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
    const pData = await $fetch('/data/passives_catalog.json')
    if (pData && typeof pData === 'object') {
      for (const [id, raw] of Object.entries(pData as Record<string, unknown>)) {
        if (!raw || typeof raw !== 'object') continue
        const r = raw as Record<string, unknown>
        const tiers = r.tiers && typeof r.tiers === 'object' ? r.tiers as Record<string, unknown> : null
        const tier1 = tiers?.['1'] && typeof tiers['1'] === 'object' ? tiers['1'] as Record<string, unknown> : null
        const nameToken = typeof r.name_token === 'string' ? r.name_token : id
        passivesCatalog.set(id, {
          id,
          name: nameToken.replace(/^PASSIVE_/, '').replace(/_NAME$/, ''),
          class: typeof r.class === 'string' ? r.class : '',
          maxTier: typeof r.max_tier === 'number' ? r.max_tier : 1,
          passives: tier1?.passives && typeof tier1.passives === 'object' ? tier1.passives as Record<string, string> : {}
        })
        passives.add(id)
        if (!passiveTiers.has(id) && typeof r.max_tier === 'number') {
          passiveTiers.set(id, r.max_tier)
        }
      }
    }
  } catch { /* optional */ }

  // Load disorders catalog
  const disordersCatalog = new Map<string, DisorderCatalogEntry>()
  try {
    const dData = await $fetch('/data/disorders_catalog.json')
    if (dData && typeof dData === 'object') {
      for (const [id, raw] of Object.entries(dData as Record<string, unknown>)) {
        if (!raw || typeof raw !== 'object') continue
        const r = raw as Record<string, unknown>
        const tiers = r.tiers && typeof r.tiers === 'object' ? r.tiers as Record<string, unknown> : null
        const tier1 = tiers?.['1'] && typeof tiers['1'] === 'object' ? tiers['1'] as Record<string, unknown> : null
        const nameToken = typeof r.name_token === 'string' ? r.name_token : id
        disordersCatalog.set(id, {
          id,
          name: nameToken.replace(/^DISORDER_/, '').replace(/_NAME$/, ''),
          class: typeof r.class === 'string' ? r.class : '',
          maxTier: typeof r.max_tier === 'number' ? r.max_tier : 1,
          passives: tier1?.passives && typeof tier1.passives === 'object' ? tier1.passives as Record<string, string> : {}
        })
        disorders.add(id)
        if (!disorderTiers.has(id) && typeof r.max_tier === 'number') {
          disorderTiers.set(id, r.max_tier)
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

function parseItemEntry(id: string, raw: unknown): ItemEntry | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  if (r.variant_of && !r.name_resolved) return null

  const stats: Record<string, number> = {}
  for (const s of ['str', 'dex', 'con', 'int', 'spd', 'cha', 'lck']) {
    const v = r[s]
    if (v !== undefined) stats[s] = typeof v === 'number' ? v : parseInt(String(v)) || 0
  }

  let durStr: string | null = null
  if (r.durability !== undefined) {
    durStr = Array.isArray(r.durability) ? r.durability.join('-').replace(/,/g, '') : String(r.durability)
  }

  // Resolve {aux} placeholder and strip game markup
  let desc = typeof r.desc_resolved === 'string' ? r.desc_resolved : ''
  if (r.aux !== undefined && r.aux !== '-1') {
    desc = desc.replace(/\{aux\}/g, String(r.aux))
  }
  // Strip [s:.7]...[/s] size tags, [img:...] image tags, \n → space
  desc = desc
    .replace(/\[s:[^\]]*\](.*?)\[\/s\]/g, '$1')
    .replace(/\[img:([^\]]*)\]/g, (_m: string, v: string) => v.charAt(0).toUpperCase() + v.slice(1))
    .replace(/\\n/g, ' ')
    .trim()

  return {
    id,
    name: typeof r.name_resolved === 'string' ? r.name_resolved : id,
    desc,
    kind: typeof r.kind === 'string' ? r.kind : 'trinket',
    rarity: typeof r.rarity === 'string' ? r.rarity : 'common',
    cursed: r.cursed === 'true' || r.cursed === true,
    stats,
    shield: r.shield ? (typeof r.shield === 'number' ? r.shield : parseInt(String(r.shield)) || null) : null,
    durability: durStr
  }
}

export async function loadItemsDB(): Promise<ItemsDB> {
  const data = await $fetch('/data/items.json')

  const items = new Set<string>()
  const consumables = new Set<string>()

  function addList(dst: Set<string>, v: unknown) {
    if (Array.isArray(v)) {
      for (const x of v) {
        if (typeof x === 'string') dst.add(x)
      }
    }
  }

  if (Array.isArray(data)) {
    addList(items, data)
  } else if (data && typeof data === 'object') {
    const d = data as Record<string, unknown>
    addList(items, d.items)
    addList(items, d.all)
    for (const [k, v] of Object.entries(d)) {
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
    for (const [id, raw] of Object.entries(fileData as Record<string, unknown>)) {
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
  const data = await $fetch('/data/mutations.json')

  const byCategory = new Map<string, Map<string, MutationEntry>>()

  const d = data && typeof data === 'object' ? data as Record<string, unknown> : null
  const source = d?.mutations ?? d?.by_category
  if (!source || typeof source !== 'object') {
    return { byCategory }
  }

  const STAT_KEYS = ['str', 'dex', 'con', 'int', 'spd', 'cha', 'lck', 'shield', 'divine_shield']

  for (const [cat, mp] of Object.entries(source as Record<string, unknown>)) {
    if (typeof cat !== 'string' || !mp || typeof mp !== 'object') continue
    const catMap = new Map<string, MutationEntry>()
    for (const [k, v] of Object.entries(mp as Record<string, unknown>)) {
      if (typeof v === 'object' && v !== null) {
        const vr = v as Record<string, unknown>
        // Parse stats from the entry (may be in v.stats object or as top-level keys)
        const stats: Record<string, number> = {}
        if (vr.stats && typeof vr.stats === 'object') {
          const vstats = vr.stats as Record<string, unknown>
          for (const s of STAT_KEYS) {
            const sv = vstats[s]
            if (sv !== undefined) {
              const n = typeof sv === 'number' ? sv : parseInt(String(sv))
              if (!isNaN(n)) stats[s] = n
            }
          }
        }
        catMap.set(k, {
          name: typeof vr.name === 'string' ? vr.name : null,
          tag: typeof vr.tag === 'string' ? vr.tag : null,
          desc: typeof vr.desc === 'string' ? vr.desc : null,
          descResolved: typeof vr.desc_resolved === 'string' ? vr.desc_resolved : null,
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
  const data = await $fetch('/data/classes.json')
  const classes: ClassesDB = new Map()

  const d = data && typeof data === 'object' ? data as Record<string, unknown> : null
  const source = d?.classes
  if (!source || typeof source !== 'object') return classes

  const STAT_KEYS = ['str', 'dex', 'con', 'int', 'spd', 'cha', 'lck']

  for (const [classId, raw] of Object.entries(source as Record<string, unknown>)) {
    if (!raw || typeof raw !== 'object') continue
    const r = raw as Record<string, unknown>
    const statMods: Record<string, number> = {}
    if (r.statMods && typeof r.statMods === 'object') {
      const sm = r.statMods as Record<string, unknown>
      for (const s of STAT_KEYS) {
        const v = sm[s]
        if (v !== undefined) {
          const n = typeof v === 'number' ? v : parseInt(String(v))
          if (!isNaN(n) && n !== 0) statMods[s] = n
        }
      }
    }
    classes.set(classId, {
      name: typeof r.name === 'string' ? r.name : classId,
      description: typeof r.description === 'string' ? r.description : '',
      statMods
    })
  }

  return classes
}

// ── Furniture ──

const EFFECT_KEYS = ['Comfort', 'Health', 'Appeal', 'Stimulation', 'FoodStorage', 'Evolution', 'FightBonusRewards', 'FightRisk', 'BreedSuppression']

export async function loadFurnitureDB(): Promise<FurnitureDB> {
  const data = await $fetch('/data/furniture_effects.json')
  const db: FurnitureDB = new Map()

  if (!data || typeof data !== 'object') return db

  for (const [id, raw] of Object.entries(data as Record<string, unknown>)) {
    if (!raw || typeof raw !== 'object') continue
    const r = raw as Record<string, unknown>

    const effects: Record<string, number> = {}
    for (const k of EFFECT_KEYS) {
      const v = r[k]
      if (v !== undefined) {
        const n = typeof v === 'number' ? v : parseInt(String(v))
        if (!isNaN(n) && n !== 0) effects[k] = n
      }
    }

    const entry: FurnitureEntry = {
      id,
      name: typeof r.name_resolved === 'string' ? r.name_resolved : id.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      desc: typeof r.desc_resolved === 'string' ? r.desc_resolved : '',
      special: r.special === 'true',
      removed: r.removed === 'true',
      set: typeof r.set === 'string' ? r.set : null,
      effects
    }
    db.set(id, entry)
  }

  return db
}
