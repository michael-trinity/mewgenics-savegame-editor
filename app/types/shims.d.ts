declare module 'sql.js' {
  export interface Database {
    run(sql: string, params?: any[]): Database
    exec(sql: string): any[]
    prepare(sql: string): Statement
    export(): Uint8Array
    close(): void
  }

  export interface Statement {
    bind(params?: any[]): boolean
    step(): boolean
    get(): any[]
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
