<script setup lang="ts">
import { mutationCount } from '~/utils/parse/mutations'
import { HP_SENTINEL, getMaxHp, getMaxMana } from '~/types/save'

const { cats, selectedCatKey, currentDay, selectCat, getCatLocation } = useSaveEditor()
const { itemsDB, mutationsDB, classesDB } = useGameData()

const search = ref('')

const filteredCats = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return cats.value
  return cats.value.filter(c =>
    c.name.toLowerCase().includes(q)
    || c.className.toLowerCase().includes(q)
    || c.sex.toLowerCase().includes(q)
    || getCatLocation(c.key).toLowerCase().includes(q)
  )
})

function catAge(birthdayDay: number | null): string {
  if (birthdayDay === null || currentDay.value === null) return '?'
  const age = currentDay.value - birthdayDay
  return `${age}d`
}

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
  <div>
    <div class="p-3 pb-0">
      <div class="text-xs text-muted uppercase tracking-wider font-semibold mb-2 px-2">
        Cats ({{ filteredCats.length }}<span v-if="search"> / {{ cats.length }}</span>)
      </div>

      <div class="px-2 mb-3">
        <UInput
          v-model="search"
          placeholder="Search cats..."
          icon="i-lucide-search"
          size="sm"
          :ui="{ root: 'w-full' }"
        />
      </div>
    </div>

    <div class="max-h-[calc(100vh-200px)] overflow-y-auto p-2 space-y-2">
      <button
        v-for="cat in filteredCats"
        :key="cat.key"
        class="w-full text-left px-3 py-2.5 rounded-lg border transition-colors text-sm"
        :class="[
          selectedCatKey === cat.key
            ? 'bg-primary/10 text-primary border-primary/30 ring-1 ring-primary/30'
            : 'border-default hover:bg-elevated'
        ]"
        @click="selectCat(cat.key)"
      >
        <div class="flex items-center justify-between">
          <span class="font-medium truncate">{{ cat.name || '(unnamed)' }}</span>
          <span class="text-xs text-muted ml-2 shrink-0">{{ catAge(cat.birthdayDay) }}</span>
        </div>

        <div class="flex items-center gap-2 mt-1 text-xs">
          <span :class="sexColor(cat.sex)">{{ cat.sex }}</span>
          <UBadge v-if="cat.className" color="primary" variant="subtle" size="md">
            {{ cat.className }}
          </UBadge>
          <span v-if="getCatLocation(cat.key)" class="text-muted truncate">
            {{ getCatLocation(cat.key) }}
          </span>
        </div>

        <div class="flex items-center gap-1.5 mt-1.5 flex-wrap">
          <UBadge
            v-if="cat.combat && cat.combat.hp !== HP_SENTINEL"
            color="error"
            variant="subtle"
            size="md"
          >
            HP: {{ cat.combat.hp }}{{ getMaxHp(cat, itemsDB?.allItems, mutationsDB?.byCategory, classesDB ?? undefined) ? ` / ${getMaxHp(cat, itemsDB?.allItems, mutationsDB?.byCategory, classesDB ?? undefined)}` : '' }}
          </UBadge>
          <UBadge
            v-if="cat.stats && getMaxMana(cat, itemsDB?.allItems, mutationsDB?.byCategory, classesDB ?? undefined)"
            color="info"
            variant="subtle"
            size="md"
          >
            MP: {{ getMaxMana(cat, itemsDB?.allItems, mutationsDB?.byCategory, classesDB ?? undefined) }}
          </UBadge>
          <UBadge
            v-if="cat.combat && cat.combat.statusEffect !== 'none'"
            color="warning"
            variant="subtle"
            size="md"
            class="capitalize"
          >
            {{ cat.combat.statusEffect }}
          </UBadge>
          <UBadge v-if="cat.flags.retired" color="warning" variant="subtle" size="md">
            Retired
          </UBadge>
          <UBadge v-if="cat.flags.dead" color="error" variant="subtle" size="md">
            Dead
          </UBadge>
          <UBadge v-if="cat.flags.donated" color="info" variant="subtle" size="md">
            Donated
          </UBadge>
          <UBadge
            v-if="mutationCount(cat.mutations.coatId, cat.mutations.slots) > 0"
            color="secondary"
            variant="subtle"
            size="md"
          >
            {{ mutationCount(cat.mutations.coatId, cat.mutations.slots) }} mutations
          </UBadge>
        </div>
      </button>
    </div>
  </div>
</template>
