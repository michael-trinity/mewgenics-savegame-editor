<script setup lang="ts">
import type { ParsedCat, EquipSlot } from '~/types/save'
import type { ItemEntry } from '~/types/database'
import { UI_SLOT_NAMES, UI_TO_BLOB } from '~/types/save'
import { formatItemStats } from '~/types/database'
import { patchDeleteEquipmentSlot, patchReplaceEquipmentSlotId, patchEquipToEmptySlot } from '~/utils/patch/equipment'
import { parseEquipmentSlots } from '~/utils/parse/equipment'

const props = defineProps<{
  cat: ParsedCat
}>()

const { updateCat } = useSaveEditor()
const { itemsDB } = useGameData()

// Mapping from blob slot index to item kind used in byKind
const BLOB_SLOT_TO_KIND: Record<number, string> = {
  0: 'head', // Hat
  1: 'face', // Glasses
  2: 'neck', // Necklace
  3: 'weapon', // Weapon
  4: 'trinket' // Trinket/Consumable
}

const SLOT_ICONS: Record<number, string> = {
  3: 'i-lucide-swords',
  0: 'i-lucide-hard-hat',
  2: 'i-lucide-link',
  1: 'i-lucide-glasses',
  4: 'i-lucide-gem'
}

// Show in UI order
const uiSlots = computed(() => {
  if (!props.cat.equipment) return []
  return UI_TO_BLOB.map((blobIdx, uiIdx) => {
    const slot = props.cat.equipment!.find(s => s.blobSlot === blobIdx)
    return {
      uiName: UI_SLOT_NAMES[uiIdx]!,
      blobIdx,
      slot: slot ?? null
    }
  })
})

// ── Item browser state ──

const editingSlot = ref<EquipSlot | null>(null)
const editingBlobIdx = ref<number>(0)
const searchQuery = ref('')

const STAT_FILTERS = [
  { key: 'shield', label: 'Shield' },
  { key: 'str', label: 'STR' },
  { key: 'dex', label: 'DEX' },
  { key: 'con', label: 'CON' },
  { key: 'int', label: 'INT' },
  { key: 'spd', label: 'SPD' },
  { key: 'cha', label: 'CHA' },
  { key: 'lck', label: 'LCK' }
] as const

const activeFilters = ref<Set<string>>(new Set())

function toggleFilter(key: string) {
  const s = new Set(activeFilters.value)
  if (s.has(key)) s.delete(key)
  else s.add(key)
  activeFilters.value = s
}

// Items for current slot kind, filtered
const filteredItems = computed(() => {
  const db = itemsDB.value
  if (!db) return [] as ItemEntry[]
  const kind = BLOB_SLOT_TO_KIND[editingBlobIdx.value]
  if (!kind) return [] as ItemEntry[]
  let entries: readonly ItemEntry[] = db.byKind.get(kind) ?? []

  // Text search
  const q = searchQuery.value.toLowerCase()
  if (q) {
    entries = entries.filter(e =>
      e.name.toLowerCase().includes(q)
      || e.id.toLowerCase().includes(q)
      || e.desc.toLowerCase().includes(q)
    )
  }

  // Stat filters — item must have positive value for ALL checked stats
  if (activeFilters.value.size > 0) {
    entries = entries.filter((e) => {
      for (const key of activeFilters.value) {
        if (key === 'shield') {
          if (!e.shield || e.shield <= 0) return false
        } else {
          const v = e.stats[key]
          if (!v || v <= 0) return false
        }
      }
      return true
    })
  }

  return entries
})

// ── Display helpers ──

function lookupItem(itemId: string | null) {
  if (!itemId) return null
  return itemsDB.value?.allItems.get(itemId) ?? null
}

function displayName(slot: EquipSlot): string {
  if (!slot.itemId) return 'Empty'
  const entry = lookupItem(slot.itemId)
  return entry?.name ?? slot.itemId
}

function displayRarity(slot: EquipSlot): string | undefined {
  if (!slot.itemId) return undefined
  return lookupItem(slot.itemId)?.rarity
}

// ── Actions ──

function startEdit(slot: EquipSlot, blobIdx: number) {
  editingSlot.value = slot
  editingBlobIdx.value = blobIdx
  searchQuery.value = ''
  activeFilters.value = new Set()
}

function cancelEdit() {
  editingSlot.value = null
}

function selectItem(itemId: string) {
  if (!editingSlot.value) return
  let newBlob: Uint8Array
  if (editingSlot.value.itemId) {
    newBlob = patchReplaceEquipmentSlotId(props.cat.decompressedBlob, editingSlot.value, itemId)
  } else {
    newBlob = patchEquipToEmptySlot(props.cat.decompressedBlob, editingSlot.value, itemId)
  }
  const equipment = parseEquipmentSlots(newBlob)
  updateCat(props.cat.key, { decompressedBlob: newBlob, equipment })
  editingSlot.value = null
}

function unequip(slot: EquipSlot) {
  if (slot.itemId === null) return
  const newBlob = patchDeleteEquipmentSlot(props.cat.decompressedBlob, slot)
  const equipment = parseEquipmentSlots(newBlob)
  updateCat(props.cat.key, { decompressedBlob: newBlob, equipment })
  if (editingSlot.value === slot) editingSlot.value = null
}

function statBadge(entry: ItemEntry): string {
  return formatItemStats(entry)
}
</script>

<template>
  <div class="h-full p-6">
    <div
      v-if="!cat.equipment"
      class="text-muted"
    >
      Equipment data not found for this cat.
    </div>

    <div
      v-else
      class="flex gap-4 h-full"
    >
      <!-- Left: Equipment slot cards -->
      <div class="flex-1 min-w-0 space-y-2 overflow-y-auto min-h-0">
        <div
          v-for="{ uiName, blobIdx, slot } in uiSlots"
          :key="uiName"
          class="p-3 rounded-lg border transition-colors cursor-pointer"
          :class="[
            editingSlot === slot
              ? 'border-primary bg-primary/5'
              : 'border-default hover:border-primary/50'
          ]"
          @click="slot && startEdit(slot, blobIdx)"
        >
          <div class="flex items-center gap-2 mb-1">
            <UIcon
              :name="SLOT_ICONS[blobIdx] ?? 'i-lucide-circle'"
              class="size-3.5 text-muted"
            />
            <span class="text-xs text-muted uppercase tracking-wider">{{ uiName }}</span>
          </div>
          <template v-if="slot?.itemId">
            <div class="flex items-center gap-2">
              <span class="font-medium text-sm truncate">{{ displayName(slot) }}</span>
              <UBadge
                v-if="lookupItem(slot.itemId)?.cursed"
                variant="subtle"
                size="md"
                class="bg-purple-500/15 text-purple-400"
              >
                Cursed
              </UBadge>
              <UBadge
                v-if="displayRarity(slot)"
                color="primary"
                variant="subtle"
                size="md"
              >
                {{ displayRarity(slot) }}
              </UBadge>
            </div>
            <div
              v-if="lookupItem(slot.itemId)?.desc"
              class="text-xs text-muted mt-0.5 line-clamp-1"
            >
              {{ lookupItem(slot.itemId)!.desc }}
            </div>
            <!-- Unequip button -->
            <div class="flex justify-end mt-1">
              <UButton
                size="md"
                color="error"
                variant="ghost"
                icon="i-lucide-trash-2"
                @click.stop="unequip(slot)"
              >
                Unequip
              </UButton>
            </div>
          </template>
          <template v-else-if="slot">
            <span class="text-sm text-muted italic">Empty</span>
          </template>
          <template v-else>
            <span class="text-sm text-muted italic">No data</span>
          </template>
        </div>
      </div>

      <!-- Right: Item browser -->
      <div
        v-if="editingSlot"
        class="flex-1 min-w-0 min-h-0 flex flex-col"
      >
        <div class="border border-default rounded-lg overflow-hidden flex flex-col min-h-0 flex-1">
          <!-- Header -->
          <div class="shrink-0 flex items-center justify-between px-3 py-2 border-b border-default bg-elevated">
            <span class="text-sm font-medium">
              {{ editingSlot.itemId ? 'Replace' : 'Equip' }} — {{ BLOB_SLOT_TO_KIND[editingBlobIdx] }}
            </span>
            <UButton
              size="md"
              color="neutral"
              variant="ghost"
              icon="i-lucide-x"
              @click="cancelEdit"
            />
          </div>

          <!-- Search + Filters -->
          <div class="shrink-0 p-3 border-b border-default space-y-2">
            <UInput
              v-model="searchQuery"
              icon="i-lucide-search"
              placeholder="Search by name..."
              size="sm"
              class="w-full"
            />
            <div class="flex flex-wrap gap-1.5">
              <button
                v-for="f in STAT_FILTERS"
                :key="f.key"
                class="px-2 py-0.5 text-xs rounded-md border transition-colors"
                :class="[
                  activeFilters.has(f.key)
                    ? 'border-primary bg-primary/15 text-primary'
                    : 'border-default text-muted hover:text-default hover:border-default'
                ]"
                @click="toggleFilter(f.key)"
              >
                {{ f.label }}
              </button>
            </div>
          </div>

          <!-- Item list -->
          <div class="flex-1 min-h-0 overflow-y-auto p-2 space-y-2">
            <div
              v-if="filteredItems.length === 0"
              class="px-3 py-6 text-center text-sm text-muted"
            >
              No items match
            </div>
            <div
              v-for="entry in filteredItems"
              :key="entry.id"
              class="p-3 rounded-lg border border-default hover:border-primary/50 cursor-pointer transition-colors"
              @click="selectItem(entry.id)"
            >
              <div class="flex items-center gap-2">
                <span class="font-medium text-sm">{{ entry.name }}</span>
                <UBadge
                  v-if="entry.cursed"
                  variant="subtle"
                  size="md"
                  class="bg-purple-500/15 text-purple-400"
                >
                  Cursed
                </UBadge>
                <UBadge
                  color="primary"
                  variant="subtle"
                  size="md"
                >
                  {{ entry.rarity }}
                </UBadge>
                <span
                  v-if="entry.shield"
                  class="text-xs text-blue-400"
                >
                  Shield {{ entry.shield }}
                </span>
              </div>
              <div
                v-if="statBadge(entry)"
                class="text-xs text-muted mt-1"
              >
                {{ statBadge(entry) }}
              </div>
              <div
                v-if="entry.desc"
                class="text-xs text-muted mt-1 line-clamp-2"
              >
                {{ entry.desc }}
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Placeholder when no slot is being edited -->
      <div
        v-else
        class="flex-1 flex items-center justify-center text-muted text-sm"
      >
        Click a slot to browse items
      </div>
    </div>
  </div>
</template>
