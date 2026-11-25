import type { BallType, DeliveryDismissalType, MatchFormat, MatchRules } from './types';

const BASE: Omit<MatchRules, 'format' | 'oversPerInnings' | 'inningsPerSide' | 'maxOversPerBowler'> = {
  ballType: 'hard',
  ballsPerOver: 6,
  playersPerSide: 11,
  wideRuns: 1,
  noBallRuns: 1,
  freeHit: true,
  lastManStands: false,
  superOverOnTie: true,
  followOnMargin: null,
  lbwAllowed: true,
  legByesAllowed: true,
};

export const FORMAT_LABELS: Record<MatchFormat, string> = {
  T10: 'T10',
  T20: 'T20',
  ODI: 'One Day',
  TEST: 'Test',
  CUSTOM: 'Custom',
};

export function presetRules(format: MatchFormat, ballType: BallType = 'hard'): MatchRules {
  let rules: MatchRules;
  switch (format) {
    case 'T10':
      rules = { ...BASE, format, oversPerInnings: 10, inningsPerSide: 1, maxOversPerBowler: 2 };
      break;
    case 'T20':
      rules = { ...BASE, format, oversPerInnings: 20, inningsPerSide: 1, maxOversPerBowler: 4 };
      break;
    case 'ODI':
      rules = { ...BASE, format, oversPerInnings: 50, inningsPerSide: 1, maxOversPerBowler: 10 };
      break;
    case 'TEST':
      rules = {
        ...BASE,
        format,
        oversPerInnings: null,
        inningsPerSide: 2,
        maxOversPerBowler: null,
        freeHit: false,
        superOverOnTie: false,
        followOnMargin: 200,
      };
      break;
    case 'CUSTOM':
    default:
      rules = { ...BASE, format: 'CUSTOM', oversPerInnings: 8, inningsPerSide: 1, maxOversPerBowler: 2 };
  }
  return applyBallType(rules, ballType);
}

/** Tape-ball local rules: no LBW, no leg byes, free hit on every no-ball. */
export function applyBallType(rules: MatchRules, ballType: BallType): MatchRules {
  if (ballType === 'tape') {
    return { ...rules, ballType, lbwAllowed: false, legByesAllowed: false, freeHit: true };
  }
  return { ...rules, ballType, lbwAllowed: true, legByesAllowed: true };
}

export interface RuleIssue {
  field: keyof MatchRules;
  message: string;
}

export function validateRules(r: MatchRules): RuleIssue[] {
  const issues: RuleIssue[] = [];
  if (r.oversPerInnings !== null && (!Number.isInteger(r.oversPerInnings) || r.oversPerInnings < 1 || r.oversPerInnings > 100)) {
    issues.push({ field: 'oversPerInnings', message: 'Overs must be between 1 and 100.' });
  }
  if (r.inningsPerSide === 1 && r.oversPerInnings === null) {
    issues.push({ field: 'oversPerInnings', message: 'Limited-overs matches need an over limit.' });
  }
  if (!Number.isInteger(r.ballsPerOver) || r.ballsPerOver < 4 || r.ballsPerOver > 8) {
    issues.push({ field: 'ballsPerOver', message: 'Balls per over must be between 4 and 8.' });
  }
  if (!Number.isInteger(r.playersPerSide) || r.playersPerSide < 2 || r.playersPerSide > 11) {
    issues.push({ field: 'playersPerSide', message: 'Players per side must be between 2 and 11.' });
  }
  if (r.maxOversPerBowler !== null) {
    if (!Number.isInteger(r.maxOversPerBowler) || r.maxOversPerBowler < 1) {
      issues.push({ field: 'maxOversPerBowler', message: 'Bowler limit must be at least 1 over.' });
    } else if (r.oversPerInnings !== null && r.maxOversPerBowler * Math.max(1, r.playersPerSide) < r.oversPerInnings) {
      issues.push({
        field: 'maxOversPerBowler',
        message: 'The bowler limit is too low for the fielding side to complete the innings.',
      });
    }
  }
  if (!Number.isInteger(r.wideRuns) || r.wideRuns < 0 || r.wideRuns > 5) {
    issues.push({ field: 'wideRuns', message: 'Wide penalty must be between 0 and 5.' });
  }
  if (!Number.isInteger(r.noBallRuns) || r.noBallRuns < 0 || r.noBallRuns > 5) {
    issues.push({ field: 'noBallRuns', message: 'No-ball penalty must be between 0 and 5.' });
  }
  return issues;
}

/** Wickets that end the innings. */
export function maxWicketsFor(rules: MatchRules, players: number, isSuperOver: boolean): number {
  if (isSuperOver) {
    return Math.min(2, Math.max(1, players - 1));
  }
  return rules.lastManStands ? players : players - 1;
}

export const BOWLER_CREDITED: ReadonlySet<DeliveryDismissalType> = new Set([
  'bowled',
  'caught',
  'lbw',
  'stumped',
  'hitWicket',
]);

export const ALLOWED_ON_WIDE: ReadonlySet<DeliveryDismissalType> = new Set([
  'stumped',
  'hitWicket',
  'runOut',
  'obstructingField',
]);

export const ALLOWED_ON_NO_BALL: ReadonlySet<DeliveryDismissalType> = new Set([
  'runOut',
  'obstructingField',
  'hitBallTwice',
]);

export const ALLOWED_ON_FREE_HIT: ReadonlySet<DeliveryDismissalType> = new Set([
  'runOut',
  'obstructingField',
  'hitBallTwice',
]);

export const DISMISSAL_LABELS: Record<string, string> = {
  bowled: 'Bowled',
  caught: 'Caught',
  lbw: 'LBW',
  stumped: 'Stumped',
  hitWicket: 'Hit wicket',
  runOut: 'Run out',
  obstructingField: 'Obstructing the field',
  hitBallTwice: 'Hit the ball twice',
  retiredOut: 'Retired out',
  timedOut: 'Timed out',
  retiredHurt: 'Retired hurt',
};
