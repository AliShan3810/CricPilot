import type { SqlDriver } from './driver';

export interface Migration {
  version: number;
  name: string;
  statements: string[];
}

export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    name: 'initial schema',
    statements: [
      `CREATE TABLE teams (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL COLLATE NOCASE UNIQUE,
        short_name TEXT NOT NULL,
        color TEXT NOT NULL,
        home_ground TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )`,
      `CREATE TABLE players (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        team_id TEXT REFERENCES teams(id) ON DELETE SET NULL,
        role TEXT NOT NULL DEFAULT 'batter' CHECK (role IN ('batter','bowler','allRounder','wicketKeeper')),
        batting_style TEXT NOT NULL DEFAULT 'right' CHECK (batting_style IN ('right','left')),
        bowling_style TEXT,
        jersey_number INTEGER,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )`,
      `CREATE INDEX idx_players_team ON players(team_id)`,
      `CREATE TABLE tournaments (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        format TEXT NOT NULL CHECK (format IN ('league','knockout','leagueKnockout')),
        rules_json TEXT NOT NULL,
        points_win INTEGER NOT NULL DEFAULT 2,
        points_tie INTEGER NOT NULL DEFAULT 1,
        points_nr INTEGER NOT NULL DEFAULT 1,
        double_round_robin INTEGER NOT NULL DEFAULT 0,
        qualifiers INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed')),
        winner_team_id TEXT,
        created_at INTEGER NOT NULL
      )`,
      `CREATE TABLE tournament_teams (
        tournament_id TEXT NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
        team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
        seed INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (tournament_id, team_id)
      )`,
      `CREATE TABLE matches (
        id TEXT PRIMARY KEY NOT NULL,
        title TEXT NOT NULL,
        format TEXT NOT NULL,
        rules_json TEXT NOT NULL,
        team_a_id TEXT NOT NULL REFERENCES teams(id),
        team_b_id TEXT NOT NULL REFERENCES teams(id),
        venue TEXT,
        scheduled_at INTEGER,
        toss_winner_id TEXT,
        toss_decision TEXT CHECK (toss_decision IN ('bat','bowl')),
        status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','live','completed')),
        tournament_id TEXT REFERENCES tournaments(id) ON DELETE SET NULL,
        fixture_id TEXT,
        summary_json TEXT,
        result_text TEXT,
        winner_team_id TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        completed_at INTEGER
      )`,
      `CREATE INDEX idx_matches_status ON matches(status, updated_at)`,
      `CREATE INDEX idx_matches_tournament ON matches(tournament_id)`,
      `CREATE TABLE fixtures (
        id TEXT PRIMARY KEY NOT NULL,
        tournament_id TEXT NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
        stage TEXT NOT NULL,
        round INTEGER NOT NULL,
        slot INTEGER NOT NULL,
        team_a_id TEXT REFERENCES teams(id),
        team_b_id TEXT REFERENCES teams(id),
        label_a TEXT,
        label_b TEXT,
        match_id TEXT REFERENCES matches(id) ON DELETE SET NULL,
        next_fixture_id TEXT,
        next_slot TEXT CHECK (next_slot IN ('a','b')),
        winner_team_id TEXT,
        scheduled_at INTEGER,
        venue TEXT
      )`,
      `CREATE INDEX idx_fixtures_tournament ON fixtures(tournament_id, round, slot)`,
      `CREATE TABLE match_players (
        match_id TEXT NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
        team_id TEXT NOT NULL REFERENCES teams(id),
        player_id TEXT NOT NULL REFERENCES players(id),
        batting_order INTEGER NOT NULL,
        is_captain INTEGER NOT NULL DEFAULT 0,
        is_keeper INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (match_id, player_id)
      )`,
      `CREATE TABLE match_events (
        id TEXT PRIMARY KEY NOT NULL,
        match_id TEXT NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
        seq INTEGER NOT NULL,
        type TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','undone')),
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        UNIQUE (match_id, seq)
      )`,
      `CREATE INDEX idx_events_match ON match_events(match_id, status, seq)`,
      `CREATE TABLE player_match_stats (
        match_id TEXT NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
        player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
        team_id TEXT NOT NULL,
        bat_innings INTEGER NOT NULL DEFAULT 0,
        runs INTEGER NOT NULL DEFAULT 0,
        balls INTEGER NOT NULL DEFAULT 0,
        fours INTEGER NOT NULL DEFAULT 0,
        sixes INTEGER NOT NULL DEFAULT 0,
        not_outs INTEGER NOT NULL DEFAULT 0,
        dismissals INTEGER NOT NULL DEFAULT 0,
        highest INTEGER NOT NULL DEFAULT 0,
        highest_not_out INTEGER NOT NULL DEFAULT 0,
        fifties INTEGER NOT NULL DEFAULT 0,
        hundreds INTEGER NOT NULL DEFAULT 0,
        ducks INTEGER NOT NULL DEFAULT 0,
        bowl_balls INTEGER NOT NULL DEFAULT 0,
        runs_conceded INTEGER NOT NULL DEFAULT 0,
        wickets INTEGER NOT NULL DEFAULT 0,
        maidens INTEGER NOT NULL DEFAULT 0,
        wides INTEGER NOT NULL DEFAULT 0,
        no_balls INTEGER NOT NULL DEFAULT 0,
        dots INTEGER NOT NULL DEFAULT 0,
        best_wickets INTEGER NOT NULL DEFAULT 0,
        best_runs INTEGER NOT NULL DEFAULT 0,
        catches INTEGER NOT NULL DEFAULT 0,
        stumpings INTEGER NOT NULL DEFAULT 0,
        run_outs INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (match_id, player_id)
      )`,
      `CREATE INDEX idx_pms_player ON player_match_stats(player_id)`,
    ],
  },
  {
    version: 2,
    name: 'temporary teams for quick matches',
    statements: [
      `ALTER TABLE teams ADD COLUMN is_temporary INTEGER NOT NULL DEFAULT 0`,
      `CREATE INDEX idx_teams_temporary ON teams(is_temporary)`,
    ],
  },
];

export const SCHEMA_VERSION = MIGRATIONS[MIGRATIONS.length - 1].version;

export async function migrate(db: SqlDriver): Promise<number> {
  await db.execute('PRAGMA foreign_keys = ON');
  const res = await db.execute('PRAGMA user_version');
  const current = Number(Object.values(res.rows[0] ?? { v: 0 })[0] ?? 0);
  for (const m of MIGRATIONS) {
    if (m.version <= current) {
      continue;
    }
    await db.transaction(async tx => {
      for (const sql of m.statements) {
        await tx.execute(sql);
      }
      await tx.execute(`PRAGMA user_version = ${m.version}`);
    });
  }
  return SCHEMA_VERSION;
}
