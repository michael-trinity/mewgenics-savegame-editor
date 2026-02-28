<script setup lang="ts">
const { loadFile, isLoading, error, saveState } = useSaveEditor()
const { init: initGameData } = useGameData()
const router = useRouter()

const fileRef = ref<HTMLInputElement | null>(null)
const dragging = ref(false)

async function handleFile(file: File) {
  if (!file.name.endsWith('.sav')) {
    return
  }

  try {
    await Promise.all([
      loadFile(file),
      initGameData()
    ])
    await router.push('/editor')
  } catch {
    // Error is already set in useSaveEditor
  }
}

function onFileChange(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) handleFile(file)
}

function onDrop(e: DragEvent) {
  dragging.value = false
  const file = e.dataTransfer?.files?.[0]
  if (file) handleFile(file)
}

// If save is already loaded, redirect to editor
onMounted(() => {
  if (saveState.value) {
    router.push('/editor')
  }
})
</script>

<template>
  <div class="min-h-[80vh] flex flex-col items-center justify-center px-4">
    <div class="text-center mb-8">
      <UIcon
        name="i-lucide-cat"
        class="size-16 text-primary mb-4"
      />
      <h1 class="text-4xl font-bold mb-3">
        Mewgenics Save Editor
      </h1>
      <p class="text-lg text-muted max-w-lg mx-auto">
        Edit your cats' stats, abilities, equipment, mutations, and more.
        Everything runs in your browser - your save file never leaves your computer.
      </p>
    </div>

    <div
      class="w-full max-w-lg p-12 border-2 border-dashed rounded-xl text-center cursor-pointer transition-colors"
      :class="[
        dragging ? 'border-primary bg-primary/5' : 'border-muted hover:border-primary/50',
        isLoading ? 'pointer-events-none opacity-50' : ''
      ]"
      @click="fileRef?.click()"
      @dragover.prevent="dragging = true"
      @dragleave="dragging = false"
      @drop.prevent="onDrop"
    >
      <div
        v-if="isLoading"
        class="flex flex-col items-center gap-3"
      >
        <UIcon
          name="i-lucide-loader-2"
          class="size-10 text-primary animate-spin"
        />
        <p class="text-sm text-muted">
          Loading save file...
        </p>
      </div>

      <div
        v-else
        class="flex flex-col items-center gap-3"
      >
        <UIcon
          name="i-lucide-upload"
          class="size-10 text-muted"
        />
        <div>
          <p class="font-medium">
            Drop your save file here
          </p>
          <p class="text-sm text-muted mt-1">
            or click to browse (e.g. steamcampaign01.sav)
          </p>
        </div>
      </div>

      <input
        ref="fileRef"
        type="file"
        accept=".sav"
        class="hidden"
        @change="onFileChange"
      >
    </div>

    <UAlert
      v-if="error"
      class="mt-4 max-w-lg w-full"
      color="error"
      icon="i-lucide-alert-circle"
      :title="error"
    />

    <div class="mt-12 grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-2xl w-full">
      <div class="text-center">
        <UIcon
          name="i-lucide-shield"
          class="size-8 text-primary mb-2"
        />
        <h3 class="font-medium text-sm">
          100% Client-Side
        </h3>
        <p class="text-xs text-muted mt-1">
          No data uploaded anywhere
        </p>
      </div>
      <div class="text-center">
        <UIcon
          name="i-lucide-file-down"
          class="size-8 text-primary mb-2"
        />
        <h3 class="font-medium text-sm">
          Auto Backup
        </h3>
        <p class="text-xs text-muted mt-1">
          Download backup before saving
        </p>
      </div>
      <div class="text-center">
        <UIcon
          name="i-lucide-sparkles"
          class="size-8 text-primary mb-2"
        />
        <h3 class="font-medium text-sm">
          Full Editor
        </h3>
        <p class="text-xs text-muted mt-1">
          Stats, abilities, items & more
        </p>
      </div>
    </div>

    <div class="mt-8">
      <NuxtLink
        to="/checker"
        class="flex items-center gap-2 text-sm text-muted hover:text-primary transition-colors"
      >
        <UIcon
          name="i-lucide-file-search"
          class="size-4"
        />
        Save file integrity checker
      </NuxtLink>
    </div>

    <details class="mt-8 max-w-lg w-full text-sm text-muted">
      <summary class="cursor-pointer hover:text-primary transition-colors flex items-center gap-2">
        <UIcon
          name="i-lucide-folder-open"
          class="size-4 shrink-0"
        />
        Where are save files stored?
      </summary>
      <div class="mt-3 space-y-3 pl-6">
        <div>
          <p class="font-medium text-foreground/80">
            Windows
          </p>
          <code class="text-xs break-all">%APPDATA%\Glaiel Games\Mewgenics\&lt;SteamID&gt;\saves\</code>
        </div>
        <div>
          <p class="font-medium text-foreground/80">
            Linux / Steam Deck
          </p>
          <code class="text-xs break-all">~/.local/share/Steam/steamapps/compatdata/&lt;AppID&gt;/pfx/drive_c/users/steamuser/Documents/My Games/Mewgenics/</code>
        </div>
      </div>
    </details>
  </div>
</template>
