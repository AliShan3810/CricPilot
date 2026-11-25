import { replay } from '../core/engine/engine';
import { validateRules } from '../core/engine/rules';
import { playerMatchStats } from '../core/engine/stats';
import { EngineError, type MatchEvent, type MatchRules, type MatchSetup, type MatchState } from '../core/engine/types';
import { ValidationError, cleanName } from '../core/utils/validation';
import { getDb } from '../data/db/database';
import type { SqlExecutor } from '../data/db/driver';
import type { MatchPlayer, MatchRecord, Player, StoredEvent, Team } from '../data/models';
import { matchRepository } from '../data/repositories/matchRepository';
import { playerRepository } from '../data/repositories/playerRepository';
import { teamRepository } from '../data/repositories/teamRepository';
import { buildSummary, statusFor } from './matchSummary';
import { tournamentService } from './tournamentService';

export interface LoadedMatch {
  record: MatchRecord;
  setup: MatchSetup;
  teams: { a: Team; b: Team };
  players: Record<string, Player>;
  matchPlayers: MatchPlayer[];
  events: StoredEvent[];
  redo: StoredEvent[];
  state: MatchState;
}

export interface CreateMatchInput {
  title?: string;
  rules: MatchRules;
  teamAId: string;
  teamBId: string;
  venue?: string | null;
  scheduledAt?: number | null;
  /** Playing XI in batting order for each team */
  squadA: string[];
  squadB: string[];
  captainA?: string | null;
  captainB?: string | null;
  keeperA?: string | null;
  keeperB?: string | null;
  tournamentId?: string | null;
  fixtureId?: string | null;
}

export class ScoringError extends Error {
  constructor(message: string, readonly code: string) {
    super(message);
    this.name = 'ScoringError';
  }
}

function validateSquads(input: CreateMatchInput): void {
  const { rules, squadA, squadB } = input;
  if (input.teamAId === input.teamBId) {
    throw new ValidationError('teams', 'Choose two different teams.');
  }
  for (const [label, sq] of [['first', squadA], ['second', squadB]] as const) {
    if (sq.length < 2) {
      throw new ValidationError('squad', `The ${label} team needs at least 2 players.`);
    }
    if (sq.length > rules.playersPerSide) {
      throw new ValidationError('squad', `The ${label} team has more than ${rules.playersPerSide} players.`);
    }
    if (new Set(sq).size !== sq.length) {
      throw new ValidationError('squad', 'A player appears twice in the same team.');
    }
  }
  if (squadA.some(p => squadB.includes(p))) {
    throw new ValidationError('squad', 'A player cannot play for both teams.');
  }
  const issues = validateRules(rules);
  if (issues.length) {
    throw new ValidationError(issues[0].field, issues[0].message);
  }
}

async function buildSetup(db: SqlExecutor, record: MatchRecord): Promise<{ setup: MatchSetup; teams: { a: Team; b: Team }; matchPlayers: MatchPlayer[]; players: Record<string, Player> }> {
  const [a, b, matchPlayers] = await Promise.all([
    teamRepository.get(db, record.teamAId),
    teamRepository.get(db, record.teamBId),
    matchRepository.getPlayers(db, record.id),
  ]);
  if (!a || !b) {
    throw new ScoringError('One of the teams in this match is missing.', 'MISSING_TEAM');
  }
  const playerList = await playerRepository.getMany(db, matchPlayers.map(p => p.playerId));
  const players: Record<string, Player> = {};
  for (const p of playerList) {
    players[p.id] = p;
  }
  const squadFor = (teamId: string) =>
    matchPlayers.filter(p => p.teamId === teamId).sort((x, y) => x.battingOrder - y.battingOrder).map(p => p.playerId);
  const setup: MatchSetup = {
    rules: record.rules,
    teamA: { id: a.id, name: a.name, shortName: a.shortName, playerIds: squadFor(a.id) },
    teamB: { id: b.id, name: b.name, shortName: b.shortName, playerIds: squadFor(b.id) },
    tossWinnerId: record.tossWinnerId,
    tossDecision: record.tossDecision,
  };
  return { setup, teams: { a, b }, matchPlayers, players };
}

function names(players: Record<string, Player>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const id of Object.keys(players)) {
    out[id] = players[id].name;
  }
  return out;
}

function replayOrThrow(setup: MatchSetup, events: MatchEvent[]): MatchState {
  try {
    return replay(setup, events);
  } catch (e) {
    if (e instanceof EngineError) {
      throw new ScoringError(e.message.replace(/^Event \d+ \([A-Z_]+\): /, ''), e.code);
    }
    throw e;
  }
}

/** Replays the match and stores the derived summary, status and player stats. Runs inside the caller's transaction. */
async function persistDerived(tx: SqlExecutor, matchId: string): Promise<LoadedMatch> {
  const record = await matchRepository.get(tx, matchId);
  if (!record) {
    throw new ScoringError('Match not found.', 'NOT_FOUND');
  }
  const { setup, teams, matchPlayers, players } = await buildSetup(tx, record);
  const events = await matchRepository.activeEvents(tx, matchId);
  const redo = await matchRepository.redoStack(tx, matchId);
  const state = replayOrThrow(setup, events.map(e => e.event));
  const status = statusFor(state, events.length);
  const summary = buildSummary(state, names(players));
  await matchRepository.updateDerived(tx, matchId, {
    status,
    summary,
    resultText: state.result?.summary ?? null,
    winnerTeamId: state.result?.winnerTeamId ?? null,
  });
  await matchRepository.replaceStats(tx, matchId, playerMatchStats(state));
  const updated = (await matchRepository.get(tx, matchId))!;
  if (updated.fixtureId) {
    await tournamentService.syncFixture(tx, updated);
  }
  return { record: updated, setup, teams, players, matchPlayers, events, redo, state };
}

export const matchService = {
  async create(input: CreateMatchInput): Promise<string> {
    validateSquads(input);
    const db = await getDb();
    return db.transaction(async tx => {
      const [a, b] = await Promise.all([teamRepository.get(tx, input.teamAId), teamRepository.get(tx, input.teamBId)]);
      if (!a || !b) {
        throw new ValidationError('teams', 'Choose two teams.');
      }
      const title = cleanName(input.title ?? '') || `${a.shortName} vs ${b.shortName}`;
      const id = await matchRepository.insert(tx, {
        title: title.slice(0, 60),
        rules: input.rules,
        teamAId: a.id,
        teamBId: b.id,
        venue: input.venue?.trim() ? input.venue.trim().slice(0, 60) : null,
        scheduledAt: input.scheduledAt ?? Date.now(),
        tournamentId: input.tournamentId ?? null,
        fixtureId: input.fixtureId ?? null,
      });
      const rows: Omit<MatchPlayer, 'matchId'>[] = [
        ...input.squadA.map((playerId, i) => ({ teamId: a.id, playerId, battingOrder: i + 1, isCaptain: playerId === input.captainA, isKeeper: playerId === input.keeperA })),
        ...input.squadB.map((playerId, i) => ({ teamId: b.id, playerId, battingOrder: i + 1, isCaptain: playerId === input.captainB, isKeeper: playerId === input.keeperB })),
      ];
      await matchRepository.setPlayers(tx, id, rows);
      if (input.fixtureId) {
        await tournamentService.linkFixture(tx, input.fixtureId, id);
      }
      await persistDerived(tx, id);
      return id;
    });
  },

  async setToss(matchId: string, winnerId: string, decision: 'bat' | 'bowl'): Promise<LoadedMatch> {
    const db = await getDb();
    return db.transaction(async tx => {
      const record = await matchRepository.get(tx, matchId);
      if (!record) {
        throw new ScoringError('Match not found.', 'NOT_FOUND');
      }
      if (winnerId !== record.teamAId && winnerId !== record.teamBId) {
        throw new ValidationError('toss', 'The toss winner must be one of the two teams.');
      }
      const events = await matchRepository.activeEvents(tx, matchId);
      if (events.length > 0) {
        throw new ValidationError('toss', 'The toss cannot be changed after play has started.');
      }
      await matchRepository.setToss(tx, matchId, winnerId, decision);
      return persistDerived(tx, matchId);
    });
  },

  async load(matchId: string): Promise<LoadedMatch> {
    const db = await getDb();
    const record = await matchRepository.get(db, matchId);
    if (!record) {
      throw new ScoringError('Match not found.', 'NOT_FOUND');
    }
    const { setup, teams, matchPlayers, players } = await buildSetup(db, record);
    const events = await matchRepository.activeEvents(db, matchId);
    const redo = await matchRepository.redoStack(db, matchId);
    const state = replayOrThrow(setup, events.map(e => e.event));
    return { record, setup, teams, players, matchPlayers, events, redo, state };
  },

  /** Records a new event atomically. A new event clears the redo stack. */
  async record(matchId: string, event: MatchEvent): Promise<LoadedMatch> {
    const db = await getDb();
    return db.transaction(async tx => {
      const record = await matchRepository.get(tx, matchId);
      if (!record) {
        throw new ScoringError('Match not found.', 'NOT_FOUND');
      }
      const { setup } = await buildSetup(tx, record);
      const events = await matchRepository.activeEvents(tx, matchId);
      // validate before writing anything
      replayOrThrow(setup, [...events.map(e => e.event), event]);
      await matchRepository.clearRedo(tx, matchId);
      await matchRepository.appendEvent(tx, matchId, event);
      return persistDerived(tx, matchId);
    });
  },

  async undo(matchId: string): Promise<LoadedMatch> {
    const db = await getDb();
    return db.transaction(async tx => {
      const events = await matchRepository.activeEvents(tx, matchId);
      const last = events[events.length - 1];
      if (!last) {
        throw new ScoringError('There is nothing to undo.', 'NOTHING_TO_UNDO');
      }
      await matchRepository.setEventStatus(tx, last.id, 'undone');
      return persistDerived(tx, matchId);
    });
  },

  async redo(matchId: string): Promise<LoadedMatch> {
    const db = await getDb();
    return db.transaction(async tx => {
      const redo = await matchRepository.redoStack(tx, matchId);
      const next = redo[0];
      if (!next) {
        throw new ScoringError('There is nothing to redo.', 'NOTHING_TO_REDO');
      }
      const record = (await matchRepository.get(tx, matchId))!;
      const { setup } = await buildSetup(tx, record);
      const events = await matchRepository.activeEvents(tx, matchId);
      replayOrThrow(setup, [...events.map(e => e.event), next.event]);
      await matchRepository.setEventStatus(tx, next.id, 'active');
      return persistDerived(tx, matchId);
    });
  },

  /**
   * Corrects a past delivery. The whole log is replayed with the change; if any later
   * event becomes invalid, the correction is rejected and nothing is written.
   */
  async correct(matchId: string, eventId: string, replacement: MatchEvent): Promise<LoadedMatch> {
    const db = await getDb();
    return db.transaction(async tx => {
      const record = await matchRepository.get(tx, matchId);
      if (!record) {
        throw new ScoringError('Match not found.', 'NOT_FOUND');
      }
      const events = await matchRepository.activeEvents(tx, matchId);
      const idx = events.findIndex(e => e.id === eventId);
      if (idx < 0) {
        throw new ScoringError('That ball is no longer in the match.', 'NOT_FOUND');
      }
      if (events[idx].event.type !== 'DELIVERY' || replacement.type !== 'DELIVERY') {
        throw new ScoringError('Only deliveries can be corrected.', 'NOT_A_DELIVERY');
      }
      const { setup } = await buildSetup(tx, record);
      const candidate = events.map((e, i) => (i === idx ? replacement : e.event));
      try {
        replay(setup, candidate);
      } catch (e) {
        if (e instanceof EngineError) {
          const m = /^Event (\d+)/.exec(e.message);
          const at = m ? Number(m[1]) : null;
          const reason = e.message.replace(/^Event \d+ \([A-Z_]+\): /, '');
          throw new ScoringError(
            at !== null && at - 1 !== idx
              ? `This correction would make a later event invalid (event ${at}): ${reason}`
              : reason,
            'CORRECTION_CONFLICT',
          );
        }
        throw e;
      }
      await matchRepository.updateEventPayload(tx, eventId, replacement);
      await matchRepository.clearRedo(tx, matchId);
      return persistDerived(tx, matchId);
    });
  },

  async remove(matchId: string): Promise<void> {
    const db = await getDb();
    await db.transaction(async tx => {
      const record = await matchRepository.get(tx, matchId);
      if (record?.fixtureId) {
        await tournamentService.unlinkMatch(tx, record);
      }
      await matchRepository.remove(tx, matchId);
    });
  },

  async list(opts: Parameters<typeof matchRepository.list>[1] = {}): Promise<MatchRecord[]> {
    const db = await getDb();
    return matchRepository.list(db, opts);
  },

  /** Used after a restore or migration to rebuild every stored summary and stats row. */
  async rebuildAll(): Promise<number> {
    const db = await getDb();
    const all = await matchRepository.list(db);
    for (const m of all) {
      await db.transaction(tx => persistDerived(tx, m.id));
    }
    return all.length;
  },
};
