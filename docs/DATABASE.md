# CricPilot — Database Architecture

* **Engine:** SQLite through `@op-engineering/op-sqlite` (`cricpilot.db`, WAL mode, foreign keys on).
* **Preferences:** MMKV (`react-native-mmkv`) for onboarding state, theme, motion settings,
  haptics and the user's display name. MMKV never holds match data.
* **Access:** `SqlDriver` interface → repositories → services. Unit tests run the real
  migrations and repositories on Node's built-in `node:sqlite` through the same interface.
* **Migrations:** `src/data/db/migrations.ts` is an ordered list. `PRAGMA user_version`
  records the version applied. Each migration runs in its own transaction.

## Tables

```
teams(id TEXT PK, name TEXT NOT NULL UNIQUE COLLATE NOCASE, short_name TEXT NOT NULL,
      color TEXT NOT NULL, home_ground TEXT, created_at INTEGER, updated_at INTEGER)

players(id TEXT PK, name TEXT NOT NULL, team_id TEXT FK→teams ON DELETE SET NULL,
        role TEXT CHECK(role IN ('batter','bowler','allRounder','wicketKeeper')),
        batting_style TEXT ('right'|'left'), bowling_style TEXT,
        jersey_number INTEGER, created_at, updated_at)

tournaments(id TEXT PK, name TEXT NOT NULL, format TEXT ('league'|'knockout'|'leagueKnockout'),
            rules_json TEXT NOT NULL, points_win INTEGER, points_tie INTEGER, points_nr INTEGER,
            double_round_robin INTEGER, qualifiers INTEGER, status TEXT, created_at)

tournament_teams(tournament_id FK, team_id FK, group_name TEXT, PK(tournament_id, team_id))

fixtures(id TEXT PK, tournament_id FK ON DELETE CASCADE, stage TEXT ('league'|'quarterFinal'|'semiFinal'|'final'),
         round INTEGER, slot INTEGER, team_a_id TEXT NULL, team_b_id TEXT NULL,
         match_id TEXT NULL FK→matches, next_fixture_id TEXT NULL, next_slot TEXT ('a'|'b') NULL,
         scheduled_at INTEGER NULL, venue TEXT)

matches(id TEXT PK, title TEXT, format TEXT, rules_json TEXT NOT NULL,
        team_a_id FK, team_b_id FK, venue TEXT, scheduled_at INTEGER,
        toss_winner_id TEXT NULL, toss_decision TEXT ('bat'|'bowl') NULL,
        status TEXT ('scheduled'|'live'|'completed'|'abandoned'),
        tournament_id TEXT NULL, fixture_id TEXT NULL,
        summary_json TEXT, result_text TEXT, winner_team_id TEXT NULL,
        created_at, updated_at, completed_at INTEGER NULL)

match_players(match_id FK CASCADE, team_id FK, player_id FK, batting_order INTEGER,
              is_captain INTEGER, is_keeper INTEGER, PK(match_id, player_id))

match_events(id TEXT PK, match_id FK CASCADE, seq INTEGER NOT NULL,
             type TEXT NOT NULL, payload_json TEXT NOT NULL,
             status TEXT ('active'|'undone') NOT NULL, created_at, updated_at,
             UNIQUE(match_id, seq))

player_match_stats(match_id FK CASCADE, player_id FK, team_id,
    bat_innings, runs, balls, fours, sixes, not_outs, dismissals, highest, fifties, hundreds, ducks,
    bowl_balls, runs_conceded, wickets, maidens, wides, no_balls, dots,
    best_wickets, best_runs, catches, stumpings, run_outs,
    PK(match_id, player_id))
```

Indexes: `match_events(match_id, status, seq)`, `matches(status, updated_at)`,
`players(team_id)`, `fixtures(tournament_id)`, `player_match_stats(player_id)`.

## Write path (scoring)

```
UI tap → matchService.record(event)
  BEGIN
    validate against the replayed current state      (pure engine)
    DELETE undone events            (a new event clears the redo stack)
    INSERT match_events(seq = max + 1)
    replay → MatchState
    UPDATE matches SET summary_json, status, result_text, winner…
    DELETE + INSERT player_match_stats for the match
    tournament: advance the knockout winner when the match completes
  COMMIT
```

If anything throws, the transaction rolls back and the in-memory store keeps its
previous state. Because every ball is committed before the UI updates, a match
picks up exactly where it stopped after the app is killed: on launch, live
matches are listed and **Resume** replays them.

## Backup format
`cricpilot-backup-YYYYMMDD-HHmm.json`: `{ app: "CricPilot", schemaVersion, exportedAt, tables: { teams: [...], ... } }`.
Restore checks the app name, the schema version and the shape of every row, then
replaces every table inside one transaction.
