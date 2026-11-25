/* Test-only SqlDriver backed by Node's built-in SQLite (node:sqlite). */
import type { Row, SqlDriver, SqlExecutor, SqlValue } from '../db/driver';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { DatabaseSync } = require('node:sqlite');

export function createNodeDriver(): SqlDriver {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON');
  let inTx = false;
  const exec: SqlExecutor = {
    async execute(sql: string, params: SqlValue[] = []) {
      const stmt = db.prepare(sql);
      const rows = stmt.all(...params) as Row[];
      const changes = db.prepare('SELECT changes() AS c').get() as { c: number };
      return { rows, rowsAffected: changes.c };
    },
  };
  return {
    ...exec,
    async transaction<T>(fn: (tx: SqlExecutor) => Promise<T>): Promise<T> {
      if (inTx) {
        throw new Error('nested transaction');
      }
      inTx = true;
      db.exec('BEGIN');
      try {
        const res = await fn(exec);
        db.exec('COMMIT');
        return res;
      } catch (e) {
        db.exec('ROLLBACK');
        throw e;
      } finally {
        inTx = false;
      }
    },
    close() {
      db.close();
    },
  };
}
