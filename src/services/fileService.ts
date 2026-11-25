/**
 * Native file operations: PDF, CSV, share sheet, backup and restore. Works fully offline;
 * files are written to the app's own storage and handed to the system share sheet.
 */
import { Platform } from 'react-native';
import * as FS from '@dr.pogodin/react-native-fs';
import Share from 'react-native-share';
import { generatePDF } from 'react-native-html-to-pdf';
import { keepLocalCopy, pick, types, isErrorWithCode, errorCodes } from '@react-native-documents/picker';
import { getDb } from '../data/db/database';
import { exportBackup, importBackup, validateBackup, BackupError } from '../data/repositories/backupRepository';
import { statsRepository } from '../data/repositories/statsRepository';
import { teamRepository } from '../data/repositories/teamRepository';
import type { LoadedMatch } from './matchService';
import { matchService } from './matchService';
import { ballByBallCsv, careersCsv, safeFileName, scorecardCsv, scorecardHtml } from './exporters';
import { bumpData } from '../stores/appStore';

const fileUrl = (p: string) => (p.startsWith('file://') ? p : `file://${p}`);

function stamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
}

async function shareFile(path: string, mime: string, title: string): Promise<void> {
  await Share.open({ url: fileUrl(path), type: mime, filename: path.split('/').pop(), title, failOnCancel: false });
}

function namesOf(m: LoadedMatch): Record<string, string> {
  const n: Record<string, string> = {};
  for (const p of Object.values(m.players)) {
    n[p.id] = p.name;
  }
  return n;
}

export const fileService = {
  async exportScorecardPdf(m: LoadedMatch): Promise<string> {
    const names = namesOf(m);
    const toss = m.record.tossWinnerId ? `${m.record.tossWinnerId === m.teams.a.id ? m.teams.a.name : m.teams.b.name} won the toss and chose to ${m.record.tossDecision}` : null;
    const html = scorecardHtml(m.state, names, { title: m.record.title, venue: m.record.venue, date: m.record.completedAt ?? m.record.scheduledAt ?? m.record.createdAt, tossText: toss });
    const res = await generatePDF({ html, fileName: `${safeFileName(m.record.title)}-scorecard`, directory: Platform.OS === 'ios' ? 'Documents' : undefined, width: 595, height: 842, padding: 0, shouldPrintBackgrounds: true });
    await shareFile(res.filePath, 'application/pdf', 'Share scorecard');
    return res.filePath;
  },

  async exportMatchCsv(m: LoadedMatch, kind: 'balls' | 'scorecard'): Promise<string> {
    const names = namesOf(m);
    const csv = kind === 'balls' ? ballByBallCsv(m.state, names) : scorecardCsv(m.state, names);
    const path = `${FS.CachesDirectoryPath}/${safeFileName(m.record.title)}-${kind === 'balls' ? 'ball-by-ball' : 'scorecard'}.csv`;
    await FS.writeFile(path, csv, 'utf8');
    await shareFile(path, 'text/csv', 'Share CSV');
    return path;
  },

  async exportCareersCsv(): Promise<string> {
    const db = await getDb();
    const [careers, teams] = await Promise.all([statsRepository.allCareers(db), teamRepository.list(db)]);
    const names: Record<string, string> = {};
    teams.forEach(t => (names[t.id] = t.name));
    const path = `${FS.CachesDirectoryPath}/player-statistics-${stamp()}.csv`;
    await FS.writeFile(path, careersCsv(careers, names), 'utf8');
    await shareFile(path, 'text/csv', 'Share statistics');
    return path;
  },

  async shareImage(uri: string, message: string): Promise<void> {
    await Share.open({ url: fileUrl(uri), type: 'image/png', message, failOnCancel: false });
  },

  /** Writes a JSON backup to the app's documents folder and opens the share sheet to save it elsewhere. */
  async createBackup(): Promise<{ path: string; counts: Record<string, number> }> {
    const db = await getDb();
    const backup = await exportBackup(db);
    const path = `${FS.DocumentDirectoryPath}/cricpilot-backup-${stamp()}.json`;
    await FS.writeFile(path, JSON.stringify(backup), 'utf8');
    await shareFile(path, 'application/json', 'Save backup');
    return { path, counts: backup.counts };
  },

  /** Lets the user choose a backup file, validates it fully, then replaces all data in one transaction. */
  async restoreBackup(): Promise<Record<string, number> | null> {
    let picked;
    try {
      picked = await pick({ type: [types.json, types.plainText, types.allFiles], mode: 'import' });
    } catch (e) {
      if (isErrorWithCode(e) && e.code === errorCodes.OPERATION_CANCELED) {
        return null;
      }
      throw e;
    }
    const file = picked[0];
    const [copy] = await keepLocalCopy({ files: [{ uri: file.uri, fileName: file.name ?? 'backup.json' }], destination: 'cachesDirectory' });
    if (copy.status !== 'success') {
      throw new BackupError(`Could not read the file: ${copy.copyError}`);
    }
    const local = decodeURIComponent(copy.localUri.replace('file://', ''));
    const text = await FS.readFile(local, 'utf8');
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new BackupError('This file is not a valid backup (it is not JSON).');
    }
    const backup = validateBackup(parsed);
    const db = await getDb();
    const counts = await importBackup(db, backup);
    // summaries and stats are rebuilt from the restored events so they always match the scoring engine
    await matchService.rebuildAll();
    bumpData();
    FS.unlink(local).catch(() => undefined);
    return counts;
  },
};
