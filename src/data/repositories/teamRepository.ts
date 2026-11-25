import { newId, num, str, strOrNull, type Row, type SqlExecutor } from '../db/driver';
import type { Team } from '../models';
import { requireColor, requireName, requireShortName, ValidationError } from '../../core/utils/validation';

export interface TeamInput {
  name: string;
  shortName: string;
  color: string;
  homeGround?: string | null;
}

function toTeam(r: Row): Team {
  return {
    id: str(r.id),
    name: str(r.name),
    shortName: str(r.short_name),
    color: str(r.color),
    homeGround: strOrNull(r.home_ground),
    createdAt: num(r.created_at),
    playerCount: r.player_count !== undefined ? num(r.player_count) : undefined,
    isTemporary: num(r.is_temporary) === 1,
  };
}

function validate(input: TeamInput): TeamInput {
  return {
    name: requireName('teamName', input.name, { min: 2, max: 32 }),
    shortName: requireShortName(input.shortName),
    color: requireColor(input.color),
    homeGround: input.homeGround?.trim() ? input.homeGround.trim().slice(0, 60) : null,
  };
}

export const teamRepository = {
  /** Permanent teams only, unless includeTemporary is set. */
  async list(db: SqlExecutor, includeTemporary = false): Promise<Team[]> {
    const { rows } = await db.execute(
      `SELECT t.*, (SELECT COUNT(*) FROM players p WHERE p.team_id = t.id) AS player_count
       FROM teams t ${includeTemporary ? '' : 'WHERE t.is_temporary = 0'} ORDER BY t.name COLLATE NOCASE`,
    );
    return rows.map(toTeam);
  },

  async get(db: SqlExecutor, id: string): Promise<Team | null> {
    const { rows } = await db.execute(
      `SELECT t.*, (SELECT COUNT(*) FROM players p WHERE p.team_id = t.id) AS player_count FROM teams t WHERE t.id = ?`,
      [id],
    );
    return rows[0] ? toTeam(rows[0]) : null;
  },

  async create(db: SqlExecutor, input: TeamInput, temporary = false): Promise<Team> {
    const v = validate(input);
    if (!temporary) {
      await assertUniqueName(db, v.name, null);
    }
    const now = Date.now();
    const id = newId('t_');
    await db.execute(
      `INSERT INTO teams (id, name, short_name, color, home_ground, created_at, updated_at, is_temporary) VALUES (?,?,?,?,?,?,?,?)`,
      [id, v.name, v.shortName, v.color, v.homeGround ?? null, now, now, temporary ? 1 : 0],
    );
    return { id, name: v.name, shortName: v.shortName, color: v.color, homeGround: v.homeGround ?? null, createdAt: now, playerCount: 0, isTemporary: temporary };
  },

  /** Turns a quick-match team into a permanent one (name must then be unique). */
  async makePermanent(db: SqlExecutor, id: string): Promise<void> {
    const t = await this.get(db, id);
    if (!t) {
      return;
    }
    await assertUniqueName(db, t.name, id);
    await db.execute(`UPDATE teams SET is_temporary = 0, updated_at = ? WHERE id = ?`, [Date.now(), id]);
  },

  async update(db: SqlExecutor, id: string, input: TeamInput): Promise<void> {
    const v = validate(input);
    await assertUniqueName(db, v.name, id);
    await db.execute(
      `UPDATE teams SET name = ?, short_name = ?, color = ?, home_ground = ?, updated_at = ? WHERE id = ?`,
      [v.name, v.shortName, v.color, v.homeGround ?? null, Date.now(), id],
    );
  },

  async remove(db: SqlExecutor, id: string): Promise<void> {
    const { rows } = await db.execute(
      `SELECT COUNT(*) AS c FROM matches WHERE team_a_id = ? OR team_b_id = ?`,
      [id, id],
    );
    if (num(rows[0]?.c) > 0) {
      throw new ValidationError('team', 'This team has played matches, so it cannot be deleted. Its history is kept.');
    }
    await db.execute(`DELETE FROM teams WHERE id = ?`, [id]);
  },
};

async function assertUniqueName(db: SqlExecutor, name: string, exceptId: string | null): Promise<void> {
  const { rows } = await db.execute(`SELECT id FROM teams WHERE name = ? COLLATE NOCASE AND is_temporary = 0`, [name]);
  if (rows.some(r => r.id !== exceptId)) {
    throw new ValidationError('teamName', 'A team with this name already exists.');
  }
}
