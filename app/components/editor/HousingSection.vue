<script setup lang="ts">
import type { FurnitureItem } from '~/types/save'
import type { FurnitureEntry } from '~/types/database'
import { formatFurnitureEffects } from '~/types/database'

const { saveState, addFurniture, removeFurniture, nextFurnitureKey } = useSaveEditor()
const { furnitureDB } = useGameData()

// ── Data ──

const furniture = computed(() => saveState.value?.furniture ?? [])
const houseCats = computed(() => saveState.value?.houseCats ?? [])
const cats = computed(() => saveState.value?.cats ?? [])

// ── Room names (union of furniture rooms + cat placement rooms) ──

const roomNames = computed(() => {
  const names = new Set<string>()
  for (const item of furniture.value) {
    names.add(item.room || '(No Room)')
  }
  for (const entry of houseCats.value) {
    names.add(entry.room)
  }
  return [...names].sort()
})

// ── Tabs: one per room ──

const subTabs = computed(() => {
  return roomNames.value.map(name => ({
    key: `room:${name}`,
    label: formatRoomName(name),
    icon: 'i-lucide-door-open'
  }))
})

const activeTab = ref('')

// Auto-select first tab when rooms load
watch(subTabs, (tabs) => {
  if (tabs.length > 0 && !tabs.some(t => t.key === activeTab.value)) {
    activeTab.value = tabs[0]!.key
  }
}, { immediate: true })

const activeRoom = computed(() => {
  if (!activeTab.value.startsWith('room:')) return null
  return activeTab.value.slice(5) // strip "room:" prefix
})

// ── Per-room data ──

const roomFurniture = computed(() => {
  if (!activeRoom.value) return []
  return furniture.value.filter((f) => {
    const room = f.room || '(No Room)'
    return room === activeRoom.value
  })
})

const roomCats = computed(() => {
  if (!activeRoom.value) return []
  return houseCats.value.filter(c => c.room === activeRoom.value)
})

// ── Helpers ──

function formatRoomName(name: string): string {
  return name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
}

function catName(key: number): string {
  return cats.value.find(c => c.key === key)?.name ?? `Cat #${key}`
}

function lookupFurniture(name: string): FurnitureEntry | null {
  return furnitureDB.value?.get(name) ?? null
}

function displayName(item: FurnitureItem): string {
  return lookupFurniture(item.name)?.name ?? formatRoomName(item.name)
}

// ── Furniture browser ──

const browseOpen = ref(false)
const searchQuery = ref('')
const activeEffectFilters = ref<Set<string>>(new Set())
const activeSetFilter = ref<string | null>(null)

const EFFECT_FILTERS = [
  { key: 'Comfort', label: 'Comfort' },
  { key: 'Health', label: 'Health' },
  { key: 'Appeal', label: 'Appeal' },
  { key: 'Stimulation', label: 'Stimulation' },
  { key: 'FoodStorage', label: 'Food' },
  { key: 'Evolution', label: 'Evolution' },
  { key: 'FightBonusRewards', label: 'Rewards' },
  { key: 'FightRisk', label: 'Risk' }
] as const

const furnitureSets = computed(() => {
  if (!furnitureDB.value) return []
  const sets = new Set<string>()
  for (const entry of furnitureDB.value.values()) {
    if (entry.set) sets.add(entry.set)
  }
  return [...sets].sort()
})

const filteredFurniture = computed((): FurnitureEntry[] => {
  if (!furnitureDB.value) return []

  let entries = [...furnitureDB.value.values()].filter(e => !e.removed)

  if (activeSetFilter.value) {
    entries = entries.filter(e => e.set === activeSetFilter.value)
  }

  if (activeEffectFilters.value.size > 0) {
    entries = entries.filter((e) => {
      for (const key of activeEffectFilters.value) {
        const v = e.effects[key]
        if (!v || v <= 0) return false
      }
      return true
    })
  }

  const q = searchQuery.value.toLowerCase()
  if (q) {
    entries = entries.filter(e =>
      e.name.toLowerCase().includes(q)
      || e.id.toLowerCase().includes(q)
      || e.desc.toLowerCase().includes(q)
    )
  }

  return entries.sort((a, b) => a.name.localeCompare(b.name))
})

function openBrowser() {
  browseOpen.value = true
  searchQuery.value = ''
  activeEffectFilters.value = new Set()
  activeSetFilter.value = null
}

function closeBrowser() {
  browseOpen.value = false
}

function toggleEffectFilter(key: string) {
  const s = new Set(activeEffectFilters.value)
  if (s.has(key)) s.delete(key)
  else s.add(key)
  activeEffectFilters.value = s
}

function addFurnitureItem(entry: FurnitureEntry) {
  const item: FurnitureItem = {
    key: nextFurnitureKey(),
    name: entry.id,
    unkU64: 0n,
    room: activeRoom.value ?? 'living_room',
    x: 0,
    y: 0,
    z: 0,
    flag1: 0,
    flag2: 0
  }
  addFurniture(item)
}

function deleteFurniture(key: number) {
  removeFurniture(key)
}
</script>

<template>
  <div class="h-full flex flex-col">
    <!-- Sub-tab bar -->
    <div class="shrink-0 flex gap-1 border-b border-default px-6 pt-2 overflow-x-auto">
      <button
        v-for="tab in subTabs"
        :key="tab.key"
        class="flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap"
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
      </button>
    </div>

    <!-- Tab content -->
    <div class="flex-1 min-h-0 overflow-hidden">
      <!-- Room tab: furniture + cats for that room -->
      <div
        v-if="activeRoom"
        class="h-full p-6"
      >
        <div class="flex gap-4 h-full">
          <!-- Left: room contents -->
          <div class="flex-1 min-w-0 overflow-y-auto min-h-0">
            <!-- Cats in this room -->
            <div
              v-if="roomCats.length > 0"
              class="mb-6"
            >
              <h3 class="text-sm font-semibold mb-2 uppercase tracking-wider text-muted">
                Cats ({{ roomCats.length }})
              </h3>
              <div class="space-y-1">
                <div
                  v-for="entry in roomCats"
                  :key="entry.key"
                  class="p-2 rounded-lg border border-default text-sm"
                >
                  <span class="font-medium">{{ catName(entry.key) }}</span>
                  <span class="text-xs text-muted ml-2">
                    ({{ entry.p0.toFixed(0) }}, {{ entry.p1.toFixed(0) }})
                  </span>
                </div>
              </div>
            </div>

            <!-- Furniture in this room -->
            <div class="flex items-center gap-2 mb-3">
              <h3 class="text-sm font-semibold uppercase tracking-wider text-muted">
                Furniture ({{ roomFurniture.length }})
              </h3>
              <UButton
                size="sm"
                color="primary"
                variant="soft"
                icon="i-lucide-plus"
                class="ml-auto"
                @click="openBrowser"
              >
                Add
              </UButton>
            </div>

            <div class="space-y-1">
              <div
                v-for="item in roomFurniture"
                :key="item.key"
                class="p-3 rounded-lg border border-default text-sm"
              >
                <div class="flex items-center gap-2">
                  <span class="font-medium truncate">{{ displayName(item) }}</span>
                  <UButton
                    size="md"
                    color="error"
                    variant="ghost"
                    icon="i-lucide-trash-2"
                    class="ml-auto shrink-0"
                    title="Delete furniture"
                    @click="deleteFurniture(item.key)"
                  />
                </div>
                <div
                  v-if="lookupFurniture(item.name)?.set || lookupFurniture(item.name)?.special"
                  class="flex items-center gap-1.5 mt-0.5"
                >
                  <UBadge
                    v-if="lookupFurniture(item.name)?.set"
                    color="primary"
                    variant="subtle"
                    size="md"
                  >
                    {{ lookupFurniture(item.name)!.set }}
                  </UBadge>
                  <UBadge
                    v-if="lookupFurniture(item.name)?.special"
                    color="warning"
                    variant="subtle"
                    size="md"
                  >
                    special
                  </UBadge>
                </div>
                <div
                  v-if="lookupFurniture(item.name) && formatFurnitureEffects(lookupFurniture(item.name)!)"
                  class="text-xs text-sky-400 mt-0.5"
                >
                  {{ formatFurnitureEffects(lookupFurniture(item.name)!) }}
                </div>
                <div class="text-xs text-muted mt-0.5">
                  Position: ({{ item.x }}, {{ item.y }}) z={{ item.z }}
                </div>
              </div>
              <div
                v-if="roomFurniture.length === 0"
                class="text-sm text-muted italic"
              >
                No furniture in this room
              </div>
            </div>
          </div>

          <!-- Right: furniture browser -->
          <div
            v-if="browseOpen"
            class="flex-1 min-w-0 min-h-0 flex flex-col"
          >
            <div class="border border-default rounded-lg overflow-hidden flex flex-col min-h-0 flex-1">
              <div class="shrink-0 flex items-center justify-between px-3 py-2 border-b border-default bg-elevated">
                <span class="text-sm font-medium">Add to {{ formatRoomName(activeRoom) }}</span>
                <UButton
                  size="md"
                  color="neutral"
                  variant="ghost"
                  icon="i-lucide-x"
                  @click="closeBrowser"
                />
              </div>

              <div class="shrink-0 p-3 border-b border-default space-y-2">
                <UInput
                  v-model="searchQuery"
                  icon="i-lucide-search"
                  placeholder="Search furniture..."
                  size="sm"
                  class="w-full"
                />
                <div class="flex flex-wrap gap-1.5">
                  <button
                    class="px-2 py-0.5 text-xs rounded-md border transition-colors"
                    :class="activeSetFilter === null
                      ? 'border-primary bg-primary/15 text-primary'
                      : 'border-default text-muted hover:text-default hover:border-muted'"
                    @click="activeSetFilter = null"
                  >
                    All sets
                  </button>
                  <button
                    v-for="s in furnitureSets"
                    :key="s"
                    class="px-2 py-0.5 text-xs rounded-md border transition-colors"
                    :class="activeSetFilter === s
                      ? 'border-primary bg-primary/15 text-primary'
                      : 'border-default text-muted hover:text-default hover:border-muted'"
                    @click="activeSetFilter = activeSetFilter === s ? null : s"
                  >
                    {{ s }}
                  </button>
                </div>
                <div class="flex flex-wrap gap-1.5">
                  <button
                    v-for="f in EFFECT_FILTERS"
                    :key="f.key"
                    class="px-2 py-0.5 text-xs rounded-md border transition-colors"
                    :class="activeEffectFilters.has(f.key)
                      ? 'border-primary bg-primary/15 text-primary'
                      : 'border-default text-muted hover:text-default hover:border-muted'"
                    @click="toggleEffectFilter(f.key)"
                  >
                    {{ f.label }}
                  </button>
                </div>
              </div>

              <div class="flex-1 min-h-0 overflow-y-auto p-2 space-y-1">
                <div
                  v-if="filteredFurniture.length === 0"
                  class="px-3 py-6 text-center text-sm text-muted"
                >
                  No furniture matches
                </div>
                <div
                  v-for="entry in filteredFurniture"
                  :key="entry.id"
                  class="p-3 rounded-lg border border-default hover:border-primary/50 cursor-pointer transition-colors"
                  @click="addFurnitureItem(entry)"
                >
                  <div class="font-medium text-sm">
                    {{ entry.name }}
                  </div>
                  <div
                    v-if="entry.set || entry.special"
                    class="flex items-center gap-1.5 mt-0.5"
                  >
                    <UBadge
                      v-if="entry.set"
                      color="primary"
                      variant="subtle"
                      size="md"
                    >
                      {{ entry.set }}
                    </UBadge>
                    <UBadge
                      v-if="entry.special"
                      color="warning"
                      variant="subtle"
                      size="md"
                    >
                      special
                    </UBadge>
                  </div>
                  <div
                    v-if="formatFurnitureEffects(entry)"
                    class="text-xs text-sky-400 mt-0.5"
                  >
                    {{ formatFurnitureEffects(entry) }}
                  </div>
                  <div
                    v-if="entry.desc"
                    class="text-xs text-muted mt-0.5 line-clamp-2"
                  >
                    {{ entry.desc }}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div
            v-else
            class="flex-1 flex items-center justify-center text-muted text-sm"
          >
            Click "Add" to browse furniture
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
