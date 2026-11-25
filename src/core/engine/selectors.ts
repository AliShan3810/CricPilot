import { formatOvers, squadOf } from './engine';
import type { BallRecord, InningsState, MatchState } from './types';

export function runRate(runs: number, legalBalls: number, ballsPerOver: number): number {
  if (legalBalls <= 0) {
    return 0;
  }
  return (runs * ballsPerOver) / legalBalls;
}

export function strikeRate(runs: number, balls: number): number {
  return balls > 0 ? (runs * 100) / balls : 0;
}

export function economy(runs: number, legalBalls: number, ballsPerOver: number): number {
  return runRate(runs, legalBalls, ballsPerOver);
}

export function fixed(n: number, digits = 2): string {
  return Number.isFinite(n) ? n.toFixed(digits) : '–';
}

export interface ChaseInfo {
  target: number;
  runsNeeded: number;
  ballsRemaining: number | null;
  requiredRate: number | null;
}

export function chaseInfo(state: MatchState, inn: InningsState): ChaseInfo | null {
  if (inn.target === null) {
    return null;
  }
  const bpo = state.setup.rules.ballsPerOver;
  const runsNeeded = Math.max(0, inn.target - inn.runs);
  const left = inn.maxOvers !== null ? Math.max(0, inn.maxOvers * bpo - inn.legalBalls) : null;
  const requiredRate = left !== null && left > 0 ? (runsNeeded * bpo) / left : null;
  return { target: inn.target, runsNeeded, ballsRemaining: left, requiredRate };
}

export function ballsRemaining(state: MatchState, inn: InningsState): number | null {
  if (inn.maxOvers === null) {
    return null;
  }
  return Math.max(0, inn.maxOvers * state.setup.rules.ballsPerOver - inn.legalBalls);
}

export function projectedScore(state: MatchState, inn: InningsState): number | null {
  if (inn.maxOvers === null || inn.legalBalls === 0) {
    return null;
  }
  const bpo = state.setup.rules.ballsPerOver;
  return Math.round((inn.runs / inn.legalBalls) * inn.maxOvers * bpo);
}

/** Short broadcast label for a ball, e.g. "4", "W", "1wd", "nb4", "2lb". */
export function ballLabel(b: BallRecord): string {
  if (b.wicket) {
    const runs = b.batRuns + b.byes + b.legByes + b.wideRuns;
    return runs > 0 ? `W+${runs}` : 'W';
  }
  if (b.kind === 'wide') {
    return b.wideRuns > 0 ? `${b.wideRuns + 1}wd` : 'wd';
  }
  if (b.kind === 'noBall') {
    if (b.byes > 0) {
      return `nb+${b.byes}b`;
    }
    if (b.legByes > 0) {
      return `nb+${b.legByes}lb`;
    }
    return b.batRuns > 0 ? `nb+${b.batRuns}` : 'nb';
  }
  if (b.byes > 0) {
    return `${b.byes}b`;
  }
  if (b.legByes > 0) {
    return `${b.legByes}lb`;
  }
  return b.batRuns === 0 ? '•' : String(b.batRuns);
}

export type BallTone = 'dot' | 'run' | 'four' | 'six' | 'wicket' | 'extra';

export function ballTone(b: BallRecord): BallTone {
  if (b.wicket) {
    return 'wicket';
  }
  if (b.kind !== 'legal' || b.byes > 0 || b.legByes > 0) {
    return 'extra';
  }
  if (b.boundary === 6) {
    return 'six';
  }
  if (b.boundary === 4) {
    return 'four';
  }
  return b.totalRuns === 0 ? 'dot' : 'run';
}

/** Balls of the over now being bowled (or the last completed over between overs). */
export function currentOverBalls(inn: InningsState): BallRecord[] {
  if (inn.overs.length === 0) {
    return [];
  }
  const last = inn.overs[inn.overs.length - 1];
  return last ? last.balls : [];
}

export function recentBalls(inn: InningsState, count = 12): BallRecord[] {
  return inn.balls.slice(-count);
}

export function inningsScoreText(state: MatchState, inn: InningsState): string {
  const bpo = state.setup.rules.ballsPerOver;
  const wk = inn.wickets >= inn.maxWickets && inn.endReason === 'allOut' ? '' : `/${inn.wickets}`;
  return `${inn.runs}${wk}${inn.declared ? 'd' : ''} (${formatOvers(inn.legalBalls, bpo)})`;
}

export function teamShortName(state: MatchState, teamId: string): string {
  return squadOf(state, teamId).shortName;
}

export function inningsTitle(state: MatchState, inn: InningsState): string {
  const name = squadOf(state, inn.battingTeamId).name;
  if (inn.isSuperOver) {
    return `${name} · Super Over ${inn.superOverNumber}`;
  }
  if (state.setup.rules.inningsPerSide === 2) {
    const nth = state.innings.filter(i => !i.isSuperOver && i.battingTeamId === inn.battingTeamId && i.index <= inn.index).length;
    return `${name} · ${nth === 1 ? '1st' : '2nd'} innings${inn.followOn ? ' (f/o)' : ''}`;
  }
  return name;
}

/** Text shown under the scoreboard, e.g. "Need 24 off 18 balls". */
export function situationText(state: MatchState): string {
  if (state.result) {
    return state.result.summary;
  }
  const inn = state.innings[state.currentInningsIndex];
  if (!inn) {
    return 'Match about to begin';
  }
  if (inn.completed) {
    if (state.awaiting.kind === 'superOverDecision') {
      return 'Scores level: super over?';
    }
    return 'Innings break';
  }
  const chase = chaseInfo(state, inn);
  if (chase) {
    if (chase.ballsRemaining !== null) {
      return `Need ${chase.runsNeeded} off ${chase.ballsRemaining} ball${chase.ballsRemaining === 1 ? '' : 's'}`;
    }
    return `Need ${chase.runsNeeded} to win`;
  }
  if (state.setup.rules.inningsPerSide === 2 && state.innings.length >= 2) {
    const batting = state.innings
      .filter(i => !i.isSuperOver && i.battingTeamId === inn.battingTeamId)
      .reduce((s, i) => s + i.runs, 0);
    const bowling = state.innings
      .filter(i => !i.isSuperOver && i.battingTeamId === inn.bowlingTeamId)
      .reduce((s, i) => s + i.runs, 0);
    const diff = batting - bowling;
    if (diff < 0) {
      return `Trail by ${-diff}`;
    }
    if (diff > 0) {
      return `Lead by ${diff}`;
    }
    return 'Scores level';
  }
  const proj = projectedScore(state, inn);
  return proj !== null ? `Projected ${proj}` : `CRR ${fixed(runRate(inn.runs, inn.legalBalls, state.setup.rules.ballsPerOver))}`;
}

/** Milestones crossed by this ball (50, 100, 150…) for the batter on strike. */
export function milestoneCrossed(before: number, after: number): number | null {
  for (const m of [50, 100, 150, 200, 250, 300]) {
    if (before < m && after >= m) {
      return m;
    }
  }
  return null;
}
