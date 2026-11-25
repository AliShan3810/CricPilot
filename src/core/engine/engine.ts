import {
  ALLOWED_ON_FREE_HIT,
  ALLOWED_ON_NO_BALL,
  ALLOWED_ON_WIDE,
  BOWLER_CREDITED,
  maxWicketsFor,
} from './rules';
import {
  Awaiting,
  BallRecord,
  BatterInnings,
  BowlerInnings,
  DeliveryPayload,
  EngineError,
  InningsState,
  MatchEvent,
  MatchResult,
  MatchSetup,
  MatchState,
  OverRecord,
  TeamSquad,
} from './types';

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

function fail(code: string, message: string): never {
  throw new EngineError(code, message);
}

export function formatOvers(legalBalls: number, ballsPerOver: number): string {
  return `${Math.floor(legalBalls / ballsPerOver)}.${legalBalls % ballsPerOver}`;
}

export function squadOf(state: MatchState, teamId: string): TeamSquad {
  if (state.setup.teamA.id === teamId) {
    return state.setup.teamA;
  }
  if (state.setup.teamB.id === teamId) {
    return state.setup.teamB;
  }
  return fail('UNKNOWN_TEAM', 'That team is not part of this match.');
}

export function otherTeamId(state: MatchState, teamId: string): string {
  return state.setup.teamA.id === teamId ? state.setup.teamB.id : state.setup.teamA.id;
}

export function currentInnings(state: MatchState): InningsState | null {
  return state.innings[state.currentInningsIndex] ?? null;
}

function activeInnings(state: MatchState): InningsState {
  const inn = currentInnings(state);
  if (!inn || inn.completed || state.completed) {
    return fail('NO_ACTIVE_INNINGS', 'There is no innings in progress.');
  }
  return inn;
}

function batterOf(inn: InningsState, playerId: string): BatterInnings | undefined {
  return inn.batters.find(b => b.playerId === playerId);
}

function ensureBatter(inn: InningsState, playerId: string): BatterInnings {
  let b = batterOf(inn, playerId);
  if (!b) {
    b = {
      playerId,
      order: inn.batters.length + 1,
      runs: 0,
      balls: 0,
      fours: 0,
      sixes: 0,
      dots: 0,
      dismissal: null,
      retiredHurt: false,
      shots: [],
    };
    inn.batters.push(b);
  }
  return b;
}

function ensureBowler(inn: InningsState, playerId: string): BowlerInnings {
  let b = inn.bowlers.find(x => x.playerId === playerId);
  if (!b) {
    b = {
      playerId,
      order: inn.bowlers.length + 1,
      legalBalls: 0,
      runs: 0,
      wickets: 0,
      maidens: 0,
      wides: 0,
      noBalls: 0,
      dots: 0,
      fours: 0,
      sixes: 0,
    };
    inn.bowlers.push(b);
  }
  return b;
}

function atCrease(inn: InningsState, playerId: string): boolean {
  return inn.strikerId === playerId || inn.nonStrikerId === playerId;
}

/** Players who could still come in to bat. */
export function availableBatters(state: MatchState, inn: InningsState): string[] {
  const squad = squadOf(state, inn.battingTeamId);
  return squad.playerIds.filter(id => {
    if (atCrease(inn, id)) {
      return false;
    }
    const b = batterOf(inn, id);
    if (!b) {
      return true;
    }
    return b.dismissal === null && b.retiredHurt;
  });
}

/** Bowlers who may bowl the next over, with the reason others are excluded. */
export function bowlerEligibility(
  state: MatchState,
  inn: InningsState,
  midOver = false,
): Array<{ playerId: string; eligible: boolean; reason: string | null }> {
  const squad = squadOf(state, inn.bowlingTeamId);
  const { maxOversPerBowler } = state.setup.rules;
  return squad.playerIds.map(playerId => {
    if (inn.lastOverBowlerId === playerId) {
      return { playerId, eligible: false, reason: 'Bowled the previous over' };
    }
    if (midOver && inn.currentBowlerId === playerId) {
      return { playerId, eligible: false, reason: 'Current bowler' };
    }
    if (maxOversPerBowler !== null && !inn.isSuperOver) {
      const overs = inn.overs.filter(o => o.bowlerIds.includes(playerId)).length;
      if (overs >= maxOversPerBowler) {
        return { playerId, eligible: false, reason: `Quota of ${maxOversPerBowler} overs used` };
      }
    }
    return { playerId, eligible: true, reason: null };
  });
}

function mainInnings(state: MatchState): InningsState[] {
  return state.innings.filter(i => !i.isSuperOver);
}

function aggregateFor(state: MatchState, teamId: string): number {
  return mainInnings(state)
    .filter(i => i.battingTeamId === teamId)
    .reduce((sum, i) => sum + i.runs, 0);
}

/* ------------------------------------------------------------------ */
/* state creation                                                      */
/* ------------------------------------------------------------------ */

export function createInitialState(setup: MatchSetup): MatchState {
  if (setup.teamA.id === setup.teamB.id) {
    fail('SAME_TEAM', 'A match needs two different teams.');
  }
  let options = [setup.teamA.id, setup.teamB.id];
  if (setup.tossWinnerId && setup.tossDecision) {
    const winnerBats = setup.tossDecision === 'bat';
    const loser = setup.tossWinnerId === setup.teamA.id ? setup.teamB.id : setup.teamA.id;
    options = [winnerBats ? setup.tossWinnerId : loser];
  }
  return {
    setup,
    innings: [],
    currentInningsIndex: -1,
    awaiting: { kind: 'startInnings', battingTeamOptions: options, reason: 'first' },
    result: null,
    completed: false,
    pendingPenalty: {},
    eventCount: 0,
    revisedTarget: null,
    phase: { kind: 'startInnings', battingTeamOptions: options, reason: 'first' },
  };
}

/* ------------------------------------------------------------------ */
/* awaiting                                                            */
/* ------------------------------------------------------------------ */

type InternalState = MatchState;

function isSoloBatting(state: MatchState, inn: InningsState): boolean {
  return (
    state.setup.rules.lastManStands &&
    !inn.isSuperOver &&
    inn.nonStrikerId === null &&
    inn.strikerId !== null &&
    availableBatters(state, inn).length === 0
  );
}

function refreshAwaiting(state: InternalState): void {
  if (state.completed) {
    state.awaiting = { kind: 'none' };
    return;
  }
  const inn = currentInnings(state);
  if (!inn || inn.completed) {
    state.awaiting = state.phase;
    return;
  }
  if (inn.strikerId === null) {
    state.awaiting = { kind: 'newBatter', end: 'striker' };
    return;
  }
  if (inn.nonStrikerId === null && !isSoloBatting(state, inn)) {
    state.awaiting = { kind: 'newBatter', end: 'nonStriker' };
    return;
  }
  if (inn.currentBowlerId === null) {
    state.awaiting = { kind: 'newBowler' };
    return;
  }
  state.awaiting = { kind: 'delivery' };
}

/* ------------------------------------------------------------------ */
/* innings completion & results                                        */
/* ------------------------------------------------------------------ */

function teamName(state: MatchState, teamId: string): string {
  return squadOf(state, teamId).name;
}

function makeResult(
  state: MatchState,
  partial: Omit<MatchResult, 'summary' | 'marginText'> & { marginText?: string },
): MatchResult {
  let marginText = partial.marginText ?? '';
  let summary: string;
  if (partial.type === 'win' && partial.winnerTeamId) {
    const name = teamName(state, partial.winnerTeamId);
    if (!partial.marginText) {
      if (partial.decidedBySuperOver) {
        marginText = 'in the Super Over';
      } else if (partial.byInnings && partial.marginRuns !== null) {
        marginText = `by an innings and ${partial.marginRuns} run${partial.marginRuns === 1 ? '' : 's'}`;
      } else if (partial.marginWickets !== null) {
        marginText = `by ${partial.marginWickets} wicket${partial.marginWickets === 1 ? '' : 's'}`;
        if (partial.ballsRemaining !== null && partial.ballsRemaining > 0) {
          marginText += ` (${partial.ballsRemaining} ball${partial.ballsRemaining === 1 ? '' : 's'} left)`;
        }
      } else if (partial.marginRuns !== null) {
        marginText = `by ${partial.marginRuns} run${partial.marginRuns === 1 ? '' : 's'}`;
      }
    }
    summary = `${name} won ${marginText}`.trim();
  } else if (partial.type === 'tie') {
    summary = 'Match tied';
  } else if (partial.type === 'draw') {
    summary = 'Match drawn';
  } else {
    summary = 'No result';
  }
  return { ...partial, marginText, summary };
}

function finishMatch(state: InternalState, result: MatchResult): void {
  state.result = result;
  state.completed = true;
  state.phase = { kind: 'none' };
}

function chaseResult(state: InternalState, chasing: InningsState, defendingTeamId: string): MatchResult | 'tie' {
  const target = chasing.target ?? 0;
  if (chasing.runs >= target) {
    const ballsRemaining =
      chasing.maxOvers !== null
        ? chasing.maxOvers * state.setup.rules.ballsPerOver - chasing.legalBalls
        : null;
    return makeResult(state, {
      type: 'win',
      winnerTeamId: chasing.battingTeamId,
      marginRuns: null,
      marginWickets: chasing.maxWickets - chasing.wickets,
      ballsRemaining,
      byInnings: false,
      decidedBySuperOver: chasing.isSuperOver,
    });
  }
  if (chasing.runs === target - 1) {
    return 'tie';
  }
  return makeResult(state, {
    type: 'win',
    winnerTeamId: defendingTeamId,
    marginRuns: target - 1 - chasing.runs,
    marginWickets: null,
    ballsRemaining: null,
    byInnings: false,
    decidedBySuperOver: chasing.isSuperOver,
  });
}

function onInningsComplete(state: InternalState): void {
  if (state.completed) {
    return;
  }
  const { rules } = state.setup;
  const inn = currentInnings(state)!;
  const main = mainInnings(state);

  if (inn.isSuperOver) {
    const supers = state.innings.filter(i => i.isSuperOver);
    if (supers.length % 2 === 1) {
      state.phase = {
        kind: 'startInnings',
        battingTeamOptions: [inn.bowlingTeamId],
        reason: 'superOver',
      };
      return;
    }
    const res = chaseResult(state, inn, inn.bowlingTeamId);
    if (res === 'tie') {
      state.phase = { kind: 'superOverDecision' };
      return;
    }
    finishMatch(state, res);
    return;
  }

  if (rules.inningsPerSide === 1) {
    if (main.length === 1) {
      state.phase = {
        kind: 'startInnings',
        battingTeamOptions: [inn.bowlingTeamId],
        reason: 'next',
      };
      return;
    }
    const res = chaseResult(state, inn, inn.bowlingTeamId);
    if (res === 'tie') {
      if (rules.superOverOnTie) {
        state.phase = { kind: 'superOverDecision' };
      } else {
        finishMatch(state, tieResult(state));
      }
      return;
    }
    finishMatch(state, res);
    return;
  }

  // Two-innings (Test) match
  const first = main[0];
  const teamA = first.battingTeamId;
  const teamB = first.bowlingTeamId;
  if (main.length === 1) {
    state.phase = { kind: 'startInnings', battingTeamOptions: [teamB], reason: 'next' };
    return;
  }
  if (main.length === 2) {
    const lead = main[0].runs - main[1].runs;
    const options =
      rules.followOnMargin !== null && lead >= rules.followOnMargin ? [teamA, teamB] : [teamA];
    state.phase = { kind: 'startInnings', battingTeamOptions: options, reason: 'next' };
    return;
  }
  if (main.length === 3) {
    const third = main[2];
    const twice = third.battingTeamId;
    const once = twice === teamA ? teamB : teamA;
    const twiceAgg = aggregateFor(state, twice);
    const onceAgg = aggregateFor(state, once);
    if (twiceAgg < onceAgg) {
      finishMatch(
        state,
        makeResult(state, {
          type: 'win',
          winnerTeamId: once,
          marginRuns: onceAgg - twiceAgg,
          marginWickets: null,
          ballsRemaining: null,
          byInnings: true,
          decidedBySuperOver: false,
        }),
      );
      return;
    }
    state.phase = { kind: 'startInnings', battingTeamOptions: [once], reason: 'next' };
    return;
  }
  // fourth innings complete
  const res = chaseResult(state, inn, inn.bowlingTeamId);
  finishMatch(state, res === 'tie' ? tieResult(state) : res);
}

function tieResult(state: MatchState): MatchResult {
  return makeResult(state, {
    type: 'tie',
    winnerTeamId: null,
    marginRuns: null,
    marginWickets: null,
    ballsRemaining: null,
    byInnings: false,
    decidedBySuperOver: false,
  });
}

function completeInnings(state: InternalState, inn: InningsState, reason: InningsState['endReason']): void {
  inn.completed = true;
  inn.endReason = reason;
  inn.freeHitNext = false;
  onInningsComplete(state);
}

/** Checks the limits after any change to runs, wickets or balls. Returns true if the innings ended. */
function checkInningsEnd(state: InternalState, inn: InningsState): boolean {
  const bpo = state.setup.rules.ballsPerOver;
  if (inn.target !== null && inn.runs >= inn.target) {
    completeInnings(state, inn, 'targetReached');
    return true;
  }
  const noOneLeft = inn.strikerId === null && inn.nonStrikerId === null;
  const vacancy = inn.strikerId === null || inn.nonStrikerId === null;
  if (
    inn.wickets >= inn.maxWickets ||
    noOneLeft ||
    (vacancy && availableBatters(state, inn).length === 0 && !canBatSolo(state, inn))
  ) {
    completeInnings(state, inn, 'allOut');
    return true;
  }
  if (inn.maxOvers !== null && inn.legalBalls >= inn.maxOvers * bpo) {
    completeInnings(state, inn, 'oversComplete');
    return true;
  }
  return false;
}

function canBatSolo(state: MatchState, inn: InningsState): boolean {
  return (
    state.setup.rules.lastManStands &&
    !inn.isSuperOver &&
    (inn.strikerId !== null) !== (inn.nonStrikerId !== null)
  );
}

/** With last man stands, the lone batter always takes strike. */
function normaliseSolo(state: MatchState, inn: InningsState): void {
  if (
    canBatSolo(state, inn) &&
    availableBatters(state, inn).length === 0 &&
    inn.strikerId === null &&
    inn.nonStrikerId !== null
  ) {
    inn.strikerId = inn.nonStrikerId;
    inn.nonStrikerId = null;
  }
}

function startPartnership(inn: InningsState, a: string, b: string | null): void {
  inn.partnerships.push({
    wicket: inn.wickets + 1,
    batter1Id: a,
    batter2Id: b,
    runs: 0,
    balls: 0,
    batter1Runs: 0,
    batter2Runs: 0,
    batter1Balls: 0,
    batter2Balls: 0,
    unbroken: true,
  });
}

function endPartnership(inn: InningsState): void {
  const p = inn.partnerships[inn.partnerships.length - 1];
  if (p) {
    p.unbroken = false;
  }
}

/* ------------------------------------------------------------------ */
/* event handlers                                                      */
/* ------------------------------------------------------------------ */

function handleStartInnings(state: InternalState, e: Extract<MatchEvent, { type: 'START_INNINGS' }>): void {
  const aw = state.awaiting;
  if (aw.kind !== 'startInnings') {
    fail('NOT_AWAITING_INNINGS', 'An innings cannot be started now.');
  }
  if (!aw.battingTeamOptions.includes(e.battingTeamId)) {
    fail('INVALID_BATTING_TEAM', 'That team cannot bat in this innings.');
  }
  const { rules } = state.setup;
  const battingSquad = squadOf(state, e.battingTeamId);
  const bowlingTeamId = otherTeamId(state, e.battingTeamId);
  const bowlingSquad = squadOf(state, bowlingTeamId);
  if (!battingSquad.playerIds.includes(e.strikerId)) {
    fail('INVALID_BATTER', 'The striker is not in the batting side.');
  }
  if (e.nonStrikerId === null) {
    if (battingSquad.playerIds.length > 1) {
      fail('INVALID_BATTER', 'Choose a non-striker.');
    }
  } else {
    if (!battingSquad.playerIds.includes(e.nonStrikerId)) {
      fail('INVALID_BATTER', 'The non-striker is not in the batting side.');
    }
    if (e.nonStrikerId === e.strikerId) {
      fail('INVALID_BATTER', 'Striker and non-striker must be different players.');
    }
  }
  if (!bowlingSquad.playerIds.includes(e.bowlerId)) {
    fail('INVALID_BOWLER', 'The bowler is not in the fielding side.');
  }

  const isSuperOver = aw.reason === 'superOver';
  const index = state.innings.length;
  const main = mainInnings(state);
  let target: number | null = null;
  let maxOvers = isSuperOver ? 1 : rules.oversPerInnings;

  if (isSuperOver) {
    const supers = state.innings.filter(i => i.isSuperOver);
    if (supers.length % 2 === 1) {
      target = supers[supers.length - 1].runs + 1;
    }
  } else if (rules.inningsPerSide === 1 && main.length === 1) {
    target = main[0].runs + 1;
    if (state.revisedTarget) {
      target = state.revisedTarget.target;
      maxOvers = state.revisedTarget.overs ?? maxOvers;
    }
  } else if (rules.inningsPerSide === 2 && main.length === 3) {
    target = aggregateFor(state, bowlingTeamId) - aggregateFor(state, e.battingTeamId) + 1;
  }

  const supersBefore = state.innings.filter(i => i.isSuperOver).length;
  const inn: InningsState = {
    index,
    isSuperOver,
    superOverNumber: isSuperOver ? Math.floor(supersBefore / 2) + 1 : 0,
    battingTeamId: e.battingTeamId,
    bowlingTeamId,
    runs: 0,
    wickets: 0,
    legalBalls: 0,
    extras: { wides: 0, noBalls: 0, byes: 0, legByes: 0, penalty: 0 },
    batters: [],
    bowlers: [],
    strikerId: e.strikerId,
    nonStrikerId: e.nonStrikerId,
    currentBowlerId: e.bowlerId,
    lastOverBowlerId: null,
    overs: [],
    balls: [],
    partnerships: [],
    fallOfWickets: [],
    freeHitNext: false,
    completed: false,
    endReason: null,
    target,
    maxOvers,
    maxWickets: maxWicketsFor(rules, battingSquad.playerIds.length, isSuperOver),
    declared: false,
    followOn:
      rules.inningsPerSide === 2 && main.length === 2 && e.battingTeamId === main[1].battingTeamId,
  };
  ensureBatter(inn, e.strikerId);
  if (e.nonStrikerId) {
    ensureBatter(inn, e.nonStrikerId);
  }
  ensureBowler(inn, e.bowlerId);
  startPartnership(inn, e.strikerId, e.nonStrikerId);

  const pending = state.pendingPenalty[e.battingTeamId] ?? 0;
  if (pending > 0 && !isSuperOver) {
    inn.runs += pending;
    inn.extras.penalty += pending;
    delete state.pendingPenalty[e.battingTeamId];
  }

  state.innings.push(inn);
  state.currentInningsIndex = index;
  state.phase = { kind: 'none' };
}

export function validateDelivery(state: MatchState, d: DeliveryPayload): void {
  const { rules } = state.setup;
  const inn = activeInnings(state);
  if (state.awaiting.kind !== 'delivery') {
    fail('NOT_AWAITING_DELIVERY', describeAwaiting(state.awaiting));
  }
  const ints: Array<[string, number]> = [
    ['batRuns', d.batRuns],
    ['byes', d.byes],
    ['legByes', d.legByes],
    ['wideRuns', d.wideRuns],
  ];
  for (const [name, v] of ints) {
    if (!Number.isInteger(v) || v < 0 || v > 7) {
      fail('INVALID_RUNS', `${name} must be a whole number from 0 to 7.`);
    }
  }
  if (d.kind !== 'legal' && d.kind !== 'wide' && d.kind !== 'noBall') {
    fail('INVALID_KIND', 'Unknown delivery type.');
  }
  if (d.kind === 'wide' && (d.batRuns > 0 || d.byes > 0 || d.legByes > 0)) {
    fail('INVALID_WIDE', 'Runs on a wide are recorded as wides.');
  }
  if (d.kind !== 'wide' && d.wideRuns > 0) {
    fail('INVALID_EXTRAS', 'Wide runs can only be recorded on a wide.');
  }
  const runSources = [d.batRuns, d.byes, d.legByes].filter(v => v > 0).length;
  if (runSources > 1) {
    fail('INVALID_EXTRAS', 'Record bat runs, byes or leg byes, not a combination.');
  }
  if (d.legByes > 0 && !rules.legByesAllowed) {
    fail('LEG_BYES_DISABLED', 'Leg byes are not allowed under this match’s rules.');
  }
  if (d.boundary !== null) {
    if (d.boundary === 6 && d.batRuns !== 6) {
      fail('INVALID_BOUNDARY', 'A six must be 6 runs off the bat.');
    }
    if (
      d.boundary === 4 &&
      d.batRuns !== 4 &&
      d.byes !== 4 &&
      d.legByes !== 4 &&
      d.wideRuns !== 4
    ) {
      fail('INVALID_BOUNDARY', 'A boundary four must be worth exactly 4 runs.');
    }
  }
  if (d.shot) {
    if (!(d.shot.angle >= 0 && d.shot.angle < 360) || !(d.shot.distance >= 0 && d.shot.distance <= 1)) {
      fail('INVALID_SHOT', 'Shot direction is out of range.');
    }
  }
  const w = d.wicket;
  if (!w) {
    return;
  }
  if (!atCrease(inn, w.batterOutId)) {
    fail('INVALID_WICKET', 'The dismissed batter is not at the crease.');
  }
  if (w.type === 'lbw' && !rules.lbwAllowed) {
    fail('LBW_DISABLED', 'LBW is not allowed under this match’s rules.');
  }
  if (d.kind === 'wide' && !ALLOWED_ON_WIDE.has(w.type)) {
    fail('INVALID_WICKET', 'A batter cannot be out that way off a wide.');
  }
  if (d.kind === 'noBall' && !ALLOWED_ON_NO_BALL.has(w.type)) {
    fail('INVALID_WICKET', 'Off a no-ball, a batter can only be run out, obstruct the field or hit the ball twice.');
  }
  if (inn.freeHitNext && !ALLOWED_ON_FREE_HIT.has(w.type)) {
    fail('FREE_HIT', 'It is a free hit: only run out, obstructing the field or hit the ball twice are possible.');
  }
  const strikerOnly = ['bowled', 'caught', 'lbw', 'stumped', 'hitWicket', 'hitBallTwice'];
  if (strikerOnly.includes(w.type) && w.batterOutId !== inn.strikerId) {
    fail('INVALID_WICKET', 'Only the striker can be out that way.');
  }
  const noRunTypes = ['bowled', 'caught', 'lbw', 'stumped', 'hitWicket'];
  if (noRunTypes.includes(w.type) && (d.batRuns + d.byes + d.legByes + d.wideRuns > 0 || d.boundary)) {
    fail('INVALID_WICKET', 'No runs can be scored on that dismissal.');
  }
  if (w.type === 'runOut' || w.type === 'obstructingField') {
    if (d.boundary !== null) {
      fail('INVALID_WICKET', 'A batter cannot be run out on a boundary.');
    }
    if (w.end && w.end !== 'striker' && w.end !== 'nonStriker') {
      fail('INVALID_WICKET', 'Choose an end.');
    }
    if (inn.nonStrikerId === null && w.end === 'nonStriker') {
      fail('INVALID_WICKET', 'There is no batter at the non-striker’s end.');
    }
  }
  if (w.fielderId) {
    const bowling = squadOf(state, inn.bowlingTeamId);
    if (!bowling.playerIds.includes(w.fielderId)) {
      fail('INVALID_FIELDER', 'The fielder is not in the fielding side.');
    }
  }
  if (w.type === 'stumped' && d.kind === 'noBall') {
    fail('INVALID_WICKET', 'A batter cannot be stumped off a no-ball.');
  }
}

function handleDelivery(state: InternalState, d: DeliveryPayload, eventIndex: number): void {
  validateDelivery(state, d);
  const { rules } = state.setup;
  const bpo = rules.ballsPerOver;
  const inn = activeInnings(state);
  const strikerId = inn.strikerId!;
  const nonStrikerId = inn.nonStrikerId;
  const bowlerId = inn.currentBowlerId!;
  const freeHit = inn.freeHitNext;
  const isLegal = d.kind === 'legal';

  const wideTotal = d.kind === 'wide' ? rules.wideRuns + d.wideRuns : 0;
  const nbPenalty = d.kind === 'noBall' ? rules.noBallRuns : 0;
  const totalRuns = d.batRuns + d.byes + d.legByes + wideTotal + nbPenalty;
  const bowlerRuns = d.batRuns + wideTotal + nbPenalty;

  // extras
  inn.extras.wides += wideTotal;
  inn.extras.noBalls += nbPenalty;
  inn.extras.byes += d.byes;
  inn.extras.legByes += d.legByes;

  // batter
  const striker = ensureBatter(inn, strikerId);
  if (d.kind !== 'wide') {
    striker.balls += 1;
    striker.runs += d.batRuns;
    if (d.batRuns === 0) {
      striker.dots += 1;
    }
    if (d.boundary === 4 && d.batRuns === 4) {
      striker.fours += 1;
    }
    if (d.boundary === 6 && d.batRuns === 6) {
      striker.sixes += 1;
    }
    if (d.shot) {
      striker.shots.push({ ...d.shot, runs: d.batRuns, boundary: d.batRuns > 0 ? d.boundary : null });
    }
  }

  // bowler
  const bowler = ensureBowler(inn, bowlerId);
  bowler.runs += bowlerRuns;
  if (isLegal) {
    bowler.legalBalls += 1;
    if (bowlerRuns === 0) {
      bowler.dots += 1;
    }
  }
  if (d.kind === 'wide') {
    bowler.wides += 1;
  }
  if (d.kind === 'noBall') {
    bowler.noBalls += 1;
  }
  if (d.boundary === 4 && d.batRuns === 4) {
    bowler.fours += 1;
  }
  if (d.boundary === 6) {
    bowler.sixes += 1;
  }

  // team
  const overIndex = Math.floor(inn.legalBalls / bpo);
  inn.runs += totalRuns;
  if (isLegal) {
    inn.legalBalls += 1;
  }

  // partnership
  const p = inn.partnerships[inn.partnerships.length - 1];
  if (p) {
    p.runs += totalRuns;
    if (d.kind !== 'wide') {
      p.balls += 1;
    }
    if (p.batter1Id === strikerId) {
      p.batter1Runs += d.kind === 'wide' ? 0 : d.batRuns;
      p.batter1Balls += d.kind === 'wide' ? 0 : 1;
    } else if (p.batter2Id === strikerId) {
      p.batter2Runs += d.kind === 'wide' ? 0 : d.batRuns;
      p.batter2Balls += d.kind === 'wide' ? 0 : 1;
    }
  }

  // free hit
  if (!rules.freeHit) {
    inn.freeHitNext = false;
  } else if (d.kind === 'noBall') {
    inn.freeHitNext = true;
  } else if (d.kind === 'wide') {
    inn.freeHitNext = freeHit;
  } else {
    inn.freeHitNext = false;
  }

  // strike: positions after the runs that were run
  const runsRun = d.boundary !== null ? 0 : d.batRuns + d.byes + d.legByes + (d.kind === 'wide' ? d.wideRuns : 0);
  let s: string | null = strikerId;
  let ns: string | null = nonStrikerId;
  if (runsRun % 2 === 1 && ns !== null) {
    [s, ns] = [ns, s];
  }

  // wicket
  let wicketRecord: BallRecord['wicket'] = null;
  if (d.wicket) {
    const w = d.wicket;
    const credited = BOWLER_CREDITED.has(w.type);
    inn.wickets += 1;
    if (credited) {
      bowler.wickets += 1;
    }
    const outBatter = ensureBatter(inn, w.batterOutId);
    outBatter.dismissal = {
      type: w.type,
      bowlerId: credited ? bowlerId : null,
      fielderId: w.fielderId ?? null,
      teamScore: inn.runs,
      wicketNumber: inn.wickets,
      overBall: formatOvers(inn.legalBalls, bpo),
    };
    inn.fallOfWickets.push({
      wicketNumber: inn.wickets,
      teamScore: inn.runs,
      overBall: formatOvers(inn.legalBalls, bpo),
      batterId: w.batterOutId,
    });
    endPartnership(inn);
    wicketRecord = { ...w, bowlerCredited: credited };

    const survivor = w.batterOutId === strikerId ? nonStrikerId : strikerId;
    if (w.type === 'caught') {
      // Law 18.11: the incoming batter takes the striker's end.
      s = null;
      ns = survivor;
    } else if (w.type === 'runOut' || w.type === 'obstructingField') {
      const end = w.end ?? (s === w.batterOutId ? 'striker' : 'nonStriker');
      if (end === 'striker') {
        s = null;
        ns = survivor;
      } else {
        ns = null;
        s = survivor;
      }
    } else {
      // bowled, lbw, stumped, hit wicket, hit ball twice: the striker is out where they stand
      if (s === w.batterOutId) {
        s = null;
      } else {
        ns = null;
      }
    }
  }
  inn.strikerId = s;
  inn.nonStrikerId = ns;

  // over record
  let over: OverRecord | undefined = inn.overs[overIndex];
  if (!over) {
    over = { number: overIndex, bowlerIds: [], balls: [], runs: 0, wickets: 0, legalBalls: 0, isMaiden: false };
    inn.overs[overIndex] = over;
  }
  if (!over.bowlerIds.includes(bowlerId)) {
    over.bowlerIds.push(bowlerId);
  }
  over.runs += totalRuns;
  if (d.wicket) {
    over.wickets += 1;
  }
  if (isLegal) {
    over.legalBalls += 1;
  }
  const ball: BallRecord = {
    eventIndex,
    over: overIndex,
    ballInOver: over.legalBalls,
    bowlerId,
    strikerId,
    nonStrikerId,
    kind: d.kind,
    batRuns: d.batRuns,
    byes: d.byes,
    legByes: d.legByes,
    wideRuns: d.wideRuns,
    boundary: d.boundary,
    totalRuns,
    bowlerRuns,
    wicket: wicketRecord,
    freeHit,
    shot: d.shot ?? null,
    teamScoreAfter: inn.runs,
    wicketsAfter: inn.wickets,
  };
  over.balls.push(ball);
  inn.balls.push(ball);

  const overComplete = isLegal && over.legalBalls === bpo;
  if (overComplete) {
    const conceded = over.balls.reduce((sum, b) => sum + b.bowlerRuns, 0);
    if (over.bowlerIds.length === 1 && conceded === 0) {
      over.isMaiden = true;
      bowler.maidens += 1;
    }
  }

  // A new partnership starts automatically when last man stands begins
  if (d.wicket && canBatSolo(state, inn) && availableBatters(state, inn).length === 0 && inn.wickets < inn.maxWickets) {
    normaliseSolo(state, inn);
    startPartnership(inn, inn.strikerId!, null);
  }

  if (checkInningsEnd(state, inn)) {
    return;
  }
  if (overComplete) {
    if (!isSoloBatting(state, inn)) {
      [inn.strikerId, inn.nonStrikerId] = [inn.nonStrikerId, inn.strikerId];
    }
    inn.lastOverBowlerId = bowlerId;
    inn.currentBowlerId = null;
  }
  normaliseSolo(state, inn);
}

function handleSetBowler(state: InternalState, e: Extract<MatchEvent, { type: 'SET_BOWLER' }>): void {
  const inn = activeInnings(state);
  if (e.midOver) {
    if (inn.currentBowlerId === null) {
      fail('NOT_MID_OVER', 'There is no over in progress.');
    }
    const ballsInOver = inn.legalBalls % state.setup.rules.ballsPerOver;
    const overStarted = inn.overs[Math.floor(inn.legalBalls / state.setup.rules.ballsPerOver)];
    if (ballsInOver === 0 && !overStarted) {
      fail('NOT_MID_OVER', 'The over has not started. Choose the bowler for the new over instead.');
    }
  } else if (state.awaiting.kind !== 'newBowler') {
    fail('NOT_AWAITING_BOWLER', 'A new bowler is not needed now.');
  }
  const eligibility = bowlerEligibility(state, inn, !!e.midOver).find(x => x.playerId === e.bowlerId);
  if (!eligibility) {
    fail('INVALID_BOWLER', 'The bowler is not in the fielding side.');
  }
  if (!eligibility.eligible) {
    fail('INELIGIBLE_BOWLER', eligibility.reason ?? 'That bowler cannot bowl now.');
  }
  // a bowler finishing someone else's over still cannot be the previous over's bowler; checked above
  inn.currentBowlerId = e.bowlerId;
  ensureBowler(inn, e.bowlerId);
}

function handleNewBatter(state: InternalState, e: Extract<MatchEvent, { type: 'NEW_BATTER' }>): void {
  const inn = activeInnings(state);
  if (state.awaiting.kind !== 'newBatter') {
    fail('NOT_AWAITING_BATTER', 'No batter is needed now.');
  }
  if (!availableBatters(state, inn).includes(e.batterId)) {
    fail('INVALID_BATTER', 'That player cannot bat now.');
  }
  const end = e.atEnd ?? state.awaiting.end;
  if ((end === 'striker' && inn.strikerId !== null) || (end === 'nonStriker' && inn.nonStrikerId !== null)) {
    fail('INVALID_END', 'That end is already occupied.');
  }
  const b = ensureBatter(inn, e.batterId);
  b.retiredHurt = false;
  if (end === 'striker') {
    inn.strikerId = e.batterId;
  } else {
    inn.nonStrikerId = e.batterId;
  }
  const partner = end === 'striker' ? inn.nonStrikerId : inn.strikerId;
  const last = inn.partnerships[inn.partnerships.length - 1];
  if (last && last.unbroken && last.batter2Id === null && last.batter1Id === partner) {
    // a solo partnership becomes a pair (only when a retired batter returns)
    last.batter2Id = e.batterId;
  } else if (partner) {
    startPartnership(inn, partner, e.batterId);
  }
}

function handleNonDeliveryDismissal(
  state: InternalState,
  e: Extract<MatchEvent, { type: 'NON_DELIVERY_DISMISSAL' }>,
): void {
  const inn = activeInnings(state);
  const bpo = state.setup.rules.ballsPerOver;
  if (e.how === 'timedOut') {
    if (state.awaiting.kind !== 'newBatter') {
      fail('INVALID_DISMISSAL', 'A batter can only be timed out while the next batter is due.');
    }
    if (!availableBatters(state, inn).includes(e.batterId) || batterOf(inn, e.batterId)) {
      fail('INVALID_DISMISSAL', 'That player is not the incoming batter.');
    }
    const b = ensureBatter(inn, e.batterId);
    inn.wickets += 1;
    b.dismissal = {
      type: 'timedOut',
      bowlerId: null,
      fielderId: null,
      teamScore: inn.runs,
      wicketNumber: inn.wickets,
      overBall: formatOvers(inn.legalBalls, bpo),
    };
    inn.fallOfWickets.push({
      wicketNumber: inn.wickets,
      teamScore: inn.runs,
      overBall: formatOvers(inn.legalBalls, bpo),
      batterId: e.batterId,
    });
    checkInningsEnd(state, inn);
    return;
  }
  if (!atCrease(inn, e.batterId)) {
    fail('INVALID_DISMISSAL', 'That batter is not at the crease.');
  }
  if (e.how === 'runOutNonStriker' && inn.nonStrikerId !== e.batterId) {
    fail('INVALID_DISMISSAL', 'Only the non-striker can be run out backing up.');
  }
  const b = ensureBatter(inn, e.batterId);
  endPartnership(inn);
  if (inn.strikerId === e.batterId) {
    inn.strikerId = null;
  } else {
    inn.nonStrikerId = null;
  }
  if (e.how === 'retiredHurt') {
    b.retiredHurt = true;
  } else {
    inn.wickets += 1;
    b.dismissal = {
      type: e.how === 'runOutNonStriker' ? 'runOut' : 'retiredOut',
      bowlerId: null,
      fielderId: null,
      teamScore: inn.runs,
      wicketNumber: inn.wickets,
      overBall: formatOvers(inn.legalBalls, bpo),
    };
    inn.fallOfWickets.push({
      wicketNumber: inn.wickets,
      teamScore: inn.runs,
      overBall: formatOvers(inn.legalBalls, bpo),
      batterId: e.batterId,
    });
  }
  if (checkInningsEnd(state, inn)) {
    return;
  }
  if (canBatSolo(state, inn) && availableBatters(state, inn).length === 0) {
    normaliseSolo(state, inn);
    startPartnership(inn, inn.strikerId!, null);
  }
}

function handlePenalty(state: InternalState, e: Extract<MatchEvent, { type: 'PENALTY' }>): void {
  if (state.completed) {
    fail('MATCH_COMPLETE', 'The match is over.');
  }
  if (!Number.isInteger(e.runs) || e.runs < 1 || e.runs > 10) {
    fail('INVALID_PENALTY', 'Penalty runs must be between 1 and 10.');
  }
  squadOf(state, e.toTeamId);
  const inn = currentInnings(state);
  if (inn && !inn.completed && inn.battingTeamId === e.toTeamId) {
    inn.runs += e.runs;
    inn.extras.penalty += e.runs;
    checkInningsEnd(state, inn);
    return;
  }
  // Awarded to the fielding side: added to its next innings, or to its last one if it bats no more.
  const { rules } = state.setup;
  const battedTimes = mainInnings(state).filter(i => i.battingTeamId === e.toTeamId).length;
  const finished = rules.inningsPerSide === battedTimes;
  if (finished) {
    const last = [...mainInnings(state)].reverse().find(i => i.battingTeamId === e.toTeamId)!;
    last.runs += e.runs;
    last.extras.penalty += e.runs;
    if (inn && !inn.completed && inn.target !== null && !inn.isSuperOver) {
      inn.target += e.runs;
    }
    return;
  }
  state.pendingPenalty[e.toTeamId] = (state.pendingPenalty[e.toTeamId] ?? 0) + e.runs;
}

function handleReviseTarget(state: InternalState, e: Extract<MatchEvent, { type: 'REVISE_TARGET' }>): void {
  const { rules } = state.setup;
  if (rules.inningsPerSide !== 1) {
    fail('INVALID_REVISION', 'Targets can only be revised in limited-overs matches.');
  }
  if (!Number.isInteger(e.target) || e.target < 1) {
    fail('INVALID_REVISION', 'The target must be at least 1.');
  }
  if (e.overs !== null && (!Number.isInteger(e.overs) || e.overs < 1)) {
    fail('INVALID_REVISION', 'Overs must be a whole number of at least 1.');
  }
  const main = mainInnings(state);
  const inn = currentInnings(state);
  if (main.length === 1 && inn?.completed && state.awaiting.kind === 'startInnings') {
    state.revisedTarget = { target: e.target, overs: e.overs };
    return;
  }
  if (main.length === 2 && inn && !inn.completed && !inn.isSuperOver) {
    if (e.overs !== null && e.overs * rules.ballsPerOver < inn.legalBalls) {
      fail('INVALID_REVISION', 'The revised overs are fewer than the overs already bowled.');
    }
    state.revisedTarget = { target: e.target, overs: e.overs };
    inn.target = e.target;
    if (e.overs !== null) {
      inn.maxOvers = e.overs;
    }
    checkInningsEnd(state, inn);
    return;
  }
  fail('INVALID_REVISION', 'A target can only be revised for the second innings.');
}

function handleStartSuperOver(state: InternalState): void {
  if (state.awaiting.kind !== 'superOverDecision') {
    fail('NOT_TIED', 'A super over is only possible after a tie.');
  }
  const last = state.innings[state.innings.length - 1];
  state.phase = {
    kind: 'startInnings',
    battingTeamOptions: [last.battingTeamId],
    reason: 'superOver',
  };
}

function handleEndMatch(state: InternalState, e: Extract<MatchEvent, { type: 'END_MATCH' }>): void {
  if (state.completed) {
    fail('MATCH_COMPLETE', 'The match is already over.');
  }
  const inn = currentInnings(state);
  if (inn && !inn.completed) {
    inn.completed = true;
    inn.endReason = 'matchEnded';
  }
  if (state.awaiting.kind === 'superOverDecision' && e.result === 'draw') {
    finishMatch(state, tieResult(state));
    return;
  }
  if (e.result === 'conceded') {
    if (!e.winnerTeamId) {
      fail('INVALID_RESULT', 'Choose the team that wins.');
    }
    squadOf(state, e.winnerTeamId);
    finishMatch(
      state,
      makeResult(state, {
        type: 'win',
        winnerTeamId: e.winnerTeamId,
        marginRuns: null,
        marginWickets: null,
        ballsRemaining: null,
        byInnings: false,
        decidedBySuperOver: false,
        marginText: '(opponent conceded)',
      }),
    );
    return;
  }
  finishMatch(
    state,
    makeResult(state, {
      type: e.result === 'draw' ? 'draw' : 'noResult',
      winnerTeamId: null,
      marginRuns: null,
      marginWickets: null,
      ballsRemaining: null,
      byInnings: false,
      decidedBySuperOver: false,
    }),
  );
}

/* ------------------------------------------------------------------ */
/* public API                                                          */
/* ------------------------------------------------------------------ */

/** Applies one event to a mutable state (used by replay). Throws EngineError if the event is invalid. */
function applyMut(state: InternalState, event: MatchEvent, eventIndex: number): void {
  if (state.completed && event.type !== 'PENALTY') {
    fail('MATCH_COMPLETE', 'The match is over.');
  }
  switch (event.type) {
    case 'START_INNINGS':
      handleStartInnings(state, event);
      break;
    case 'DELIVERY':
      handleDelivery(state, event, eventIndex);
      break;
    case 'SET_BOWLER':
      handleSetBowler(state, event);
      break;
    case 'NEW_BATTER':
      handleNewBatter(state, event);
      break;
    case 'NON_DELIVERY_DISMISSAL':
      handleNonDeliveryDismissal(state, event);
      break;
    case 'SWAP_STRIKE': {
      const inn = activeInnings(state);
      if (inn.strikerId === null || inn.nonStrikerId === null) {
        fail('INVALID_SWAP', 'Both batters must be at the crease to swap strike.');
      }
      [inn.strikerId, inn.nonStrikerId] = [inn.nonStrikerId, inn.strikerId];
      break;
    }
    case 'PENALTY':
      handlePenalty(state, event);
      break;
    case 'REVISE_TARGET':
      handleReviseTarget(state, event);
      break;
    case 'DECLARE': {
      const inn = activeInnings(state);
      if (state.setup.rules.inningsPerSide !== 2 || inn.isSuperOver) {
        fail('INVALID_DECLARATION', 'Declarations are only allowed in two-innings matches.');
      }
      inn.declared = true;
      completeInnings(state, inn, 'declared');
      break;
    }
    case 'END_INNINGS': {
      const inn = activeInnings(state);
      completeInnings(state, inn, 'manual');
      break;
    }
    case 'START_SUPER_OVER':
      handleStartSuperOver(state);
      break;
    case 'END_MATCH':
      handleEndMatch(state, event);
      break;
    default: {
      const unknown: never = event;
      fail('UNKNOWN_EVENT', `Unknown event ${(unknown as { type: string }).type}`);
    }
  }
  state.eventCount += 1;
  refreshAwaiting(state);
}

/** Rebuilds the full match state from its events. Throws EngineError at the first invalid event. */
export function replay(setup: MatchSetup, events: readonly MatchEvent[]): MatchState {
  const state = createInitialState(setup);
  events.forEach((event, i) => {
    try {
      applyMut(state, event, i);
    } catch (err) {
      if (err instanceof EngineError) {
        throw new EngineError(err.code, `Event ${i + 1} (${event.type}): ${err.message}`);
      }
      throw err;
    }
  });
  return state;
}

/** Applies a single event on top of a log. Returns the new state, or throws. */
export function applyEvent(setup: MatchSetup, events: readonly MatchEvent[], event: MatchEvent): MatchState {
  const state = replay(setup, events);
  applyMut(state, event, events.length);
  return state;
}

/** Returns null if the event is valid, or a readable error message. */
export function checkEvent(setup: MatchSetup, events: readonly MatchEvent[], event: MatchEvent): string | null {
  try {
    applyEvent(setup, events, event);
    return null;
  } catch (err) {
    return err instanceof Error ? err.message : String(err);
  }
}

export function describeAwaiting(a: Awaiting): string {
  switch (a.kind) {
    case 'startInnings':
      return 'Start the innings first: choose the openers and the bowler.';
    case 'newBatter':
      return 'Choose the next batter first.';
    case 'newBowler':
      return 'Choose the bowler for the next over first.';
    case 'superOverDecision':
      return 'The match is tied. Start a super over or end the match as a tie.';
    case 'none':
      return 'The match is over.';
    default:
      return 'Ready.';
  }
}
