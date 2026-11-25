import { newId, num, numOrNull, str, strOrNull, type Row, type SqlExecutor } from '../db/driver';
import type { Player, PlayerRole } from '../models';
import { optionalJersey, requireName, ValidationError } from '../../core/utils/validation';

export interface PlayerInput {
  name: string;
  teamId: string | null;
  role: PlayerRole;
  battingStyle: 'right' | 'left';
  bowlingStyle?: string | null;
  jerseyNumber?: number | null;
}

const ROLES: PlayerRole[] = ['batter', 'bowler', 'allRounder', 'wicketKeeper'];

export const ROLE_LABELS: Record<PlayerRole, string> = {
  batter: 'Batter',
  bowler: 'Bowler',
  allRounder: 'All-rounder',
  wicketKeeper: 'Wicket-keeper',
};

function toPlayer(r: Row): Player {
  return {
    id: str(r.id),
    name: str(r.name),
    teamId: strOrNull(r.team_id),
    role: str(r.role) as PlayerRole,
    battingStyle: str(r.batting_style) === 'left' ? 'left' : 'right',
    bowlingStyle: strOrNull(r.bowling_style),
    jerseyNumber: numOrNull(r.jersey_number),
    createdAt: num(r.created_at),
  };
}

function validate(input: PlayerInput): PlayerInput {
  if (!ROLES.includes(input.role)) {
    throw new ValidationError('role', 'Choose a role.');
  }
  if (input.battingStyle !== 'left' && input.battingStyle !== 'right') {
    throw new ValidationError('battingStyle', 'Choose a batting style.');
  }
  return {
    name: requireName('playerName', input.name, { min: 2, max: 40 }),
    teamId: input.teamId,
    role: input.role,
    battingStyle: input.battingStyle,
    bowlingStyle: input.bowlingStyle?.trim() ? input.bowlingStyle.trim().slice(0, 40) : null,
    jerseyNumber: optionalJersey(input.jerseyNumber ?? null),
  };
}

export const playerRepository = {
  async list(db: SqlExecutor, teamId?: string): Promise<Player[]> {
    const { rows } = teamId
      ? await db.execute(`SELECT * FROM players WHERE team_id = ? ORDER BY name COLLATE NOCASE`, [teamId])
      : await db.execute(`SELECT * FROM players ORDER BY name COLLATE NOCASE`);
    return rows.map(toPlayer);
  },

  async get(db: SqlExecutor, id: string): Promise<Player | null> {
    const { rows } = await db.execute(`SELECT * FROM players WHERE id = ?`, [id]);
    return rows[0] ? toPlayer(rows[0]) : null;
  },

  async getMany(db: SqlExecutor, ids: string[]): Promise<Player[]> {
    if (ids.length === 0) {
      return [];
    }
    const { rows } = await db.execute(
      `SELECT * FROM players WHERE id IN (${ids.map(() => '?').join(',')})`,
      ids,
    );
    return rows.map(toPlayer);
  },

  async create(db: SqlExecutor, input: PlayerInput): Promise<Player> {
    const v = validate(input);
    if (v.teamId) {
      const t = await db.execute(`SELECT id FROM teams WHERE id = ?`, [v.teamId]);
      if (t.rows.length === 0) {
        throw new ValidationError('teamId', 'That team no longer exists.');
      }
    }
    const now = Date.now();
    const id = newId('p_');
    await db.execute(
      `INSERT INTO players (id, name, team_id, role, batting_style, bowling_style, jersey_number, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      [id, v.name, v.teamId, v.role, v.battingStyle, v.bowlingStyle ?? null, v.jerseyNumber ?? null, now, now],
    );
    return { id, name: v.name, teamId: v.teamId, role: v.role, battingStyle: v.battingStyle, bowlingStyle: v.bowlingStyle ?? null, jerseyNumber: v.jerseyNumber ?? null, createdAt: now };
  },

  async update(db: SqlExecutor, id: string, input: PlayerInput): Promise<void> {
    const v = validate(input);
    await db.execute(
      `UPDATE players SET name = ?, team_id = ?, role = ?, batting_style = ?, bowling_style = ?, jersey_number = ?, updated_at = ? WHERE id = ?`,
      [v.name, v.teamId, v.role, v.battingStyle, v.bowlingStyle ?? null, v.jerseyNumber ?? null, Date.now(), id],
    );
  },

  async remove(db: SqlExecutor, id: string): Promise<void> {
    const { rows } = await db.execute(`SELECT COUNT(*) AS c FROM match_players WHERE player_id = ?`, [id]);
    if (num(rows[0]?.c) > 0) {
      throw new ValidationError('player', 'This player has played matches, so they cannot be deleted. Move them to another team instead.');
    }
    await db.execute(`DELETE FROM players WHERE id = ?`, [id]);
  },
};
