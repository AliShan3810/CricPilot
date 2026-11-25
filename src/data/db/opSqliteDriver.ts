import { open, type DB } from '@op-engineering/op-sqlite';
import { DatabaseError, type Row, type SqlDriver, type SqlExecutor, type SqlValue } from './driver';

function wrap(db: Pick<DB, 'execute'>): SqlExecutor {
  return {
    async execute(sql: string, params: SqlValue[] = []) {
      try {
        const res = await db.execute(sql, params);
        return { rows: (res.rows ?? []) as Row[], rowsAffected: res.rowsAffected ?? 0 };
      } catch (e) {
        throw new DatabaseError(e instanceof Error ? e.message : String(e), e);
      }
    },
  };
}

export function openOpSqlite(name = 'cricpilot.db'): SqlDriver {
  const db = open({ name });
  // WAL makes writes faster and keeps reads working during a write
  db.executeSync('PRAGMA journal_mode = WAL');
  db.executeSync('PRAGMA foreign_keys = ON');
  const base = wrap(db);
  return {
    ...base,
    async transaction<T>(fn: (tx: SqlExecutor) => Promise<T>): Promise<T> {
      let result: T | undefined;
      await db.transaction(async tx => {
        result = await fn(wrap(tx));
      });
      return result as T;
    },
    close() {
      db.close();
    },
  };
}
