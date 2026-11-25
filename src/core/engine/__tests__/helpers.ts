import { replay } from '../engine';
import { presetRules } from '../rules';
import type { DeliveryPayload, MatchEvent, MatchFormat, MatchRules, MatchSetup, MatchState } from '../types';

export function squad(prefix: string, n: number): string[] {
  return Array.from({ length: n }, (_, i) => `${prefix}${i + 1}`);
}

export function setupFor(
  format: MatchFormat = 'T20',
  overrides: Partial<MatchRules> = {},
  playersA = 11,
  playersB = 11,
): MatchSetup {
  return {
    rules: { ...presetRules(format), ...overrides },
    teamA: { id: 'A', name: 'Alpha', shortName: 'ALP', playerIds: squad('a', playersA) },
    teamB: { id: 'B', name: 'Bravo', shortName: 'BRV', playerIds: squad('b', playersB) },
  };
}

export const dot = (): MatchEvent => del({});
export const runs = (n: number): MatchEvent => del({ batRuns: n });
export const four = (): MatchEvent => del({ batRuns: 4, boundary: 4 });
export const six = (): MatchEvent => del({ batRuns: 6, boundary: 6 });
export const wide = (extra = 0): MatchEvent => del({ kind: 'wide', wideRuns: extra });
export const noBall = (bat = 0): MatchEvent => del({ kind: 'noBall', batRuns: bat });

export function del(p: Partial<DeliveryPayload>): MatchEvent {
  return {
    type: 'DELIVERY',
    kind: 'legal',
    batRuns: 0,
    byes: 0,
    legByes: 0,
    wideRuns: 0,
    boundary: null,
    wicket: null,
    ...p,
  };
}

export function bowled(batterOutId: string): MatchEvent {
  return del({ wicket: { type: 'bowled', batterOutId } });
}

/** Scorer helper that remembers events and replays them on every call. */
export class Scorer {
  events: MatchEvent[] = [];
  constructor(public setup: MatchSetup) {}

  get state(): MatchState {
    return replay(this.setup, this.events);
  }

  push(...e: MatchEvent[]): this {
    for (const ev of e) {
      this.events.push(ev);
      replay(this.setup, this.events); // throws immediately if invalid
    }
    return this;
  }

  start(battingTeamId: string, striker: string, nonStriker: string | null, bowler: string): this {
    return this.push({ type: 'START_INNINGS', battingTeamId, strikerId: striker, nonStrikerId: nonStriker, bowlerId: bowler });
  }

  bowler(id: string): this {
    return this.push({ type: 'SET_BOWLER', bowlerId: id });
  }

  batter(id: string): this {
    return this.push({ type: 'NEW_BATTER', batterId: id });
  }

  /** Bowls an over of n dot balls (or the given events), then sets the next bowler if one is needed. */
  over(events: MatchEvent[], nextBowler?: string): this {
    this.push(...events);
    if (nextBowler && this.state.awaiting.kind === 'newBowler') {
      this.bowler(nextBowler);
    }
    return this;
  }

  get inn() {
    const s = this.state;
    return s.innings[s.currentInningsIndex];
  }
}

export function repeat<T>(n: number, f: () => T): T[] {
  return Array.from({ length: n }, f);
}
