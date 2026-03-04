<script setup lang="ts">
import { mutationCount } from '~/utils/parse/mutations'

const { deadCats, currentDay, resurrectCat, rebornCat } = useSaveEditor()

const search = ref('')

const filteredCats = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return deadCats.value
  return deadCats.value.filter(c =>
    c.name.toLowerCase().includes(q)
    || c.className.toLowerCase().includes(q)
    || c.sex.toLowerCase().includes(q)
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

function onResurrect(key: number) {
  resurrectCat(key)
}

function onReborn(key: number) {
  rebornCat(key)
}
</script>

<template>
  <div class="h-full overflow-y-auto p-6">
    <div class="flex items-center gap-4 mb-4">
      <h1 class="text-2xl font-bold">
        Graveyard
      </h1>
      <span class="text-sm text-muted">
        {{ deadCats.length }} dead/inactive cats
      </span>
    </div>

    <div class="mb-4 max-w-sm">
      <UInput
        v-model="search"
        placeholder="Search dead cats..."
        icon="i-lucide-search"
        size="sm"
      />
    </div>

    <div
      v-if="filteredCats.length === 0"
      class="text-center text-muted py-12"
    >
      <UIcon
        name="i-lucide-heart"
        class="size-12 mb-3 opacity-30"
      />
      <p class="text-lg">
        No dead cats found
      </p>
      <p class="text-sm mt-1">
        All your cats are alive and well!
      </p>
    </div>

    <div
      v-else
      class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3"
    >
      <div
        v-for="cat in filteredCats"
        :key="cat.key"
        class="rounded-lg border border-default bg-elevated/30 p-4 text-sm"
      >
        <div class="flex items-center justify-between mb-2 gap-2">
          <div class="min-w-0">
            <span class="font-semibold text-base truncate block">{{ cat.name || '(unnamed)' }}</span>
            <span class="text-xs text-muted">{{ catAge(cat.birthdayDay) }}</span>
          </div>
          <div class="flex gap-1.5 shrink-0">
            <UButton
              size="sm"
              color="success"
              variant="subtle"
              icon="i-lucide-heart-pulse"
              title="Resurrect with original stats, level, and age"
              @click="onResurrect(cat.key)"
            >
              Resurrect
            </UButton>
            <UButton
              size="sm"
              color="warning"
              variant="subtle"
              icon="i-lucide-baby"
              title="Reborn as age 2, level 0"
              @click="onReborn(cat.key)"
            >
              Reborn
            </UButton>
          </div>
        </div>

        <div class="flex items-center gap-2 text-xs mb-2">
          <span :class="sexColor(cat.sex)">{{ cat.sex }}</span>
          <UBadge
            v-if="cat.className"
            color="primary"
            variant="subtle"
            size="md"
          >
            {{ cat.className }}
          </UBadge>
          <span class="text-muted">Lv{{ cat.level }}</span>
        </div>

        <!-- Stats -->
        <div
          v-if="cat.stats"
          class="flex gap-2 text-xs text-muted mb-2"
        >
          <span>STR {{ cat.stats.str }}</span>
          <span>DEX {{ cat.stats.dex }}</span>
          <span>CON {{ cat.stats.con }}</span>
          <span>INT {{ cat.stats.int }}</span>
          <span>SPD {{ cat.stats.spd }}</span>
          <span>CHA {{ cat.stats.cha }}</span>
          <span>LCK {{ cat.stats.luck }}</span>
        </div>

        <div class="flex items-center gap-1.5 flex-wrap">
          <UBadge
            v-if="cat.flags.dead"
            color="error"
            variant="subtle"
            size="md"
          >
            Dead
          </UBadge>
          <UBadge
            v-if="!cat.flags.dead"
            color="warning"
            variant="subtle"
            size="md"
          >
            Inactive
          </UBadge>
          <UBadge
            v-if="cat.flags.retired"
            color="warning"
            variant="subtle"
            size="md"
          >
            Retired
          </UBadge>
          <UBadge
            v-if="cat.flags.donated"
            color="info"
            variant="subtle"
            size="md"
          >
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
      </div>
    </div>
  </div>
</template>
