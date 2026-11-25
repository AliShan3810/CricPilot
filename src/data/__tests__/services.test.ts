import { setDriver, getDb } from '../db/database';
import { migrate, SCHEMA_VERSION } from '../db/migrations';
import { teamRepository } from '../repositories/teamRepository';
import { playerRepository } from '../repositories/playerRepository';
import { statsRepository } from '../repositories/statsRepository';
import { exportBackup, importBackup, validateBackup } from '../repositories/backupRepository';
import { matchService } from '../../services/matchService';
import { tournamentService } from '../../services/tournamentService';
import { teamService, computeHeadToHead } from '../../services/teamService';
import { presetRules } from '../../core/engine/rules';
import type { MatchEvent, DeliveryPayload } from '../../core/engine/types';
import { createNodeDriver } from './nodeDriver';

const d = (p: Partial<DeliveryPayload> = {}): MatchEvent => ({
  type: 'DELIVERY',
  kind: 'legal',
  batRuns: 0,
  byes: 0,
  legByes: 0,
  wideRuns: 0,
  boundary: null,
  wicket: null,
  ...p,
});

async function seedTeam(name: string, short: string, n = 4) {
  const db = await getDb();
  const team = await teamRepository.create(db, { name, shortName: short, color: '#38BDF8' });
  const players = [];
  for (let i = 1; i <= n; i++) {
    players.push(await playerRepository.create(db, { name: `${short} Player ${i}`, teamId: team.id, role: 'allRounder', battingStyle: 'right' }));
  }
  return { team, ids: players.map(p => p.id) };
}

beforeEach(() => {
  setDriver(createNodeDriver());
});

describe('migrations', () => {
  it('creates the schema and records the version once', async () => {
    const db = await getDb();
    const v = await db.execute('PRAGMA user_version');
    expect(Object.values(v.rows[0])[0]).toBe(SCHEMA_VERSION);
    await migrate(db); // idempotent
    const t = await db.execute(`SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`);
    expect(t.rows.map(r => r.name)).toEqual(
      expect.arrayContaining(['teams', 'players', 'matches', 'match_events', 'match_players', 'player_match_stats', 'tournaments', 'fixtures']),
    );
  });
});

describe('teams and players', () => {
  it('validates and enforces unique team names', async () => {
    const db = await getDb();
    await teamRepository.create(db, { name: 'Lahore Lions', shortName: 'LHL', color: '#22C55E' });
    await expect(teamRepository.create(db, { name: 'lahore lions', shortName: 'LL', color: '#22C55E' })).rejects.toThrow(/already exists/);
    await expect(teamRepository.create(db, { name: 'X', shortName: 'XX', color: '#22C55E' })).rejects.toThrow(/at least/);
    await expect(teamRepository.create(db, { name: 'Valid', shortName: 'TOOLONG', color: '#22C55E' })).rejects.toThrow(/Short name/);
    await expect(teamRepository.create(db, { name: 'Valid', shortName: 'VL', color: 'red' })).rejects.toThrow(/colour/);
  });

  it('creates, updates and lists players with team counts', async () => {
    const { team, ids } = await seedTeam('Karachi Kings', 'KK', 3);
    const db = await getDb();
    await playerRepository.update(db, ids[0], { name: 'Renamed', teamId: team.id, role: 'bowler', battingStyle: 'left', jerseyNumber: 7 });
    const p = await playerRepository.get(db, ids[0]);
    expect(p).toMatchObject({ name: 'Renamed', role: 'bowler', battingStyle: 'left', jerseyNumber: 7 });
    const teams = await teamRepository.list(db);
    expect(teams[0].playerCount).toBe(3);
    await expect(playerRepository.create(db, { name: 'Bad', teamId: team.id, role: 'bowler', battingStyle: 'right', jerseyNumber: 1000 })).rejects.toThrow(/Jersey/);
  });
});

async function newMatch(overs = 1, players = 3) {
  const A = await seedTeam('Alpha XI', 'ALP', players);
  const B = await seedTeam('Bravo XI', 'BRV', players);
  const rules = { ...presetRules('CUSTOM'), oversPerInnings: overs, playersPerSide: players, maxOversPerBowler: null };
  const id = await matchService.create({ rules, teamAId: A.team.id, teamBId: B.team.id, squadA: A.ids, squadB: B.ids });
  return { id, A, B };
}

describe('match scoring service', () => {
  it('rejects invalid squads', async () => {
    const A = await seedTeam('Alpha XI', 'ALP', 3);
    const B = await seedTeam('Bravo XI', 'BRV', 3);
    const rules = { ...presetRules('CUSTOM'), playersPerSide: 3 };
    await expect(matchService.create({ rules, teamAId: A.team.id, teamBId: A.team.id, squadA: A.ids, squadB: B.ids })).rejects.toThrow(/different/);
    await expect(matchService.create({ rules, teamAId: A.team.id, teamBId: B.team.id, squadA: [A.ids[0]], squadB: B.ids })).rejects.toThrow(/at least 2/);
    await expect(matchService.create({ rules, teamAId: A.team.id, teamBId: B.team.id, squadA: [...A.ids, B.ids[0]], squadB: B.ids })).rejects.toThrow();
  });

  it('records events atomically, survives a reload, and supports undo/redo', async () => {
    const { id, A, B } = await newMatch();
    await matchService.setToss(id, A.team.id, 'bat');
    let m = await matchService.record(id, { type: 'START_INNINGS', battingTeamId: A.team.id, strikerId: A.ids[0], nonStrikerId: A.ids[1], bowlerId: B.ids[0] });
    expect(m.record.status).toBe('live');
    await matchService.record(id, d({ batRuns: 4, boundary: 4 }));
    await matchService.record(id, d({ batRuns: 1 }));
    // an invalid event is rejected and nothing is written
    await expect(matchService.record(id, d({ wicket: { type: 'bowled', batterOutId: B.ids[0] } }))).rejects.toThrow(/not at the crease/);

    // "app restart": a fresh load rebuilds the same state from SQLite
    m = await matchService.load(id);
    expect(m.events).toHaveLength(3);
    expect(m.state.innings[0].runs).toBe(5);
    expect(m.record.summary?.innings[0].runs).toBe(5);

    m = await matchService.undo(id);
    expect(m.state.innings[0].runs).toBe(4);
    expect(m.redo).toHaveLength(1);
    m = await matchService.redo(id);
    expect(m.state.innings[0].runs).toBe(5);
    expect(m.redo).toHaveLength(0);

    await matchService.undo(id);
    m = await matchService.record(id, d({ batRuns: 2 }));
    expect(m.redo).toHaveLength(0); // a new event clears redo
    expect(m.state.innings[0].runs).toBe(6);
    await expect(matchService.redo(id)).rejects.toThrow(/nothing to redo/i);
    await expect(matchService.setToss(id, B.team.id, 'bat')).rejects.toThrow(/after play/);
  });

  it('applies historical corrections and rejects ones that break later events', async () => {
    const { id, A, B } = await newMatch();
    await matchService.record(id, { type: 'START_INNINGS', battingTeamId: A.team.id, strikerId: A.ids[0], nonStrikerId: A.ids[1], bowlerId: B.ids[0] });
    let m = await matchService.record(id, d({ batRuns: 1 }));
    m = await matchService.record(id, d({ wicket: { type: 'bowled', batterOutId: A.ids[1] } }));
    const firstBall = m.events[1];
    // changing the single to a dot puts A.ids[0] on strike, so the later "bowled A.ids[1]" becomes invalid
    await expect(matchService.correct(id, firstBall.id, d({ batRuns: 0 }))).rejects.toThrow(/later event/);
    // changing it to a three keeps strike rotation identical: valid
    m = await matchService.correct(id, firstBall.id, d({ batRuns: 3 }));
    expect(m.state.innings[0].runs).toBe(3);
    expect(m.state.innings[0].batters[0].runs).toBe(3);
  });

  it('completes a match, writes career stats and the result', async () => {
    const { id, A, B } = await newMatch(1, 3);
    const ev: MatchEvent[] = [
      { type: 'START_INNINGS', battingTeamId: A.team.id, strikerId: A.ids[0], nonStrikerId: A.ids[1], bowlerId: B.ids[0] },
      d({ batRuns: 6, boundary: 6 }),
      d({ batRuns: 6, boundary: 6 }),
      d(),
      d(),
      d(),
      d({ wicket: { type: 'caught', batterOutId: A.ids[0], fielderId: B.ids[1] } }),
      { type: 'START_INNINGS', battingTeamId: B.team.id, strikerId: B.ids[0], nonStrikerId: B.ids[1], bowlerId: A.ids[2] },
      d({ wicket: { type: 'bowled', batterOutId: B.ids[0] } }),
      { type: 'NEW_BATTER', batterId: B.ids[2] },
      d({ batRuns: 4, boundary: 4 }),
      d({ wicket: { type: 'bowled', batterOutId: B.ids[2] } }),
    ];
    let m;
    for (const e of ev) {
      m = await matchService.record(id, e);
    }
    expect(m!.record.status).toBe('completed');
    expect(m!.record.resultText).toBe('Alpha XI won by 8 runs');
    const db = await getDb();
    const c = await statsRepository.career(db, A.ids[0]);
    expect(c).toMatchObject({ matches: 1, runs: 12, sixes: 2, dismissals: 1, highest: 12 });
    const bowler = await statsRepository.career(db, A.ids[2]);
    expect(bowler).toMatchObject({ wickets: 2, runsConceded: 4, bestWickets: 2, bestRuns: 4 });
    const fielder = await statsRepository.career(db, B.ids[1]);
    expect(fielder?.catches).toBe(1);
    const board = await statsRepository.leaderboard(db, 'runs');
    expect(board[0].playerId).toBe(A.ids[0]);

    // undoing the final ball re-opens the match and removes it from career stats
    m = await matchService.undo(id);
    expect(m.record.status).toBe('live');
    expect(await statsRepository.career(db, A.ids[0])).toBeNull();
  });
});

describe('tournaments', () => {
  async function playQuickWin(matchId: string, winnerBatsFirst: { team: string; ids: string[] }, loser: { team: string; ids: string[] }) {
    // 1-over, 3-player match: winner bats first and scores 6, loser is bowled out for 0
    const evs: MatchEvent[] = [
      { type: 'START_INNINGS', battingTeamId: winnerBatsFirst.team, strikerId: winnerBatsFirst.ids[0], nonStrikerId: winnerBatsFirst.ids[1], bowlerId: loser.ids[0] },
      d({ batRuns: 6, boundary: 6 }),
      d(), d(), d(), d(), d(),
      { type: 'START_INNINGS', battingTeamId: loser.team, strikerId: loser.ids[0], nonStrikerId: loser.ids[1], bowlerId: winnerBatsFirst.ids[0] },
      d({ wicket: { type: 'bowled', batterOutId: loser.ids[0] } }),
      { type: 'NEW_BATTER', batterId: loser.ids[2] },
      d({ wicket: { type: 'bowled', batterOutId: loser.ids[2] } }),
    ];
    for (const e of evs) {
      await matchService.record(matchId, e);
    }
  }

  it('runs a 4-team knockout: winners advance and the champion is crowned', async () => {
    const teams = [];
    for (const [n, s] of [['North Stars', 'NS'], ['East Eagles', 'EE'], ['South Sharks', 'SS'], ['West Wolves', 'WW']]) {
      teams.push(await seedTeam(n, s, 3));
    }
    const rules = { ...presetRules('CUSTOM'), oversPerInnings: 1, playersPerSide: 3, maxOversPerBowler: null };
    const tid = await tournamentService.create({ name: 'Winter Cup', format: 'knockout', rules, teamIds: teams.map(t => t.team.id) });
    let det = await tournamentService.detail(tid);
    const semis = det.fixtures.filter(f => f.stage === 'semiFinal');
    expect(semis).toHaveLength(2);
    const byId = new Map(teams.map(t => [t.team.id, t]));
    for (const sf of semis) {
      const a = byId.get(sf.teamAId!)!;
      const b = byId.get(sf.teamBId!)!;
      const mid = await matchService.create({ rules, teamAId: a.team.id, teamBId: b.team.id, squadA: a.ids, squadB: b.ids, tournamentId: tid, fixtureId: sf.id });
      await playQuickWin(mid, { team: a.team.id, ids: a.ids }, { team: b.team.id, ids: b.ids });
    }
    det = await tournamentService.detail(tid);
    const final = det.fixtures.find(f => f.stage === 'final')!;
    expect([final.teamAId, final.teamBId]).toEqual([semis[0].teamAId, semis[1].teamAId]);
    const fa = byId.get(final.teamAId!)!;
    const fb = byId.get(final.teamBId!)!;
    const fid = await matchService.create({ rules, teamAId: fa.team.id, teamBId: fb.team.id, squadA: fa.ids, squadB: fb.ids, tournamentId: tid, fixtureId: final.id });
    await playQuickWin(fid, { team: fb.team.id, ids: fb.ids }, { team: fa.team.id, ids: fa.ids });
    det = await tournamentService.detail(tid);
    expect(det.tournament).toMatchObject({ status: 'completed', winnerTeamId: fb.team.id });
    // undoing the last ball of the final re-opens the tournament
    await matchService.undo(fid);
    det = await tournamentService.detail(tid);
    expect(det.tournament.status).toBe('active');
  });

  it('seeds the knockout from the points table when the league finishes', async () => {
    const teams = [];
    for (const [n, s] of [['Team One', 'ONE'], ['Team Two', 'TWO'], ['Team Three', 'THR']]) {
      teams.push(await seedTeam(n, s, 3));
    }
    const rules = { ...presetRules('CUSTOM'), oversPerInnings: 1, playersPerSide: 3, maxOversPerBowler: null };
    const tid = await tournamentService.create({ name: 'Summer League', format: 'leagueKnockout', qualifiers: 2, rules, teamIds: teams.map(t => t.team.id) });
    let det = await tournamentService.detail(tid);
    const league = det.fixtures.filter(f => f.stage === 'league');
    expect(league).toHaveLength(3);
    const byId = new Map(teams.map(t => [t.team.id, t]));
    const rank = [teams[0].team.id, teams[1].team.id, teams[2].team.id];
    for (const f of league) {
      const a = byId.get(f.teamAId!)!;
      const b = byId.get(f.teamBId!)!;
      // lower index in `rank` always wins
      const [w, l] = rank.indexOf(a.team.id) < rank.indexOf(b.team.id) ? [a, b] : [b, a];
      const mid = await matchService.create({ rules, teamAId: w.team.id, teamBId: l.team.id, squadA: w.ids, squadB: l.ids, tournamentId: tid, fixtureId: f.id });
      await playQuickWin(mid, { team: w.team.id, ids: w.ids }, { team: l.team.id, ids: l.ids });
    }
    det = await tournamentService.detail(tid);
    expect(det.table.map(r => r.teamId)).toEqual(rank);
    expect(det.table[0]).toMatchObject({ played: 2, won: 2, points: 4 });
    const final = det.fixtures.find(f => f.stage === 'final')!;
    expect([final.teamAId, final.teamBId]).toEqual([rank[0], rank[1]]);
  });

  it('validates tournament input', async () => {
    const a = await seedTeam('Solo Side', 'SOL', 2);
    await expect(tournamentService.create({ name: 'Cup', format: 'league', rules: presetRules('T20'), teamIds: [a.team.id] })).rejects.toThrow(/at least 2/);
  });
});

describe('backup and restore', () => {
  it('exports everything and restores it into an empty database', async () => {
    const { id, A, B } = await newMatch();
    await matchService.record(id, { type: 'START_INNINGS', battingTeamId: A.team.id, strikerId: A.ids[0], nonStrikerId: A.ids[1], bowlerId: B.ids[0] });
    await matchService.record(id, d({ batRuns: 4, boundary: 4 }));
    const backup = await exportBackup(await getDb());
    const json = JSON.parse(JSON.stringify(backup));

    setDriver(createNodeDriver());
    const fresh = await getDb();
    const counts = await importBackup(fresh, validateBackup(json));
    expect(counts.match_events).toBe(2);
    const m = await matchService.load(id);
    expect(m.state.innings[0].runs).toBe(4);
  });

  it('rejects damaged or foreign files without touching data', async () => {
    expect(() => validateBackup(null)).toThrow(/not a backup/);
    expect(() => validateBackup({ app: 'Other' })).toThrow(/not created/);
    expect(() => validateBackup({ app: 'CricLedger', schemaVersion: 999, tables: {} })).toThrow(/newer version/);
    const db = await getDb();
    const good = await exportBackup(db);
    const bad = JSON.parse(JSON.stringify(good));
    bad.tables.teams.push({ id: 'x' });
    expect(() => validateBackup(bad)).toThrow(/missing name/);
  });
});

describe('quick matches with temporary teams', () => {
  it('creates temporary teams with players, hidden from the team list', async () => {
    const { team, players } = await teamService.createQuick({ name: 'Street XI', color: '#FF6B00', playerNames: ['Ali', ' Bilal ', '', 'Chand'] });
    expect(team.isTemporary).toBe(true);
    expect(players.map(p => p.name)).toEqual(['Ali', 'Bilal', 'Chand']);
    expect((await teamService.list()).find(t => t.id === team.id)).toBeUndefined();
    expect((await teamService.all()).find(t => t.id === team.id)).toBeDefined();
  });

  it('suffixes clashing names and validates rosters', async () => {
    await teamService.createQuick({ name: 'Night Owls', color: '#38BDF8', playerNames: ['A1', 'A2'] });
    const second = await teamService.createQuick({ name: 'Night Owls', color: '#38BDF8', playerNames: ['B1', 'B2'] });
    expect(second.team.name).toBe('Night Owls · 2');
    await expect(teamService.createQuick({ name: 'Solo', color: '#38BDF8', playerNames: ['Only'] })).rejects.toThrow(/at least 2/);
    await expect(teamService.createQuick({ name: 'Twins', color: '#38BDF8', playerNames: ['Sam', 'sam'] })).rejects.toThrow(/same name/);
  });

  it('can promote a quick team to a permanent team', async () => {
    const { team } = await teamService.createQuick({ name: 'Weekend Club', color: '#22C55E', playerNames: ['Xavier', 'Yasir'] });
    await teamService.makePermanent(team.id);
    expect((await teamService.list()).some(t => t.id === team.id)).toBe(true);
  });

  it('plays a full match between quick teams and reports head-to-head', async () => {
    const A = await teamService.createQuick({ name: 'Home Quick', color: '#FF6B00', playerNames: ['h1', 'h2', 'h3'] });
    const B = await teamService.createQuick({ name: 'Away Quick', color: '#38BDF8', playerNames: ['a1', 'a2', 'a3'] });
    const rules = { ...presetRules('CUSTOM'), oversPerInnings: 1, playersPerSide: 3, maxOversPerBowler: null };
    const id = await matchService.create({ rules, teamAId: A.team.id, teamBId: B.team.id, squadA: A.players.map(p => p.id), squadB: B.players.map(p => p.id) });
    const ap = A.players.map(p => p.id);
    const bp = B.players.map(p => p.id);
    const evs: MatchEvent[] = [
      { type: 'START_INNINGS', battingTeamId: A.team.id, strikerId: ap[0], nonStrikerId: ap[1], bowlerId: bp[0] },
      d({ batRuns: 4, boundary: 4 }), d(), d(), d(), d(), d(),
      { type: 'START_INNINGS', battingTeamId: B.team.id, strikerId: bp[0], nonStrikerId: bp[1], bowlerId: ap[0] },
      d(), d(), d(), d(), d(), d(),
    ];
    for (const e of evs) {
      await matchService.record(id, e);
    }
    const h = await teamService.headToHead(A.team.id, B.team.id);
    expect(h).toMatchObject({ played: 1, aWins: 1, bWins: 0, aBest: 4, bBest: 0 });
    expect(h.last?.resultText).toBe('Home Quick won by 4 runs');
  });

  it('computes head-to-head from either side', () => {
    const base = { title: 't', format: 'T20' as const, rules: presetRules('T20'), venue: null, scheduledAt: 0, tossWinnerId: null, tossDecision: null, tournamentId: null, fixtureId: null, createdAt: 0, updatedAt: 0 };
    const m = (a: string, b: string, w: string | null, t: number) => ({ ...base, id: `${t}`, teamAId: a, teamBId: b, status: 'completed' as const, winnerTeamId: w, resultText: w ? `${w} won` : 'Match tied', completedAt: t, summary: null });
    const h = computeHeadToHead('X', 'Y', [m('X', 'Y', 'X', 1), m('Y', 'X', 'Y', 2), m('Y', 'X', null, 3), m('X', 'Z', 'X', 4)]);
    expect(h).toMatchObject({ played: 3, aWins: 1, bWins: 1, other: 1 });
    expect(h.last?.resultText).toBe('Match tied');
  });
});
