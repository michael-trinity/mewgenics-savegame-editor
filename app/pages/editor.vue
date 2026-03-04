<script setup lang="ts">
const { saveState } = useSaveEditor()
const router = useRouter()

onMounted(() => {
  if (!saveState.value) {
    router.push('/')
  }
})

watch(saveState, (v) => {
  if (!v) router.push('/')
})

const activeSection = ref('cats')
const sections = [
  { key: 'cats', label: 'Cat Editor', icon: 'i-lucide-cat' },
  { key: 'team', label: 'Active Team', icon: 'i-lucide-swords' },
  { key: 'housing', label: 'Housing', icon: 'i-lucide-house' },
  { key: 'inventory', label: 'Inventory', icon: 'i-lucide-backpack' },
  { key: 'graveyard', label: 'Graveyard', icon: 'i-lucide-cross' },
  { key: 'properties', label: 'Game Data', icon: 'i-lucide-settings' },
  { key: 'grid-test', label: 'Grid Test', icon: 'i-lucide-grid-2x2' }
]
</script>

<template>
  <div
    v-if="saveState"
    class="max-w-7xl mx-auto h-[calc(100vh-var(--ui-header-height))] flex flex-col overflow-hidden"
  >
    <!-- Top Section Nav -->
    <div class="shrink-0 border-b border-default bg-elevated/50">
      <div class="flex gap-1 px-4">
        <button
          v-for="sec in sections"
          :key="sec.key"
          class="flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors"
          :class="[
            activeSection === sec.key
              ? 'border-primary text-primary'
              : 'border-transparent text-muted hover:text-default hover:border-default'
          ]"
          @click="activeSection = sec.key"
        >
          <UIcon
            :name="sec.icon"
            class="size-4"
          />
          {{ sec.label }}
        </button>
      </div>
    </div>

    <!-- Section Content -->
    <div class="flex-1 min-h-0 overflow-hidden">
      <EditorCatSection v-if="activeSection === 'cats'" />
      <EditorActiveTeamSection v-if="activeSection === 'team'" />
      <EditorHousingSection v-if="activeSection === 'housing'" />
      <EditorInventorySection v-if="activeSection === 'inventory'" />
      <EditorGraveyardSection v-if="activeSection === 'graveyard'" />
      <EditorPropertiesSection v-if="activeSection === 'properties'" />
      <EditorGridTestSection v-if="activeSection === 'grid-test'" />
    </div>
  </div>
</template>
