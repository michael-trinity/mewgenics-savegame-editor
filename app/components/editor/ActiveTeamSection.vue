<script setup lang="ts">
import { HP_SENTINEL, getMaxHp, getMaxMana } from '~/types/save'

const { saveState, cats } = useSaveEditor()
const { itemsDB, mutationsDB, classesDB } = useGameData()

const teamCats = computed(() => {
  if (!saveState.value) return []
  const keys = saveState.value.adventureKeys
  return cats.value.filter(c => keys.includes(c.key))
})

const selectedKey = ref<number | null>(null)

const selectedCat = computed(() => {
  if (selectedKey.value === null) return null
  return teamCats.value.find(c => c.key === selectedKey.value) ?? null
})

// Auto-select first team cat
watch(teamCats, (tc) => {
  if (tc.length > 0 && (selectedKey.value === null || !tc.some(c => c.key === selectedKey.value))) {
    selectedKey.value = tc[0]!.key
  }
}, { immediate: true })

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
  <div v-if="teamCats.length === 0" class="p-6 text-muted text-center">
    No cats are currently on an adventure.
  </div>

  <div v-else class="flex h-full">
    <!-- Left: Team cat list -->
    <div class="w-64 shrink-0 border-r border-default overflow-y-auto">
      <div class="p-3">
        <div class="text-xs text-muted uppercase tracking-wider font-semibold mb-3 px-2">
          Adventure Team ({{ teamCats.length }})
        </div>
        <div class="space-y-2">
          <button
            v-for="cat in teamCats"
            :key="cat.key"
            class="w-full text-left px-3 py-2.5 rounded-lg border transition-colors text-sm"
            :class="[
              selectedKey === cat.key
                ? 'bg-primary/10 text-primary border-primary/30 ring-1 ring-primary/30'
                : 'border-default hover:bg-elevated'
            ]"
            @click="selectedKey = cat.key"
          >
            <div class="flex items-center justify-between">
              <span class="font-medium truncate">{{ cat.name || '(unnamed)' }}</span>
              <UBadge v-if="cat.className" color="primary" variant="subtle" size="lg">
                {{ cat.className }}
              </UBadge>
            </div>
            <div class="flex items-center gap-2 mt-1 text-xs">
              <span :class="sexColor(cat.sex)">{{ cat.sex }}</span>
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
            </div>
          </button>
        </div>
      </div>
    </div>

    <!-- Right: Cat detail -->
    <div class="flex-1 min-h-0 overflow-hidden">
      <EditorCatDetail v-if="selectedCat" :cat="selectedCat" />
      <div v-else class="p-6 text-muted text-center">
        Select a cat from the team to view details.
      </div>
    </div>
  </div>
</template>
