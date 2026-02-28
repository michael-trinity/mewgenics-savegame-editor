import type { Database, SqlJsStatic, SqlValue } from 'sql.js'
import initSqlJs from 'sql.js'

let sqlPromise: Promise<SqlJsStatic> | null = null

async function initSQL(): Promise<SqlJsStatic> {
  if (!sqlPromise) {
    // Fetch the WASM binary ourselves to avoid Vite dev server
    // intercepting the request and returning the SPA HTML fallback
    const wasmResponse = await fetch('/sql-wasm.wasm')
    if (!wasmResponse.ok) {
      throw new Error(`Failed to fetch sql-wasm.wasm: ${wasmResponse.status}`)
    }
    const wasmBinary = await wasmResponse.arrayBuffer()
    sqlPromise = initSqlJs({ wasmBinary })
  }
  return sqlPromise
}

export async function openDatabase(buffer: ArrayBuffer): Promise<Database> {
  const SQL = await initSQL()
  return new SQL.Database(new Uint8Array(buffer))
}

export function exportDatabase(db: Database): Uint8Array {
  return db.export()
}

export function queryBlob(db: Database, sql: string, params: SqlValue[] = []): Uint8Array | null {
  const stmt = db.prepare(sql)
  stmt.bind(params)
  if (stmt.step()) {
    const row = stmt.get()
    stmt.free()
    if (row[0] instanceof Uint8Array) return row[0]
    return null
  }
  stmt.free()
  return null
}

export function queryScalar<T = SqlValue>(db: Database, sql: string, params: SqlValue[] = []): T | null {
  const stmt = db.prepare(sql)
  stmt.bind(params)
  if (stmt.step()) {
    const row = stmt.get()
    stmt.free()
    return row[0] as T
  }
  stmt.free()
  return null
}

export function queryAllRows(db: Database, sql: string, params: SqlValue[] = []): SqlValue[][] {
  const results: SqlValue[][] = []
  const stmt = db.prepare(sql)
  stmt.bind(params)
  while (stmt.step()) {
    results.push(stmt.get())
  }
  stmt.free()
  return results
}
