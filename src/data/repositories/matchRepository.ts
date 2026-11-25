import { newId, num, numOrNull, str, strOrNull, type Row, type SqlExecutor } from '../db/driver';
import type { MatchPlayer, MatchRecord, MatchStatus, MatchSummary, StoredEvent } from '../models';
import type { MatchEvent, MatchFormat, MatchRules } from '../../core/engine/types';
import type { PlayerMatchStats } from '../../core/engine/stats';

function parseJson<T>(v: unknown, fallback: T): T {
  if (typeof v !== 'string' || v.length === 0) {
    return fallback;
  }
  try {
    return JSON.parse(v) as T;
  } catch {
    return fallback;
  }
}

export function toMatch(r: Row): MatchRecord {
  return {
    id: str(r.id),
    title: str(r.title),
    format: str(r.format) as MatchFormat,
    rules: parseJson<MatchRules>(r.rules_json, {} as MatchRules),
    teamAId: str(r.team_a_id),
    teamBId: str(r.team_b_id),
    venue: strOrNull(r.venue),
    scheduledAt: numOrNull(r.scheduled_at),
    tossWinnerId: strOrNull(r.toss_winner_id),
    tossDecision: (strOrNull(r.toss_decision) as 'bat' | 'bowl' | null) ?? null,
    status: str(r.status) as MatchStatus,
    tournamentId: strOrNull(r.tournament_id),
    fixtureId: strOrNull(r.fixture_id),
    summary: parseJson<MatchSummary | null>(r.summary_json, null),
    resultText: strOrNull(r.result_text),
    winnerTeamId: strOrNull(r.winner_team_id),
    createdAt: num(r.created_at),
    updatedAt: num(r.updated_at),
    completedAt: numOrNull(r.completed_at),
  };
}

function toEvent(r: Row): StoredEvent {
  return {
    id: str(r.id),
    matchId: str(r.match_id),
    seq: num(r.seq),
    event: JSON.parse(str(r.payload_json)) as MatchEvent,
    status: str(r.status) as 'active' | 'undone',
    createdAt: num(r.created_at),
  };
}

export interface NewMatchRow {
  title: string;
  rules: MatchRules;
  teamAId: string;
  teamBId: string;
  venue: string | null;
  scheduledAt: number | null;
  tournamentId?: string | null;
  fixtureId?: string | null;
}

export const matchRepository = {
  async insert(db: SqlExecutor, m: NewMatchRow): Promise<string> {
    const id = newId('m_');
    const now = Date.now();
    await db.execute(
      `INSERT INTO matches (id, title, format, rules_json, team_a_id, team_b_id, venue, scheduled_at, status, tournament_id, fixture_id, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?, 'scheduled', ?,?,?,?)`,
      [id, m.title, m.rules.format, JSON.stringify(m.rules), m.teamAId, m.teamBId, m.venue, m.scheduledAt, m.tournamentId ?? null, m.fixtureId ?? null, now, now],
    );
    return id;
  },

  async get(db: SqlExecutor, id: string): Promise<MatchRecord | null> {
    const { rows } = await db.execute(`SELECT * FROM matches WHERE id = ?`, [id]);
    return rows[0] ? toMatch(rows[0]) : null;
  },

  async list(db: SqlExecutor, opts: { status?: MatchStatus[]; teamId?: string; tournamentId?: string; limit?: number } = {}): Promise<MatchRecord[]> {
    const where: string[] = [];
    const params: Array<string | number> = [];
    if (opts.status?.length) {
      where.push(`status IN (${opts.status.map(() => '?').join(',')})`);
      params.push(...opts.status);
    }
    if (opts.teamId) {
      where.push(`(team_a_id = ? OR team_b_id = ?)`);
      params.push(opts.teamId, opts.teamId);
    }
    if (opts.tournamentId) {
      where.push(`tournament_id = ?`);
      params.push(opts.tournamentId);
    }
    const sql = `SELECT * FROM matches ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY CASE status WHEN 'live' THEN 0 WHEN 'scheduled' THEN 1 ELSE 2 END,
               COALESCE(completed_at, scheduled_at, updated_at) DESC
      ${opts.limit ? `LIMIT ${Math.floor(opts.limit)}` : ''}`;
    const { rows } = await db.execute(sql, params);
    return rows.map(toMatch);
  },

  async setToss(db: SqlExecutor, id: string, winnerId: string, decision: 'bat' | 'bowl'): Promise<void> {
    await db.execute(`UPDATE matches SET toss_winner_id = ?, toss_decision = ?, updated_at = ? WHERE id = ?`, [winnerId, decision, Date.now(), id]);
  },

  async updateDerived(
    db: SqlExecutor,
    id: string,
    d: { status: MatchStatus; summary: MatchSummary; resultText: string | null; winnerTeamId: string | null },
  ): Promise<void> {
    const now = Date.now();
    await db.execute(
      `UPDATE matches SET status = ?, summary_json = ?, result_text = ?, winner_team_id = ?, updated_at = ?,
         completed_at = CASE WHEN ? = 'completed' THEN COALESCE(completed_at, ?) ELSE NULL END
       WHERE id = ?`,
      [d.status, JSON.stringify(d.summary), d.resultText, d.winnerTeamId, now, d.status, now, id],
    );
  },

  async remove(db: SqlExecutor, id: string): Promise<void> {
    await db.execute(`UPDATE fixtures SET match_id = NULL WHERE match_id = ?`, [id]);
    await db.execute(`DELETE FROM matches WHERE id = ?`, [id]);
  },

  /* ----- players ----- */
  async setPlayers(db: SqlExecutor, matchId: string, players: Omit<MatchPlayer, 'matchId'>[]): Promise<void> {
    await db.execute(`DELETE FROM match_players WHERE match_id = ?`, [matchId]);
    for (const p of players) {
      await db.execute(
        `INSERT INTO match_players (match_id, team_id, player_id, batting_order, is_captain, is_keeper) VALUES (?,?,?,?,?,?)`,
        [matchId, p.teamId, p.playerId, p.battingOrder, p.isCaptain ? 1 : 0, p.isKeeper ? 1 : 0],
      );
    }
  },

  async getPlayers(db: SqlExecutor, matchId: string): Promise<MatchPlayer[]> {
    const { rows } = await db.execute(
      `SELECT * FROM match_players WHERE match_id = ? ORDER BY team_id, batting_order`,
      [matchId],
    );
    return rows.map(r => ({
      matchId: str(r.match_id),
      teamId: str(r.team_id),
      playerId: str(r.player_id),
      battingOrder: num(r.batting_order),
      isCaptain: num(r.is_captain) === 1,
      isKeeper: num(r.is_keeper) === 1,
    }));
  },

  /* ----- events ----- */
  async activeEvents(db: SqlExecutor, matchId: string): Promise<StoredEvent[]> {
    const { rows } = await db.execute(
      `SELECT * FROM match_events WHERE match_id = ? AND status = 'active' ORDER BY seq`,
      [matchId],
    );
    return rows.map(toEvent);
  },

  /** Undone events, most recently undone first (the redo stack). */
  async redoStack(db: SqlExecutor, matchId: string): Promise<StoredEvent[]> {
    const { rows } = await db.execute(
      `SELECT * FROM match_events WHERE match_id = ? AND status = 'undone' ORDER BY seq ASC`,
      [matchId],
    );
    return rows.map(toEvent);
  },

  async appendEvent(db: SqlExecutor, matchId: string, event: MatchEvent): Promise<StoredEvent> {
    const { rows } = await db.execute(`SELECT COALESCE(MAX(seq), 0) AS s FROM match_events WHERE match_id = ?`, [matchId]);
    const seq = num(rows[0]?.s) + 1;
    const id = newId('e_');
    const now = Date.now();
    await db.execute(
      `INSERT INTO match_events (id, match_id, seq, type, payload_json, status, created_at, updated_at) VALUES (?,?,?,?,?, 'active', ?, ?)`,
      [id, matchId, seq, event.type, JSON.stringify(event), now, now],
    );
    return { id, matchId, seq, event, status: 'active', createdAt: now };
  },

  async clearRedo(db: SqlExecutor, matchId: string): Promise<void> {
    await db.execute(`DELETE FROM match_events WHERE match_id = ? AND status = 'undone'`, [matchId]);
  },

  async setEventStatus(db: SqlExecutor, eventId: string, status: 'active' | 'undone'): Promise<void> {
    await db.execute(`UPDATE match_events SET status = ?, updated_at = ? WHERE id = ?`, [status, Date.now(), eventId]);
  },

  async updateEventPayload(db: SqlExecutor, eventId: string, event: MatchEvent): Promise<void> {
    await db.execute(`UPDATE match_events SET payload_json = ?, type = ?, updated_at = ? WHERE id = ?`, [JSON.stringify(event), event.type, Date.now(), eventId]);
  },

  /* ----- stats ----- */
  async replaceStats(db: SqlExecutor, matchId: string, stats: PlayerMatchStats[]): Promise<void> {
    await db.execute(`DELETE FROM player_match_stats WHERE match_id = ?`, [matchId]);
    for (const s of stats) {
      await db.execute(
        `INSERT INTO player_match_stats (match_id, player_id, team_id, bat_innings, runs, balls, fours, sixes, not_outs, dismissals,
          highest, highest_not_out, fifties, hundreds, ducks, bowl_balls, runs_conceded, wickets, maidens, wides, no_balls, dots,
          best_wickets, best_runs, catches, stumpings, run_outs)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          matchId, s.playerId, s.teamId, s.batInnings, s.runs, s.balls, s.fours, s.sixes, s.notOuts, s.dismissals,
          s.highest, s.highestNotOut ? 1 : 0, s.fifties, s.hundreds, s.ducks, s.bowlBalls, s.runsConceded, s.wickets,
          s.maidens, s.wides, s.noBalls, s.dots, s.bestWickets, s.bestRuns, s.catches, s.stumpings, s.runOuts,
        ],
      );
    }
  },
};
