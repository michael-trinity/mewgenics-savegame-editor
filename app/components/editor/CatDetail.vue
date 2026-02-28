<script setup lang="ts">
import type { ParsedCat } from '~/types/save'
import { HP_SENTINEL, getMaxHp, getMaxMana, getManaRegen } from '~/types/save'
import { patchName } from '~/utils/patch/name'
import { reParseCatFromBlob } from '~/utils/parse/saveLoader'

const props = defineProps<{
  cat: ParsedCat
}>()

const { currentDay, updateCat } = useSaveEditor()
const { itemsDB, mutationsDB, classesDB } = useGameData()

const age = computed(() => {
  if (props.cat.birthdayDay === null || currentDay.value === null) return null
  return currentDay.value - props.cat.birthdayDay
})

// Inline name editing
const editingName = ref(false)
const newName = ref('')

watch(() => props.cat.key, () => {
  editingName.value = false
  newName.value = props.cat.name
}, { immediate: true })

function startEditName() {
  newName.value = props.cat.name
  editingName.value = true
}

function applyName() {
  const trimmed = newName.value.trim()
  if (!trimmed || trimmed === props.cat.name) {
    editingName.value = false
    return
  }
  const newBlob = patchName(props.cat.decompressedBlob, props.cat.nameEndRaw, trimmed)
  const reparsed = reParseCatFromBlob(props.cat.key, newBlob, props.cat.lz4Variant, currentDay.value)
  updateCat(props.cat.key, reparsed)
  editingName.value = false
}

const hpText = computed(() => {
  if (!props.cat.combat) return null
  if (props.cat.combat.hp === HP_SENTINEL) return null // don't show for house cats
  const maxHp = getMaxHp(props.cat, itemsDB.value?.allItems, mutationsDB.value?.byCategory, classesDB.value ?? undefined)
  if (maxHp) return `${props.cat.combat.hp} / ${maxHp}`
  return String(props.cat.combat.hp)
})

const manaText = computed(() => {
  if (!props.cat.stats) return null
  const maxMana = getMaxMana(props.cat, itemsDB.value?.allItems, mutationsDB.value?.byCategory, classesDB.value ?? undefined)
  const regen = getManaRegen(props.cat, itemsDB.value?.allItems, mutationsDB.value?.byCategory, classesDB.value ?? undefined)
  if (maxMana === null) return null
  return `${maxMana}${regen ? ` (+${regen}/t)` : ''}`
})

const activeTab = ref('stats')
const tabItems = [
  { key: 'stats', label: 'Stats', icon: 'i-lucide-bar-chart-3' },
  { key: 'abilities', label: 'Abilities', icon: 'i-lucide-sword' },
  { key: 'equipment', label: 'Equipment', icon: 'i-lucide-shield' },
  { key: 'mutations', label: 'Mutations', icon: 'i-lucide-dna' },
  { key: 'details', label: 'Details', icon: 'i-lucide-settings' }
]

function sexColor(sex: string): string {
  switch (sex) {
    case 'Male': return 'text-sky-400'
    case 'Female': return 'text-pink-400'
    case 'Ditto': return 'text-gray-400'
    default: return 'text-muted'
  }
}
</script>

<template>
  <div class="h-full flex flex-col">
    <!-- Header -->
    <div class="shrink-0 px-6 pt-6 mb-4">
      <div class="flex items-center gap-3 mb-1">
        <template v-if="editingName">
          <UInput
            v-model="newName"
            size="lg"
            class="w-64"
            :maxlength="64"
            placeholder="Cat name"
            autofocus
            @keyup.enter="applyName"
            @keyup.escape="editingName = false"
          />
          <UButton
            size="md"
            color="primary"
            icon="i-lucide-check"
            @click="applyName"
          />
          <UButton
            size="md"
            color="neutral"
            variant="ghost"
            icon="i-lucide-x"
            @click="editingName = false"
          />
        </template>
        <template v-else>
          <h2 class="text-2xl font-bold">
            {{ cat.name || '(unnamed)' }}
          </h2>
          <UButton
            size="md"
            color="neutral"
            variant="ghost"
            icon="i-lucide-square-pen"
            @click="startEditName"
          />
        </template>
        <UBadge
          v-if="cat.className"
          color="primary"
          variant="subtle"
          size="lg"
        >
          {{ cat.className }}
        </UBadge>
      </div>
      <div class="flex items-center gap-3 text-sm flex-wrap">
        <span :class="sexColor(cat.sex)">{{ cat.sex }}</span>
        <span
          v-if="age !== null"
          class="text-muted"
        >Age: {{ age }} days</span>
        <span
          v-if="hpText"
          class="text-red-400 font-medium"
        >HP: {{ hpText }}</span>
        <span
          v-if="manaText"
          class="text-sky-400 font-medium"
        >MP: {{ manaText }}</span>
        <span
          v-if="cat.combat && cat.combat.statusEffect !== 'none'"
          class="text-amber-400 font-medium capitalize"
        >
          {{ cat.combat.statusEffect }}
        </span>
        <span class="text-muted">Key: {{ cat.key }}</span>
        <UBadge
          v-if="cat.flags.retired"
          color="warning"
          variant="subtle"
          size="lg"
        >
          Retired
        </UBadge>
        <UBadge
          v-if="cat.flags.dead"
          color="error"
          variant="subtle"
          size="lg"
        >
          Dead
        </UBadge>
        <UBadge
          v-if="cat.flags.donated"
          color="info"
          variant="subtle"
          size="lg"
        >
          Donated
        </UBadge>
      </div>
    </div>

    <!-- Tab Bar -->
    <div class="shrink-0 px-6 flex gap-1 border-b border-default">
      <button
        v-for="tab in tabItems"
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
      </button>
    </div>

    <!-- Tab Content -->
    <div class="flex-1 min-h-0">
      <EditorStatsEditor
        v-if="activeTab === 'stats'"
        :cat="cat"
      />
      <EditorAbilityEditor
        v-if="activeTab === 'abilities'"
        :cat="cat"
      />
      <EditorEquipmentEditor
        v-if="activeTab === 'equipment'"
        :cat="cat"
      />
      <EditorMutationEditor
        v-if="activeTab === 'mutations'"
        :cat="cat"
      />
      <EditorDetailsEditor
        v-if="activeTab === 'details'"
        :cat="cat"
      />
    </div>
  </div>
</template>
