<script setup lang="ts">
const { selectedCat } = useSaveEditor()
</script>

<template>
  <div class="flex h-full">
    <!-- Sidebar: Cat List -->
    <aside class="w-72 shrink-0 border-r border-default overflow-hidden">
      <EditorCatList />
    </aside>

    <!-- Main: Cat Detail -->
    <main class="flex-1 min-h-0 overflow-hidden p-2">
      <EditorCatDetail v-if="selectedCat" :cat="selectedCat" />
      <div v-else class="flex items-center justify-center h-full text-muted">
        <div class="text-center">
          <UIcon name="i-lucide-cat" class="size-12 mb-3 opacity-50" />
          <p>Select a cat to view details</p>
        </div>
      </div>
    </main>
  </div>
</template>
