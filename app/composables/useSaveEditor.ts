import { toRaw } from 'vue'
import { loadSaveFile } from '~/utils/parse/saveLoader'
import { buildModifiedSave } from '~/utils/saveWriter'
import { patchU64TierEntry } from '~/utils/patch/abilities'
import { buildAbilitySlots } from '~/utils/parse/abilities'
import { setFlag } from '~/utils/patch/flags'
import { readStatusFlags } from '~/utils/parse/catMeta'
import { patchBirthday } from '~/utils/patch/birthday'
import { writeI32LE } from '~/utils/binary'
import type { SaveState, ParsedCat, GameProperties, InventoryItem, FurnitureItem } from '~/types/save'

const saveState = ref<SaveState | null>(null)
const isLoading = ref(false)
const error = ref<string | null>(null)
const selectedCatKey = ref<number | null>(null)
const isDirty = ref(false)

// Dirty tracking — only write what actually changed
const dirtyCatKeys = ref<Set<number>>(new Set())
const dirtyPropertyKeys = ref<Set<string>>(new Set())
const dirtyInventoryContainers = ref<Set<string>>(new Set())
const furnitureDirty = ref(false)
const houseCatsDirty = ref(false)
const deletedPropertyKeys = ref<string[]>([])

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
    furnitureDirty.value = false
    houseCatsDirty.value = false
    deletedPropertyKeys.value = []

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
      deletePropertyKeys: deletedPropertyKeys.value.length > 0 ? deletedPropertyKeys.value : undefined,
      inventory: dirtyInventory,
      furniture: furnitureDirty.value ? raw.furniture : undefined,
      houseCats: houseCatsDirty.value ? raw.houseCats : undefined
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
    furnitureDirty.value = false
    houseCatsDirty.value = false
    deletedPropertyKeys.value = []
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
    furnitureDirty.value = false
    houseCatsDirty.value = false
    deletedPropertyKeys.value = []
  }

  const namedToRawKey: Record<string, string> = {
    currentDay: 'current_day',
    houseGold: 'house_gold',
    houseFood: 'house_food',
    blankCollars: 'blank_collars',
    adventureCoins: 'adventure_coins',
    adventureFood: 'adventure_food',
    saveFilePercent: 'save_file_percent',
    houseStorageUpgrades: 'house_storage_upgrades',
    adventureFurnitureBoxes: 'adventure_furniture_boxes',
    minStraysTomorrow: 'min_strays_tomorrow'
  }

  function updateProperty<K extends keyof GameProperties>(key: K, value: GameProperties[K]): void {
    if (!saveState.value) return
    saveState.value.properties[key] = value
    // Keep currentDay in sync
    if (key === 'currentDay') {
      saveState.value.currentDay = value as number
    }
    // Sync to raw map so save writer picks it up
    const rawKey = namedToRawKey[key]
    if (rawKey && (typeof value === 'number' || typeof value === 'string')) {
      saveState.value.properties.raw.set(rawKey, value)
      dirtyPropertyKeys.value.add(rawKey)
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

  function addFurniture(item: FurnitureItem): void {
    if (!saveState.value) return
    saveState.value.furniture.push(item)
    furnitureDirty.value = true
    isDirty.value = true
  }

  function removeFurniture(key: number): void {
    if (!saveState.value) return
    const idx = saveState.value.furniture.findIndex(f => f.key === key)
    if (idx === -1) return
    saveState.value.furniture.splice(idx, 1)
    furnitureDirty.value = true
    isDirty.value = true
  }

  function reviveDeadCat(key: number, blob: Uint8Array, cat: ParsedCat): void {
    if (!saveState.value) return
    const idx = saveState.value.deadCats.findIndex(c => c.key === key)
    if (idx === -1) return

    cat.decompressedBlob = blob

    // Move from deadCats to cats
    saveState.value.deadCats.splice(idx, 1)
    saveState.value.cats.push(cat)
    saveState.value.cats.sort((a, b) => a.name.localeCompare(b.name))

    // Add to houseCats so the game places them in the attic
    saveState.value.houseCats.push({
      key: cat.key,
      room: 'Attic',
      unkU32: 0,
      p0: 0,
      p1: 0,
      p2: 0
    })

    dirtyCatKeys.value.add(key)
    houseCatsDirty.value = true
    isDirty.value = true
  }

  /** Resurrect: keep original stats, level, and age */
  function resurrectCat(key: number): string | null {
    if (!saveState.value) return null
    const cat = saveState.value.deadCats.find(c => c.key === key)
    if (!cat) return null

    let blob: Uint8Array = new Uint8Array(cat.decompressedBlob)

    // Clear the dead flag
    blob = new Uint8Array(setFlag(blob, cat.flags.offset, 0x0020, false))
    cat.flags = readStatusFlags(blob, cat.nameEndRaw)

    reviveDeadCat(key, blob, cat)
    return cat.name || `Cat #${key}`
  }

  /** Reborn: clear dead flag, reset age to 2, reset level to 0 */
  function rebornCat(key: number): string | null {
    if (!saveState.value) return null
    const cat = saveState.value.deadCats.find(c => c.key === key)
    if (!cat) return null

    const day = saveState.value.currentDay
    let blob: Uint8Array = new Uint8Array(cat.decompressedBlob)

    // Clear the dead flag
    blob = new Uint8Array(setFlag(blob, cat.flags.offset, 0x0020, false))
    cat.flags = readStatusFlags(blob, cat.nameEndRaw)

    // Set age to 2 (birthday = currentDay - 2)
    if (day !== null && cat.birthdayOffset !== null) {
      blob = new Uint8Array(patchBirthday(blob, cat.birthdayOffset, day - 2))
      cat.birthdayDay = day - 2
    }

    // Set level to 0
    if (cat.levelOffset !== null) {
      writeI32LE(blob, cat.levelOffset, 0)
      cat.level = 0
    }

    reviveDeadCat(key, blob, cat)
    return cat.name || `Cat #${key}`
  }

  function nextFurnitureKey(): number {
    if (!saveState.value) return 1
    const existing = saveState.value.furniture.map(f => f.key)
    return existing.length > 0 ? Math.max(...existing) + 1 : 1
  }

  function savescumReset(): { deletedKeys: string[], clearedCats: string[] } {
    if (!saveState.value) return { deletedKeys: [], clearedCats: [] }

    // 1. Delete savescum tracker properties
    const savescumKeys = [
      'NPCRSTRACKER_steven_savescum_1alt1',
      'NPCRSTRACKER_steven_savescum_1alt2',
      'NPCRSTRACKER_steven_savescum_1alt3',
      'NPCRSTRACKER_steven_savescum_2alt3'
    ]

    const deletedKeys: string[] = []
    for (const key of savescumKeys) {
      if (saveState.value.properties.raw.has(key)) {
        saveState.value.properties.raw.delete(key)
        deletedPropertyKeys.value.push(key)
        deletedKeys.push(key)
      }
    }

    // 2. Remove DejaVu disorder from adventure cats
    const clearedCats: string[] = []
    const adventureKeys = saveState.value.adventureKeys
    for (const cat of saveState.value.cats) {
      if (!adventureKeys.includes(cat.key)) continue

      const dejaVuSlot = cat.abilities.find(
        s => s.abilityId === 'DejaVu' && s.label.toLowerCase().includes('disorder')
      )
      if (!dejaVuSlot) continue

      // Patch the blob to clear the disorder slot
      if (dejaVuSlot.kind === 'u64tier' && dejaVuSlot.recordOffset != null && dejaVuSlot.byteLength != null) {
        const newBlob = patchU64TierEntry(cat.decompressedBlob, dejaVuSlot.recordOffset, dejaVuSlot.byteLength, 'None', 1)
        cat.decompressedBlob = newBlob
        cat.abilities = buildAbilitySlots(newBlob)
        dirtyCatKeys.value.add(cat.key)
        clearedCats.push(cat.name || `Cat #${cat.key}`)
      }
    }

    if (deletedKeys.length > 0 || clearedCats.length > 0) {
      isDirty.value = true
    }

    return { deletedKeys, clearedCats }
  }

  function getCatLocation(key: number): string {
    if (!saveState.value) return ''
    if (saveState.value.adventureKeys.includes(key)) return 'Adventure'
    const house = saveState.value.houseCats.find(h => h.key === key)
    return house?.room ?? ''
  }

  const deadCats = computed(() => saveState.value?.deadCats ?? [])

  return {
    saveState: readonly(saveState),
    isLoading: readonly(isLoading),
    error: readonly(error),
    selectedCatKey: readonly(selectedCatKey),
    isDirty: readonly(isDirty),
    cats,
    deadCats,
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
    removeInventoryItem,
    addFurniture,
    removeFurniture,
    nextFurnitureKey,
    resurrectCat,
    rebornCat,
    savescumReset
  }
}
