import type { Row, SqlDriver, SqlValue } from '../db/driver';
import { SCHEMA_VERSION } from '../db/migrations';
import { BACKUP_APP_IDS, BRAND_NAME } from '../../theme/brand';

/** Tables in dependency order (parents first). */
export const BACKUP_TABLES = [
  'teams',
  'players',
  'tournaments',
  'tournament_teams',
  'matches',
  'fixtures',
  'match_players',
  'match_events',
  'player_match_stats',
] as const;

export type BackupTable = (typeof BACKUP_TABLES)[number];

export interface BackupFile {
  app: string;
  schemaVersion: number;
  exportedAt: number;
  counts: Record<string, number>;
  tables: Record<BackupTable, Row[]>;
}

export class BackupError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BackupError';
  }
}

const REQUIRED_COLUMNS: Record<BackupTable, string[]> = {
  teams: ['id', 'name', 'short_name', 'color'],
  players: ['id', 'name', 'role'],
  tournaments: ['id', 'name', 'format', 'rules_json'],
  tournament_teams: ['tournament_id', 'team_id'],
  matches: ['id', 'title', 'rules_json', 'team_a_id', 'team_b_id', 'status'],
  fixtures: ['id', 'tournament_id', 'stage', 'round', 'slot'],
  match_players: ['match_id', 'team_id', 'player_id', 'batting_order'],
  match_events: ['id', 'match_id', 'seq', 'type', 'payload_json', 'status'],
  player_match_stats: ['match_id', 'player_id', 'team_id'],
};

export async function exportBackup(db: SqlDriver): Promise<BackupFile> {
  const tables = {} as Record<BackupTable, Row[]>;
  const counts: Record<string, number> = {};
  for (const t of BACKUP_TABLES) {
    const { rows } = await db.execute(`SELECT * FROM ${t}`);
    tables[t] = rows;
    counts[t] = rows.length;
  }
  return { app: BRAND_NAME, schemaVersion: SCHEMA_VERSION, exportedAt: Date.now(), counts, tables };
}

/** Checks a parsed backup file. Throws a BackupError with a readable reason. */
export function validateBackup(data: unknown): BackupFile {
  if (!data || typeof data !== 'object') {
    throw new BackupError('This file is not a backup.');
  }
  const b = data as Partial<BackupFile>;
  if (!BACKUP_APP_IDS.includes(String(b.app))) {
    throw new BackupError(`This file was not created by ${BRAND_NAME}.`);
  }
  if (typeof b.schemaVersion !== 'number' || b.schemaVersion > SCHEMA_VERSION) {
    throw new BackupError('This backup was made by a newer version of the app. Update the app and try again.');
  }
  if (!b.tables || typeof b.tables !== 'object') {
    throw new BackupError('The backup has no data.');
  }
  for (const t of BACKUP_TABLES) {
    const rows = (b.tables as Record<string, unknown>)[t];
    if (!Array.isArray(rows)) {
      throw new BackupError(`The backup is missing the ${t.replace(/_/g, ' ')} data.`);
    }
    for (const row of rows) {
      if (!row || typeof row !== 'object') {
        throw new BackupError(`The backup has a damaged ${t.replace(/_/g, ' ')} row.`);
      }
      for (const c of REQUIRED_COLUMNS[t]) {
        if (!(c in (row as object))) {
          throw new BackupError(`The backup has a damaged ${t.replace(/_/g, ' ')} row (missing ${c}).`);
        }
      }
      for (const v of Object.values(row as object)) {
        if (v !== null && typeof v !== 'string' && typeof v !== 'number') {
          throw new BackupError(`The backup has an invalid value in ${t.replace(/_/g, ' ')}.`);
        }
      }
    }
  }
  return b as BackupFile;
}

/** Replaces all data with the backup, inside one transaction. */
export async function importBackup(db: SqlDriver, backup: BackupFile): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  await db.transaction(async tx => {
    await tx.execute('PRAGMA defer_foreign_keys = ON');
    for (const t of [...BACKUP_TABLES].reverse()) {
      await tx.execute(`DELETE FROM ${t}`);
    }
    for (const t of BACKUP_TABLES) {
      const rows = backup.tables[t];
      counts[t] = rows.length;
      for (const row of rows) {
        const cols = Object.keys(row).filter(c => /^[a-z_]+$/.test(c));
        const sql = `INSERT INTO ${t} (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`;
        await tx.execute(sql, cols.map(c => row[c] as SqlValue));
      }
    }
  });
  return counts;
}
