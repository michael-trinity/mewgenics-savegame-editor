import { toRaw } from 'vue'
import { loadSaveFile } from '~/utils/parse/saveLoader'
import { buildModifiedSave } from '~/utils/saveWriter'
import type { SaveState, ParsedCat, GameProperties, InventoryItem } from '~/types/save'

const saveState = ref<SaveState | null>(null)
const isLoading = ref(false)
const error = ref<string | null>(null)
const selectedCatKey = ref<number | null>(null)
const isDirty = ref(false)

// Dirty tracking — only write what actually changed
const dirtyCatKeys = ref<Set<number>>(new Set())
const dirtyPropertyKeys = ref<Set<string>>(new Set())
const dirtyInventoryContainers = ref<Set<string>>(new Set())

export function useSaveEditor() {
  const cats = computed(() => saveState.value?.cats ?? [])
  const selectedCat = computed(() =>
    cats.value.find(c => c.key === selectedCatKey.value) ?? null
  )
  const currentDay = computed(() => saveState.value?.currentDay ?? null)
  const fileName = computed(() => saveState.value?.fileName ?? '')

  async function loadFile(file: File): Promise<void> {
    isLoading.value = true
    error.value = null
    selectedCatKey.value = null
    isDirty.value = false
    dirtyCatKeys.value.clear()
    dirtyPropertyKeys.value.clear()
    dirtyInventoryContainers.value.clear()

    try {
      const buffer = await file.arrayBuffer()
      const state = await loadSaveFile(buffer, file.name)
      saveState.value = state

      // Auto-select first cat
      if (state.cats.length > 0) {
        selectedCatKey.value = state.cats[0]!.key
      }
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : 'Failed to load save file'
      saveState.value = null
      throw e
    } finally {
      isLoading.value = false
    }
  }

  function selectCat(key: number): void {
    selectedCatKey.value = key
  }

  function updateCatBlob(key: number, newBlob: Uint8Array): void {
    if (!saveState.value) return
    const idx = saveState.value.cats.findIndex(c => c.key === key)
    if (idx === -1) return
    saveState.value.cats[idx]!.decompressedBlob = newBlob
    dirtyCatKeys.value.add(key)
    isDirty.value = true
  }

  function updateCat(key: number, updates: Partial<ParsedCat>): void {
    if (!saveState.value) return
    const idx = saveState.value.cats.findIndex(c => c.key === key)
    if (idx === -1) return
    Object.assign(saveState.value.cats[idx]!, updates)
    dirtyCatKeys.value.add(key)
    isDirty.value = true
  }

  async function exportSave(): Promise<Blob> {
    if (!saveState.value) throw new Error('No save loaded')
    // Strip Vue reactive proxies before passing to pure utility functions
    const raw = toRaw(saveState.value)

    // Only pass dirty cats (avoid recompressing unchanged blobs)
    const dirtyCats = dirtyCatKeys.value.size > 0
      ? raw.cats.filter(c => dirtyCatKeys.value.has(c.key))
      : undefined

    // Only pass dirty properties
    let dirtyProps: Map<string, string | number> | undefined
    if (dirtyPropertyKeys.value.size > 0) {
      dirtyProps = new Map()
      for (const key of dirtyPropertyKeys.value) {
        const val = raw.properties.raw.get(key)
        if (val !== undefined && typeof val !== 'object') {
          dirtyProps.set(key, val as string | number)
        }
      }
    }

    // Only pass dirty inventory containers
    let dirtyInventory: { backpack?: typeof raw.inventory.backpack, storage?: typeof raw.inventory.storage, trash?: typeof raw.inventory.trash } | undefined
    if (dirtyInventoryContainers.value.size > 0) {
      dirtyInventory = {}
      if (dirtyInventoryContainers.value.has('backpack')) dirtyInventory.backpack = raw.inventory.backpack
      if (dirtyInventoryContainers.value.has('storage')) dirtyInventory.storage = raw.inventory.storage
      if (dirtyInventoryContainers.value.has('trash')) dirtyInventory.trash = raw.inventory.trash
    }

    const modified = await buildModifiedSave(raw.originalBytes, {
      cats: dirtyCats,
      properties: dirtyProps,
      inventory: dirtyInventory
    })
    return new Blob([modified as BlobPart], { type: 'application/octet-stream' })
  }

  function downloadBlob(data: Uint8Array | Blob, downloadFileName: string): void {
    const blob = data instanceof Blob ? data : new Blob([data as BlobPart], { type: 'application/octet-stream' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = downloadFileName
    a.style.display = 'none'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 10000)
  }

  async function downloadModifiedSave(): Promise<void> {
    const blob = await exportSave()
    downloadBlob(blob, fileName.value || 'modified.sav')
    // Clear dirty state after successful save
    isDirty.value = false
    dirtyCatKeys.value.clear()
    dirtyPropertyKeys.value.clear()
    dirtyInventoryContainers.value.clear()
  }

  function downloadBackup(): void {
    if (!saveState.value) return
    const backupName = (saveState.value.fileName || 'save').replace('.sav', '_backup.savbak')
    downloadBlob(saveState.value.originalBytes, backupName)
  }

  function reset(): void {
    saveState.value = null
    selectedCatKey.value = null
    isDirty.value = false
    error.value = null
    dirtyCatKeys.value.clear()
    dirtyPropertyKeys.value.clear()
    dirtyInventoryContainers.value.clear()
  }

  function updateProperty<K extends keyof GameProperties>(key: K, value: GameProperties[K]): void {
    if (!saveState.value) return
    saveState.value.properties[key] = value
    // Keep currentDay in sync
    if (key === 'currentDay') {
      saveState.value.currentDay = value as number
    }
    isDirty.value = true
  }

  function updateRawProperty(key: string, value: string | number): void {
    if (!saveState.value) return
    saveState.value.properties.raw.set(key, value)
    dirtyPropertyKeys.value.add(key)
    // Sync named fields when their raw key is updated
    const keyMap: Record<string, keyof GameProperties> = {
      current_day: 'currentDay',
      house_gold: 'houseGold',
      house_food: 'houseFood',
      blank_collars: 'blankCollars',
      adventure_coins: 'adventureCoins',
      adventure_food: 'adventureFood',
      save_file_percent: 'saveFilePercent',
      house_storage_upgrades: 'houseStorageUpgrades',
      adventure_furniture_boxes: 'adventureFurnitureBoxes',
      min_strays_tomorrow: 'minStraysTomorrow'
    }
    const namedKey = keyMap[key]
    if (namedKey && typeof value === 'number') {
      (saveState.value.properties as unknown as Record<string, number>)[namedKey] = value
    }
    if (key === 'current_day' && typeof value === 'number') {
      saveState.value.currentDay = value
    }
    isDirty.value = true
  }

  function addInventoryItem(container: 'backpack' | 'storage' | 'trash', item: InventoryItem): void {
    if (!saveState.value) return
    saveState.value.inventory[container].push(item)
    dirtyInventoryContainers.value.add(container)
    isDirty.value = true
  }

  function removeInventoryItem(container: 'backpack' | 'storage' | 'trash', index: number): void {
    if (!saveState.value) return
    saveState.value.inventory[container].splice(index, 1)
    dirtyInventoryContainers.value.add(container)
    isDirty.value = true
  }

  function getCatLocation(key: number): string {
    if (!saveState.value) return ''
    if (saveState.value.adventureKeys.includes(key)) return 'Adventure'
    const house = saveState.value.houseCats.find(h => h.key === key)
    return house?.room ?? ''
  }

  return {
    saveState: readonly(saveState),
    isLoading: readonly(isLoading),
    error: readonly(error),
    selectedCatKey: readonly(selectedCatKey),
    isDirty: readonly(isDirty),
    cats,
    selectedCat,
    currentDay,
    fileName,
    loadFile,
    selectCat,
    updateCat,
    updateCatBlob,
    updateProperty,
    updateRawProperty,
    exportSave,
    downloadModifiedSave,
    downloadBackup,
    reset,
    getCatLocation,
    addInventoryItem,
    removeInventoryItem
  }
}
