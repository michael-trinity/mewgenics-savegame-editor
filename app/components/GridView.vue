<script setup lang="ts">
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

defineProps<{
  grid: {
    cells: GridCell[][]
    width: number
    height: number
    outOfBounds?: number
  }
}>()

function shortName(name: string): string {
  return name
    .replace(/_/g, ' ')
    .replace(/\b\w/g, l => l.toUpperCase())
    .slice(0, 14)
}

function cellColor(cell: AnchorCell): string {
  if (cell.colspan > 2 || cell.rowspan > 2) return 'bg-primary/25 border-primary/50'
  if (cell.colspan > 1 || cell.rowspan > 1) return 'bg-primary/20 border-primary/40'
  return 'bg-primary/15 border-primary/30'
}

function isAnchor(cell: GridCell): cell is AnchorCell {
  return cell !== null && cell.type === 'anchor'
}

function isCovered(cell: GridCell): cell is CoveredCell {
  return cell !== null && cell.type === 'covered'
}
</script>

<template>
  <div>
    <div
      v-if="grid.outOfBounds"
      class="text-xs text-amber-400 mb-1"
    >
      {{ grid.outOfBounds }} items out of bounds
    </div>
    <div
      v-if="grid.width === 0"
      class="text-sm text-muted"
    >
      No items
    </div>
    <div v-else>
      <table class="w-full table-fixed border-collapse text-[9px] font-mono">
        <thead>
          <tr>
            <th class="text-muted text-right pr-1 w-6" />
            <th
              v-for="c in grid.width"
              :key="c"
              class="text-center text-muted"
            >
              {{ c - 1 }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(row, r) in grid.cells"
            :key="r"
          >
            <td class="text-muted text-right pr-1 w-6">
              {{ r }}
            </td>
            <template
              v-for="(cell, c) in row"
              :key="c"
            >
              <!-- Skip covered cells (consumed by a spanning cell) -->
              <td
                v-if="isAnchor(cell)"
                :colspan="cell.colspan"
                :rowspan="cell.rowspan"
                class="border border-primary/40 p-0.5 text-center align-middle truncate"
                :class="cellColor(cell)"
                :title="`${cell.name} (z=${cell.z}, ${cell.colspan}×${cell.rowspan})`"
              >
                {{ shortName(cell.name) }}
              </td>
              <td
                v-else-if="!isCovered(cell)"
                class="border border-default/20 p-0.5"
              />
            </template>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
