import { validateRules } from '../core/engine/rules';
import type { MatchRules } from '../core/engine/types';
import {
  generateFixtures,
  pointsTable,
  type CompletedLeagueMatch,
  type PointsRow,
  type TournamentFormat,
} from '../core/tournament/tournament';
import { requireName, ValidationError } from '../core/utils/validation';
import { getDb } from '../data/db/database';
import type { SqlExecutor } from '../data/db/driver';
import type { Fixture, MatchRecord, Tournament } from '../data/models';
import { matchRepository } from '../data/repositories/matchRepository';
import { tournamentRepository } from '../data/repositories/tournamentRepository';

export interface CreateTournamentInput {
  name: string;
  format: TournamentFormat;
  rules: MatchRules;
  teamIds: string[];
  doubleRoundRobin?: boolean;
  qualifiers?: number;
  points?: { win: number; tie: number; noResult: number };
}

export interface TournamentDetail {
  tournament: Tournament;
  teamIds: string[];
  fixtures: Fixture[];
  matches: Record<string, MatchRecord>;
  table: PointsRow[];
}

/** Converts a completed match into the shape the points table needs. */
export function toLeagueResult(m: MatchRecord): CompletedLeagueMatch | null {
  if (m.status !== 'completed' || !m.summary) {
    return null;
  }
  const main = m.summary.innings.filter(i => !i.isSuperOver);
  const sum = (teamId: string) => {
    const inns = main.filter(i => i.teamId === teamId);
    return {
      runs: inns.reduce((s, i) => s + i.runs, 0),
      balls: inns.reduce((s, i) => s + i.balls, 0),
      allOut: inns.length > 0 && inns.every(i => i.allOut),
    };
  };
  const a = sum(m.teamAId);
  const b = sum(m.teamBId);
  const resultType = m.summary.resultType ?? 'noResult';
  return {
    teamAId: m.teamAId,
    teamBId: m.teamBId,
    winnerTeamId: m.winnerTeamId,
    // a super-over win counts as a win
    resultType: resultType === 'draw' ? 'draw' : resultType,
    teamARuns: a.runs,
    teamABalls: a.balls,
    teamAAllOut: a.allOut,
    teamBRuns: b.runs,
    teamBBalls: b.balls,
    teamBAllOut: b.allOut,
    quotaBalls: m.summary.quotaBalls,
    ballsPerOver: m.summary.ballsPerOver,
  };
}

async function standings(tx: SqlExecutor, t: Tournament, fixtures: Fixture[], teamIds: string[]): Promise<PointsRow[]> {
  const leagueMatchIds = fixtures.filter(f => f.stage === 'league' && f.matchId).map(f => f.matchId!);
  const results: CompletedLeagueMatch[] = [];
  for (const id of leagueMatchIds) {
    const m = await matchRepository.get(tx, id);
    const r = m ? toLeagueResult(m) : null;
    if (r) {
      results.push(r);
    }
  }
  return pointsTable(teamIds, results, { win: t.pointsWin, tie: t.pointsTie, noResult: t.pointsNoResult });
}

/** "3rd in table" → 3 */
function labelRank(label: string | null): number | null {
  const m = label ? /^(\d+)/.exec(label) : null;
  return m ? Number(m[1]) : null;
}

async function reseedKnockout(tx: SqlExecutor, t: Tournament): Promise<void> {
  if (t.format !== 'leagueKnockout') {
    return;
  }
  const fixtures = await tournamentRepository.fixtures(tx, t.id);
  const league = fixtures.filter(f => f.stage === 'league');
  let leagueDone = true;
  for (const f of league) {
    const m = f.matchId ? await matchRepository.get(tx, f.matchId) : null;
    if (!m || m.status !== 'completed') {
      leagueDone = false;
      break;
    }
  }
  const teamIds = await tournamentRepository.teamIds(tx, t.id);
  const table = leagueDone ? await standings(tx, t, fixtures, teamIds) : [];
  for (const f of fixtures.filter(x => x.stage !== 'league' && !x.matchId)) {
    for (const slot of ['a', 'b'] as const) {
      const rank = labelRank(slot === 'a' ? f.labelA : f.labelB);
      if (rank === null) {
        continue;
      }
      const teamId = leagueDone ? table[rank - 1]?.teamId ?? null : null;
      await tournamentRepository.setFixtureTeam(tx, f.id, slot, teamId);
    }
  }
}

export const tournamentService = {
  async create(input: CreateTournamentInput): Promise<string> {
    const name = requireName('tournamentName', input.name, { min: 3, max: 40 });
    const unique = [...new Set(input.teamIds)];
    if (unique.length < 2) {
      throw new ValidationError('teams', 'Choose at least 2 teams.');
    }
    if (unique.length > 16) {
      throw new ValidationError('teams', 'A tournament can have at most 16 teams.');
    }
    const issues = validateRules(input.rules);
    if (issues.length) {
      throw new ValidationError(issues[0].field, issues[0].message);
    }
    const qualifiers = input.format === 'leagueKnockout' ? input.qualifiers ?? 4 : 0;
    if (input.format === 'leagueKnockout' && qualifiers >= unique.length) {
      throw new ValidationError('qualifiers', 'There must be more teams than knockout places.');
    }
    let drafts;
    try {
      drafts = generateFixtures(input.format, unique, { double: input.doubleRoundRobin, qualifiers });
    } catch (e) {
      throw new ValidationError('format', e instanceof Error ? e.message : 'Could not create fixtures.');
    }
    const points = input.points ?? { win: 2, tie: 1, noResult: 1 };
    const db = await getDb();
    return db.transaction(tx =>
      tournamentRepository.insert(
        tx,
        {
          name,
          format: input.format,
          rules: input.rules,
          pointsWin: points.win,
          pointsTie: points.tie,
          pointsNoResult: points.noResult,
          doubleRoundRobin: !!input.doubleRoundRobin,
          qualifiers,
          teamIds: unique,
        },
        drafts,
      ),
    );
  },

  async list(): Promise<Tournament[]> {
    const db = await getDb();
    return tournamentRepository.list(db);
  },

  async detail(id: string): Promise<TournamentDetail> {
    const db = await getDb();
    const tournament = await tournamentRepository.get(db, id);
    if (!tournament) {
      throw new ValidationError('tournament', 'Tournament not found.');
    }
    const [teamIds, fixtures, matchList] = await Promise.all([
      tournamentRepository.teamIds(db, id),
      tournamentRepository.fixtures(db, id),
      matchRepository.list(db, { tournamentId: id }),
    ]);
    const matches: Record<string, MatchRecord> = {};
    for (const m of matchList) {
      matches[m.id] = m;
    }
    const table = await standings(db, tournament, fixtures, teamIds);
    return { tournament, teamIds, fixtures, matches, table };
  },

  async remove(id: string): Promise<void> {
    const db = await getDb();
    await db.transaction(tx => tournamentRepository.remove(tx, id));
  },

  async linkFixture(tx: SqlExecutor, fixtureId: string, matchId: string): Promise<void> {
    const f = await tournamentRepository.fixture(tx, fixtureId);
    if (!f) {
      throw new ValidationError('fixture', 'Fixture not found.');
    }
    if (f.matchId) {
      throw new ValidationError('fixture', 'This fixture already has a match.');
    }
    if (!f.teamAId || !f.teamBId) {
      throw new ValidationError('fixture', 'Both teams for this fixture are not known yet.');
    }
    await tournamentRepository.linkMatch(tx, fixtureId, matchId);
  },

  async unlinkMatch(tx: SqlExecutor, record: MatchRecord): Promise<void> {
    if (!record.fixtureId) {
      return;
    }
    await tournamentRepository.linkMatch(tx, record.fixtureId, null);
    await this.syncFixture(tx, { ...record, status: 'scheduled', winnerTeamId: null });
  },

  /**
   * Keeps the tournament in step with a match: records the fixture winner, moves knockout
   * winners forward (or takes them back after an undo), seeds the knockout once the league
   * is finished, and completes the tournament when the final is decided.
   */
  async syncFixture(tx: SqlExecutor, record: MatchRecord): Promise<void> {
    if (!record.fixtureId) {
      return;
    }
    const fixture = await tournamentRepository.fixture(tx, record.fixtureId);
    if (!fixture) {
      return;
    }
    const t = (await tournamentRepository.get(tx, fixture.tournamentId))!;
    const winner = record.status === 'completed' ? record.winnerTeamId : null;
    const manual = fixture.stage !== 'league' && fixture.winnerTeamId && !record.winnerTeamId && record.status === 'completed';
    if (!manual) {
      await tournamentRepository.setFixtureWinner(tx, fixture.id, winner);
    }
    const effectiveWinner = manual ? fixture.winnerTeamId : winner;
    if (fixture.stage !== 'league') {
      await this.advance(tx, fixture, effectiveWinner);
    } else {
      await reseedKnockout(tx, t);
    }
    if (t.format === 'league') {
      const fixtures = await tournamentRepository.fixtures(tx, t.id);
      const done = await allCompleted(tx, fixtures);
      if (done) {
        const table = await standings(tx, t, fixtures, await tournamentRepository.teamIds(tx, t.id));
        await tournamentRepository.setStatus(tx, t.id, 'completed', table[0]?.teamId ?? null);
      } else {
        await tournamentRepository.setStatus(tx, t.id, 'active', null);
      }
    }
  },

  async advance(tx: SqlExecutor, fixture: Fixture, winner: string | null): Promise<void> {
    if (fixture.stage === 'final' || !fixture.nextFixtureId) {
      await tournamentRepository.setStatus(tx, fixture.tournamentId, winner ? 'completed' : 'active', winner);
      return;
    }
    const next = await tournamentRepository.fixture(tx, fixture.nextFixtureId);
    if (!next || next.matchId || !fixture.nextSlot) {
      return; // the next match has already started: leave it alone
    }
    await tournamentRepository.setFixtureTeam(tx, next.id, fixture.nextSlot, winner);
  },

  /** For a knockout match with no result or a tie: the organiser chooses who goes through. */
  async setManualWinner(fixtureId: string, teamId: string): Promise<void> {
    const db = await getDb();
    await db.transaction(async tx => {
      const f = await tournamentRepository.fixture(tx, fixtureId);
      if (!f || f.stage === 'league') {
        throw new ValidationError('fixture', 'Only knockout fixtures can have a winner chosen.');
      }
      if (teamId !== f.teamAId && teamId !== f.teamBId) {
        throw new ValidationError('fixture', 'The winner must be one of the two teams.');
      }
      const m = f.matchId ? await matchRepository.get(tx, f.matchId) : null;
      if (m && m.status === 'completed' && m.winnerTeamId) {
        throw new ValidationError('fixture', 'This match already has a winner.');
      }
      if (m && m.status !== 'completed') {
        throw new ValidationError('fixture', 'Finish the match first.');
      }
      await tournamentRepository.setFixtureWinner(tx, f.id, teamId);
      await this.advance(tx, f, teamId);
    });
  },
};

async function allCompleted(tx: SqlExecutor, fixtures: Fixture[]): Promise<boolean> {
  for (const f of fixtures) {
    if (!f.matchId) {
      return false;
    }
    const m = await matchRepository.get(tx, f.matchId);
    if (!m || m.status !== 'completed') {
      return false;
    }
  }
  return fixtures.length > 0;
}
