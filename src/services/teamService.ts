import { getDb } from '../data/db/database';
import type { MatchRecord, Player, Team } from '../data/models';
import { matchRepository } from '../data/repositories/matchRepository';
import { playerRepository, type PlayerInput } from '../data/repositories/playerRepository';
import { teamRepository, type TeamInput } from '../data/repositories/teamRepository';
import { statsRepository, type CareerStats } from '../data/repositories/statsRepository';
import { bumpData } from '../stores/appStore';
import { ValidationError, shortNameFrom } from '../core/utils/validation';

export interface TeamStats {
  played: number;
  won: number;
  lost: number;
  tied: number;
  noResult: number;
  winPercent: number;
  highest: { runs: number; wickets: number; vs: string } | null;
  lowest: { runs: number; wickets: number; vs: string } | null;
  form: Array<'W' | 'L' | 'T' | 'N'>;
}

/** Team record computed from completed matches. Super overs are excluded from totals. */
export function computeTeamStats(teamId: string, matches: MatchRecord[], teams: Record<string, Team>): TeamStats {
  const done = matches
    .filter(m => m.status === 'completed' && (m.teamAId === teamId || m.teamBId === teamId))
    .sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0));
  const s: TeamStats = { played: done.length, won: 0, lost: 0, tied: 0, noResult: 0, winPercent: 0, highest: null, lowest: null, form: [] };
  for (const m of done) {
    const rt = m.summary?.resultType;
    let f: 'W' | 'L' | 'T' | 'N';
    if (rt === 'win' && m.winnerTeamId) {
      f = m.winnerTeamId === teamId ? 'W' : 'L';
    } else if (rt === 'tie') {
      f = 'T';
    } else {
      f = 'N';
    }
    if (f === 'W') {
      s.won++;
    } else if (f === 'L') {
      s.lost++;
    } else if (f === 'T') {
      s.tied++;
    } else {
      s.noResult++;
    }
    if (s.form.length < 5) {
      s.form.push(f);
    }
    const opp = teams[m.teamAId === teamId ? m.teamBId : m.teamAId]?.shortName ?? '';
    for (const inn of m.summary?.innings ?? []) {
      if (inn.teamId !== teamId || inn.isSuperOver || !inn.completed) {
        continue;
      }
      if (!s.highest || inn.runs > s.highest.runs) {
        s.highest = { runs: inn.runs, wickets: inn.wickets, vs: opp };
      }
      if (inn.allOut && (!s.lowest || inn.runs < s.lowest.runs)) {
        s.lowest = { runs: inn.runs, wickets: inn.wickets, vs: opp };
      }
    }
  }
  const decided = s.won + s.lost + s.tied;
  s.winPercent = decided > 0 ? (s.won * 100) / decided : 0;
  return s;
}

export interface HeadToHead {
  played: number;
  aWins: number;
  bWins: number;
  other: number;
  last: { resultText: string; completedAt: number } | null;
  aBest: number | null;
  bBest: number | null;
}

/** Record between two teams from completed matches (super overs excluded from totals). */
export function computeHeadToHead(aId: string, bId: string, matches: MatchRecord[]): HeadToHead {
  const games = matches
    .filter(m => m.status === 'completed' && ((m.teamAId === aId && m.teamBId === bId) || (m.teamAId === bId && m.teamBId === aId)))
    .sort((x, y) => (y.completedAt ?? 0) - (x.completedAt ?? 0));
  const h: HeadToHead = { played: games.length, aWins: 0, bWins: 0, other: 0, last: null, aBest: null, bBest: null };
  for (const g of games) {
    if (g.winnerTeamId === aId) {
      h.aWins++;
    } else if (g.winnerTeamId === bId) {
      h.bWins++;
    } else {
      h.other++;
    }
    for (const inn of g.summary?.innings ?? []) {
      if (inn.isSuperOver) {
        continue;
      }
      if (inn.teamId === aId) {
        h.aBest = Math.max(h.aBest ?? 0, inn.runs);
      } else if (inn.teamId === bId) {
        h.bBest = Math.max(h.bBest ?? 0, inn.runs);
      }
    }
  }
  if (games[0]) {
    h.last = { resultText: games[0].resultText ?? 'Completed', completedAt: games[0].completedAt ?? 0 };
  }
  return h;
}

export interface QuickTeamInput {
  name: string;
  color: string;
  playerNames: string[];
}

export const teamService = {
  async list(): Promise<Team[]> {
    return teamRepository.list(await getDb());
  },
  /** Includes quick-match teams (for showing past matches). */
  async all(): Promise<Team[]> {
    return teamRepository.list(await getDb(), true);
  },
  async headToHead(aId: string, bId: string): Promise<HeadToHead> {
    const db = await getDb();
    return computeHeadToHead(aId, bId, await matchRepository.list(db, { teamId: aId, status: ['completed'] }));
  },
  /** Creates a temporary team and its players in one transaction (for quick matches). */
  async createQuick(input: QuickTeamInput): Promise<{ team: Team; players: Player[] }> {
    const names = input.playerNames.map(n => n.replace(/\s+/g, ' ').trim()).filter(Boolean);
    if (names.length < 2) {
      throw new ValidationError('players', 'Add at least 2 players.');
    }
    if (names.length > 11) {
      throw new ValidationError('players', 'A team can have at most 11 players.');
    }
    if (new Set(names.map(n => n.toLowerCase())).size !== names.length) {
      throw new ValidationError('players', 'Two players have the same name.');
    }
    const db = await getDb();
    const result = await db.transaction(async tx => {
      const base = input.name.replace(/\s+/g, ' ').trim();
      // team names are unique in the database: quick teams get a suffix when the name is taken
      let name = base;
      for (let i = 2; i < 100; i++) {
        const { rows } = await tx.execute(`SELECT id FROM teams WHERE name = ? COLLATE NOCASE`, [name]);
        if (rows.length === 0) {
          break;
        }
        name = `${base} · ${i}`;
      }
      const team = await teamRepository.create(tx, { name, shortName: shortNameFrom(base).slice(0, 4) || 'TM', color: input.color }, true);
      const players: Player[] = [];
      for (const n of names) {
        players.push(await playerRepository.create(tx, { name: n, teamId: team.id, role: 'allRounder', battingStyle: 'right' }));
      }
      return { team: { ...team, playerCount: players.length }, players };
    });
    bumpData();
    return result;
  },
  async makePermanent(id: string): Promise<void> {
    await teamRepository.makePermanent(await getDb(), id);
    bumpData();
  },
  async get(id: string): Promise<Team | null> {
    return teamRepository.get(await getDb(), id);
  },
  async save(input: TeamInput, id?: string): Promise<Team | null> {
    const db = await getDb();
    if (id) {
      await teamRepository.update(db, id, input);
      bumpData();
      return teamRepository.get(db, id);
    }
    const t = await teamRepository.create(db, input);
    bumpData();
    return t;
  },
  async remove(id: string): Promise<void> {
    await teamRepository.remove(await getDb(), id);
    bumpData();
  },
  async detail(id: string): Promise<{ team: Team; players: Player[]; stats: TeamStats; careers: Record<string, CareerStats>; matches: MatchRecord[]; teams: Record<string, Team> } | null> {
    const db = await getDb();
    const team = await teamRepository.get(db, id);
    if (!team) {
      return null;
    }
    const [players, matches, teamList, careerList] = await Promise.all([
      playerRepository.list(db, id),
      matchRepository.list(db, { teamId: id }),
      teamRepository.list(db, true),
      statsRepository.allCareers(db, id),
    ]);
    const teams: Record<string, Team> = {};
    teamList.forEach(t => (teams[t.id] = t));
    const careers: Record<string, CareerStats> = {};
    careerList.forEach(c => (careers[c.playerId] = c));
    return { team, players, stats: computeTeamStats(id, matches, teams), careers, matches, teams };
  },
};

export const playerService = {
  async list(teamId?: string): Promise<Player[]> {
    return playerRepository.list(await getDb(), teamId);
  },
  async get(id: string): Promise<Player | null> {
    return playerRepository.get(await getDb(), id);
  },
  async save(input: PlayerInput, id?: string): Promise<Player | null> {
    const db = await getDb();
    if (id) {
      await playerRepository.update(db, id, input);
      bumpData();
      return playerRepository.get(db, id);
    }
    const p = await playerRepository.create(db, input);
    bumpData();
    return p;
  },
  async remove(id: string): Promise<void> {
    await playerRepository.remove(await getDb(), id);
    bumpData();
  },
  async profile(id: string) {
    const db = await getDb();
    const player = await playerRepository.get(db, id);
    if (!player) {
      return null;
    }
    const [career, form, team] = await Promise.all([
      statsRepository.career(db, id),
      statsRepository.recentForm(db, id, 10),
      player.teamId ? teamRepository.get(db, player.teamId) : Promise.resolve(null),
    ]);
    return { player, career, form, team };
  },
};
