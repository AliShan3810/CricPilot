import { num, str, type Row, type SqlExecutor } from '../db/driver';

/** Career statistics, built only from completed matches. Overs are in 6-ball equivalents. */
export interface CareerStats {
  playerId: string;
  name: string;
  teamId: string | null;
  matches: number;
  innings: number;
  runs: number;
  balls: number;
  notOuts: number;
  dismissals: number;
  highest: number;
  highestNotOut: boolean;
  fifties: number;
  hundreds: number;
  fours: number;
  sixes: number;
  ducks: number;
  battingAverage: number | null;
  strikeRate: number | null;
  bowlBalls: number;
  runsConceded: number;
  wickets: number;
  maidens: number;
  wides: number;
  noBalls: number;
  dots: number;
  bestWickets: number;
  bestRuns: number;
  bowlingAverage: number | null;
  economy: number | null;
  bowlingStrikeRate: number | null;
  catches: number;
  stumpings: number;
  runOuts: number;
}

const AGG = `
  SELECT s.player_id, p.name, p.team_id,
    COUNT(*) AS matches,
    SUM(s.bat_innings) AS innings, SUM(s.runs) AS runs, SUM(s.balls) AS balls, SUM(s.not_outs) AS not_outs,
    SUM(s.dismissals) AS dismissals, SUM(s.fifties) AS fifties, SUM(s.hundreds) AS hundreds,
    SUM(s.fours) AS fours, SUM(s.sixes) AS sixes, SUM(s.ducks) AS ducks,
    SUM(s.bowl_balls) AS bowl_balls, SUM(s.runs_conceded) AS runs_conceded, SUM(s.wickets) AS wickets,
    SUM(s.maidens) AS maidens, SUM(s.wides) AS wides, SUM(s.no_balls) AS no_balls, SUM(s.dots) AS dots,
    SUM(s.catches) AS catches, SUM(s.stumpings) AS stumpings, SUM(s.run_outs) AS run_outs,
    MAX(s.highest * 2 + s.highest_not_out) AS hs_key,
    MAX(CASE WHEN s.bowl_balls > 0 OR s.wides > 0 OR s.no_balls > 0 THEN s.best_wickets * 10000 + (9999 - s.best_runs) ELSE -1 END) AS bb_key
  FROM player_match_stats s
  JOIN matches m ON m.id = s.match_id AND m.status = 'completed'
  JOIN players p ON p.id = s.player_id`;

function toCareer(r: Row): CareerStats {
  const runs = num(r.runs);
  const balls = num(r.balls);
  const dismissals = num(r.dismissals);
  const bowlBalls = num(r.bowl_balls);
  const conceded = num(r.runs_conceded);
  const wickets = num(r.wickets);
  const hs = num(r.hs_key);
  const bb = num(r.bb_key);
  return {
    playerId: str(r.player_id),
    name: str(r.name),
    teamId: r.team_id === null ? null : str(r.team_id),
    matches: num(r.matches),
    innings: num(r.innings),
    runs,
    balls,
    notOuts: num(r.not_outs),
    dismissals,
    highest: Math.floor(hs / 2),
    highestNotOut: hs % 2 === 1,
    fifties: num(r.fifties),
    hundreds: num(r.hundreds),
    fours: num(r.fours),
    sixes: num(r.sixes),
    ducks: num(r.ducks),
    battingAverage: dismissals > 0 ? runs / dismissals : null,
    strikeRate: balls > 0 ? (runs * 100) / balls : null,
    bowlBalls,
    runsConceded: conceded,
    wickets,
    maidens: num(r.maidens),
    wides: num(r.wides),
    noBalls: num(r.no_balls),
    dots: num(r.dots),
    bestWickets: bb >= 0 ? Math.floor(bb / 10000) : 0,
    bestRuns: bb >= 0 ? 9999 - (bb % 10000) : 0,
    bowlingAverage: wickets > 0 ? conceded / wickets : null,
    economy: bowlBalls > 0 ? (conceded * 6) / bowlBalls : null,
    bowlingStrikeRate: wickets > 0 ? bowlBalls / wickets : null,
    catches: num(r.catches),
    stumpings: num(r.stumpings),
    runOuts: num(r.run_outs),
  };
}

export type LeaderboardKey = 'runs' | 'wickets' | 'sixes' | 'battingAverage' | 'strikeRate' | 'economy' | 'catches';

export const statsRepository = {
  async career(db: SqlExecutor, playerId: string): Promise<CareerStats | null> {
    const { rows } = await db.execute(`${AGG} WHERE s.player_id = ? GROUP BY s.player_id`, [playerId]);
    return rows[0] ? toCareer(rows[0]) : null;
  },

  async allCareers(db: SqlExecutor, teamId?: string): Promise<CareerStats[]> {
    const { rows } = teamId
      ? await db.execute(`${AGG} WHERE p.team_id = ? GROUP BY s.player_id`, [teamId])
      : await db.execute(`${AGG} GROUP BY s.player_id`);
    return rows.map(toCareer);
  },

  async leaderboard(db: SqlExecutor, key: LeaderboardKey, limit = 10): Promise<CareerStats[]> {
    const all = await this.allCareers(db);
    const sorters: Record<LeaderboardKey, { filter: (c: CareerStats) => boolean; value: (c: CareerStats) => number; asc?: boolean }> = {
      runs: { filter: c => c.runs > 0, value: c => c.runs },
      wickets: { filter: c => c.wickets > 0, value: c => c.wickets },
      sixes: { filter: c => c.sixes > 0, value: c => c.sixes },
      battingAverage: { filter: c => c.battingAverage !== null && c.innings >= 2, value: c => c.battingAverage ?? 0 },
      strikeRate: { filter: c => c.strikeRate !== null && c.balls >= 10, value: c => c.strikeRate ?? 0 },
      economy: { filter: c => c.economy !== null && c.bowlBalls >= 12, value: c => c.economy ?? 0, asc: true },
      catches: { filter: c => c.catches > 0, value: c => c.catches },
    };
    const s = sorters[key];
    return all
      .filter(s.filter)
      .sort((a, b) => (s.asc ? s.value(a) - s.value(b) : s.value(b) - s.value(a)) || a.name.localeCompare(b.name))
      .slice(0, limit);
  },

  /** Recent per-match rows for a player (form guide). */
  async recentForm(db: SqlExecutor, playerId: string, limit = 10): Promise<Array<{ matchId: string; title: string; runs: number; balls: number; out: boolean; wickets: number; conceded: number; completedAt: number }>> {
    const { rows } = await db.execute(
      `SELECT s.match_id, m.title, s.runs, s.balls, s.dismissals, s.bat_innings, s.wickets, s.runs_conceded, m.completed_at
       FROM player_match_stats s JOIN matches m ON m.id = s.match_id AND m.status = 'completed'
       WHERE s.player_id = ? ORDER BY m.completed_at DESC LIMIT ?`,
      [playerId, limit],
    );
    return rows.map(r => ({
      matchId: str(r.match_id),
      title: str(r.title),
      runs: num(r.runs),
      balls: num(r.balls),
      out: num(r.dismissals) > 0,
      wickets: num(r.wickets),
      conceded: num(r.runs_conceded),
      completedAt: num(r.completed_at),
    }));
  },
};
