/**
 * Domain types for the CricLedger scoring engine.
 * The engine is pure TypeScript: it does no I/O and does not touch React Native.
 * See docs/SCORING_RULES.md for the laws implemented here.
 */

export type MatchFormat = 'T10' | 'T20' | 'ODI' | 'TEST' | 'CUSTOM';
export type BallType = 'hard' | 'tape';

export interface MatchRules {
  format: MatchFormat;
  ballType: BallType;
  /** null = unlimited (Test) */
  oversPerInnings: number | null;
  inningsPerSide: 1 | 2;
  ballsPerOver: number;
  playersPerSide: number;
  maxOversPerBowler: number | null;
  wideRuns: number;
  noBallRuns: number;
  freeHit: boolean;
  lastManStands: boolean;
  superOverOnTie: boolean;
  followOnMargin: number | null;
  lbwAllowed: boolean;
  legByesAllowed: boolean;
}

export type DeliveryKind = 'legal' | 'wide' | 'noBall';

export type DismissalType =
  | 'bowled'
  | 'caught'
  | 'lbw'
  | 'stumped'
  | 'hitWicket'
  | 'runOut'
  | 'obstructingField'
  | 'hitBallTwice'
  | 'retiredOut'
  | 'timedOut'
  | 'retiredHurt';

export type DeliveryDismissalType = Exclude<
  DismissalType,
  'retiredOut' | 'timedOut' | 'retiredHurt'
>;

export interface DeliveryWicket {
  type: DeliveryDismissalType;
  batterOutId: string;
  fielderId?: string | null;
  /** For run outs: the end the dismissed batter was at when the wicket was put down. */
  end?: 'striker' | 'nonStriker';
}

export interface ShotInfo {
  /** degrees, 0 = straight down the ground toward the bowler, clockwise from the batter's view (off side for a right-hander is 0–180) */
  angle: number;
  /** 0..1 relative distance to the boundary */
  distance: number;
}

export interface DeliveryPayload {
  kind: DeliveryKind;
  batRuns: number;
  byes: number;
  legByes: number;
  /** runs completed on a wide, not counting the penalty */
  wideRuns: number;
  boundary: 4 | 6 | null;
  wicket: DeliveryWicket | null;
  shot?: ShotInfo | null;
}

export type MatchEvent =
  | {
      type: 'START_INNINGS';
      battingTeamId: string;
      strikerId: string;
      nonStrikerId: string | null;
      bowlerId: string;
    }
  | ({ type: 'DELIVERY' } & DeliveryPayload)
  | { type: 'SET_BOWLER'; bowlerId: string; midOver?: boolean }
  | { type: 'NEW_BATTER'; batterId: string; atEnd?: 'striker' | 'nonStriker' }
  | {
      type: 'NON_DELIVERY_DISMISSAL';
      batterId: string;
      how: 'retiredHurt' | 'retiredOut' | 'timedOut' | 'runOutNonStriker';
    }
  | { type: 'SWAP_STRIKE' }
  | { type: 'PENALTY'; toTeamId: string; runs: number }
  | { type: 'REVISE_TARGET'; target: number; overs: number | null }
  | { type: 'DECLARE' }
  | { type: 'END_INNINGS'; reason?: string }
  | { type: 'START_SUPER_OVER' }
  | {
      type: 'END_MATCH';
      result: 'draw' | 'noResult' | 'abandoned' | 'conceded';
      winnerTeamId?: string | null;
    };

export type MatchEventType = MatchEvent['type'];

export interface TeamSquad {
  id: string;
  name: string;
  shortName: string;
  /** players in batting order */
  playerIds: string[];
}

export interface MatchSetup {
  rules: MatchRules;
  teamA: TeamSquad;
  teamB: TeamSquad;
  /** Team that bats first, decided by the toss. Optional: START_INNINGS also names it. */
  tossWinnerId?: string | null;
  tossDecision?: 'bat' | 'bowl' | null;
}

export interface BatterInnings {
  playerId: string;
  order: number;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  dots: number;
  dismissal: Dismissal | null;
  retiredHurt: boolean;
  /** shots with direction recorded (wagon wheel) */
  shots: Array<ShotInfo & { runs: number; boundary: 4 | 6 | null }>;
}

export interface Dismissal {
  type: DismissalType;
  bowlerId: string | null;
  fielderId: string | null;
  teamScore: number;
  wicketNumber: number;
  overBall: string;
}

export interface BowlerInnings {
  playerId: string;
  order: number;
  legalBalls: number;
  runs: number;
  wickets: number;
  maidens: number;
  wides: number;
  noBalls: number;
  dots: number;
  fours: number;
  sixes: number;
}

export interface Extras {
  wides: number;
  noBalls: number;
  byes: number;
  legByes: number;
  penalty: number;
}

export interface BallRecord {
  /** index of the event in the active log */
  eventIndex: number;
  over: number; // 0-based over number
  ballInOver: number; // legal balls bowled in the over after this delivery
  bowlerId: string;
  strikerId: string;
  nonStrikerId: string | null;
  kind: DeliveryKind;
  batRuns: number;
  byes: number;
  legByes: number;
  wideRuns: number;
  boundary: 4 | 6 | null;
  /** total runs this delivery added to the team */
  totalRuns: number;
  /** runs charged to the bowler */
  bowlerRuns: number;
  wicket: (DeliveryWicket & { bowlerCredited: boolean }) | null;
  freeHit: boolean;
  shot: ShotInfo | null;
  teamScoreAfter: number;
  wicketsAfter: number;
}

export interface OverRecord {
  number: number; // 0-based
  bowlerIds: string[];
  balls: BallRecord[];
  runs: number;
  wickets: number;
  legalBalls: number;
  isMaiden: boolean;
}

export interface Partnership {
  wicket: number; // 1-based partnership number
  batter1Id: string;
  batter2Id: string | null;
  runs: number;
  balls: number;
  batter1Runs: number;
  batter2Runs: number;
  batter1Balls: number;
  batter2Balls: number;
  unbroken: boolean;
}

export interface FallOfWicket {
  wicketNumber: number;
  teamScore: number;
  overBall: string;
  batterId: string;
}

export type InningsEndReason =
  | 'allOut'
  | 'oversComplete'
  | 'targetReached'
  | 'declared'
  | 'manual'
  | 'matchEnded';

export interface InningsState {
  index: number;
  isSuperOver: boolean;
  superOverNumber: number;
  battingTeamId: string;
  bowlingTeamId: string;
  runs: number;
  wickets: number;
  legalBalls: number;
  extras: Extras;
  batters: BatterInnings[];
  bowlers: BowlerInnings[];
  strikerId: string | null;
  nonStrikerId: string | null;
  currentBowlerId: string | null;
  lastOverBowlerId: string | null;
  overs: OverRecord[];
  balls: BallRecord[];
  partnerships: Partnership[];
  fallOfWickets: FallOfWicket[];
  freeHitNext: boolean;
  completed: boolean;
  endReason: InningsEndReason | null;
  target: number | null;
  /** overs limit for this innings (may be revised) */
  maxOvers: number | null;
  maxWickets: number;
  declared: boolean;
  followOn: boolean;
}

export type Awaiting =
  | { kind: 'startInnings'; battingTeamOptions: string[]; reason: 'first' | 'next' | 'superOver' }
  | { kind: 'newBatter'; end: 'striker' | 'nonStriker' }
  | { kind: 'newBowler' }
  | { kind: 'superOverDecision' }
  | { kind: 'delivery' }
  | { kind: 'none' };

export type ResultType = 'win' | 'tie' | 'draw' | 'noResult';

export interface MatchResult {
  type: ResultType;
  winnerTeamId: string | null;
  /** e.g. "by 5 wickets" */
  marginText: string;
  marginRuns: number | null;
  marginWickets: number | null;
  ballsRemaining: number | null;
  byInnings: boolean;
  decidedBySuperOver: boolean;
  summary: string;
}

export interface MatchState {
  setup: MatchSetup;
  innings: InningsState[];
  currentInningsIndex: number;
  awaiting: Awaiting;
  result: MatchResult | null;
  completed: boolean;
  /** penalty runs awarded to a team that has not batted yet */
  pendingPenalty: Record<string, number>;
  eventCount: number;
  /** DLS-style manual revision for the second innings */
  revisedTarget: { target: number; overs: number | null } | null;
  /** between-innings phase (what is needed when no innings is in progress) */
  phase: Awaiting;
}

export class EngineError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = 'EngineError';
  }
}
