<script setup lang="ts">
import type { GameProperties } from '~/types/save'

const { saveState, updateProperty, updateRawProperty } = useSaveEditor()

const props_ = computed(() => saveState.value?.properties ?? null)

const editableFields: { key: keyof GameProperties, label: string, icon: string }[] = [
  { key: 'currentDay', label: 'Current Day', icon: 'i-lucide-calendar' },
  { key: 'houseGold', label: 'Gold', icon: 'i-lucide-coins' },
  { key: 'houseFood', label: 'Food', icon: 'i-lucide-utensils' },
  { key: 'blankCollars', label: 'Blank Collars', icon: 'i-lucide-circle' },
  { key: 'adventureCoins', label: 'Adventure Coins', icon: 'i-lucide-coins' },
  { key: 'adventureFood', label: 'Adventure Food', icon: 'i-lucide-utensils' },
  { key: 'saveFilePercent', label: 'Save Completion %', icon: 'i-lucide-percent' },
  { key: 'houseStorageUpgrades', label: 'Storage Upgrades', icon: 'i-lucide-box' },
  { key: 'adventureFurnitureBoxes', label: 'Furniture Boxes', icon: 'i-lucide-package' },
  { key: 'minStraysTomorrow', label: 'Min Strays Tomorrow', icon: 'i-lucide-paw-print' }
]

// Local editable values for key properties
const editValues = ref<Record<string, number>>({})

watch(props_, (p) => {
  if (!p) return
  const vals: Record<string, number> = {}
  for (const f of editableFields) {
    const v = p[f.key]
    if (typeof v === 'number') vals[f.key] = v
  }
  editValues.value = vals
}, { immediate: true })

function applyField(key: keyof GameProperties) {
  const val = editValues.value[key]
  if (val === undefined) return
  updateProperty(key, val)
}

// All raw properties for reference and editing
const rawProperties = computed<[string, string | number][]>(() => {
  if (!props_.value) return []
  return [...props_.value.raw.entries()]
    .filter((entry): entry is [string, string | number] => typeof entry[1] === 'number' || typeof entry[1] === 'string')
    .sort(([a], [b]) => a.localeCompare(b))
})

// Local editable values for raw properties
const rawEditValues = ref<Record<string, string | number>>({})

watch(rawProperties, (rp) => {
  const vals: Record<string, string | number> = {}
  for (const [key, value] of rp) {
    vals[key] = value
  }
  rawEditValues.value = vals
}, { immediate: true })

function applyRawField(key: string) {
  const val = rawEditValues.value[key]
  if (val === undefined) return
  // Try to keep numeric values as numbers
  if (typeof val === 'string') {
    const num = Number(val)
    if (!isNaN(num) && val.trim() !== '') {
      updateRawProperty(key, num)
      return
    }
  }
  updateRawProperty(key, val)
}

// Search/filter for raw properties
const rawSearch = ref('')
const filteredRawProperties = computed(() => {
  if (!rawSearch.value) return rawProperties.value
  const q = rawSearch.value.toLowerCase()
  return rawProperties.value.filter(([key]) => key.toLowerCase().includes(q))
})

const showAll = ref(false)
const warningDismissed = ref(false)
</script>

<template>
  <div class="h-full overflow-y-auto p-6 max-w-4xl mx-auto">
    <h2 class="text-xl font-bold mb-4">
      Game Data
    </h2>

    <!-- Corruption Warning -->
    <UAlert
      v-if="!warningDismissed"
      class="mb-6"
      color="warning"
      icon="i-lucide-triangle-alert"
      title="Editing game data can corrupt your save"
      description="Changing values like Current Day, Save Completion %, or Storage Upgrades to invalid values may cause the game to crash or behave unexpectedly. Always download a backup before saving changes."
      :close="{
        color: 'warning',
        variant: 'link',
        class: '-my-1'
      }"
      @close="warningDismissed = true"
    />

    <!-- Key properties -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
      <div
        v-for="field in editableFields"
        :key="field.key"
        class="p-4 rounded-lg border border-default"
      >
        <div class="flex items-center gap-2 mb-2">
          <UIcon
            :name="field.icon"
            class="size-4 text-muted"
          />
          <span class="text-sm text-muted">{{ field.label }}</span>
        </div>
        <input
          v-model.number="editValues[field.key]"
          type="number"
          class="w-full text-2xl font-bold bg-transparent border-b border-transparent hover:border-default focus:border-primary focus:outline-none transition-colors py-1"
          @change="applyField(field.key)"
        >
      </div>
    </div>

    <!-- Status badges -->
    <div class="flex gap-2 flex-wrap mb-8">
      <UBadge
        v-if="props_?.onAdventure"
        color="primary"
        variant="subtle"
      >
        On Adventure
      </UBadge>
      <UBadge
        v-else
        color="neutral"
        variant="subtle"
      >
        At Home
      </UBadge>
    </div>

    <!-- All Properties (expandable) -->
    <div>
      <button
        class="flex items-center gap-2 text-sm font-medium text-muted hover:text-default transition-colors"
        @click="showAll = !showAll"
      >
        <UIcon
          :name="showAll ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'"
          class="size-4"
        />
        All Properties ({{ rawProperties.length }})
      </button>

      <div
        v-if="showAll"
        class="mt-3"
      >
        <!-- Search bar -->
        <div class="mb-3">
          <UInput
            v-model="rawSearch"
            icon="i-lucide-search"
            placeholder="Filter properties..."
            size="sm"
            class="max-w-xs"
          />
        </div>

        <div class="border border-default rounded-lg overflow-hidden">
          <table class="w-full text-sm">
            <thead class="bg-elevated">
              <tr>
                <th class="text-left px-3 py-2 font-medium w-1/3">
                  Key
                </th>
                <th class="text-left px-3 py-2 font-medium">
                  Value
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="[key, value] in filteredRawProperties"
                :key="key"
                class="border-t border-default group"
              >
                <td class="px-3 py-1.5 font-mono text-xs align-middle">
                  {{ key }}
                </td>
                <td class="px-3 py-0.5">
                  <input
                    v-if="typeof value === 'number'"
                    v-model.number="rawEditValues[key]"
                    type="number"
                    class="w-full font-mono text-xs bg-transparent border-b border-transparent hover:border-default focus:border-primary focus:outline-none transition-colors py-1"
                    @change="applyRawField(key)"
                  >
                  <input
                    v-else
                    v-model="rawEditValues[key]"
                    type="text"
                    class="w-full font-mono text-xs bg-transparent border-b border-transparent hover:border-default focus:border-primary focus:outline-none transition-colors py-1"
                    @change="applyRawField(key)"
                  >
                </td>
              </tr>
              <tr v-if="filteredRawProperties.length === 0">
                <td
                  colspan="2"
                  class="px-3 py-4 text-center text-muted text-xs"
                >
                  No properties match "{{ rawSearch }}"
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>
