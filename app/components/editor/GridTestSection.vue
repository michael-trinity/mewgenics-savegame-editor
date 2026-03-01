<script setup lang="ts">
import type { FurnitureItem } from '~/types/save'

const { saveState } = useSaveEditor()

const furniture = computed(() => saveState.value?.furniture ?? [])
const houseCats = computed(() => saveState.value?.houseCats ?? [])

// ── Load furniture piece dimensions ──

interface PieceInfo {
  width: number
  height: number
}

const pieceDB = ref<Map<string, PieceInfo>>(new Map())

onMounted(async () => {
  try {
    const res = await fetch('/data/furniture_info_decoded.json')
    const data = await res.json()
    const map = new Map<string, PieceInfo>()
    for (const p of data.pieces) {
      map.set(p.name, { width: p.width, height: p.height })
    }
    pieceDB.value = map
  } catch (e) {
    console.warn('Failed to load furniture_info_decoded.json:', e)
  }
})

function pieceSize(name: string): { w: number, h: number } {
  const p = pieceDB.value.get(name)
  return { w: p?.width ?? 1, h: p?.height ?? 1 }
}

// ── Room dimensions from house.gon ──

const ROOM_DIMS: Record<string, { w: number, h: number }> = {
  Floor1_Large: { w: 16, h: 7 },
  Floor1_Small: { w: 16, h: 7 },
  Floor2_Large: { w: 16, h: 7 },
  Floor2_Small: { w: 16, h: 7 },
  SmallAttic: { w: 18, h: 5 },
  LargeAttic: { w: 35, h: 9 },
  Basement0: { w: 33, h: 5 },
  Basement1: { w: 33, h: 5 },
  Basement2: { w: 33, h: 5 },
  Basement3: { w: 33, h: 5 },
  Basement4: { w: 33, h: 5 }
}

// ── Group furniture by room ──

const byRoom = computed(() => {
  const map = new Map<string, FurnitureItem[]>()
  for (const item of furniture.value) {
    const room = item.room || '(No Room)'
    if (!map.has(room)) map.set(room, [])
    map.get(room)!.push(item)
  }
  return map
})

const roomNames = computed(() => [...byRoom.value.keys()].sort())

// Coordinate stats per room
function roomStats(room: string) {
  const items = byRoom.value.get(room) ?? []
  if (items.length === 0) return null
  let minX = Infinity, maxX = -Infinity
  let minY = Infinity, maxY = -Infinity
  let minZ = Infinity, maxZ = -Infinity
  for (const item of items) {
    if (item.x < minX) minX = item.x
    if (item.x > maxX) maxX = item.x
    if (item.y < minY) minY = item.y
    if (item.y > maxY) maxY = item.y
    if (item.z < minZ) minZ = item.z
    if (item.z > maxZ) maxZ = item.z
  }
  return { minX, maxX, minY, maxY, minZ, maxZ, count: items.length }
}

// Active room
const activeRoom = ref('')
watch(roomNames, (names) => {
  if (names.length > 0 && !names.includes(activeRoom.value)) {
    activeRoom.value = names[0]!
  }
}, { immediate: true })

const activeItems = computed(() => byRoom.value.get(activeRoom.value) ?? [])
const activeStats = computed(() => roomStats(activeRoom.value))
const activeDims = computed(() => ROOM_DIMS[activeRoom.value] ?? null)

// Cats in active room
const activeCats = computed(() => {
  return houseCats.value.filter(c => c.room === activeRoom.value)
})

// Debug: how many items match piece DB
const matchStats = computed(() => {
  const items = activeItems.value
  let matched = 0
  let unmatched = 0
  const unmatchedNames: string[] = []
  for (const item of items) {
    if (pieceDB.value.has(item.name)) {
      matched++
    } else {
      unmatched++
      if (!unmatchedNames.includes(item.name)) unmatchedNames.push(item.name)
    }
  }
  return { matched, unmatched, unmatchedNames }
})

function formatRoomName(name: string): string {
  return name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
}

// ── Grid cell types ──

interface AnchorCell {
  type: 'anchor'
  name: string
  z: number
  colspan: number
  rowspan: number
}

interface CoveredCell {
  type: 'covered'
}

type GridCell = null | AnchorCell | CoveredCell

// ── Grid builder ──

function gridD(items: FurnitureItem[]) {
  if (items.length === 0) return { cells: [], width: 0, height: 0 }
  const stats = activeStats.value!
  const w = stats.maxX - stats.minX + 1
  const h = stats.maxY - stats.minY + 1
  return buildGrid(items, w, h, item => ({ col: item.x - stats.minX, row: item.y - stats.minY }))
}

function buildGrid(
  items: FurnitureItem[],
  width: number,
  height: number,
  mapFn: (item: FurnitureItem) => { col: number, row: number }
) {
  const cells: GridCell[][] = []
  for (let r = 0; r < height; r++) {
    cells[r] = []
    for (let c = 0; c < width; c++) {
      cells[r]![c] = null
    }
  }

  let outOfBounds = 0
  for (const item of items) {
    const { col, row } = mapFn(item)
    const size = pieceSize(item.name)
    const colspan = size.w
    const rowspan = size.h

    const anchorRow = row
    const anchorCol = col

    // Clamp spans to grid bounds
    const effColspan = Math.min(colspan, width - anchorCol)
    const effRowspan = Math.min(rowspan, height - anchorRow)

    if (anchorRow < 0 || anchorRow >= height || anchorCol < 0 || anchorCol >= width || effColspan <= 0 || effRowspan <= 0) {
      outOfBounds++
      continue
    }

    // Check if anchor cell is already occupied
    if (cells[anchorRow]![anchorCol] !== null) {
      // Overlap — skip this item (already placed item wins)
      continue
    }

    // Place anchor
    cells[anchorRow]![anchorCol] = {
      type: 'anchor',
      name: item.name,
      z: item.z,
      colspan: effColspan,
      rowspan: effRowspan
    }

    // Mark covered cells
    for (let dy = 0; dy < effRowspan; dy++) {
      for (let dx = 0; dx < effColspan; dx++) {
        if (dy === 0 && dx === 0) continue
        const r = anchorRow + dy
        const c = anchorCol + dx
        if (cells[r]![c] === null) {
          cells[r]![c] = { type: 'covered' }
        }
      }
    }
  }

  return { cells, width, height, outOfBounds }
}
</script>

<template>
  <div class="h-full overflow-y-auto p-6 space-y-6">
    <h1 class="text-2xl font-bold">
      Grid Coordinate Test
    </h1>

    <!-- Room selector -->
    <div class="flex flex-wrap gap-2">
      <button
        v-for="name in roomNames"
        :key="name"
        class="px-3 py-1.5 text-sm rounded-lg border transition-colors"
        :class="activeRoom === name
          ? 'border-primary bg-primary/15 text-primary'
          : 'border-default text-muted hover:text-default'"
        @click="activeRoom = name"
      >
        {{ formatRoomName(name) }}
      </button>
    </div>

    <!-- Stats -->
    <div
      v-if="activeStats"
      class="text-sm space-y-1"
    >
      <div class="font-mono text-muted">
        Room: <span class="text-default">{{ activeRoom }}</span>
        | Items: <span class="text-default">{{ activeStats.count }}</span>
        | Cats: <span class="text-default">{{ activeCats.length }}</span>
        | Piece DB: <span class="text-default">{{ pieceDB.size }} entries</span>
        | Matched: <span class="text-default">{{ matchStats.matched }}/{{ activeItems.length }}</span>
      </div>
      <div class="font-mono text-muted">
        X: <span class="text-default">{{ activeStats.minX }} .. {{ activeStats.maxX }}</span>
        | Y: <span class="text-default">{{ activeStats.minY }} .. {{ activeStats.maxY }}</span>
        | Z: <span class="text-default">{{ activeStats.minZ }} .. {{ activeStats.maxZ }}</span>
      </div>
      <div
        v-if="activeDims"
        class="font-mono text-muted"
      >
        Room dims (house.gon): <span class="text-default">{{ activeDims.w }} × {{ activeDims.h }}</span>
      </div>
      <div
        v-else
        class="font-mono text-amber-400"
      >
        Room "{{ activeRoom }}" not in house.gon
      </div>
      <div
        v-if="matchStats.unmatched > 0"
        class="font-mono text-amber-400"
      >
        {{ matchStats.unmatched }} items not in piece DB: {{ matchStats.unmatchedNames.slice(0, 5).join(', ') }}
      </div>
    </div>

    <!-- Cat positions -->
    <div
      v-if="activeCats.length > 0"
      class="text-sm"
    >
      <div class="font-mono text-muted mb-1">
        Cat positions (f64):
      </div>
      <div
        v-for="cat in activeCats"
        :key="cat.key"
        class="font-mono text-xs text-muted"
      >
        Cat #{{ cat.key }}: ({{ cat.p0.toFixed(2) }}, {{ cat.p1.toFixed(2) }}, {{ cat.p2.toFixed(2) }})
      </div>
    </div>

    <!-- Raw coordinate list -->
    <details class="text-sm">
      <summary class="cursor-pointer text-muted hover:text-default">
        Raw furniture coordinates ({{ activeItems.length }} items)
      </summary>
      <div class="mt-2 max-h-48 overflow-y-auto font-mono text-xs space-y-0.5">
        <div
          v-for="item in activeItems"
          :key="item.key"
          class="text-muted"
        >
          {{ item.name }} [{{ pieceSize(item.name).w }}×{{ pieceSize(item.name).h }}]: x={{ item.x }}, y={{ item.y }}, z={{ item.z }}
        </div>
      </div>
    </details>

    <!-- Grid -->
    <GridView :grid="gridD(activeItems)" />
  </div>
</template>
