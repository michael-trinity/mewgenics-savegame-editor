import type { Database } from 'sql.js'
import { queryAllRows } from '../sqlite'
import type { GameProperties } from '~/types/save'

/**
 * Read all properties from the save database and return a structured GameProperties object.
 */
export function readGameProperties(db: Database): GameProperties {
  const raw = new Map<string, string | number | Uint8Array>()

  const rows = queryAllRows(db, 'SELECT key, data FROM properties')
  for (const [key, value] of rows) {
    if (typeof key === 'string') {
      raw.set(key, value as string | number | Uint8Array)
    }
  }

  function getInt(key: string, fallback: number): number {
    const v = raw.get(key)
    if (typeof v === 'number') return v
    if (typeof v === 'string') {
      const n = parseInt(v)
      return isNaN(n) ? fallback : n
    }
    return fallback
  }

  return {
    currentDay: getInt('current_day', 0),
    houseGold: getInt('house_gold', 0),
    houseFood: getInt('house_food', 0),
    blankCollars: getInt('blank_collars', 0),
    adventureCoins: getInt('adventure_coins', 0),
    adventureFood: getInt('adventure_food', 0),
    onAdventure: getInt('on_adventure', 0) === 1,
    saveFilePercent: getInt('save_file_percent', 0),
    houseStorageUpgrades: getInt('house_storage_upgrades', 0),
    adventureFurnitureBoxes: getInt('adventure_furniture_boxes', 0),
    minStraysTomorrow: getInt('min_strays_tomorrow', 0),
    raw
  }
}
