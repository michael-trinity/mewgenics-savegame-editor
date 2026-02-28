<script setup lang="ts">
import type { FurnitureItem, HouseCatEntry } from '~/types/save'

const { saveState } = useSaveEditor()

const furniture = computed(() => saveState.value?.furniture ?? [])

const rooms = computed(() => {
  const roomMap = new Map<string, FurnitureItem[]>()
  for (const item of furniture.value) {
    const room = item.room || '(No Room)'
    if (!roomMap.has(room)) roomMap.set(room, [])
    roomMap.get(room)!.push(item)
  }
  return [...roomMap.entries()].sort(([a], [b]) => a.localeCompare(b))
})

const houseCats = computed(() => saveState.value?.houseCats ?? [])

const catsByRoom = computed(() => {
  const map = new Map<string, HouseCatEntry[]>()
  for (const entry of houseCats.value) {
    if (!map.has(entry.room)) map.set(entry.room, [])
    map.get(entry.room)!.push(entry)
  }
  return map
})

const cats = computed(() => saveState.value?.cats ?? [])

function catName(key: number): string {
  const cat = cats.value.find(c => c.key === key)
  return cat?.name ?? `Cat #${key}`
}

function formatFurnitureName(name: string): string {
  return name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
}
</script>

<template>
  <div class="h-full overflow-y-auto p-6 max-w-5xl mx-auto">
    <h2 class="text-xl font-bold mb-4">
      Housing
    </h2>

    <!-- Cat Placements -->
    <div
      v-if="houseCats.length > 0"
      class="mb-8"
    >
      <h3 class="text-lg font-semibold mb-3">
        Cat Placements ({{ houseCats.length }})
      </h3>
      <div class="space-y-4">
        <div
          v-for="[room, entries] in catsByRoom"
          :key="room"
        >
          <h4 class="text-sm font-medium text-muted uppercase tracking-wider mb-2">
            {{ room }}
          </h4>
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            <div
              v-for="entry in entries"
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
      </div>
    </div>

    <!-- Furniture by Room -->
    <h3 class="text-lg font-semibold mb-3">
      Furniture ({{ furniture.length }} items)
    </h3>

    <div class="space-y-6">
      <div
        v-for="[room, items] in rooms"
        :key="room"
      >
        <h4 class="text-sm font-medium text-muted uppercase tracking-wider mb-2">
          {{ room }} ({{ items.length }})
        </h4>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          <div
            v-for="item in items"
            :key="item.key"
            class="p-3 rounded-lg border border-default text-sm"
          >
            <div class="font-medium">
              {{ formatFurnitureName(item.name) }}
            </div>
            <div class="text-xs text-muted mt-1">
              Position: ({{ item.x }}, {{ item.y }}) z={{ item.z }}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
