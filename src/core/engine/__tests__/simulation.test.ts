/**
 * Property-style check: a long, randomly generated (but always valid) T20 match must keep
 * every total consistent: batting + extras = team runs, bowler runs + byes + leg byes + penalty = team runs,
 * legal balls = over count, wickets = fall of wickets, and replay must be deterministic.
 */
import { availableBatters, bowlerEligibility, replay } from '../engine';
import type { DeliveryPayload, MatchEvent, MatchState } from '../types';
import { setupFor } from './helpers';

function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

function nextEvent(state: MatchState, r: () => number): MatchEvent | null {
  const aw = state.awaiting;
  const inn = state.innings[state.currentInningsIndex];
  switch (aw.kind) {
    case 'startInnings': {
      const team = aw.battingTeamOptions[0];
      const bat = (team === 'A' ? state.setup.teamA : state.setup.teamB).playerIds;
      const bowl = (team === 'A' ? state.setup.teamB : state.setup.teamA).playerIds;
      return { type: 'START_INNINGS', battingTeamId: team, strikerId: bat[0], nonStrikerId: bat[1], bowlerId: bowl[bowl.length - 1] };
    }
    case 'newBatter':
      return { type: 'NEW_BATTER', batterId: availableBatters(state, inn!)[0] };
    case 'newBowler': {
      const options = bowlerEligibility(state, inn!).filter(b => b.eligible);
      return { type: 'SET_BOWLER', bowlerId: options[Math.floor(r() * options.length)].playerId };
    }
    case 'superOverDecision':
      return { type: 'START_SUPER_OVER' };
    case 'delivery': {
      const d: DeliveryPayload = { kind: 'legal', batRuns: 0, byes: 0, legByes: 0, wideRuns: 0, boundary: null, wicket: null };
      const x = r();
      if (x < 0.04) {
        d.kind = 'wide';
        d.wideRuns = r() < 0.2 ? 1 : 0;
      } else if (x < 0.07) {
        d.kind = 'noBall';
        d.batRuns = [0, 1, 4][Math.floor(r() * 3)];
        d.boundary = d.batRuns === 4 ? 4 : null;
      } else if (x < 0.1) {
        d.legByes = 1;
      } else if (x < 0.16 && !inn!.freeHitNext) {
        d.wicket = { type: r() < 0.5 ? 'bowled' : 'caught', batterOutId: inn!.strikerId!, fielderId: null };
      } else if (x < 0.18) {
        d.batRuns = 1;
        d.wicket = { type: 'runOut', batterOutId: inn!.nonStrikerId ?? inn!.strikerId!, end: inn!.nonStrikerId ? 'striker' : 'striker' };
      } else {
        const runs = [0, 0, 0, 1, 1, 1, 2, 3, 4, 6][Math.floor(r() * 10)];
        d.batRuns = runs;
        d.boundary = runs === 4 ? 4 : runs === 6 ? 6 : null;
      }
      return { type: 'DELIVERY', ...d };
    }
    default:
      return null;
  }
}

describe('random match simulation', () => {
  it.each([1, 2, 3, 4, 5, 6, 7, 8])('keeps every total consistent (seed %i)', seed => {
    const setup = setupFor('T20');
    const r = rng(seed);
    const events: MatchEvent[] = [];
    let state = replay(setup, events);
    for (let i = 0; i < 2000 && !state.completed; i++) {
      const e = nextEvent(state, r);
      if (!e) {
        break;
      }
      events.push(e);
      state = replay(setup, events);
    }
    expect(state.completed).toBe(true);
    expect(state.result).not.toBeNull();
    for (const inn of state.innings) {
      const ex = inn.extras;
      const extras = ex.wides + ex.noBalls + ex.byes + ex.legByes + ex.penalty;
      const batRuns = inn.batters.reduce((s, b) => s + b.runs, 0);
      expect(batRuns + extras).toBe(inn.runs);
      const bowlerRuns = inn.bowlers.reduce((s, b) => s + b.runs, 0);
      expect(bowlerRuns + ex.byes + ex.legByes + ex.penalty).toBe(inn.runs);
      expect(inn.bowlers.reduce((s, b) => s + b.legalBalls, 0)).toBe(inn.legalBalls);
      expect(inn.fallOfWickets).toHaveLength(inn.wickets);
      expect(inn.overs.reduce((s, o) => s + o.runs, 0)).toBe(inn.runs);
      expect(inn.balls.filter(b => b.kind === 'legal')).toHaveLength(inn.legalBalls);
      expect(inn.wickets).toBeLessThanOrEqual(inn.maxWickets);
      if (inn.maxOvers !== null) {
        expect(inn.legalBalls).toBeLessThanOrEqual(inn.maxOvers * 6);
      }
      for (const b of inn.bowlers) {
        if (!inn.isSuperOver) {
          expect(inn.overs.filter(o => o.bowlerIds.includes(b.playerId)).length).toBeLessThanOrEqual(4);
        }
      }
      for (let k = 1; k < inn.overs.length; k++) {
        expect(inn.overs[k].bowlerIds[0]).not.toBe(inn.overs[k - 1].bowlerIds[inn.overs[k - 1].bowlerIds.length - 1]);
      }
      const partnershipRuns = inn.partnerships.reduce((s, p) => s + p.runs, 0);
      expect(partnershipRuns).toBe(inn.runs);
    }
    // deterministic replay
    expect(JSON.stringify(replay(setup, events))).toBe(JSON.stringify(state));
  });
});
