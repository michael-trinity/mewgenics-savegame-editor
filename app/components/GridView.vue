<script setup lang="ts">
export interface GridItem {
  name: string
  x: number // column (left = 0)
  y: number // row from bottom (bottom = 0)
  z: number
  sprite?: string // path to sprite image e.g. "sprites/DefineSprite_.../1.png"
}

const props = defineProps<{
  items: GridItem[]
  gridWidth: number
  gridHeight: number
  cellSize?: number
}>()

const cs = computed(() => props.cellSize ?? 28)

// Sprite pixel-to-cell ratio: ~28px per cell in sprite space
const SPRITE_PX_PER_CELL = 28

// Sort items by z for proper layering (lower z = further back)
const sortedItems = computed(() =>
  [...props.items].sort((a, b) => a.z - b.z)
)

// Color palette for items without sprites
const PALETTE = [
  'rgba(59,130,246,0.5)',
  'rgba(168,85,247,0.5)',
  'rgba(236,72,153,0.5)',
  'rgba(34,197,94,0.5)',
  'rgba(245,158,11,0.5)',
  'rgba(6,182,212,0.5)',
  'rgba(239,68,68,0.5)',
  'rgba(132,204,22,0.5)',
  'rgba(251,146,60,0.5)',
  'rgba(99,102,241,0.5)'
]

function nameHash(name: string): number {
  let h = 0
  for (let i = 0; i < name.length; i++) {
    h = ((h << 5) - h + name.charCodeAt(i)) | 0
  }
  return Math.abs(h)
}

function itemColor(name: string): string {
  return PALETTE[nameHash(name) % PALETTE.length]!
}

function formatName(name: string): string {
  return name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
}
</script>

<template>
  <div
    v-if="gridWidth > 0 && gridHeight > 0"
    class="relative overflow-hidden"
    :style="{
      width: cs * gridWidth + 'px',
      height: cs * gridHeight + 'px'
    }"
  >
    <!-- Grid background -->
    <div
      class="absolute inset-0"
      :style="{
        backgroundImage: `
          linear-gradient(to right, var(--ui-border-muted) 1px, transparent 1px),
          linear-gradient(to bottom, var(--ui-border-muted) 1px, transparent 1px)
        `,
        backgroundSize: cs + 'px ' + cs + 'px',
        opacity: 0.3
      }"
    />

    <!-- Furniture items -->
    <template
      v-for="(item, i) in sortedItems"
      :key="i"
    >
      <!-- Sprite image -->
      <img
        v-if="item.sprite"
        :src="'/' + item.sprite"
        :alt="item.name"
        :title="formatName(item.name) + ' (z=' + item.z + ')'"
        class="absolute pointer-events-auto"
        :style="{
          left: item.x * cs + 'px',
          bottom: item.y * cs + 'px',
          zIndex: item.z,
          maxWidth: 'none',
          transformOrigin: 'bottom left',
          transform: 'scale(' + (cs / SPRITE_PX_PER_CELL) + ')'
        }"
      >
      <!-- Fallback colored square -->
      <div
        v-else
        :title="formatName(item.name) + ' (z=' + item.z + ')'"
        class="absolute rounded-sm"
        :style="{
          left: item.x * cs + 'px',
          bottom: item.y * cs + 'px',
          width: cs + 'px',
          height: cs + 'px',
          zIndex: item.z,
          background: itemColor(item.name)
        }"
      />
    </template>
  </div>
  <div
    v-else
    class="text-sm text-muted"
  >
    Empty room
  </div>
</template>
