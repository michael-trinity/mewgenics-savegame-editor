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
async function handleSave() {
  saving.value = true
  try {
    await downloadModifiedSave()
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <UApp>
    <UHeader>
      <template #left>
        <NuxtLink to="/" class="flex items-center gap-2" @click="reset">
          <UIcon name="i-lucide-cat" class="size-6 text-primary" />
          <span class="font-bold text-lg">Mewgenics Save Editor</span>
        </NuxtLink>
      </template>

      <template #right>
        <template v-if="saveState">
          <UBadge v-if="isDirty" color="warning" variant="subtle">
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

  </UApp>
</template>
