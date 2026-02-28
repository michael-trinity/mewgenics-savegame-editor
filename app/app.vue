<script setup lang="ts">
useHead({
  meta: [
    { name: 'viewport', content: 'width=device-width, initial-scale=1' }
  ],
  link: [
    { rel: 'icon', href: '/favicon.ico' }
  ],
  htmlAttrs: {
    lang: 'en'
  }
})

const title = 'Mewgenics Save Editor'
const description = 'A client-side save editor for Mewgenics. Upload your save file and edit your cats\' stats, abilities, equipment, mutations, and more.'

useSeoMeta({
  title,
  description,
  ogTitle: title,
  ogDescription: description
})

const { saveState, isDirty, downloadModifiedSave, downloadBackup, reset } = useSaveEditor()

const saving = ref(false)
const showSaveModal = ref(false)
const hideSaveModal = useCookie('hide-save-modal', { maxAge: 60 * 60 * 24 * 365 })
const dontShowAgain = ref(false)

async function handleSave() {
  saving.value = true
  try {
    await downloadModifiedSave()
    if (!hideSaveModal.value) {
      showSaveModal.value = true
    }
  } finally {
    saving.value = false
  }
}

function dismissSaveModal() {
  if (dontShowAgain.value) {
    hideSaveModal.value = '1'
  }
  showSaveModal.value = false
}
</script>

<template>
  <UApp>
    <UHeader>
      <template #left>
        <NuxtLink
          to="/"
          class="flex items-center gap-2"
          @click="reset"
        >
          <UIcon
            name="i-lucide-cat"
            class="size-6 text-primary"
          />
          <span class="font-bold text-lg">Mewgenics Save Editor</span>
        </NuxtLink>
      </template>

      <template #right>
        <template v-if="saveState">
          <UBadge
            v-if="isDirty"
            color="warning"
            variant="subtle"
          >
            Unsaved changes
          </UBadge>

          <UButton
            icon="i-lucide-download"
            label="Backup"
            color="neutral"
            variant="ghost"
            size="sm"
            @click="downloadBackup"
          />

          <UButton
            icon="i-lucide-save"
            label="Save"
            color="primary"
            size="sm"
            :loading="saving"
            @click="handleSave"
          />
        </template>

        <UColorModeButton />
      </template>
    </UHeader>

    <UMain>
      <NuxtPage />
    </UMain>

    <UModal
      v-model:open="showSaveModal"
      title="Save file downloaded"
      icon="i-lucide-check-circle"
    >
      <template #body>
        <UAlert
          color="warning"
          icon="i-lucide-triangle-alert"
          title="Always keep a backup of your original save file before replacing it."
          class="mb-4"
        />
        <p class="text-sm text-muted mb-4">
          Place the downloaded file in your Mewgenics saves folder, replacing the original.
        </p>
        <div class="space-y-3 text-sm">
          <div>
            <p class="font-medium mb-1">
              Windows
            </p>
            <code class="text-xs break-all text-muted">%APPDATA%\Glaiel Games\Mewgenics\&lt;SteamID&gt;\saves\</code>
          </div>
          <div>
            <p class="font-medium mb-1">
              Linux / Steam Deck
            </p>
            <code class="text-xs break-all text-muted">~/.local/share/Steam/steamapps/compatdata/&lt;AppID&gt;/pfx/drive_c/users/steamuser/Documents/My Games/Mewgenics/</code>
          </div>
        </div>
      </template>
      <template #footer>
        <div class="w-full space-y-3">
          <label class="flex items-center gap-2 text-sm text-muted cursor-pointer">
            <input
              v-model="dontShowAgain"
              type="checkbox"
              class="rounded"
            >
            Don't show this again
          </label>
          <UButton
            label="Got it"
            color="primary"
            block
            @click="dismissSaveModal"
          />
        </div>
      </template>
    </UModal>
  </UApp>
</template>
