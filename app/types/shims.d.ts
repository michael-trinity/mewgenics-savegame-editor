declare module 'sql.js' {
  export type SqlValue = number | string | null | Uint8Array | bigint

  export interface QueryExecResult {
    columns: string[]
    values: SqlValue[][]
  }

  export interface Database {
    run(sql: string, params?: SqlValue[]): Database
    exec(sql: string): QueryExecResult[]
    prepare(sql: string): Statement
    export(): Uint8Array
    close(): void
  }

  export interface Statement {
    bind(params?: SqlValue[]): boolean
    step(): boolean
    get(): SqlValue[]
    free(): boolean
  }

  export interface SqlJsStatic {
    Database: new (data?: Uint8Array) => Database
  }

  export default function initSqlJs(config?: {
    locateFile?: (file: string) => string
    wasmBinary?: ArrayBuffer
  }): Promise<SqlJsStatic>
}
