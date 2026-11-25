/**
 * A small SQL interface so repositories never depend on a particular SQLite binding.
 * Production: op-sqlite (see opSqliteDriver.ts). Tests: node:sqlite (see __tests__/nodeDriver.ts).
 */
export type SqlValue = string | number | null;
export type Row = Record<string, SqlValue>;

export interface SqlExecutor {
  execute(sql: string, params?: SqlValue[]): Promise<{ rows: Row[]; rowsAffected: number }>;
}

export interface SqlDriver extends SqlExecutor {
  /** Runs fn inside BEGIN/COMMIT; any thrown error rolls back. */
  transaction<T>(fn: (tx: SqlExecutor) => Promise<T>): Promise<T>;
  close(): void;
}

export class DatabaseError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = 'DatabaseError';
  }
}

export function newId(prefix = ''): string {
  const rand = Math.random().toString(36).slice(2, 10);
  const time = Date.now().toString(36);
  const more = Math.random().toString(36).slice(2, 6);
  return `${prefix}${time}${rand}${more}`;
}

export function num(v: SqlValue | undefined): number {
  return typeof v === 'number' ? v : v === null || v === undefined ? 0 : Number(v);
}

export function str(v: SqlValue | undefined): string {
  return v === null || v === undefined ? '' : String(v);
}

export function strOrNull(v: SqlValue | undefined): string | null {
  return v === null || v === undefined ? null : String(v);
}

export function numOrNull(v: SqlValue | undefined): number | null {
  return v === null || v === undefined ? null : Number(v);
}
