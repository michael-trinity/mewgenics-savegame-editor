<script setup lang="ts">
import type { ParsedCat, MutationSlot } from '~/types/save'
import type { MutationEntry } from '~/types/database'
import { MUT_PAIRS, MUT_SLOT_INFO } from '~/types/save'
import { patchMutCoat, patchMutSlot } from '~/utils/patch/mutations'
import { parseMutationTable } from '~/utils/parse/mutations'
import { formatMutationStats } from '~/types/database'

const props = defineProps<{
  cat: ParsedCat
}>()

const { updateCat } = useSaveEditor()
const { mutationsDB } = useGameData()

// Base coat ID to use when clearing a texture mutation.
// Non-mutation coats use IDs 1-299; 49 is the most common value in real save data.
const BASE_COAT_RESET = 49

// ── Editing state ──

const editingSlotIdx = ref<number | null>(null)
const editingIsCoat = ref(false)
const searchQuery = ref('')
const activeTagFilter = ref<string | null>(null)
const activeStatFilters = ref<Set<string>>(new Set())
const rawCoatInput = ref('')

const STAT_FILTERS = [
  { key: 'str', label: 'STR' },
  { key: 'dex', label: 'DEX' },
  { key: 'con', label: 'CON' },
  { key: 'int', label: 'INT' },
  { key: 'spd', label: 'SPD' },
  { key: 'cha', label: 'CHA' },
  { key: 'lck', label: 'LCK' },
  { key: 'shield', label: 'Shield' }
] as const

function toggleStatFilter(key: string) {
  const s = new Set(activeStatFilters.value)
  if (s.has(key)) s.delete(key)
  else s.add(key)
  activeStatFilters.value = s
}

// ── Helpers ──

function getEntry(category: string, id: number): MutationEntry | null {
  if (!mutationsDB.value || id < 300) return null
  return mutationsDB.value.byCategory.get(category)?.get(String(id)) ?? null
}

function getDisplayName(category: string, id: number): string {
  if (id < 300) return 'None'
  const entry = getEntry(category, id)
  return entry?.name || entry?.tag || `#${id}`
}

type BadgeColor = 'error' | 'primary' | 'secondary' | 'success' | 'info' | 'warning' | 'neutral'

function tagColor(tag: string | null): BadgeColor {
  switch (tag) {
    case 'animal': return 'info'
    case 'bird': return 'info'
    case 'melted': return 'warning'
    case 'birth_defect': return 'error'
    case 'extra': return 'success'
    default: return 'neutral'
  }
}

const TAG_FILTERS = [
  { label: 'Animal', value: 'animal' },
  { label: 'Bird', value: 'bird' },
  { label: 'Melted', value: 'melted' },
  { label: 'Birth Defect', value: 'birth_defect' },
  { label: 'Extra', value: 'extra' }
]

// ── Browse panel ──

const browseCategory = computed(() => {
  if (editingIsCoat.value) return 'texture'
  if (editingSlotIdx.value === null) return null
  return MUT_SLOT_INFO[editingSlotIdx.value]?.category ?? null
})

const browseLabel = computed(() => {
  if (editingIsCoat.value) return 'Coat / Texture'
  if (editingSlotIdx.value === null) return ''
  const label = MUT_SLOT_INFO[editingSlotIdx.value]?.label ?? ''
  return label.replace(/_([LR])$/, ' $1')
})

const filteredMutations = computed((): [string, MutationEntry][] => {
  const cat = browseCategory.value
  if (!cat || !mutationsDB.value) return []
  const catMap = mutationsDB.value.byCategory.get(cat)
  if (!catMap) return []

  let entries = [...catMap.entries()].filter(([id]) => Number(id) >= 300)

  if (activeTagFilter.value) {
    entries = entries.filter(([, e]) => e.tag === activeTagFilter.value)
  }

  if (activeStatFilters.value.size > 0) {
    entries = entries.filter(([, e]) => {
      for (const key of activeStatFilters.value) {
        const v = e.stats[key]
        if (!v || v <= 0) return false
      }
      return true
    })
  }

  const q = searchQuery.value.toLowerCase()
  if (q) {
    entries = entries.filter(([id, e]) =>
      (e.name ?? '').toLowerCase().includes(q)
      || id.includes(q)
      || (e.descResolved ?? e.desc ?? '').toLowerCase().includes(q)
    )
  }

  return entries.sort((a, b) => Number(a[0]) - Number(b[0]))
})

// ── Slot grouping for left panel ──

const singleSlots = computed(() => {
  return [1, 2, 3, 14]
    .map(idx => props.cat.mutations.slots.find(s => s.slotIndex === idx))
    .filter((s): s is MutationSlot => !!s)
})

const pairedGroups = computed(() => {
  const slots = props.cat.mutations.slots
  const result: { label: string, left: MutationSlot, right: MutationSlot }[] = []
  for (const [l, r] of [[4, 5], [6, 7], [8, 9], [10, 11], [12, 13]] as [number, number][]) {
    const ls = slots.find(s => s.slotIndex === l)
    const rs = slots.find(s => s.slotIndex === r)
    if (ls && rs) {
      result.push({ label: ls.label.replace(/_[LR]$/, ''), left: ls, right: rs })
    }
  }
  return result
})

// ── Edit actions ──

function startEdit(slotIdx: number) {
  editingIsCoat.value = false
  editingSlotIdx.value = slotIdx
  searchQuery.value = ''
  activeTagFilter.value = null
  activeStatFilters.value = new Set()
}

function startEditCoat() {
  editingIsCoat.value = true
  editingSlotIdx.value = null
  searchQuery.value = ''
  activeTagFilter.value = null
  activeStatFilters.value = new Set()
  rawCoatInput.value = ''
}

function cancelEdit() {
  editingIsCoat.value = false
  editingSlotIdx.value = null
}

function applyMutation(newId: number) {
  if (editingIsCoat.value) {
    if (props.cat.mutations.baseOffset === null || props.cat.mutations.coatId === null) return
    const newBlob = patchMutCoat(props.cat.decompressedBlob, props.cat.mutations.baseOffset, props.cat.mutations.coatId, newId)
    updateCat(props.cat.key, { decompressedBlob: newBlob, mutations: parseMutationTable(newBlob) })
  } else if (editingSlotIdx.value !== null) {
    if (props.cat.mutations.baseOffset === null) return
    const newBlob = patchMutSlot(props.cat.decompressedBlob, props.cat.mutations.baseOffset, editingSlotIdx.value, newId)
    updateCat(props.cat.key, { decompressedBlob: newBlob, mutations: parseMutationTable(newBlob) })
  }
  cancelEdit()
}

function applyRawCoatId() {
  const id = Number(rawCoatInput.value)
  if (!id || id < 1 || id > 20000) return
  applyMutation(id)
}

function clearSlot(slotIdx: number) {
  if (props.cat.mutations.baseOffset === null) return
  const newBlob = patchMutSlot(props.cat.decompressedBlob, props.cat.mutations.baseOffset, slotIdx, 0)
  updateCat(props.cat.key, { decompressedBlob: newBlob, mutations: parseMutationTable(newBlob) })
  if (editingSlotIdx.value === slotIdx) cancelEdit()
}

function clearCoat() {
  if (props.cat.mutations.baseOffset === null || props.cat.mutations.coatId === null) return
  const newBlob = patchMutCoat(props.cat.decompressedBlob, props.cat.mutations.baseOffset, props.cat.mutations.coatId, BASE_COAT_RESET)
  updateCat(props.cat.key, { decompressedBlob: newBlob, mutations: parseMutationTable(newBlob) })
  if (editingIsCoat.value) cancelEdit()
}

function mirrorSlot(slotIdx: number) {
  const pair = MUT_PAIRS[slotIdx]
  if (!pair || props.cat.mutations.baseOffset === null) return
  const sourceSlot = props.cat.mutations.slots.find(s => s.slotIndex === slotIdx)
  if (!sourceSlot) return
  const newBlob = patchMutSlot(props.cat.decompressedBlob, props.cat.mutations.baseOffset, pair, sourceSlot.slotId)
  updateCat(props.cat.key, { decompressedBlob: newBlob, mutations: parseMutationTable(newBlob) })
}

const isBrowseOpen = computed(() => editingIsCoat.value || editingSlotIdx.value !== null)
</script>

<template>
  <div class="h-full p-6">
    <div
      v-if="!cat.mutations.baseOffset"
      class="text-muted"
    >
      Mutation data not found for this cat.
    </div>

    <div
      v-else
      class="flex gap-4 h-full"
    >
      <!-- Left: slot list -->
      <div class="flex-1 min-w-0 space-y-2 overflow-y-auto min-h-0">
        <!-- Coat card -->
        <div
          class="p-3 rounded-lg border transition-colors cursor-pointer"
          :class="editingIsCoat ? 'border-primary bg-primary/5' : 'border-default hover:border-primary/50'"
          @click="startEditCoat"
        >
          <div class="text-xs text-muted uppercase tracking-wider mb-1.5">
            Coat / Texture
          </div>
          <div class="flex items-center gap-2">
            <span class="font-medium text-sm truncate">
              {{ getDisplayName('texture', cat.mutations.coatId!) }}
            </span>
            <UBadge
              v-if="getEntry('texture', cat.mutations.coatId!)?.tag"
              :color="tagColor(getEntry('texture', cat.mutations.coatId!)?.tag ?? null)"
              variant="subtle"
              size="md"
            >
              {{ getEntry('texture', cat.mutations.coatId!)!.tag }}
            </UBadge>
            <span class="text-xs text-muted font-mono ml-auto">{{ cat.mutations.coatId }}</span>
            <UButton
              v-if="cat.mutations.coatId !== null && cat.mutations.coatId >= 300"
              size="md"
              color="error"
              variant="ghost"
              icon="i-lucide-trash-2"
              title="Remove texture mutation"
              @click.stop="clearCoat"
            />
          </div>
          <div
            v-if="getEntry('texture', cat.mutations.coatId!)?.descResolved"
            class="text-xs text-muted mt-1 line-clamp-1"
          >
            {{ getEntry('texture', cat.mutations.coatId!)!.descResolved }}
          </div>
          <div
            v-if="getEntry('texture', cat.mutations.coatId!) && formatMutationStats(getEntry('texture', cat.mutations.coatId!)!)"
            class="text-xs text-sky-400 mt-0.5"
          >
            {{ formatMutationStats(getEntry('texture', cat.mutations.coatId!)!) }}
          </div>
        </div>

        <!-- Single slots: Body, Head, Tail, Mouth -->
        <div
          v-for="slot in singleSlots"
          :key="slot.slotIndex"
          class="p-3 rounded-lg border transition-colors cursor-pointer"
          :class="editingSlotIdx === slot.slotIndex && !editingIsCoat ? 'border-primary bg-primary/5' : 'border-default hover:border-primary/50'"
          @click="startEdit(slot.slotIndex)"
        >
          <div class="text-xs text-muted uppercase tracking-wider mb-1.5">
            {{ slot.label }}
          </div>
          <div class="flex items-center gap-2">
            <span class="font-medium text-sm">
              {{ getDisplayName(slot.category, slot.slotId) }}
            </span>
            <UBadge
              v-if="getEntry(slot.category, slot.slotId)?.tag"
              :color="tagColor(getEntry(slot.category, slot.slotId)?.tag ?? null)"
              variant="subtle"
              size="md"
            >
              {{ getEntry(slot.category, slot.slotId)!.tag }}
            </UBadge>
            <span
              v-if="slot.slotId >= 300"
              class="text-xs text-muted font-mono ml-auto"
            >{{ slot.slotId }}</span>
            <span
              v-else
              class="ml-auto"
            />
            <UButton
              v-if="slot.slotId >= 300"
              size="md"
              color="error"
              variant="ghost"
              icon="i-lucide-trash-2"
              title="Clear mutation"
              @click.stop="clearSlot(slot.slotIndex)"
            />
          </div>
          <div
            v-if="getEntry(slot.category, slot.slotId)?.descResolved"
            class="text-xs text-muted mt-1 line-clamp-1"
          >
            {{ getEntry(slot.category, slot.slotId)!.descResolved }}
          </div>
          <div
            v-if="getEntry(slot.category, slot.slotId) && formatMutationStats(getEntry(slot.category, slot.slotId)!)"
            class="text-xs text-sky-400 mt-0.5"
          >
            {{ formatMutationStats(getEntry(slot.category, slot.slotId)!) }}
          </div>
        </div>

        <!-- Paired slots: Legs, Eyes, Brows, Ears -->
        <div
          v-for="pair in pairedGroups"
          :key="pair.label"
          class="p-3 rounded-lg border border-default"
        >
          <div class="text-xs text-muted uppercase tracking-wider mb-2">
            {{ pair.label }}
          </div>
          <div class="grid grid-cols-2 gap-2">
            <!-- Left side -->
            <div
              class="p-2 rounded-md cursor-pointer transition-colors"
              :class="editingSlotIdx === pair.left.slotIndex && !editingIsCoat
                ? 'bg-primary/10 ring-1 ring-primary/50'
                : 'bg-elevated/50 hover:bg-elevated'"
              @click="startEdit(pair.left.slotIndex)"
            >
              <div class="text-xs text-muted mb-1">
                L
              </div>
              <div class="font-medium text-sm truncate">
                {{ getDisplayName(pair.left.category, pair.left.slotId) }}
              </div>
              <UBadge
                v-if="getEntry(pair.left.category, pair.left.slotId)?.tag"
                :color="tagColor(getEntry(pair.left.category, pair.left.slotId)?.tag ?? null)"
                variant="subtle"
                size="md"
                class="mt-1"
              >
                {{ getEntry(pair.left.category, pair.left.slotId)!.tag }}
              </UBadge>
              <div
                v-if="getEntry(pair.left.category, pair.left.slotId) && formatMutationStats(getEntry(pair.left.category, pair.left.slotId)!)"
                class="text-xs text-sky-400 mt-0.5"
              >
                {{ formatMutationStats(getEntry(pair.left.category, pair.left.slotId)!) }}
              </div>
              <div class="flex items-center gap-1 mt-1.5">
                <span
                  v-if="pair.left.slotId >= 300"
                  class="text-xs text-muted font-mono"
                >{{ pair.left.slotId }}</span>
                <div class="ml-auto flex items-center gap-0.5">
                  <UButton
                    v-if="pair.left.slotId >= 300"
                    size="md"
                    color="error"
                    variant="ghost"
                    icon="i-lucide-trash-2"
                    title="Clear mutation"
                    @click.stop="clearSlot(pair.left.slotIndex)"
                  />
                  <UButton
                    size="md"
                    color="neutral"
                    variant="ghost"
                    icon="i-lucide-copy"
                    title="Mirror to right"
                    @click.stop="mirrorSlot(pair.left.slotIndex)"
                  />
                </div>
              </div>
            </div>

            <!-- Right side -->
            <div
              class="p-2 rounded-md cursor-pointer transition-colors"
              :class="editingSlotIdx === pair.right.slotIndex && !editingIsCoat
                ? 'bg-primary/10 ring-1 ring-primary/50'
                : 'bg-elevated/50 hover:bg-elevated'"
              @click="startEdit(pair.right.slotIndex)"
            >
              <div class="text-xs text-muted mb-1">
                R
              </div>
              <div class="font-medium text-sm truncate">
                {{ getDisplayName(pair.right.category, pair.right.slotId) }}
              </div>
              <UBadge
                v-if="getEntry(pair.right.category, pair.right.slotId)?.tag"
                :color="tagColor(getEntry(pair.right.category, pair.right.slotId)?.tag ?? null)"
                variant="subtle"
                size="md"
                class="mt-1"
              >
                {{ getEntry(pair.right.category, pair.right.slotId)!.tag }}
              </UBadge>
              <div
                v-if="getEntry(pair.right.category, pair.right.slotId) && formatMutationStats(getEntry(pair.right.category, pair.right.slotId)!)"
                class="text-xs text-sky-400 mt-0.5"
              >
                {{ formatMutationStats(getEntry(pair.right.category, pair.right.slotId)!) }}
              </div>
              <div class="flex items-center gap-1 mt-1.5">
                <span
                  v-if="pair.right.slotId >= 300"
                  class="text-xs text-muted font-mono"
                >{{ pair.right.slotId }}</span>
                <div class="ml-auto flex items-center gap-0.5">
                  <UButton
                    v-if="pair.right.slotId >= 300"
                    size="md"
                    color="error"
                    variant="ghost"
                    icon="i-lucide-trash-2"
                    title="Clear mutation"
                    @click.stop="clearSlot(pair.right.slotIndex)"
                  />
                  <UButton
                    size="md"
                    color="neutral"
                    variant="ghost"
                    icon="i-lucide-copy"
                    title="Mirror to left"
                    @click.stop="mirrorSlot(pair.right.slotIndex)"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Right: mutation browser -->
      <div
        v-if="isBrowseOpen"
        class="flex-1 min-w-0 min-h-0 flex flex-col"
      >
        <div class="border border-default rounded-lg overflow-hidden flex flex-col min-h-0 flex-1">
          <!-- Header -->
          <div class="shrink-0 flex items-center justify-between px-3 py-2 border-b border-default bg-elevated">
            <span class="text-sm font-medium">{{ browseLabel }}</span>
            <UButton
              size="md"
              color="neutral"
              variant="ghost"
              icon="i-lucide-x"
              @click="cancelEdit"
            />
          </div>

          <!-- Search + filters -->
          <div class="shrink-0 p-3 border-b border-default space-y-2">
            <UInput
              v-model="searchQuery"
              icon="i-lucide-search"
              placeholder="Search mutations..."
              size="sm"
              class="w-full"
            />
            <!-- Tag filter chips (mutation slots only) -->
            <div
              v-if="!editingIsCoat"
              class="flex flex-wrap gap-1.5"
            >
              <button
                class="px-2 py-0.5 text-xs rounded-md border transition-colors"
                :class="activeTagFilter === null
                  ? 'border-primary bg-primary/15 text-primary'
                  : 'border-default text-muted hover:text-default hover:border-muted'"
                @click="activeTagFilter = null"
              >
                All
              </button>
              <button
                v-for="f in TAG_FILTERS"
                :key="f.value"
                class="px-2 py-0.5 text-xs rounded-md border transition-colors"
                :class="activeTagFilter === f.value
                  ? 'border-primary bg-primary/15 text-primary'
                  : 'border-default text-muted hover:text-default hover:border-muted'"
                @click="activeTagFilter = activeTagFilter === f.value ? null : f.value"
              >
                {{ f.label }}
              </button>
            </div>
            <!-- Stat filter chips -->
            <div class="flex flex-wrap gap-1.5">
              <button
                v-for="f in STAT_FILTERS"
                :key="f.key"
                class="px-2 py-0.5 text-xs rounded-md border transition-colors"
                :class="activeStatFilters.has(f.key)
                  ? 'border-primary bg-primary/15 text-primary'
                  : 'border-default text-muted hover:text-default hover:border-muted'"
                @click="toggleStatFilter(f.key)"
              >
                {{ f.label }}
              </button>
            </div>
            <!-- Raw ID input (coat only) -->
            <div
              v-if="editingIsCoat"
              class="flex items-center gap-2"
            >
              <span class="text-xs text-muted shrink-0">Base coat ID:</span>
              <UInput
                v-model="rawCoatInput"
                type="number"
                size="sm"
                class="w-28"
                :min="1"
                :max="20000"
                placeholder="e.g. 49"
              />
              <UButton
                size="md"
                color="primary"
                icon="i-lucide-check"
                :disabled="!rawCoatInput || Number(rawCoatInput) < 1"
                @click="applyRawCoatId"
              />
            </div>
          </div>

          <!-- Mutation list -->
          <div class="flex-1 min-h-0 overflow-y-auto p-2 space-y-1">
            <!-- Clear option (mutation slots only) -->
            <div
              v-if="!editingIsCoat"
              class="px-3 py-2 rounded-lg border border-default hover:border-primary/50 cursor-pointer transition-colors text-sm text-muted italic"
              @click="applyMutation(0)"
            >
              None / Clear
            </div>

            <div
              v-if="filteredMutations.length === 0"
              class="px-3 py-6 text-center text-sm text-muted"
            >
              No mutations match
            </div>

            <div
              v-for="[id, entry] in filteredMutations"
              :key="id"
              class="p-3 rounded-lg border border-default hover:border-primary/50 cursor-pointer transition-colors"
              @click="applyMutation(Number(id))"
            >
              <div class="flex items-center gap-2">
                <span class="font-medium text-sm">{{ entry.name || entry.tag || `#${id}` }}</span>
                <UBadge
                  v-if="entry.tag"
                  :color="tagColor(entry.tag)"
                  variant="subtle"
                  size="md"
                >
                  {{ entry.tag }}
                </UBadge>
                <span class="text-xs text-muted font-mono ml-auto">{{ id }}</span>
              </div>
              <div
                v-if="formatMutationStats(entry)"
                class="text-xs text-sky-400 mt-0.5"
              >
                {{ formatMutationStats(entry) }}
              </div>
              <div
                v-if="entry.descResolved ?? entry.desc"
                class="text-xs text-muted mt-0.5 line-clamp-2"
              >
                {{ entry.descResolved ?? entry.desc }}
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Placeholder when no slot is selected -->
      <div
        v-else
        class="flex-1 flex items-center justify-center text-muted text-sm"
      >
        Click a slot to browse mutations
      </div>
    </div>
  </div>
</template>
