import type { SqlDriver } from './driver';
import { migrate } from './migrations';

let driver: SqlDriver | null = null;
let ready: Promise<SqlDriver> | null = null;

/** Lets tests swap in a driver. The next getDb() call runs migrations on it. */
export function setDriver(d: SqlDriver | null): void {
  driver = d;
  ready = null;
}

export function getDb(): Promise<SqlDriver> {
  if (ready) {
    return ready;
  }
  ready = (async () => {
    if (!driver) {
      // Loaded lazily so the pure parts of the app (and Jest) never import the native module.
      const { openOpSqlite } = require('./opSqliteDriver') as typeof import('./opSqliteDriver');
      driver = openOpSqlite();
    }
    await migrate(driver);
    return driver;
  })();
  ready.catch(() => {
    ready = null;
  });
  return ready;
}
