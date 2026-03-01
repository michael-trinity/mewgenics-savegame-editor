import { loadAbilitiesDB, loadItemsDB, loadMutationsDB, loadClassesDB, loadFurnitureDB } from '~/utils/gamedata'
import type { AbilitiesDB, ItemsDB, MutationsDB, ClassesDB, FurnitureDB } from '~/types/database'

const abilitiesDB = ref<AbilitiesDB | null>(null)
const itemsDB = ref<ItemsDB | null>(null)
const mutationsDB = ref<MutationsDB | null>(null)
const classesDB = ref<ClassesDB | null>(null)
const furnitureDB = ref<FurnitureDB | null>(null)
const loaded = ref(false)

export function useGameData() {
  async function init(): Promise<void> {
    if (loaded.value) return

    const [abil, items, muts, classes, furn] = await Promise.all([
      loadAbilitiesDB(),
      loadItemsDB(),
      loadMutationsDB(),
      loadClassesDB(),
      loadFurnitureDB()
    ])

    abilitiesDB.value = abil
    itemsDB.value = items
    mutationsDB.value = muts
    classesDB.value = classes
    furnitureDB.value = furn
    loaded.value = true
  }

  return {
    abilitiesDB: readonly(abilitiesDB),
    itemsDB: readonly(itemsDB),
    mutationsDB: readonly(mutationsDB),
    classesDB: readonly(classesDB),
    furnitureDB: readonly(furnitureDB),
    loaded: readonly(loaded),
    init
  }
}
