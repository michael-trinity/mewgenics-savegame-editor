<script setup lang="ts">
import type { ParsedCat, MutationSlot } from '~/types/save'
import type { SearchOption } from '~/components/editor/SearchSelect.vue'
import type { MutationEntry } from '~/types/database'
import { MUT_PAIRS } from '~/types/save'
import { patchMutCoat, patchMutSlot } from '~/utils/patch/mutations'
import { parseMutationTable } from '~/utils/parse/mutations'
import { formatMutationStats } from '~/types/database'

const props = defineProps<{
  cat: ParsedCat
}>()

const { updateCat } = useSaveEditor()
const { mutationsDB } = useGameData()

const editingSlotIdx = ref<number | null>(null)
const editValue = ref('')
const editCoat = ref(false)

// ── Helpers ──

function getEntry(category: string, id: number): MutationEntry | null {
  if (!mutationsDB.value || id === 0) return null
  return mutationsDB.value.byCategory.get(category)?.get(String(id)) ?? null
}

function getDisplayName(category: string, id: number): string {
  if (id === 0) return 'None'
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

// ── Build SearchOption arrays from mutationsDB by category ──

function buildOptions(category: string): SearchOption[] {
  const db = mutationsDB.value
  if (!db) return [{ id: '0', label: 'None (Default)' }]

  const catMap = db.byCategory.get(category)
  const opts: SearchOption[] = [{ id: '0', label: 'None (Default)' }]

  if (catMap) {
    for (const [id, entry] of [...catMap.entries()].sort((a, b) => Number(a[0]) - Number(b[0]))) {
      if (id === '0') continue
      const statsStr = formatMutationStats(entry)
      opts.push({
        id,
        label: entry.name || entry.tag || `Mutation ${id}`,
        description: entry.descResolved ?? entry.desc ?? undefined,
        badge: entry.tag ?? undefined,
        stats: statsStr || undefined,
      })
    }
  }

  return opts
}

const optionsByCategory = computed(() => {
  const map = new Map<string, SearchOption[]>()
  const categories = ['body', 'head', 'tail', 'mouth', 'legs', 'eyes', 'eyebrows', 'ears', 'texture']
  for (const cat of categories) {
    map.set(cat, buildOptions(cat))
  }
  return map
})

function getOptions(category: string): SearchOption[] {
  return optionsByCategory.value.get(category) ?? []
}

// ── Coat editing ──

function startEditCoat() {
  editCoat.value = true
  editingSlotIdx.value = null
  editValue.value = String(props.cat.mutations.coatId ?? 0)
}

function cancelEdit() {
  editingSlotIdx.value = null
  editCoat.value = false
}

function applyCoatEdit() {
  if (props.cat.mutations.baseOffset === null || props.cat.mutations.coatId === null) return
  const newBlob = patchMutCoat(
    props.cat.decompressedBlob,
    props.cat.mutations.baseOffset,
    props.cat.mutations.coatId,
    Number(editValue.value)
  )
  const mutations = parseMutationTable(newBlob)
  updateCat(props.cat.key, { decompressedBlob: newBlob, mutations })
  editCoat.value = false
}

// ── Slot editing ──

function startEditSlot(slotIdx: number, currentId: number) {
  editingSlotIdx.value = slotIdx
  editValue.value = String(currentId)
  editCoat.value = false
}

function applySlotEdit() {
  if (editingSlotIdx.value === null || props.cat.mutations.baseOffset === null) return
  const newBlob = patchMutSlot(
    props.cat.decompressedBlob,
    props.cat.mutations.baseOffset,
    editingSlotIdx.value,
    Number(editValue.value)
  )
  const mutations = parseMutationTable(newBlob)
  updateCat(props.cat.key, { decompressedBlob: newBlob, mutations })
  editingSlotIdx.value = null
}

function mirrorSlot(slotIdx: number) {
  const pair = MUT_PAIRS[slotIdx]
  if (!pair || props.cat.mutations.baseOffset === null) return

  const sourceSlot = props.cat.mutations.slots.find(s => s.slotIndex === slotIdx)
  if (!sourceSlot) return

  const newBlob = patchMutSlot(
    props.cat.decompressedBlob,
    props.cat.mutations.baseOffset,
    pair,
    sourceSlot.slotId
  )
  const mutations = parseMutationTable(newBlob)
  updateCat(props.cat.key, { decompressedBlob: newBlob, mutations })
}

// ── Slot grouping ──

const singleSlots = computed(() => {
  const slots = props.cat.mutations.slots
  const indices = [1, 2, 3, 14] // Body, Head, Tail, Mouth
  return indices
    .map(idx => slots.find(s => s.slotIndex === idx))
    .filter((s): s is MutationSlot => !!s)
})

const pairedGroups = computed(() => {
  const slots = props.cat.mutations.slots
  const pairs: { label: string, left: MutationSlot, right: MutationSlot }[] = []
  const pairSets: [number, number][] = [[4, 5], [6, 7], [8, 9], [10, 11], [12, 13]]

  for (const [l, r] of pairSets) {
    const ls = slots.find(s => s.slotIndex === l)
    const rs = slots.find(s => s.slotIndex === r)
    if (ls && rs) {
      pairs.push({
        label: ls.label.replace(/_[LR]$/, ''),
        left: ls,
        right: rs,
      })
    }
  }

  return pairs
})
</script>

<template>
  <div class="h-full overflow-y-auto p-6">
    <div v-if="!cat.mutations.baseOffset" class="text-muted">
      Mutation data not found for this cat.
    </div>

    <div v-else class="space-y-3 max-w-2xl">
      <!-- Coat card -->
      <div class="p-4 rounded-lg border border-default">
        <div class="text-xs text-muted uppercase tracking-wider mb-2">Coat / Texture</div>

        <!-- Editing mode -->
        <div v-if="editCoat" class="space-y-2">
          <EditorSearchSelect
            :model-value="editValue"
            :options="getOptions('texture')"
            placeholder="Search coat..."
            @update:model-value="editValue = $event"
          />
          <div class="flex items-center gap-1 justify-end">
            <UButton size="md" color="primary" icon="i-lucide-check" @click="applyCoatEdit" />
            <UButton size="md" color="neutral" variant="ghost" icon="i-lucide-x" @click="cancelEdit" />
          </div>
        </div>

        <!-- Display mode -->
        <div v-else>
          <div class="flex items-center gap-2">
            <span class="font-medium text-sm">
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
              size="md"
              color="neutral"
              variant="ghost"
              icon="i-lucide-square-pen"
              @click="startEditCoat"
            />
          </div>
          <div
            v-if="getEntry('texture', cat.mutations.coatId!)?.descResolved"
            class="text-xs text-muted mt-1"
          >
            {{ getEntry('texture', cat.mutations.coatId!)!.descResolved }}
          </div>
          <div
            v-if="formatMutationStats(getEntry('texture', cat.mutations.coatId!) ?? { stats: {} } as any)"
            class="text-xs text-sky-400 mt-0.5"
          >
            {{ formatMutationStats(getEntry('texture', cat.mutations.coatId!)!) }}
          </div>
        </div>
      </div>

      <!-- Single slots: Body, Head, Tail, Mouth -->
      <div
        v-for="slot in singleSlots"
        :key="slot.slotIndex"
        class="p-4 rounded-lg border border-default"
      >
        <div class="text-xs text-muted uppercase tracking-wider mb-2">{{ slot.label }}</div>

        <!-- Editing mode -->
        <div v-if="editingSlotIdx === slot.slotIndex" class="space-y-2">
          <EditorSearchSelect
            :model-value="editValue"
            :options="getOptions(slot.category)"
            placeholder="Search mutation..."
            @update:model-value="editValue = $event"
          />
          <div class="flex items-center gap-1 justify-end">
            <UButton size="md" color="primary" icon="i-lucide-check" @click="applySlotEdit" />
            <UButton size="md" color="neutral" variant="ghost" icon="i-lucide-x" @click="cancelEdit" />
          </div>
        </div>

        <!-- Display mode -->
        <div v-else>
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
            <span class="text-xs text-muted font-mono ml-auto">{{ slot.slotId }}</span>
            <UButton
              size="md"
              color="neutral"
              variant="ghost"
              icon="i-lucide-square-pen"
              @click="startEditSlot(slot.slotIndex, slot.slotId)"
            />
          </div>
          <div
            v-if="getEntry(slot.category, slot.slotId)?.descResolved"
            class="text-xs text-muted mt-1"
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
      </div>

      <!-- Paired slots: RearLeg, FrontLeg, Eye, Brow, Ear -->
      <div
        v-for="pair in pairedGroups"
        :key="pair.label"
        class="p-4 rounded-lg border border-default"
      >
        <div class="text-xs text-muted uppercase tracking-wider mb-3">{{ pair.label }}</div>

        <div class="grid grid-cols-2 gap-3">
          <!-- Left side -->
          <div class="p-3 rounded-md bg-elevated/50">
            <div class="text-xs text-muted mb-1.5">Left</div>

            <!-- Editing mode -->
            <div v-if="editingSlotIdx === pair.left.slotIndex" class="space-y-2">
              <EditorSearchSelect
                :model-value="editValue"
                :options="getOptions(pair.left.category)"
                placeholder="Search..."
                @update:model-value="editValue = $event"
              />
              <div class="flex items-center gap-1 justify-end">
                <UButton size="md" color="primary" icon="i-lucide-check" @click="applySlotEdit" />
                <UButton size="md" color="neutral" variant="ghost" icon="i-lucide-x" @click="cancelEdit" />
              </div>
            </div>

            <!-- Display mode -->
            <div v-else>
              <div class="flex items-center gap-1.5 flex-wrap">
                <span class="font-medium text-sm">
                  {{ getDisplayName(pair.left.category, pair.left.slotId) }}
                </span>
                <UBadge
                  v-if="getEntry(pair.left.category, pair.left.slotId)?.tag"
                  :color="tagColor(getEntry(pair.left.category, pair.left.slotId)?.tag ?? null)"
                  variant="subtle"
                  size="md"
                >
                  {{ getEntry(pair.left.category, pair.left.slotId)!.tag }}
                </UBadge>
              </div>
              <div
                v-if="getEntry(pair.left.category, pair.left.slotId)?.descResolved"
                class="text-xs text-muted mt-1"
              >
                {{ getEntry(pair.left.category, pair.left.slotId)!.descResolved }}
              </div>
              <div
                v-if="getEntry(pair.left.category, pair.left.slotId) && formatMutationStats(getEntry(pair.left.category, pair.left.slotId)!)"
                class="text-xs text-sky-400 mt-0.5"
              >
                {{ formatMutationStats(getEntry(pair.left.category, pair.left.slotId)!) }}
              </div>
              <div class="flex items-center gap-1 mt-1.5">
                <span class="text-xs text-muted font-mono">{{ pair.left.slotId }}</span>
                <div class="ml-auto flex items-center gap-0.5">
                  <UButton
                    size="md"
                    color="neutral"
                    variant="ghost"
                    icon="i-lucide-square-pen"
                    @click="startEditSlot(pair.left.slotIndex, pair.left.slotId)"
                  />
                  <UButton
                    size="md"
                    color="neutral"
                    variant="ghost"
                    icon="i-lucide-copy"
                    title="Mirror to right side"
                    @click="mirrorSlot(pair.left.slotIndex)"
                  />
                </div>
              </div>
            </div>
          </div>

          <!-- Right side -->
          <div class="p-3 rounded-md bg-elevated/50">
            <div class="text-xs text-muted mb-1.5">Right</div>

            <!-- Editing mode -->
            <div v-if="editingSlotIdx === pair.right.slotIndex" class="space-y-2">
              <EditorSearchSelect
                :model-value="editValue"
                :options="getOptions(pair.right.category)"
                placeholder="Search..."
                @update:model-value="editValue = $event"
              />
              <div class="flex items-center gap-1 justify-end">
                <UButton size="md" color="primary" icon="i-lucide-check" @click="applySlotEdit" />
                <UButton size="md" color="neutral" variant="ghost" icon="i-lucide-x" @click="cancelEdit" />
              </div>
            </div>

            <!-- Display mode -->
            <div v-else>
              <div class="flex items-center gap-1.5 flex-wrap">
                <span class="font-medium text-sm">
                  {{ getDisplayName(pair.right.category, pair.right.slotId) }}
                </span>
                <UBadge
                  v-if="getEntry(pair.right.category, pair.right.slotId)?.tag"
                  :color="tagColor(getEntry(pair.right.category, pair.right.slotId)?.tag ?? null)"
                  variant="subtle"
                  size="md"
                >
                  {{ getEntry(pair.right.category, pair.right.slotId)!.tag }}
                </UBadge>
              </div>
              <div
                v-if="getEntry(pair.right.category, pair.right.slotId)?.descResolved"
                class="text-xs text-muted mt-1"
              >
                {{ getEntry(pair.right.category, pair.right.slotId)!.descResolved }}
              </div>
              <div
                v-if="getEntry(pair.right.category, pair.right.slotId) && formatMutationStats(getEntry(pair.right.category, pair.right.slotId)!)"
                class="text-xs text-sky-400 mt-0.5"
              >
                {{ formatMutationStats(getEntry(pair.right.category, pair.right.slotId)!) }}
              </div>
              <div class="flex items-center gap-1 mt-1.5">
                <span class="text-xs text-muted font-mono">{{ pair.right.slotId }}</span>
                <div class="ml-auto flex items-center gap-0.5">
                  <UButton
                    size="md"
                    color="neutral"
                    variant="ghost"
                    icon="i-lucide-square-pen"
                    @click="startEditSlot(pair.right.slotIndex, pair.right.slotId)"
                  />
                  <UButton
                    size="md"
                    color="neutral"
                    variant="ghost"
                    icon="i-lucide-copy"
                    title="Mirror to left side"
                    @click="mirrorSlot(pair.right.slotIndex)"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
