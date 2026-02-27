<script setup lang="ts">
import type { ParsedCat, AbilitySlot } from '~/types/save'
import type { SearchOption } from '~/components/editor/SearchSelect.vue'
import { formatAbilityStats, formatPassiveStats } from '~/types/database'
import { patchU64RunEntry, patchU64TierEntry } from '~/utils/patch/abilities'
import { buildAbilitySlots } from '~/utils/parse/abilities'

const props = defineProps<{
  cat: ParsedCat
}>()

const { updateCat } = useSaveEditor()
const { abilitiesDB } = useGameData()

const editingSlot = ref<AbilitySlot | null>(null)
const editValue = ref('')
const editTier = ref(1)

// ── Slot classification helpers ──

function slotCategory(label: string): 'disorder' | 'passive' | 'active' {
  const lab = label.toLowerCase()
  if (lab.includes('disorder')) return 'disorder'
  if (lab.includes('passive')) return 'passive'
  return 'active'
}

function hasTier(label: string): boolean {
  const cat = slotCategory(label)
  return cat === 'passive' || cat === 'disorder'
}

function isFixedSlot(label: string): boolean {
  return label.includes('DefaultMove') || label.includes('BasicAttack')
}

// ── Build SearchOption arrays per slot category ──

const activeOptions = computed<SearchOption[]>(() => {
  const db = abilitiesDB.value
  if (!db) return []
  const opts: SearchOption[] = []
  for (const id of [...db.actives].sort()) {
    const entry = db.allAbilities.get(id)
    opts.push({
      id,
      label: entry?.name ?? id,
      badge: entry?.class,
      stats: entry ? formatAbilityStats(entry) : undefined,
      description: entry?.description,
    })
  }
  return opts
})

const passiveOptions = computed<SearchOption[]>(() => {
  const db = abilitiesDB.value
  if (!db) return []
  const opts: SearchOption[] = []
  for (const [id, entry] of [...db.passivesCatalog.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    opts.push({
      id,
      label: entry.name || id,
      badge: entry.class,
      stats: formatPassiveStats(entry.passives),
    })
  }
  return opts
})

const disorderOptions = computed<SearchOption[]>(() => {
  const db = abilitiesDB.value
  if (!db) return []
  const opts: SearchOption[] = []
  for (const [id, entry] of [...db.disordersCatalog.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    opts.push({
      id,
      label: entry.name || id,
      badge: entry.class,
      stats: formatPassiveStats(entry.passives),
    })
  }
  return opts
})

function getOptions(label: string): SearchOption[] {
  switch (slotCategory(label)) {
    case 'disorder': return disorderOptions.value
    case 'passive': return passiveOptions.value
    default: return activeOptions.value
  }
}

// ── Resolve display info for a slot's current ability ──

function displayName(slot: AbilitySlot): string {
  if (!slot.abilityId) return 'None'
  const db = abilitiesDB.value
  if (!db) return slot.abilityId

  const cat = slotCategory(slot.label)
  if (cat === 'passive') {
    const entry = db.passivesCatalog.get(slot.abilityId)
    return entry?.name || slot.abilityId
  }
  if (cat === 'disorder') {
    const entry = db.disordersCatalog.get(slot.abilityId)
    return entry?.name || slot.abilityId
  }
  const entry = db.allAbilities.get(slot.abilityId)
  return entry?.name || slot.abilityId
}

function displayClass(slot: AbilitySlot): string | undefined {
  if (!slot.abilityId) return undefined
  const db = abilitiesDB.value
  if (!db) return undefined

  const cat = slotCategory(slot.label)
  if (cat === 'passive') return db.passivesCatalog.get(slot.abilityId)?.class
  if (cat === 'disorder') return db.disordersCatalog.get(slot.abilityId)?.class
  return db.allAbilities.get(slot.abilityId)?.class
}

function displayStats(slot: AbilitySlot): string | undefined {
  if (!slot.abilityId) return undefined
  const db = abilitiesDB.value
  if (!db) return undefined

  const cat = slotCategory(slot.label)
  if (cat === 'passive') {
    const entry = db.passivesCatalog.get(slot.abilityId)
    return entry ? formatPassiveStats(entry.passives) : undefined
  }
  if (cat === 'disorder') {
    const entry = db.disordersCatalog.get(slot.abilityId)
    return entry ? formatPassiveStats(entry.passives) : undefined
  }
  const entry = db.allAbilities.get(slot.abilityId)
  return entry ? formatAbilityStats(entry) : undefined
}

function displayDescription(slot: AbilitySlot): string | undefined {
  if (!slot.abilityId) return undefined
  const db = abilitiesDB.value
  if (!db) return undefined

  if (slotCategory(slot.label) === 'active') {
    return db.allAbilities.get(slot.abilityId)?.description
  }
  return undefined
}

// ── Max tier for the currently-editing value ──

const editMaxTier = computed<number>(() => {
  const db = abilitiesDB.value
  if (!db || !editingSlot.value) return 10

  const cat = slotCategory(editingSlot.value.label)
  if (cat === 'passive') {
    const entry = db.passivesCatalog.get(editValue.value)
    return entry?.maxTier ?? db.passiveTiers.get(editValue.value) ?? 10
  }
  if (cat === 'disorder') {
    const entry = db.disordersCatalog.get(editValue.value)
    return entry?.maxTier ?? db.disorderTiers.get(editValue.value) ?? 10
  }
  return 10
})

// ── Edit actions ──

function startEdit(slot: AbilitySlot) {
  editingSlot.value = slot
  editValue.value = slot.abilityId
  editTier.value = slot.tier ?? 1
}

function cancelEdit() {
  editingSlot.value = null
}

function applyEdit() {
  if (!editingSlot.value) return

  const slot = editingSlot.value
  let newBlob = props.cat.decompressedBlob

  if (slot.kind === 'u64run' && slot.runStart != null && slot.runEnd != null && slot.runIndex != null) {
    newBlob = patchU64RunEntry(newBlob, slot.runStart, slot.runEnd, slot.runIndex, editValue.value)
  } else if (slot.kind === 'u64tier' && slot.recordOffset != null && slot.byteLength != null) {
    newBlob = patchU64TierEntry(newBlob, slot.recordOffset, slot.byteLength, editValue.value, editTier.value)
  }

  const abilities = buildAbilitySlots(newBlob)
  updateCat(props.cat.key, { decompressedBlob: newBlob, abilities })
  editingSlot.value = null
}

function clearSlot(slot: AbilitySlot) {
  let newBlob = props.cat.decompressedBlob

  if (slot.kind === 'u64run' && slot.runStart != null && slot.runEnd != null && slot.runIndex != null) {
    newBlob = patchU64RunEntry(newBlob, slot.runStart, slot.runEnd, slot.runIndex, 'None')
  } else if (slot.kind === 'u64tier' && slot.recordOffset != null && slot.byteLength != null) {
    newBlob = patchU64TierEntry(newBlob, slot.recordOffset, slot.byteLength, 'None', 1)
  }

  const abilities = buildAbilitySlots(newBlob)
  updateCat(props.cat.key, { decompressedBlob: newBlob, abilities })
  editingSlot.value = null
}

function canClear(slot: AbilitySlot): boolean {
  return !isFixedSlot(slot.label) && slot.abilityId !== 'None'
}
</script>

<template>
  <div class="h-full overflow-y-auto p-6">
    <div v-if="cat.abilities.length === 0" class="text-muted">
      No ability data found for this cat.
    </div>

    <div v-else class="space-y-2 max-w-xl">
      <div
        v-for="slot in cat.abilities"
        :key="slot.label"
        class="flex items-start gap-3 p-3 rounded-lg border border-default"
      >
        <!-- Slot label -->
        <div class="w-32 shrink-0 pt-0.5">
          <div class="text-xs text-muted uppercase tracking-wider">
            {{ slot.label.replace(/ \(.*\)/, '') }}
          </div>
        </div>

        <div class="flex-1 min-w-0">
          <!-- Editing mode -->
          <div v-if="editingSlot === slot" class="space-y-2">
            <EditorSearchSelect
              :model-value="editValue"
              :options="getOptions(slot.label)"
              placeholder="Search ability..."
              @update:model-value="editValue = $event"
            />

            <div class="flex items-center gap-2">
              <UInput
                v-if="hasTier(slot.label)"
                v-model.number="editTier"
                type="number"
                size="sm"
                class="w-20"
                :min="1"
                :max="editMaxTier"
                placeholder="Tier"
              />

              <div class="ml-auto flex items-center gap-1">
                <UButton size="md" color="primary" icon="i-lucide-check" @click="applyEdit" />
                <UButton size="md" color="neutral" variant="ghost" icon="i-lucide-x" @click="cancelEdit" />
              </div>
            </div>
          </div>

          <!-- Display mode -->
          <div v-else>
            <div class="flex items-center gap-2">
              <span class="font-medium text-sm">{{ displayName(slot) }}</span>
              <UBadge v-if="displayClass(slot)" color="primary" variant="subtle" size="md">
                {{ displayClass(slot) }}
              </UBadge>
              <UBadge v-if="slot.tier" color="neutral" variant="subtle" size="md">
                T{{ slot.tier }}
              </UBadge>
              <span class="text-xs text-muted font-mono ml-auto">{{ slot.abilityId }}</span>
            </div>
            <div v-if="displayStats(slot)" class="text-xs text-muted mt-0.5">
              {{ displayStats(slot) }}
            </div>
            <div v-if="displayDescription(slot)" class="text-xs text-muted mt-0.5 line-clamp-2">
              {{ displayDescription(slot) }}
            </div>
          </div>
        </div>

        <!-- Actions -->
        <div v-if="!isFixedSlot(slot.label) && editingSlot !== slot" class="shrink-0 mt-0.5 flex items-center gap-0.5">
          <UButton
            size="md"
            color="neutral"
            variant="ghost"
            icon="i-lucide-square-pen"
            @click="startEdit(slot)"
          />
          <UButton
            v-if="canClear(slot)"
            size="md"
            color="error"
            variant="ghost"
            icon="i-lucide-trash-2"
            @click="clearSlot(slot)"
          />
        </div>
      </div>
    </div>
  </div>
</template>
