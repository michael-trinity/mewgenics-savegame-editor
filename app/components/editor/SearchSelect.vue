<script setup lang="ts">
export interface SearchOption {
  id: string
  label: string
  description?: string
  badge?: string
  stats?: string
}

const props = withDefaults(defineProps<{
  options: SearchOption[]
  placeholder?: string
  modelValue?: string
}>(), {
  placeholder: 'Search...',
  modelValue: ''
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const query = ref('')
const open = ref(false)
const containerRef = ref<HTMLElement | null>(null)

const filtered = computed(() => {
  const q = query.value.toLowerCase()
  if (!q) return props.options.slice(0, 50)
  return props.options
    .filter(o =>
      o.label.toLowerCase().includes(q) ||
      o.id.toLowerCase().includes(q) ||
      o.description?.toLowerCase().includes(q) ||
      o.badge?.toLowerCase().includes(q)
    )
    .slice(0, 50)
})

function select(opt: SearchOption) {
  emit('update:modelValue', opt.id)
  query.value = ''
  open.value = false
}

function onFocus() {
  open.value = true
}

function onClickOutside(e: MouseEvent) {
  if (containerRef.value && !containerRef.value.contains(e.target as Node)) {
    open.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', onClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', onClickOutside)
})
</script>

<template>
  <div ref="containerRef" class="relative">
    <UInput
      v-model="query"
      icon="i-lucide-search"
      :placeholder="placeholder"
      size="sm"
      class="w-full"
      @focus="onFocus"
      @keyup.escape="open = false"
    />

    <div
      v-if="open"
      class="absolute z-50 mt-1 w-full max-h-80 overflow-y-auto rounded-lg border border-default bg-default shadow-lg"
    >
      <div v-if="filtered.length === 0" class="px-3 py-4 text-center text-sm text-muted">
        No matches found
      </div>
      <button
        v-for="opt in filtered"
        :key="opt.id"
        class="w-full text-left px-3 py-2 hover:bg-elevated transition-colors border-b border-default last:border-0"
        @click="select(opt)"
      >
        <div class="flex items-center gap-2">
          <span class="font-medium text-sm">{{ opt.label }}</span>
          <UBadge v-if="opt.badge" color="primary" variant="subtle" size="md">
            {{ opt.badge }}
          </UBadge>
          <span class="text-xs text-muted font-mono ml-auto">{{ opt.id }}</span>
        </div>
        <div v-if="opt.stats" class="text-xs text-muted mt-0.5">
          {{ opt.stats }}
        </div>
        <div v-if="opt.description" class="text-xs text-muted mt-0.5 line-clamp-2">
          {{ opt.description }}
        </div>
      </button>
    </div>
  </div>
</template>
