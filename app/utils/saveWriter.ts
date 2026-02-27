import { openDatabase, exportDatabase } from './sqlite'
import { recompressCatBlob } from './lz4'
import { buildInventoryBlob } from './patch/inventory'
import type { ParsedCat, InventoryItem } from '~/types/save'

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
  inventory?: {
    backpack?: InventoryItem[]
    storage?: InventoryItem[]
    trash?: InventoryItem[]
  }
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
        db.run('UPDATE properties SET data=? WHERE key=?', [value, key])
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

    return exportDatabase(db)
  } finally {
    db.close()
  }
}
