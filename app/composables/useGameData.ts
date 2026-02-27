import { loadAbilitiesDB, loadItemsDB, loadMutationsDB, loadClassesDB } from '~/utils/gamedata'
import type { AbilitiesDB, ItemsDB, MutationsDB, ClassesDB } from '~/types/database'

const abilitiesDB = ref<AbilitiesDB | null>(null)
const itemsDB = ref<ItemsDB | null>(null)
const mutationsDB = ref<MutationsDB | null>(null)
const classesDB = ref<ClassesDB | null>(null)
const loaded = ref(false)

export function useGameData() {
  async function init(): Promise<void> {
    if (loaded.value) return

    const [abil, items, muts, classes] = await Promise.all([
      loadAbilitiesDB(),
      loadItemsDB(),
      loadMutationsDB(),
      loadClassesDB()
    ])

    abilitiesDB.value = abil
    itemsDB.value = items
    mutationsDB.value = muts
    classesDB.value = classes
    loaded.value = true
  }

  return {
    abilitiesDB: readonly(abilitiesDB),
    itemsDB: readonly(itemsDB),
    mutationsDB: readonly(mutationsDB),
    classesDB: readonly(classesDB),
    loaded: readonly(loaded),
    init
  }
}
