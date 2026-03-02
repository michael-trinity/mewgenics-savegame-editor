import { openDatabase, exportDatabase } from './sqlite'
import { recompressCatBlob } from './lz4'
import { buildInventoryBlob } from './patch/inventory'
import { buildFurnitureBlob } from './patch/furniture'
import type { ParsedCat, InventoryItem, FurnitureItem } from '~/types/save'

/**
 * Convert a Uint8Array to a SQL hex literal: X'AABB...'
 * Used instead of bind parameters for BLOB data because Vite's CJS→ESM
 * pre-bundling of sql.js breaks Emscripten's allocate() used in bindBlob().
 */
function sqlHexLiteral(data: Uint8Array): string {
  const hex = Array.from(data, b => b.toString(16).padStart(2, '0')).join('')
  return `X'${hex}'`
}

export interface DirtyChanges {
  cats?: ParsedCat[]
  properties?: Map<string, string | number>
  deletePropertyKeys?: string[]
  inventory?: {
    backpack?: InventoryItem[]
    storage?: InventoryItem[]
    trash?: InventoryItem[]
  }
  furniture?: FurnitureItem[]
}

/**
 * Build a modified save file by writing only the changed data back
 * into the SQLite database. Unchanged cats/properties/inventory are left as-is.
 */
export async function buildModifiedSave(
  originalBytes: Uint8Array,
  changes: DirtyChanges
): Promise<Uint8Array> {
  // Create a fresh ArrayBuffer copy to avoid SharedArrayBuffer issues
  const bufferCopy = new ArrayBuffer(originalBytes.byteLength)
  new Uint8Array(bufferCopy).set(originalBytes)
  const db = await openDatabase(bufferCopy)

  try {
    // Recompress and write only modified cats
    if (changes.cats) {
      for (const cat of changes.cats) {
        const blob = new Uint8Array(cat.decompressedBlob)
        const compressed = await recompressCatBlob(blob, cat.lz4Variant)
        db.run(`UPDATE cats SET data=${sqlHexLiteral(compressed)} WHERE key=${cat.key}`)
      }
    }

    // Write only changed properties
    if (changes.properties) {
      for (const [key, value] of changes.properties.entries()) {
        const escaped = String(key).replace(/'/g, '\'\'')
        if (typeof value === 'number') {
          db.run(`UPDATE properties SET data=${value} WHERE key='${escaped}'`)
        } else {
          const escapedVal = String(value).replace(/'/g, '\'\'')
          db.run(`UPDATE properties SET data='${escapedVal}' WHERE key='${escaped}'`)
        }
      }
    }

    // Delete property keys
    if (changes.deletePropertyKeys) {
      for (const key of changes.deletePropertyKeys) {
        const escaped = String(key).replace(/'/g, '\'\'')
        db.run(`DELETE FROM properties WHERE key='${escaped}'`)
      }
    }

    // Write only changed inventory containers
    if (changes.inventory) {
      if (changes.inventory.backpack) {
        const blob = buildInventoryBlob(changes.inventory.backpack)
        db.run(`UPDATE files SET data=${sqlHexLiteral(blob)} WHERE key='inventory_backpack'`)
      }
      if (changes.inventory.storage) {
        const blob = buildInventoryBlob(changes.inventory.storage)
        db.run(`UPDATE files SET data=${sqlHexLiteral(blob)} WHERE key='inventory_storage'`)
      }
      if (changes.inventory.trash) {
        const blob = buildInventoryBlob(changes.inventory.trash)
        db.run(`UPDATE files SET data=${sqlHexLiteral(blob)} WHERE key='inventory_trash'`)
      }
    }

    // Rewrite all furniture (delete all + re-insert)
    if (changes.furniture) {
      db.run('DELETE FROM furniture')
      for (const item of changes.furniture) {
        const blob = buildFurnitureBlob(item)
        db.run(`INSERT INTO furniture (key, data) VALUES (${item.key}, ${sqlHexLiteral(blob)})`)
      }
    }

    return exportDatabase(db)
  } finally {
    db.close()
  }
}
