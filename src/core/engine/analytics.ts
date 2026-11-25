import type { BallRecord, InningsState, MatchState } from './types';

export interface ManhattanBar {
  over: number; // 1-based
  runs: number;
  wickets: number;
}

/** Runs per over (Manhattan chart). */
export function manhattan(inn: InningsState): ManhattanBar[] {
  return inn.overs.filter(Boolean).map(o => ({ over: o.number + 1, runs: o.runs, wickets: o.wickets }));
}

export interface WormPoint {
  over: number; // fractional overs, e.g. 3.5 for 3 overs + 3 balls (of 6)
  runs: number;
  wicket: boolean;
}

/** Cumulative runs by ball (worm chart). */
export function worm(inn: InningsState, ballsPerOver: number): WormPoint[] {
  const pts: WormPoint[] = [{ over: 0, runs: 0, wicket: false }];
  let legal = 0;
  for (const b of inn.balls) {
    if (b.kind === 'legal') {
      legal += 1;
    }
    pts.push({ over: legal / ballsPerOver, runs: b.teamScoreAfter, wicket: !!b.wicket });
  }
  return pts;
}

export interface WagonShot {
  angle: number;
  distance: number;
  runs: number;
  boundary: 4 | 6 | null;
  batterId: string;
}

export function wagonWheel(inn: InningsState, batterId?: string): WagonShot[] {
  return inn.balls
    .filter(b => b.shot && b.kind !== 'wide' && (!batterId || b.strikerId === batterId))
    .map(b => ({
      angle: b.shot!.angle,
      distance: b.shot!.distance,
      runs: b.batRuns,
      boundary: b.batRuns > 0 ? b.boundary : null,
      batterId: b.strikerId,
    }));
}

export interface PhaseSplit {
  label: string;
  fromOver: number;
  toOver: number;
  runs: number;
  wickets: number;
  balls: number;
  runRate: number;
}

/** Powerplay / middle / death split for limited-overs innings. */
export function phaseSplit(state: MatchState, inn: InningsState): PhaseSplit[] {
  const overs = inn.maxOvers ?? state.setup.rules.oversPerInnings;
  if (!overs || inn.isSuperOver) {
    return [];
  }
  const pp = Math.max(1, Math.round(overs * 0.3));
  const death = Math.max(1, Math.round(overs * 0.2));
  const phases: Array<[string, number, number]> = [
    ['Powerplay', 0, pp],
    ['Middle overs', pp, Math.max(pp, overs - death)],
    ['Death overs', Math.max(pp, overs - death), overs],
  ];
  const bpo = state.setup.rules.ballsPerOver;
  return phases
    .filter(([, a, b]) => b > a)
    .map(([label, from, to]) => {
      const balls = inn.balls.filter(b => b.over >= from && b.over < to);
      const runs = balls.reduce((s, b) => s + b.totalRuns, 0);
      const legal = balls.filter(b => b.kind === 'legal').length;
      return {
        label,
        fromOver: from + 1,
        toOver: to,
        runs,
        wickets: balls.filter(b => b.wicket).length,
        balls: legal,
        runRate: legal > 0 ? (runs * bpo) / legal : 0,
      };
    });
}

export interface ScoringDistribution {
  dots: number;
  ones: number;
  twos: number;
  threes: number;
  fours: number;
  sixes: number;
  extras: number;
}

export function scoringDistribution(balls: BallRecord[]): ScoringDistribution {
  const d: ScoringDistribution = { dots: 0, ones: 0, twos: 0, threes: 0, fours: 0, sixes: 0, extras: 0 };
  for (const b of balls) {
    if (b.kind !== 'legal' || b.byes > 0 || b.legByes > 0) {
      d.extras += 1;
      continue;
    }
    if (b.boundary === 6) {
      d.sixes += 1;
    } else if (b.boundary === 4) {
      d.fours += 1;
    } else if (b.batRuns === 0) {
      d.dots += 1;
    } else if (b.batRuns === 1) {
      d.ones += 1;
    } else if (b.batRuns === 2) {
      d.twos += 1;
    } else {
      d.threes += 1;
    }
  }
  return d;
}

export interface BowlerAnalysis {
  playerId: string;
  overs: string;
  runs: number;
  wickets: number;
  economy: number;
  dotPercent: number;
  boundariesConceded: number;
  extras: number;
}

export function bowlerAnalysis(state: MatchState, inn: InningsState): BowlerAnalysis[] {
  const bpo = state.setup.rules.ballsPerOver;
  return inn.bowlers.map(b => ({
    playerId: b.playerId,
    overs: `${Math.floor(b.legalBalls / bpo)}.${b.legalBalls % bpo}`,
    runs: b.runs,
    wickets: b.wickets,
    economy: b.legalBalls > 0 ? (b.runs * bpo) / b.legalBalls : 0,
    dotPercent: b.legalBalls > 0 ? (b.dots * 100) / b.legalBalls : 0,
    boundariesConceded: b.fours + b.sixes,
    extras: b.wides + b.noBalls,
  }));
}
