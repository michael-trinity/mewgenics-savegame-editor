<script setup lang="ts">
import type { FurnitureItem } from '~/types/save'
import type { GridItem } from '~/components/GridView.vue'

const { saveState } = useSaveEditor()

const furniture = computed(() => saveState.value?.furniture ?? [])
const houseCats = computed(() => saveState.value?.houseCats ?? [])

// ── Load sprite paths from furniture.json ──

const spriteDB = ref<Map<string, string>>(new Map())

onMounted(async () => {
  try {
    const res = await fetch('/data/furniture.json')
    const data = await res.json()
    const map = new Map<string, string>()
    for (const f of data.furniture) {
      if (f.sprite_path) {
        map.set(f.name, f.sprite_path + '/1.png')
      }
    }
    spriteDB.value = map
  } catch (e) {
    console.warn('Failed to load furniture.json:', e)
  }
})

// ── Room dimensions ──

const FLOOR_DIMS = { w: 16, h: 7 }
const BASEMENT_DIMS = { w: 33, h: 5 }
const SMALL_ATTIC_DIMS = { w: 18, h: 5 }
const LARGE_ATTIC_DIMS = { w: 35, h: 9 }

// ── Group furniture by room ──

const byRoom = computed(() => {
  const map = new Map<string, FurnitureItem[]>()
  for (const item of furniture.value) {
    if (!item.room) continue
    if (!map.has(item.room)) map.set(item.room, [])
    map.get(item.room)!.push(item as FurnitureItem)
  }
  return map
})

const roomNames = computed(() => [...byRoom.value.keys()].sort())

// ── House layout detection ──

interface HouseLayout {
  type: string
  attic: string | null
  floors: string[][]
  basements: string[]
}

const houseLayout = computed<HouseLayout>(() => {
  const names = roomNames.value

  const hasFloor2 = names.some(n => n.startsWith('Floor2_'))
  const hasBasement = names.some(n => n.startsWith('Basement'))
  const floorCount = names.filter(n => n.startsWith('Floor')).length

  let type = 'House 1'
  if (hasFloor2 || floorCount >= 3 || hasBasement) type = 'House 3'
  else if (floorCount >= 2) type = 'House 2'

  const attic: string | null = 'Attic'
  const floorRows: string[][] = []
  const basements: string[] = []

  // Floor2 = upper floor (below attic), Floor1 = lower floor
  if (type === 'House 1') {
    floorRows.push(['Floor1_Large'])
  } else if (type === 'House 2') {
    floorRows.push(['Floor1_Small', 'Floor1_Large'])
  } else {
    floorRows.push(['Floor2_Small', 'Floor2_Large'])
    floorRows.push(['Floor1_Small', 'Floor1_Large'])
    for (const n of names) {
      if (n.startsWith('Basement')) basements.push(n)
    }
    basements.sort()
  }

  return { type, attic, floors: floorRows, basements }
})

function roomDims(roomName: string): { w: number, h: number } | null {
  if (roomName === 'Attic') {
    return houseLayout.value.type === 'House 1' ? SMALL_ATTIC_DIMS : LARGE_ATTIC_DIMS
  }
  if (roomName.startsWith('Floor')) return FLOOR_DIMS
  if (roomName.startsWith('Basement')) return BASEMENT_DIMS
  return null
}

// ── Build GridItem[] for a room ──

function roomGridItems(roomName: string): { items: GridItem[], width: number, height: number } {
  const items = byRoom.value.get(roomName) ?? []
  const dims = roomDims(roomName)

  if (items.length === 0) {
    return {
      items: [],
      width: dims?.w ?? 0,
      height: dims?.h ?? 0
    }
  }

  // Find coordinate bounds to offset into grid space
  let minX = Infinity, maxX = -Infinity
  let minY = Infinity, maxY = -Infinity
  for (const item of items) {
    if (item.x < minX) minX = item.x
    if (item.x > maxX) maxX = item.x
    if (item.y < minY) minY = item.y
    if (item.y > maxY) maxY = item.y
  }

  const rangeW = maxX - minX + 1
  const rangeH = maxY - minY + 1
  const w = dims ? Math.max(dims.w, rangeW) : rangeW
  const h = dims ? Math.max(dims.h, rangeH) : rangeH

  const gridItems: GridItem[] = items.map((item) => {
    const sprite = spriteDB.value.get(item.name)
    if (!sprite && spriteDB.value.size > 0) {
      console.warn(`[GridTest] Missing sprite for furniture: "${item.name}"`)
    }
    return {
      name: item.name,
      x: item.x - minX,
      y: item.y - minY,
      z: item.z,
      sprite
    }
  })

  return { items: gridItems, width: w, height: h }
}

// ── Helpers ──

function roomItemCount(room: string): number {
  return (byRoom.value.get(room) ?? []).length
}

function roomCatCount(room: string): number {
  return houseCats.value.filter(c => c.room === room).length
}

function formatRoomName(name: string): string {
  return name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
}

const totalItems = computed(() => furniture.value.length)
const totalCats = computed(() => houseCats.value.length)
</script>

<template>
  <div class="h-full overflow-y-auto p-6 space-y-6">
    <div class="flex items-center gap-4">
      <h1 class="text-2xl font-bold">
        House Layout
      </h1>
      <span class="text-sm text-muted">
        {{ houseLayout.type }} — {{ totalItems }} items, {{ totalCats }} cats
      </span>
    </div>

    <!-- House layout -->
    <div class="space-y-1 inline-block">
      <!-- Attic -->
      <div
        v-if="houseLayout.attic"
        class="flex justify-center"
      >
        <div>
          <div class="text-xs text-muted mb-1 text-center">
            {{ formatRoomName(houseLayout.attic) }}
            <span class="text-default ml-1">{{ roomItemCount(houseLayout.attic) }} items</span>
            <span
              v-if="roomCatCount(houseLayout.attic) > 0"
              class="ml-1"
            >{{ roomCatCount(houseLayout.attic) }} cats</span>
          </div>
          <div class="border border-default rounded-t-xl bg-elevated/30 p-1">
            <GridView
              :items="roomGridItems(houseLayout.attic).items"
              :grid-width="roomGridItems(houseLayout.attic).width"
              :grid-height="roomGridItems(houseLayout.attic).height"
              :cell-size="28"
            />
          </div>
        </div>
      </div>

      <!-- Floor rows -->
      <div
        v-for="(floorRow, fi) in houseLayout.floors"
        :key="fi"
        class="flex justify-center gap-px"
      >
        <div
          v-for="room in floorRow"
          :key="room"
        >
          <div class="text-xs text-muted mb-1 text-center">
            {{ formatRoomName(room) }}
            <span class="text-default ml-1">{{ roomItemCount(room) }} items</span>
            <span
              v-if="roomCatCount(room) > 0"
              class="ml-1"
            >{{ roomCatCount(room) }} cats</span>
          </div>
          <div class="border border-default bg-elevated/30 p-1">
            <GridView
              :items="roomGridItems(room).items"
              :grid-width="roomGridItems(room).width"
              :grid-height="roomGridItems(room).height"
              :cell-size="28"
            />
          </div>
        </div>
      </div>

      <!-- Basements -->
      <div
        v-if="houseLayout.basements.length > 0"
        class="space-y-px"
      >
        <div
          v-for="basement in houseLayout.basements"
          :key="basement"
        >
          <div class="text-xs text-muted mb-1 text-center">
            {{ formatRoomName(basement) }}
            <span class="text-default ml-1">{{ roomItemCount(basement) }} items</span>
            <span
              v-if="roomCatCount(basement) > 0"
              class="ml-1"
            >{{ roomCatCount(basement) }} cats</span>
          </div>
          <div class="border border-default rounded-b-lg bg-elevated/30 p-1">
            <GridView
              :items="roomGridItems(basement).items"
              :grid-width="roomGridItems(basement).width"
              :grid-height="roomGridItems(basement).height"
              :cell-size="28"
            />
          </div>
        </div>
      </div>

      <!-- Rooms not in any layout section -->
      <div
        v-for="room in roomNames.filter(n => n !== 'Attic' && !n.startsWith('Floor') && !n.startsWith('Basement'))"
        :key="room"
      >
        <div class="text-xs text-muted mb-1 text-center">
          {{ formatRoomName(room) }}
          <span class="text-default ml-1">{{ roomItemCount(room) }} items</span>
        </div>
        <div class="border border-default rounded-lg bg-elevated/30 p-1">
          <GridView
            :items="roomGridItems(room).items"
            :grid-width="roomGridItems(room).width"
            :grid-height="roomGridItems(room).height"
            :cell-size="28"
          />
        </div>
      </div>
    </div>
  </div>
</template>
