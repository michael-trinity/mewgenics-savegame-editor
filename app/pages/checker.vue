<script setup lang="ts">
import { checkSaveFile, type CheckResult, type CheckProgress, type CheckSeverity } from '~/utils/saveChecker'

const fileRef = ref<HTMLInputElement | null>(null)
const dragging = ref(false)
const isRunning = ref(false)
const progress = ref<CheckProgress | null>(null)
const results = ref<CheckResult[]>([])
const fileName = ref('')
const hasRun = ref(false)
const filterSeverity = ref<CheckSeverity | 'all'>('all')

const stats = computed(() => {
  const r = results.value
  return {
    errors: r.filter(x => x.severity === 'error').length,
    warnings: r.filter(x => x.severity === 'warn').length,
    ok: r.filter(x => x.severity === 'ok').length,
    total: r.length
  }
})

const filteredResults = computed(() => {
  if (filterSeverity.value === 'all') return results.value
  return results.value.filter(r => r.severity === filterSeverity.value)
})

const groupedResults = computed(() => {
  const groups = new Map<string, CheckResult[]>()
  for (const r of filteredResults.value) {
    const list = groups.get(r.table) || []
    list.push(r)
    groups.set(r.table, list)
  }
  return groups
})

const TABLE_LABELS: Record<string, string> = {
  cats: 'Cat Blobs (LZ4)',
  files: 'Files Table',
  furniture: 'Furniture',
  properties: 'Properties',
  winning_teams: 'Winning Teams'
}

function severityIcon(s: CheckSeverity): string {
  switch (s) {
    case 'error': return 'i-lucide-circle-x'
    case 'warn': return 'i-lucide-triangle-alert'
    case 'ok': return 'i-lucide-circle-check'
  }
}

function severityColor(s: CheckSeverity): string {
  switch (s) {
    case 'error': return 'text-red-500'
    case 'warn': return 'text-amber-500'
    case 'ok': return 'text-emerald-500'
  }
}

async function handleFile(file: File) {
  if (!file.name.endsWith('.sav')) return

  isRunning.value = true
  hasRun.value = true
  results.value = []
  fileName.value = file.name
  filterSeverity.value = 'all'

  try {
    const buffer = await file.arrayBuffer()
    results.value = await checkSaveFile(buffer, (p) => {
      progress.value = p
    })
  } catch (e: unknown) {
    results.value = [{
      table: 'database', key: 'fatal', label: 'Database',
      severity: 'error', message: 'Failed to open save file',
      details: e instanceof Error ? e.message : undefined
    }]
  } finally {
    isRunning.value = false
    progress.value = null
  }
}

function onFileChange(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) handleFile(file)
  // Reset so the same file can be re-checked
  input.value = ''
}

function onDrop(e: DragEvent) {
  dragging.value = false
  const file = e.dataTransfer?.files?.[0]
  if (file) handleFile(file)
}
</script>

<template>
  <div class="max-w-4xl mx-auto px-4 py-8">
    <!-- Header -->
    <div class="flex items-center gap-3 mb-6">
      <NuxtLink
        to="/"
        class="text-muted hover:text-default transition-colors"
      >
        <UIcon
          name="i-lucide-arrow-left"
          class="size-5"
        />
      </NuxtLink>
      <div>
        <h1 class="text-2xl font-bold">
          Save File Checker
        </h1>
        <p class="text-sm text-muted mt-0.5">
          Validate LZ4 streams, blob integrity, and data structure of a .sav file
        </p>
      </div>
    </div>

    <!-- Upload area -->
    <div
      class="w-full p-8 border-2 border-dashed rounded-xl text-center cursor-pointer transition-colors mb-6"
      :class="[
        dragging ? 'border-primary bg-primary/5' : 'border-muted hover:border-primary/50',
        isRunning ? 'pointer-events-none opacity-50' : ''
      ]"
      @click="fileRef?.click()"
      @dragover.prevent="dragging = true"
      @dragleave="dragging = false"
      @drop.prevent="onDrop"
    >
      <div
        v-if="isRunning"
        class="flex flex-col items-center gap-2"
      >
        <UIcon
          name="i-lucide-loader-2"
          class="size-8 text-primary animate-spin"
        />
        <p class="text-sm text-muted">
          {{ progress ? `${progress.phase} (${progress.current}/${progress.total})` : 'Opening database...' }}
        </p>
      </div>
      <div
        v-else
        class="flex flex-col items-center gap-2"
      >
        <UIcon
          name="i-lucide-file-search"
          class="size-8 text-muted"
        />
        <p class="font-medium text-sm">
          {{ hasRun ? 'Drop another file to check' : 'Drop a .sav file to check integrity' }}
        </p>
        <p class="text-xs text-muted">
          or click to browse
        </p>
      </div>
      <input
        ref="fileRef"
        type="file"
        accept=".sav"
        class="hidden"
        @change="onFileChange"
      >
    </div>

    <!-- Results -->
    <template v-if="hasRun && !isRunning">
      <!-- Summary bar -->
      <div class="flex items-center gap-4 mb-4 p-3 rounded-lg border border-default bg-elevated/50">
        <span class="text-sm font-medium truncate">{{ fileName }}</span>
        <div class="flex items-center gap-3 ml-auto shrink-0">
          <button
            class="flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium transition-colors"
            :class="filterSeverity === 'all' ? 'bg-primary/15 text-primary' : 'text-muted hover:text-default'"
            @click="filterSeverity = 'all'"
          >
            All {{ stats.total }}
          </button>
          <button
            v-if="stats.errors > 0"
            class="flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium transition-colors"
            :class="filterSeverity === 'error' ? 'bg-red-500/15 text-red-500' : 'text-red-500/70 hover:text-red-500'"
            @click="filterSeverity = 'error'"
          >
            <UIcon
              name="i-lucide-circle-x"
              class="size-3.5"
            />
            {{ stats.errors }} errors
          </button>
          <button
            v-if="stats.warnings > 0"
            class="flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium transition-colors"
            :class="filterSeverity === 'warn' ? 'bg-amber-500/15 text-amber-500' : 'text-amber-500/70 hover:text-amber-500'"
            @click="filterSeverity = 'warn'"
          >
            <UIcon
              name="i-lucide-triangle-alert"
              class="size-3.5"
            />
            {{ stats.warnings }} warnings
          </button>
          <button
            class="flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium transition-colors"
            :class="filterSeverity === 'ok' ? 'bg-emerald-500/15 text-emerald-500' : 'text-emerald-500/70 hover:text-emerald-500'"
            @click="filterSeverity = 'ok'"
          >
            <UIcon
              name="i-lucide-circle-check"
              class="size-3.5"
            />
            {{ stats.ok }} OK
          </button>
        </div>
      </div>

      <!-- Verdict banner -->
      <div
        v-if="stats.errors === 0"
        class="mb-4 p-4 rounded-lg border border-emerald-500/30 bg-emerald-500/5 flex items-center gap-3"
      >
        <UIcon
          name="i-lucide-circle-check"
          class="size-6 text-emerald-500 shrink-0"
        />
        <div>
          <p class="font-medium text-sm text-emerald-500">
            All checks passed
          </p>
          <p class="text-xs text-muted mt-0.5">
            All LZ4 streams decompress and roundtrip correctly. No structural issues detected.
          </p>
        </div>
      </div>
      <div
        v-else
        class="mb-4 p-4 rounded-lg border border-red-500/30 bg-red-500/5 flex items-center gap-3"
      >
        <UIcon
          name="i-lucide-circle-x"
          class="size-6 text-red-500 shrink-0"
        />
        <div>
          <p class="font-medium text-sm text-red-500">
            {{ stats.errors }} error{{ stats.errors > 1 ? 's' : '' }} found
          </p>
          <p class="text-xs text-muted mt-0.5">
            Some blobs have corrupted LZ4 streams or structural issues. The game may crash when loading these entries.
          </p>
        </div>
      </div>

      <!-- Grouped results -->
      <div class="space-y-4">
        <div
          v-for="[table, items] in groupedResults"
          :key="table"
        >
          <h3 class="text-sm font-medium text-muted uppercase tracking-wider mb-2">
            {{ TABLE_LABELS[table] || table }}
          </h3>
          <div class="space-y-1">
            <div
              v-for="(r, idx) in items"
              :key="idx"
              class="flex items-start gap-2.5 px-3 py-2 rounded-lg border border-default text-sm"
              :class="{
                'bg-red-500/5 border-red-500/20': r.severity === 'error',
                'bg-amber-500/5 border-amber-500/20': r.severity === 'warn'
              }"
            >
              <UIcon
                :name="severityIcon(r.severity)"
                class="size-4 shrink-0 mt-0.5"
                :class="severityColor(r.severity)"
              />
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-2">
                  <span class="font-medium">{{ r.label }}</span>
                  <span class="text-xs text-muted font-mono">[{{ r.key }}]</span>
                </div>
                <p class="text-muted text-xs mt-0.5">
                  {{ r.message }}
                </p>
                <p
                  v-if="r.details"
                  class="text-xs text-muted mt-0.5 font-mono"
                >
                  {{ r.details }}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Empty filter -->
      <div
        v-if="filteredResults.length === 0"
        class="text-center text-muted py-8 text-sm"
      >
        No results match the current filter.
      </div>
    </template>
  </div>
</template>
