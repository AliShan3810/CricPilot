import { newId, num, numOrNull, str, strOrNull, type Row, type SqlExecutor } from '../db/driver';
import type { Fixture, Tournament } from '../models';
import type { MatchRules } from '../../core/engine/types';
import type { FixtureDraft, FixtureStage, TournamentFormat } from '../../core/tournament/tournament';

function toTournament(r: Row): Tournament {
  return {
    id: str(r.id),
    name: str(r.name),
    format: str(r.format) as TournamentFormat,
    rules: JSON.parse(str(r.rules_json)) as MatchRules,
    pointsWin: num(r.points_win),
    pointsTie: num(r.points_tie),
    pointsNoResult: num(r.points_nr),
    doubleRoundRobin: num(r.double_round_robin) === 1,
    qualifiers: num(r.qualifiers),
    status: str(r.status) as 'active' | 'completed',
    winnerTeamId: strOrNull(r.winner_team_id),
    createdAt: num(r.created_at),
  };
}

function toFixture(r: Row): Fixture {
  return {
    id: str(r.id),
    tournamentId: str(r.tournament_id),
    stage: str(r.stage) as FixtureStage,
    round: num(r.round),
    slot: num(r.slot),
    teamAId: strOrNull(r.team_a_id),
    teamBId: strOrNull(r.team_b_id),
    labelA: strOrNull(r.label_a),
    labelB: strOrNull(r.label_b),
    matchId: strOrNull(r.match_id),
    nextFixtureId: strOrNull(r.next_fixture_id),
    nextSlot: (strOrNull(r.next_slot) as 'a' | 'b' | null) ?? null,
    winnerTeamId: strOrNull(r.winner_team_id),
    scheduledAt: numOrNull(r.scheduled_at),
    venue: strOrNull(r.venue),
  };
}

export interface NewTournament {
  name: string;
  format: TournamentFormat;
  rules: MatchRules;
  pointsWin: number;
  pointsTie: number;
  pointsNoResult: number;
  doubleRoundRobin: boolean;
  qualifiers: number;
  teamIds: string[];
}

export const tournamentRepository = {
  async insert(db: SqlExecutor, t: NewTournament, drafts: FixtureDraft[]): Promise<string> {
    const id = newId('tr_');
    await db.execute(
      `INSERT INTO tournaments (id, name, format, rules_json, points_win, points_tie, points_nr, double_round_robin, qualifiers, status, created_at)
       VALUES (?,?,?,?,?,?,?,?,?, 'active', ?)`,
      [id, t.name, t.format, JSON.stringify(t.rules), t.pointsWin, t.pointsTie, t.pointsNoResult, t.doubleRoundRobin ? 1 : 0, t.qualifiers, Date.now()],
    );
    for (const [i, teamId] of t.teamIds.entries()) {
      await db.execute(`INSERT INTO tournament_teams (tournament_id, team_id, seed) VALUES (?,?,?)`, [id, teamId, i + 1]);
    }
    const ids = new Map(drafts.map(d => [d.key, newId('fx_')]));
    for (const d of drafts) {
      await db.execute(
        `INSERT INTO fixtures (id, tournament_id, stage, round, slot, team_a_id, team_b_id, label_a, label_b, next_fixture_id, next_slot)
         VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
        [ids.get(d.key)!, id, d.stage, d.round, d.slot, d.teamAId, d.teamBId, d.labelA ?? null, d.labelB ?? null, d.nextKey ? ids.get(d.nextKey) ?? null : null, d.nextSlot],
      );
    }
    return id;
  },

  async list(db: SqlExecutor): Promise<Tournament[]> {
    const { rows } = await db.execute(`SELECT * FROM tournaments ORDER BY status, created_at DESC`);
    return rows.map(toTournament);
  },

  async get(db: SqlExecutor, id: string): Promise<Tournament | null> {
    const { rows } = await db.execute(`SELECT * FROM tournaments WHERE id = ?`, [id]);
    return rows[0] ? toTournament(rows[0]) : null;
  },

  async teamIds(db: SqlExecutor, id: string): Promise<string[]> {
    const { rows } = await db.execute(`SELECT team_id FROM tournament_teams WHERE tournament_id = ? ORDER BY seed`, [id]);
    return rows.map(r => str(r.team_id));
  },

  async fixtures(db: SqlExecutor, id: string): Promise<Fixture[]> {
    const { rows } = await db.execute(`SELECT * FROM fixtures WHERE tournament_id = ? ORDER BY round, slot`, [id]);
    return rows.map(toFixture);
  },

  async fixture(db: SqlExecutor, id: string): Promise<Fixture | null> {
    const { rows } = await db.execute(`SELECT * FROM fixtures WHERE id = ?`, [id]);
    return rows[0] ? toFixture(rows[0]) : null;
  },

  async fixtureByMatch(db: SqlExecutor, matchId: string): Promise<Fixture | null> {
    const { rows } = await db.execute(`SELECT * FROM fixtures WHERE match_id = ?`, [matchId]);
    return rows[0] ? toFixture(rows[0]) : null;
  },

  async linkMatch(db: SqlExecutor, fixtureId: string, matchId: string | null): Promise<void> {
    await db.execute(`UPDATE fixtures SET match_id = ? WHERE id = ?`, [matchId, fixtureId]);
  },

  async setFixtureTeam(db: SqlExecutor, fixtureId: string, slot: 'a' | 'b', teamId: string | null): Promise<void> {
    await db.execute(`UPDATE fixtures SET ${slot === 'a' ? 'team_a_id' : 'team_b_id'} = ? WHERE id = ?`, [teamId, fixtureId]);
  },

  async setFixtureWinner(db: SqlExecutor, fixtureId: string, teamId: string | null): Promise<void> {
    await db.execute(`UPDATE fixtures SET winner_team_id = ? WHERE id = ?`, [teamId, fixtureId]);
  },

  async setStatus(db: SqlExecutor, id: string, status: 'active' | 'completed', winnerTeamId: string | null): Promise<void> {
    await db.execute(`UPDATE tournaments SET status = ?, winner_team_id = ? WHERE id = ?`, [status, winnerTeamId, id]);
  },

  async remove(db: SqlExecutor, id: string): Promise<void> {
    await db.execute(`UPDATE matches SET tournament_id = NULL, fixture_id = NULL WHERE tournament_id = ?`, [id]);
    await db.execute(`DELETE FROM tournaments WHERE id = ?`, [id]);
  },
};
