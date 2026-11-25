import { getDb } from '../data/db/database';
import type { MatchRecord, Player, Team, Tournament } from '../data/models';
import { matchRepository } from '../data/repositories/matchRepository';
import { playerRepository } from '../data/repositories/playerRepository';
import { statsRepository, type CareerStats } from '../data/repositories/statsRepository';
import { teamRepository } from '../data/repositories/teamRepository';
import { tournamentRepository } from '../data/repositories/tournamentRepository';
import { num } from '../data/db/driver';

export interface Dashboard {
  teams: Record<string, Team>;
  teamList: Team[];
  live: MatchRecord[];
  upcoming: MatchRecord[];
  recent: MatchRecord[];
  tournaments: Tournament[];
  topBatters: CareerStats[];
  topBowlers: CareerStats[];
  totals: { matches: number; runs: number; wickets: number; sixes: number; players: number };
  players: Record<string, Player>;
  fixtures: Array<{ id: string; tournamentId: string; tournamentName: string; stage: string; teamAId: string; teamBId: string }>;
}

export async function loadDashboard(): Promise<Dashboard> {
  const db = await getDb();
  const [teamList, all, tournaments, topBatters, topBowlers, players] = await Promise.all([
    teamRepository.list(db, true),
    matchRepository.list(db, { limit: 60 }),
    tournamentRepository.list(db),
    statsRepository.leaderboard(db, 'runs', 8),
    statsRepository.leaderboard(db, 'wickets', 8),
    playerRepository.list(db),
  ]);
  const totalsRow = await db.execute(
    `SELECT COUNT(DISTINCT s.match_id) AS matches, COALESCE(SUM(s.runs),0) AS runs, COALESCE(SUM(s.wickets),0) AS wickets, COALESCE(SUM(s.sixes),0) AS sixes
     FROM player_match_stats s JOIN matches m ON m.id = s.match_id AND m.status = 'completed'`,
  );
  const r = totalsRow.rows[0] ?? {};
  const fx = await db.execute(
    `SELECT f.id, f.tournament_id, f.stage, f.team_a_id, f.team_b_id, t.name AS tname
     FROM fixtures f JOIN tournaments t ON t.id = f.tournament_id
     WHERE f.match_id IS NULL AND f.team_a_id IS NOT NULL AND f.team_b_id IS NOT NULL AND f.winner_team_id IS NULL AND t.status = 'active'
     ORDER BY f.round, f.slot LIMIT 10`,
  );
  const teams: Record<string, Team> = {};
  for (const t of teamList) {
    teams[t.id] = t;
  }
  const playerMap: Record<string, Player> = {};
  for (const p of players) {
    playerMap[p.id] = p;
  }
  return {
    teams,
    teamList: teamList.filter(t => !t.isTemporary),
    live: all.filter(m => m.status === 'live'),
    upcoming: all.filter(m => m.status === 'scheduled').slice(0, 10),
    recent: all.filter(m => m.status === 'completed').slice(0, 10),
    tournaments: tournaments.slice(0, 6),
    topBatters,
    topBowlers,
    totals: { matches: num(r.matches), runs: num(r.runs), wickets: num(r.wickets), sixes: num(r.sixes), players: players.length },
    players: playerMap,
    fixtures: fx.rows.map(f => ({
      id: String(f.id),
      tournamentId: String(f.tournament_id),
      tournamentName: String(f.tname),
      stage: String(f.stage),
      teamAId: String(f.team_a_id),
      teamBId: String(f.team_b_id),
    })),
  };
}
