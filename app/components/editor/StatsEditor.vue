<script setup lang="ts">
import type { ParsedCat } from '~/types/save'
import { STAT_NAMES, statsToArray, arrayToStats, HP_SENTINEL, getMaxHp, getMaxMana, getManaRegen } from '~/types/save'
import { patchStats, patchLevel } from '~/utils/patch/stats'
import { patchHp } from '~/utils/patch/hp'
import { findStats } from '~/utils/parse/stats'
import { parseCombatState } from '~/utils/parse/hp'

const props = defineProps<{
  cat: ParsedCat
}>()

const { updateCat } = useSaveEditor()
const { itemsDB, mutationsDB, classesDB } = useGameData()

const editableStats = ref<number[]>([1, 1, 1, 1, 1, 1, 1])
const editableHp = ref<number>(0)
const editableLevel = ref<number>(1)

const hpIsSentinel = computed(() => props.cat.combat?.hp === HP_SENTINEL)
const maxHp = computed(() => getMaxHp(props.cat, itemsDB.value?.allItems, mutationsDB.value?.byCategory, classesDB.value ?? undefined) ?? 0)
const maxMana = computed(() => getMaxMana(props.cat, itemsDB.value?.allItems, mutationsDB.value?.byCategory, classesDB.value ?? undefined) ?? 0)
const manaRegen = computed(() => getManaRegen(props.cat, itemsDB.value?.allItems, mutationsDB.value?.byCategory, classesDB.value ?? undefined) ?? 0)

const currentLevel = computed(() => props.cat.level)

watch(() => props.cat.key, () => {
  if (props.cat.stats) {
    editableStats.value = [...statsToArray(props.cat.stats)]
  }
  if (props.cat.combat) {
    editableHp.value = hpIsSentinel.value ? (maxHp.value || 100) : props.cat.combat.hp
  }
  editableLevel.value = currentLevel.value ?? 1
}, { immediate: true })

function statColor(v: number): string {
  const lo = 3
  const hi = 10
  const vv = Math.max(lo, Math.min(hi, v))
  const t = (vv - lo) / (hi - lo)
  const r = Math.round(0xEB + (0x6A - 0xEB) * t)
  const g = Math.round(0x4D + (0xB0 - 0x4D) * t)
  const b = Math.round(0x4B + (0x4C - 0x4B) * t)
  return `rgb(${r},${g},${b})`
}

function statusColor(status: string): string {
  switch (status) {
    case 'none': return 'text-emerald-400'
    case 'poisoned': return 'text-purple-400'
    case 'burned': return 'text-orange-400'
    case 'bleeding': return 'text-red-400'
    default: return 'text-sky-400'
  }
}

const STAT_EMOJI = ['\u{1F4AA}', '\u{1F3F9}', '\u{1F90D}', '\u{1F4A1}', '\u{1F45F}', '\u{1F444}', '\u{1F340}']

function applyStats() {
  if (props.cat.statsOffset === null) return
  const newStats = arrayToStats(editableStats.value)
  const newBlob = patchStats(props.cat.decompressedBlob, props.cat.statsOffset, newStats)
  // Re-parse to verify
  const { stats: verified, levelBonuses, offset } = findStats(newBlob)
  updateCat(props.cat.key, {
    decompressedBlob: newBlob,
    stats: verified ?? newStats,
    levelBonuses: levelBonuses ?? props.cat.levelBonuses,
    statsOffset: offset ?? props.cat.statsOffset
  })
}

function applyHp() {
  if (!props.cat.combat) return
  const hp = Number(editableHp.value)
  if (!Number.isFinite(hp) || hp < 0) return
  const newBlob = patchHp(props.cat.decompressedBlob, props.cat.combat.hpOffset, hp)
  const newCombat = parseCombatState(newBlob, props.cat.statsOffset!)
  updateCat(props.cat.key, {
    decompressedBlob: newBlob,
    combat: newCombat ?? { ...props.cat.combat, hp }
  })
}

function fullHealHp() {
  editableHp.value = HP_SENTINEL
  applyHp()
}

function maxAll() {
  editableStats.value = [10, 10, 10, 10, 10, 10, 10]
  applyStats()
}

function applyLevel() {
  if (props.cat.levelOffset === null) return
  const level = Math.max(1, Math.round(editableLevel.value))
  const newBlob = patchLevel(props.cat.decompressedBlob, props.cat.levelOffset, level)
  updateCat(props.cat.key, { decompressedBlob: newBlob, level })
}
</script>

<template>
  <div class="h-full overflow-y-auto p-6">
    <div v-if="!cat.stats" class="text-muted">
      Stats not found in this cat's data.
    </div>

    <div v-else class="space-y-4 max-w-md">
      <!-- HP & Status -->
      <div v-if="cat.combat" class="rounded-lg border border-default p-4 mb-2">
        <div class="flex items-center gap-3 mb-3">
          <span class="text-lg" title="HP">&#x2764;&#xFE0F;</span>
          <span class="font-medium text-sm w-12">HP</span>
          <template v-if="hpIsSentinel">
            <span class="text-emerald-400 font-bold">Full (default)</span>
          </template>
          <template v-else>
            <input
              v-model.number="editableHp"
              type="number"
              min="0"
              :max="maxHp || 9999"
              class="w-24 px-2 py-1 rounded border border-default bg-default text-center font-bold"
              @input="applyHp"
            >
            <span v-if="maxHp" class="text-sm text-muted">/ {{ maxHp }}</span>
          </template>
        </div>

        <div class="flex items-center gap-3 mb-3">
          <span class="text-lg" title="Status">&#x1F3AF;</span>
          <span class="font-medium text-sm w-12">Status</span>
          <span :class="statusColor(cat.combat.statusEffect)" class="font-medium capitalize">
            {{ cat.combat.statusEffect }}
          </span>
          <UBadge
            v-if="cat.combat.statusEffect !== 'none' && !['str','dex','con','int','spd','cha','lck'].includes(cat.combat.statusEffect)"
            color="warning"
            variant="subtle"
            size="md"
          >
            Debuff
          </UBadge>
          <UBadge
            v-else-if="cat.combat.statusEffect !== 'none'"
            color="info"
            variant="subtle"
            size="md"
          >
            Stat Boost
          </UBadge>
        </div>

        <div v-if="!hpIsSentinel" class="flex gap-2">
          <UButton
            icon="i-lucide-heart"
            label="Full Heal"
            size="md"
            color="success"
            variant="soft"
            @click="fullHealHp"
          />
        </div>
      </div>

      <!-- Mana & Regen -->
      <div v-if="cat.stats" class="rounded-lg border border-default p-4 mb-2">
        <div class="flex items-center gap-3 mb-3">
          <span class="text-lg" title="Max Mana">&#x1F4A7;</span>
          <span class="font-medium text-sm w-12">Mana</span>
          <span class="font-bold text-sky-400">{{ maxMana }}</span>
          <span class="text-xs text-muted">CHA ({{ cat.stats.cha }}) &times; 3</span>
        </div>
        <div class="flex items-center gap-3">
          <span class="text-lg" title="Mana Regen">&#x26A1;</span>
          <span class="font-medium text-sm w-12">Regen</span>
          <span class="font-bold text-violet-400">{{ manaRegen }}</span>
          <span class="text-xs text-muted">INT ({{ cat.stats.int }}) per turn</span>
        </div>
      </div>

      <!-- Level -->
      <div v-if="currentLevel !== null" class="flex items-center gap-3">
        <span class="w-8 text-lg" title="Level">⭐</span>
        <span class="w-12 font-medium text-sm">Level</span>
        <input
          v-model.number="editableLevel"
          type="number"
          min="1"
          max="999"
          class="w-24 px-2 py-1 rounded border border-default bg-default text-center font-bold"
          @change="applyLevel"
        >
      </div>

      <!-- Base Stats -->
      <div v-for="(name, i) in STAT_NAMES" :key="name" class="flex items-center gap-3">
        <span class="w-8 text-lg" :title="name">{{ STAT_EMOJI[i] }}</span>
        <span class="w-12 font-medium text-sm">{{ name }}</span>
        <input
          v-model.number="editableStats[i]"
          type="range"
          min="1"
          max="10"
          class="flex-1"
          @change="applyStats"
        >
        <span
          class="w-8 text-center font-bold text-lg"
          :style="{ color: statColor(editableStats[i]!) }"
        >
          {{ editableStats[i] }}
        </span>
      </div>

      <div class="flex gap-2 pt-2">
        <UButton
          icon="i-lucide-crown"
          label="Max All Stats"
          size="sm"
          color="primary"
          variant="soft"
          @click="maxAll"
        />
      </div>
    </div>
  </div>
</template>
