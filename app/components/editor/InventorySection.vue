<script setup lang="ts">
import type { InventoryItem } from '~/types/save'
import type { ItemEntry } from '~/types/database'
import { formatItemStats } from '~/types/database'

const { saveState, addInventoryItem, removeInventoryItem } = useSaveEditor()
const { itemsDB } = useGameData()

const inventory = computed(() => saveState.value?.inventory ?? null)

const activeTab = ref('backpack')
const tabs = [
  { key: 'backpack', label: 'Backpack', icon: 'i-lucide-backpack' },
  { key: 'storage', label: 'Storage', icon: 'i-lucide-warehouse' },
  { key: 'trash', label: 'Trash', icon: 'i-lucide-trash-2' }
]

const currentItems = computed(() => {
  if (!inventory.value) return []
  switch (activeTab.value) {
    case 'backpack': return inventory.value.backpack
    case 'storage': return inventory.value.storage
    case 'trash': return inventory.value.trash
    default: return []
  }
})

// ── Item browser state ──

const showBrowser = ref(false)
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

const CATEGORY_FILTERS = [
  { key: 'sidequest', label: 'Sidequest' },
  { key: 'quest', label: 'Quest' },
  { key: 'legendary', label: 'Legendary' },
  { key: 'cursed', label: 'Cursed' }
] as const

const activeCategory = ref<string | null>(null)

function toggleFilter(key: string) {
  const s = new Set(activeFilters.value)
  if (s.has(key)) s.delete(key)
  else s.add(key)
  activeFilters.value = s
}

function toggleCategory(key: string) {
  activeCategory.value = activeCategory.value === key ? null : key
}

const filteredItems = computed(() => {
  const db = itemsDB.value
  if (!db) return [] as ItemEntry[]
  let entries: readonly ItemEntry[] = [...db.allItems.values()]

  // Text search
  const q = searchQuery.value.toLowerCase()
  if (q) {
    entries = entries.filter(e =>
      e.name.toLowerCase().includes(q)
      || e.id.toLowerCase().includes(q)
      || e.desc.toLowerCase().includes(q)
    )
  }

  // Category filter
  if (activeCategory.value) {
    const cat = activeCategory.value
    if (cat === 'cursed') {
      entries = entries.filter(e => e.cursed)
    } else {
      entries = entries.filter(e => e.rarity === cat)
    }
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

  // Sort alphabetically
  return [...entries].sort((a, b) => a.name.localeCompare(b.name))
})

// ── Actions ──

function getNextSeqId(): number {
  if (!inventory.value) return 1
  let max = 0
  for (const container of [inventory.value.backpack, inventory.value.storage, inventory.value.trash]) {
    for (const item of container) {
      if (item.seqId > max) max = item.seqId
    }
  }
  return max + 1
}

function onAddItem(entry: ItemEntry) {
  const container = activeTab.value as 'backpack' | 'storage' | 'trash'
  const newItem: InventoryItem = {
    name: entry.id,
    subName: null,
    charges: 1,
    field1: 0,
    field2: 0,
    seqId: getNextSeqId(),
    tailByte: 0xFF
  }
  addInventoryItem(container, newItem)
}

function onRemoveItem(index: number) {
  const container = activeTab.value as 'backpack' | 'storage' | 'trash'
  removeInventoryItem(container, index)
}

function openBrowser() {
  showBrowser.value = true
  searchQuery.value = ''
  activeFilters.value = new Set()
  activeCategory.value = null
}

function getItemDisplayName(name: string): string {
  const entry = itemsDB.value?.allItems.get(name)
  return entry?.name ?? name
}

function getItemRarity(name: string): string | null {
  const entry = itemsDB.value?.allItems.get(name)
  return entry?.rarity ?? null
}

function getItemStats(name: string): string {
  const entry = itemsDB.value?.allItems.get(name)
  if (!entry) return ''
  return formatItemStats(entry)
}

function getItemEntry(name: string): ItemEntry | null {
  return itemsDB.value?.allItems.get(name) ?? null
}

function chargesDisplay(charges: number): string {
  if (charges === -1) return 'Uses: \u221E'
  return `Uses: ${charges}`
}
</script>

<template>
  <div class="h-full flex flex-col">
    <div class="shrink-0 flex items-center justify-between px-6 pt-6 pb-4">
      <h2 class="text-xl font-bold">
        Inventory
      </h2>
      <UButton
        icon="i-lucide-plus"
        size="sm"
        color="primary"
        variant="soft"
        @click="openBrowser"
      >
        Add Item
      </UButton>
    </div>

    <!-- Sub-tabs -->
    <div class="shrink-0 flex gap-1 border-b border-default px-6">
      <button
        v-for="tab in tabs"
        :key="tab.key"
        class="flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 transition-colors"
        :class="[
          activeTab === tab.key
            ? 'border-primary text-primary'
            : 'border-transparent text-muted hover:text-default hover:border-default'
        ]"
        @click="activeTab = tab.key"
      >
        <UIcon
          :name="tab.icon"
          class="size-4"
        />
        {{ tab.label }}
        <UBadge
          v-if="inventory"
          color="neutral"
          variant="subtle"
          size="md"
          class="ml-1"
        >
          {{
            tab.key === 'backpack' ? inventory.backpack.length
            : tab.key === 'storage' ? inventory.storage.length
              : inventory.trash.length
          }}
        </UBadge>
      </button>
    </div>

    <div class="flex-1 min-h-0 flex gap-4 px-6 py-4">
      <!-- Left: Current inventory items -->
      <div class="flex-1 min-h-0 min-w-0 overflow-y-auto">
        <div
          v-if="currentItems.length === 0"
          class="text-muted py-8 text-center"
        >
          No items in {{ activeTab }}.
        </div>

        <div
          v-else
          class="grid grid-cols-2 gap-3"
        >
          <div
            v-for="(item, idx) in currentItems"
            :key="idx"
            class="relative group p-3 rounded-lg border border-default hover:border-primary/50 transition-colors flex flex-col"
          >
            <!-- Delete button -->
            <button
              class="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-error/10 text-muted hover:text-error"
              title="Remove item"
              @click="onRemoveItem(idx)"
            >
              <UIcon
                name="i-lucide-x"
                class="size-3.5"
              />
            </button>

            <!-- Item name + rarity + shield -->
            <div class="flex items-center gap-2 pr-5">
              <span
                class="font-medium text-sm truncate"
                :title="item.name"
              >
                {{ getItemDisplayName(item.name) }}
              </span>
              <UBadge
                v-if="getItemEntry(item.name)?.cursed"
                variant="subtle"
                size="md"
                class="bg-purple-500/15 text-purple-400"
              >
                Cursed
              </UBadge>
              <UBadge
                v-if="getItemRarity(item.name)"
                color="primary"
                variant="subtle"
                size="md"
              >
                {{ getItemRarity(item.name) }}
              </UBadge>
              <span
                v-if="getItemEntry(item.name)?.shield"
                class="text-xs text-blue-400"
              >
                Shield {{ getItemEntry(item.name)!.shield }}
              </span>
            </div>

            <!-- Sub-name -->
            <div
              v-if="item.subName"
              class="text-xs text-muted truncate mt-0.5"
              :title="item.subName"
            >
              {{ item.subName }}
            </div>

            <!-- Stats -->
            <div
              v-if="getItemStats(item.name)"
              class="text-xs text-muted mt-1"
            >
              {{ getItemStats(item.name) }}
            </div>

            <!-- Description -->
            <div
              v-if="getItemEntry(item.name)?.desc"
              class="text-xs text-muted mt-1 line-clamp-2"
            >
              {{ getItemEntry(item.name)!.desc }}
            </div>

            <!-- Badges row -->
            <div class="flex items-center gap-1.5 mt-auto pt-2 flex-wrap">
              <UBadge
                v-if="item.field2 === 4"
                color="secondary"
                variant="subtle"
                size="md"
              >
                Equip
              </UBadge>
              <UBadge
                v-if="item.charges !== 0"
                color="neutral"
                variant="subtle"
                size="md"
              >
                {{ chargesDisplay(item.charges) }}
              </UBadge>
              <span class="text-[10px] text-muted font-mono ml-auto">#{{ item.seqId }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Right: Item browser -->
      <div
        v-if="showBrowser"
        class="flex-1 min-w-0 min-h-0 flex flex-col"
      >
        <div class="border border-default rounded-lg overflow-hidden flex flex-col min-h-0 flex-1">
          <!-- Header -->
          <div class="shrink-0 flex items-center justify-between px-3 py-2 border-b border-default bg-elevated">
            <span class="text-sm font-medium">Add to {{ activeTab }}</span>
            <UButton
              size="md"
              color="neutral"
              variant="ghost"
              icon="i-lucide-x"
              @click="showBrowser = false"
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
                v-for="f in CATEGORY_FILTERS"
                :key="f.key"
                class="px-2 py-0.5 text-xs rounded-md border transition-colors"
                :class="[
                  activeCategory === f.key
                    ? 'border-primary bg-primary/15 text-primary'
                    : 'border-default text-muted hover:text-default hover:border-default'
                ]"
                @click="toggleCategory(f.key)"
              >
                {{ f.label }}
              </button>
              <span class="text-muted text-xs px-1">|</span>
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
              @click="onAddItem(entry)"
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
                v-if="formatItemStats(entry)"
                class="text-xs text-muted mt-1"
              >
                {{ formatItemStats(entry) }}
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

      <!-- Placeholder when browser is closed -->
      <div
        v-else
        class="flex-1 flex items-center justify-center text-muted text-sm"
      >
        Click "Add Item" to browse items
      </div>
    </div>
  </div>
</template>
