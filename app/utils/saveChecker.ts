import { openDatabase, queryAllRows, queryBlob } from './sqlite'
import { decompressCatBlob, recompressCatBlob } from './lz4'
import { u32LE } from './binary'
import { parseInventoryBlob } from './parse/inventory'
import { parseHouseState, parseAdventureStateKeys } from './parse/houseState'
import { parseFurnitureBlob } from './parse/furniture'
import { detectNameEndAndSex } from './parse/catMeta'

export type CheckSeverity = 'error' | 'warn' | 'ok'

export interface CheckResult {
  table: string
  key: string | number
  label: string
  severity: CheckSeverity
  message: string
  details?: string
}

export interface CheckProgress {
  phase: string
  current: number
  total: number
}

/**
 * Run all integrity checks on a save file.
 * Yields progress updates and returns a list of results.
 */
export async function checkSaveFile(
  buffer: ArrayBuffer,
  onProgress?: (p: CheckProgress) => void
): Promise<CheckResult[]> {
  const results: CheckResult[] = []

  const db = await openDatabase(buffer)
  try {
    // ── 1. Cat blobs ──
    const catRows = queryAllRows(db, 'SELECT key, data FROM cats')
    const totalCats = catRows.length

    for (let i = 0; i < totalCats; i++) {
      const [key, data] = catRows[i]!
      const catKey = key as number
      onProgress?.({ phase: 'Checking cats', current: i + 1, total: totalCats })

      if (!(data instanceof Uint8Array)) {
        results.push({
          table: 'cats', key: catKey, label: `Cat ${catKey}`,
          severity: 'error', message: 'Data is not a blob'
        })
        continue
      }

      if (data.length < 4) {
        results.push({
          table: 'cats', key: catKey, label: `Cat ${catKey}`,
          severity: 'error', message: `Blob too small (${data.length} bytes)`
        })
        continue
      }

      // Check LZ4 header values
      const declaredUncompLen = u32LE(data, 0)
      if (declaredUncompLen === 0) {
        results.push({
          table: 'cats', key: catKey, label: `Cat ${catKey}`,
          severity: 'error', message: 'Declared uncompressed length is 0'
        })
        continue
      }

      if (declaredUncompLen > 1_000_000) {
        results.push({
          table: 'cats', key: catKey, label: `Cat ${catKey}`,
          severity: 'warn', message: `Unusually large uncompressed size: ${declaredUncompLen} bytes`
        })
      }

      // Try decompression
      let decompressed: Uint8Array
      let variant: 'A' | 'B'
      try {
        const result = await decompressCatBlob(data)
        decompressed = result.data
        variant = result.variant
      } catch (e: any) {
        results.push({
          table: 'cats', key: catKey, label: `Cat ${catKey}`,
          severity: 'error', message: 'LZ4 decompression failed',
          details: e?.message
        })
        continue
      }

      // Validate decompressed size matches declared
      if (decompressed.length !== declaredUncompLen) {
        results.push({
          table: 'cats', key: catKey, label: `Cat ${catKey}`,
          severity: 'warn',
          message: `Decompressed size (${decompressed.length}) differs from declared (${declaredUncompLen})`
        })
      }

      // Basic structure: must be at least 12 bytes (header + id64)
      if (decompressed.length < 12) {
        results.push({
          table: 'cats', key: catKey, label: `Cat ${catKey}`,
          severity: 'error', message: `Decompressed blob too small (${decompressed.length} bytes)`
        })
        continue
      }

      // Try to read cat name
      let catName = `Cat ${catKey}`
      try {
        const meta = detectNameEndAndSex(decompressed)
        if (meta.name) catName = meta.name
      } catch { /* use default */ }

      // Roundtrip: recompress then decompress again to verify integrity
      try {
        const recompressed = await recompressCatBlob(decompressed, variant)
        const roundtrip = await decompressCatBlob(recompressed)

        if (roundtrip.data.length !== decompressed.length) {
          results.push({
            table: 'cats', key: catKey, label: catName,
            severity: 'error',
            message: `Roundtrip size mismatch: original ${decompressed.length}, roundtrip ${roundtrip.data.length}`
          })
          continue
        }

        // Byte-level comparison
        let mismatchCount = 0
        let firstMismatch = -1
        for (let j = 0; j < decompressed.length; j++) {
          if (decompressed[j] !== roundtrip.data[j]) {
            mismatchCount++
            if (firstMismatch === -1) firstMismatch = j
          }
        }

        if (mismatchCount > 0) {
          results.push({
            table: 'cats', key: catKey, label: catName,
            severity: 'error',
            message: `Roundtrip data mismatch: ${mismatchCount} bytes differ`,
            details: `First difference at offset 0x${firstMismatch.toString(16)}`
          })
          continue
        }
      } catch (e: any) {
        results.push({
          table: 'cats', key: catKey, label: catName,
          severity: 'error', message: 'Roundtrip recompress/decompress failed',
          details: e?.message
        })
        continue
      }

      results.push({
        table: 'cats', key: catKey, label: catName,
        severity: 'ok', message: `OK (${variant}, ${data.length}B compressed, ${decompressed.length}B decompressed)`
      })
    }

    // ── 2. Files table ──
    const fileRows = queryAllRows(db, 'SELECT key, data FROM files')
    const totalFiles = fileRows.length

    for (let i = 0; i < totalFiles; i++) {
      const [key, data] = fileRows[i]!
      const fileKey = key as string
      onProgress?.({ phase: 'Checking files', current: i + 1, total: totalFiles })

      if (!(data instanceof Uint8Array)) {
        results.push({
          table: 'files', key: fileKey, label: fileKey,
          severity: 'error', message: 'Data is not a blob'
        })
        continue
      }

      if (data.length === 0) {
        results.push({
          table: 'files', key: fileKey, label: fileKey,
          severity: 'warn', message: 'Empty blob (0 bytes)'
        })
        continue
      }

      // Try to parse known file types
      if (fileKey.startsWith('inventory_')) {
        try {
          const items = parseInventoryBlob(data)
          const declaredCount = data.length >= 4 ? u32LE(data, 0) : 0
          if (declaredCount > 0 && items.length !== declaredCount) {
            results.push({
              table: 'files', key: fileKey, label: fileKey,
              severity: 'warn',
              message: `Declared ${declaredCount} items but parsed ${items.length}`
            })
          } else {
            results.push({
              table: 'files', key: fileKey, label: fileKey,
              severity: 'ok', message: `OK (${items.length} items, ${data.length}B)`
            })
          }
        } catch (e: any) {
          results.push({
            table: 'files', key: fileKey, label: fileKey,
            severity: 'error', message: 'Failed to parse inventory blob',
            details: e?.message
          })
        }
        continue
      }

      if (fileKey === 'house_state') {
        try {
          const cats = parseHouseState(data)
          if (cats.length === 0 && data.length > 8) {
            results.push({
              table: 'files', key: fileKey, label: fileKey,
              severity: 'warn', message: `House state has ${data.length}B but parsed 0 entries`
            })
          } else {
            results.push({
              table: 'files', key: fileKey, label: fileKey,
              severity: 'ok', message: `OK (${cats.length} cats, ${data.length}B)`
            })
          }
        } catch (e: any) {
          results.push({
            table: 'files', key: fileKey, label: fileKey,
            severity: 'error', message: 'Failed to parse house_state',
            details: e?.message
          })
        }
        continue
      }

      if (fileKey === 'adventure_state') {
        try {
          const keys = parseAdventureStateKeys(data)
          results.push({
            table: 'files', key: fileKey, label: fileKey,
            severity: 'ok', message: `OK (${keys.length} adventure cats, ${data.length}B)`
          })
        } catch (e: any) {
          results.push({
            table: 'files', key: fileKey, label: fileKey,
            severity: 'error', message: 'Failed to parse adventure_state',
            details: e?.message
          })
        }
        continue
      }

      // Unknown file — just report size
      results.push({
        table: 'files', key: fileKey, label: fileKey,
        severity: 'ok', message: `OK (${data.length}B, not validated)`
      })
    }

    // ── 3. Furniture ──
    const furnRows = queryAllRows(db, 'SELECT key, data FROM furniture')
    const totalFurn = furnRows.length
    let furnFail = 0

    for (let i = 0; i < totalFurn; i++) {
      const [key, data] = furnRows[i]!
      const fKey = key as number
      onProgress?.({ phase: 'Checking furniture', current: i + 1, total: totalFurn })

      if (!(data instanceof Uint8Array) || data.length < 20) {
        results.push({
          table: 'furniture', key: fKey, label: `Furniture ${fKey}`,
          severity: 'error', message: `Invalid blob (${data instanceof Uint8Array ? data.length : 'not blob'}B)`
        })
        furnFail++
        continue
      }

      try {
        const item = parseFurnitureBlob(fKey, data)
        if (!item.name) {
          results.push({
            table: 'furniture', key: fKey, label: `Furniture ${fKey}`,
            severity: 'warn', message: 'Parsed OK but has empty name'
          })
        }
        // Don't spam individual OK results for furniture — summarize at end
      } catch (e: any) {
        results.push({
          table: 'furniture', key: fKey, label: `Furniture ${fKey}`,
          severity: 'error', message: 'Failed to parse furniture blob',
          details: e?.message
        })
        furnFail++
      }
    }

    // Summary for furniture
    if (totalFurn > 0) {
      const okCount = totalFurn - furnFail
      results.push({
        table: 'furniture', key: 'summary', label: 'Furniture (all)',
        severity: furnFail > 0 ? 'warn' : 'ok',
        message: `${okCount}/${totalFurn} parsed OK${furnFail > 0 ? `, ${furnFail} failed` : ''}`
      })
    }

    // ── 4. Properties ──
    onProgress?.({ phase: 'Checking properties', current: 1, total: 1 })
    const propRows = queryAllRows(db, 'SELECT key, data FROM properties')
    let propCount = 0
    let propBlobCount = 0
    for (const [key, data] of propRows) {
      propCount++
      if (data instanceof Uint8Array) propBlobCount++
    }
    results.push({
      table: 'properties', key: 'summary', label: 'Properties (all)',
      severity: 'ok',
      message: `${propCount} properties (${propBlobCount} blobs, ${propCount - propBlobCount} scalars)`
    })

    // ── 5. Winning teams ──
    try {
      const wtRows = queryAllRows(db, 'SELECT key, data FROM winning_teams')
      results.push({
        table: 'winning_teams', key: 'summary', label: 'Winning Teams',
        severity: 'ok', message: `${wtRows.length} entries`
      })
    } catch {
      // Table might not exist
    }

  } finally {
    db.close()
  }

  return results
}
