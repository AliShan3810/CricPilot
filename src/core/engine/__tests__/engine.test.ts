import { checkEvent, replay, formatOvers, availableBatters, bowlerEligibility } from '../engine';
import { EngineError } from '../types';
import { bowled, del, dot, four, noBall, repeat, runs, Scorer, setupFor, six, wide } from './helpers';

describe('starting an innings', () => {
  it('requires valid openers and bowler', () => {
    const setup = setupFor();
    expect(checkEvent(setup, [], { type: 'START_INNINGS', battingTeamId: 'A', strikerId: 'b1', nonStrikerId: 'a2', bowlerId: 'b1' })).toMatch(/striker/i);
    expect(checkEvent(setup, [], { type: 'START_INNINGS', battingTeamId: 'A', strikerId: 'a1', nonStrikerId: 'a1', bowlerId: 'b1' })).toMatch(/different/i);
    expect(checkEvent(setup, [], { type: 'START_INNINGS', battingTeamId: 'A', strikerId: 'a1', nonStrikerId: 'a2', bowlerId: 'a3' })).toMatch(/bowler/i);
    expect(checkEvent(setup, [], { type: 'START_INNINGS', battingTeamId: 'A', strikerId: 'a1', nonStrikerId: 'a2', bowlerId: 'b1' })).toBeNull();
  });

  it('respects the toss decision', () => {
    const setup = { ...setupFor(), tossWinnerId: 'B', tossDecision: 'bowl' as const };
    const s = replay(setup, []);
    expect(s.awaiting).toEqual({ kind: 'startInnings', battingTeamOptions: ['A'], reason: 'first' });
    expect(checkEvent(setup, [], { type: 'START_INNINGS', battingTeamId: 'B', strikerId: 'b1', nonStrikerId: 'b2', bowlerId: 'a1' })).toMatch(/cannot bat/);
  });

  it('rejects deliveries before the innings starts', () => {
    expect(checkEvent(setupFor(), [], dot())).toMatch(/innings/i);
  });
});

describe('runs and strike rotation', () => {
  it('credits runs and rotates strike on odd runs', () => {
    const sc = new Scorer(setupFor()).start('A', 'a1', 'a2', 'b1');
    sc.push(runs(1));
    expect(sc.inn.strikerId).toBe('a2');
    sc.push(runs(2));
    expect(sc.inn.strikerId).toBe('a2');
    sc.push(runs(3));
    expect(sc.inn.strikerId).toBe('a1');
    const i = sc.inn;
    expect(i.runs).toBe(6);
    expect(i.batters.find(b => b.playerId === 'a1')!.runs).toBe(1);
    expect(i.batters.find(b => b.playerId === 'a2')!.runs).toBe(5);
  });

  it('counts boundaries without changing strike', () => {
    const sc = new Scorer(setupFor()).start('A', 'a1', 'a2', 'b1');
    sc.push(four(), six());
    const a1 = sc.inn.batters[0];
    expect(a1.runs).toBe(10);
    expect(a1.fours).toBe(1);
    expect(a1.sixes).toBe(1);
    expect(sc.inn.strikerId).toBe('a1');
    expect(sc.inn.bowlers[0].sixes).toBe(1);
  });

  it('treats four runs that were run as not a boundary', () => {
    const sc = new Scorer(setupFor()).start('A', 'a1', 'a2', 'b1');
    sc.push(runs(4));
    expect(sc.inn.batters[0].fours).toBe(0);
    expect(sc.inn.strikerId).toBe('a1');
    sc.push(runs(5));
    expect(sc.inn.strikerId).toBe('a2');
  });

  it('swaps strike at the end of the over and waits for a new bowler', () => {
    const sc = new Scorer(setupFor()).start('A', 'a1', 'a2', 'b1');
    sc.push(...repeat(5, dot), runs(1));
    expect(sc.state.awaiting.kind).toBe('newBowler');
    // a1 took a single on the last ball (→ a2 on strike), then the over ended (→ a1)
    expect(sc.inn.strikerId).toBe('a1');
    expect(sc.inn.lastOverBowlerId).toBe('b1');
    expect(formatOvers(sc.inn.legalBalls, 6)).toBe('1.0');
  });

  it('does not allow the same bowler two overs in a row', () => {
    const sc = new Scorer(setupFor()).start('A', 'a1', 'a2', 'b1');
    sc.push(...repeat(6, dot));
    expect(checkEvent(sc.setup, sc.events, { type: 'SET_BOWLER', bowlerId: 'b1' })).toMatch(/previous over/);
    sc.bowler('b2');
    expect(sc.state.awaiting.kind).toBe('delivery');
  });

  it('enforces the bowler quota', () => {
    const sc = new Scorer(setupFor('T10')).start('A', 'a1', 'a2', 'b1'); // 2 overs max
    sc.over(repeat(6, dot), 'b2').over(repeat(6, dot), 'b1').over(repeat(6, dot), 'b2');
    sc.push(...repeat(6, dot));
    expect(checkEvent(sc.setup, sc.events, { type: 'SET_BOWLER', bowlerId: 'b1' })).toMatch(/Quota/);
    const elig = bowlerEligibility(sc.state, sc.inn);
    expect(elig.find(e => e.playerId === 'b1')!.eligible).toBe(false);
    expect(elig.find(e => e.playerId === 'b2')!.eligible).toBe(false);
    expect(elig.find(e => e.playerId === 'b3')!.eligible).toBe(true);
  });

  it('records a maiden over', () => {
    const sc = new Scorer(setupFor()).start('A', 'a1', 'a2', 'b1');
    sc.push(...repeat(5, dot), del({ legByes: 1 }));
    expect(sc.inn.bowlers[0].maidens).toBe(1); // leg byes do not count against the bowler
    expect(sc.inn.overs[0].isMaiden).toBe(true);
  });

  it('does not record a maiden if a wide was bowled', () => {
    const sc = new Scorer(setupFor()).start('A', 'a1', 'a2', 'b1');
    sc.push(wide(), ...repeat(6, dot));
    expect(sc.inn.bowlers[0].maidens).toBe(0);
  });
});

describe('extras', () => {
  it('scores a wide without counting it as a legal ball', () => {
    const sc = new Scorer(setupFor()).start('A', 'a1', 'a2', 'b1');
    sc.push(wide());
    const i = sc.inn;
    expect(i.runs).toBe(1);
    expect(i.legalBalls).toBe(0);
    expect(i.extras.wides).toBe(1);
    expect(i.batters[0].balls).toBe(0);
    expect(i.bowlers[0].runs).toBe(1);
    expect(i.bowlers[0].wides).toBe(1);
  });

  it('rotates strike on runs taken off a wide', () => {
    const sc = new Scorer(setupFor()).start('A', 'a1', 'a2', 'b1');
    sc.push(wide(1));
    expect(sc.inn.runs).toBe(2);
    expect(sc.inn.extras.wides).toBe(2);
    expect(sc.inn.strikerId).toBe('a2');
  });

  it('scores a wide that runs to the boundary as five wides', () => {
    const sc = new Scorer(setupFor()).start('A', 'a1', 'a2', 'b1');
    sc.push(del({ kind: 'wide', wideRuns: 4, boundary: 4 }));
    expect(sc.inn.runs).toBe(5);
    expect(sc.inn.strikerId).toBe('a1');
  });

  it('scores a no-ball with bat runs, counted as a ball faced', () => {
    const sc = new Scorer(setupFor()).start('A', 'a1', 'a2', 'b1');
    sc.push(del({ kind: 'noBall', batRuns: 4, boundary: 4 }));
    const i = sc.inn;
    expect(i.runs).toBe(5);
    expect(i.extras.noBalls).toBe(1);
    expect(i.legalBalls).toBe(0);
    expect(i.batters[0].runs).toBe(4);
    expect(i.batters[0].balls).toBe(1);
    expect(i.batters[0].fours).toBe(1);
    expect(i.bowlers[0].runs).toBe(5);
    expect(i.bowlers[0].noBalls).toBe(1);
  });

  it('charges no-ball byes to extras, not to the bowler', () => {
    const sc = new Scorer(setupFor()).start('A', 'a1', 'a2', 'b1');
    sc.push(del({ kind: 'noBall', byes: 2 }));
    expect(sc.inn.runs).toBe(3);
    expect(sc.inn.extras).toMatchObject({ noBalls: 1, byes: 2 });
    expect(sc.inn.bowlers[0].runs).toBe(1);
  });

  it('scores byes and leg byes as legal balls', () => {
    const sc = new Scorer(setupFor()).start('A', 'a1', 'a2', 'b1');
    sc.push(del({ byes: 1 }), del({ legByes: 4, boundary: 4 }));
    const i = sc.inn;
    expect(i.runs).toBe(5);
    expect(i.legalBalls).toBe(2);
    expect(i.extras).toMatchObject({ byes: 1, legByes: 4 });
    expect(i.bowlers[0].runs).toBe(0);
    expect(i.bowlers[0].dots).toBe(2);
    expect(i.strikerId).toBe('a2');
    expect(i.batters[0].balls).toBe(1);
    expect(i.batters[1].balls).toBe(1);
  });

  it('uses configurable wide and no-ball penalties', () => {
    const sc = new Scorer(setupFor('CUSTOM', { wideRuns: 2, noBallRuns: 2 })).start('A', 'a1', 'a2', 'b1');
    sc.push(wide(), noBall(1));
    expect(sc.inn.runs).toBe(5);
  });

  it('validates delivery payloads', () => {
    const sc = new Scorer(setupFor()).start('A', 'a1', 'a2', 'b1');
    const bad = [
      del({ batRuns: 2, byes: 1 }),
      del({ kind: 'wide', batRuns: 1 }),
      del({ wideRuns: 1 }),
      del({ batRuns: 5, boundary: 6 }),
      del({ batRuns: 3, boundary: 4 }),
      del({ batRuns: -1 }),
      del({ batRuns: 8 }),
      del({ batRuns: 1.5 }),
    ];
    for (const b of bad) {
      expect(checkEvent(sc.setup, sc.events, b)).not.toBeNull();
    }
  });

  it('disallows leg byes and LBW in tape-ball rules', () => {
    const setup = setupFor('T20');
    setup.rules = { ...setup.rules, ballType: 'tape', lbwAllowed: false, legByesAllowed: false };
    const sc = new Scorer(setup).start('A', 'a1', 'a2', 'b1');
    expect(checkEvent(setup, sc.events, del({ legByes: 1 }))).toMatch(/Leg byes/);
    expect(checkEvent(setup, sc.events, del({ wicket: { type: 'lbw', batterOutId: 'a1' } }))).toMatch(/LBW/);
  });
});

describe('free hit', () => {
  it('follows a no-ball and allows only run outs', () => {
    const sc = new Scorer(setupFor()).start('A', 'a1', 'a2', 'b1');
    sc.push(noBall());
    expect(sc.inn.freeHitNext).toBe(true);
    expect(checkEvent(sc.setup, sc.events, bowled('a1'))).toMatch(/free hit/i);
    expect(
      checkEvent(sc.setup, sc.events, del({ batRuns: 1, wicket: { type: 'runOut', batterOutId: 'a2', end: 'nonStriker' } })),
    ).toBeNull();
  });

  it('carries over a wide and ends after a legal ball', () => {
    const sc = new Scorer(setupFor()).start('A', 'a1', 'a2', 'b1');
    sc.push(noBall(), wide());
    expect(sc.inn.freeHitNext).toBe(true);
    sc.push(dot());
    expect(sc.inn.freeHitNext).toBe(false);
    expect(sc.inn.balls[2].freeHit).toBe(true);
  });

  it('is off in Test rules', () => {
    const sc = new Scorer(setupFor('TEST')).start('A', 'a1', 'a2', 'b1');
    sc.push(noBall());
    expect(sc.inn.freeHitNext).toBe(false);
  });
});

describe('dismissals', () => {
  it('records a bowled wicket and waits for the next batter at the striker’s end', () => {
    const sc = new Scorer(setupFor()).start('A', 'a1', 'a2', 'b1');
    sc.push(runs(2), bowled('a1'));
    const i = sc.inn;
    expect(i.wickets).toBe(1);
    expect(i.bowlers[0].wickets).toBe(1);
    expect(i.batters[0].dismissal).toMatchObject({ type: 'bowled', bowlerId: 'b1', teamScore: 2, wicketNumber: 1, overBall: '0.2' });
    expect(i.fallOfWickets).toEqual([{ wicketNumber: 1, teamScore: 2, overBall: '0.2', batterId: 'a1' }]);
    expect(sc.state.awaiting).toEqual({ kind: 'newBatter', end: 'striker' });
    expect(checkEvent(sc.setup, sc.events, dot())).toMatch(/next batter/);
    sc.batter('a3');
    expect(sc.inn.strikerId).toBe('a3');
    expect(sc.inn.partnerships).toHaveLength(2);
  });

  it('puts the new batter on strike after a catch, even if the batters crossed', () => {
    const sc = new Scorer(setupFor()).start('A', 'a1', 'a2', 'b1');
    sc.push(del({ wicket: { type: 'caught', batterOutId: 'a1', fielderId: 'b5' } }));
    sc.batter('a3');
    expect(sc.inn.strikerId).toBe('a3');
    expect(sc.inn.nonStrikerId).toBe('a2');
    expect(sc.inn.batters[0].dismissal?.fielderId).toBe('b5');
  });

  it('handles a run out at either end with completed runs', () => {
    const sc = new Scorer(setupFor()).start('A', 'a1', 'a2', 'b1');
    // a1 hits, one run completed, then a1 (now at the non-striker end after crossing) is run out going for a second
    sc.push(del({ batRuns: 1, wicket: { type: 'runOut', batterOutId: 'a1', end: 'striker', fielderId: 'b2' } }));
    const i = sc.inn;
    expect(i.runs).toBe(1);
    expect(i.batters[0].runs).toBe(1);
    expect(i.bowlers[0].wickets).toBe(0); // run outs are not credited to the bowler
    expect(i.nonStrikerId).toBe('a2');
    expect(sc.state.awaiting).toEqual({ kind: 'newBatter', end: 'striker' });
    sc.batter('a3');
    expect(sc.inn.strikerId).toBe('a3');
  });

  it('allows the non-striker to be run out at their end', () => {
    const sc = new Scorer(setupFor()).start('A', 'a1', 'a2', 'b1');
    sc.push(del({ wicket: { type: 'runOut', batterOutId: 'a2', end: 'nonStriker' } }));
    expect(sc.state.awaiting).toEqual({ kind: 'newBatter', end: 'nonStriker' });
    sc.batter('a3');
    expect(sc.inn.strikerId).toBe('a1');
    expect(sc.inn.nonStrikerId).toBe('a3');
  });

  it('allows stumping off a wide but not bowled off a wide or no-ball', () => {
    const sc = new Scorer(setupFor()).start('A', 'a1', 'a2', 'b1');
    expect(checkEvent(sc.setup, sc.events, del({ kind: 'wide', wicket: { type: 'bowled', batterOutId: 'a1' } }))).toMatch(/wide/);
    expect(checkEvent(sc.setup, sc.events, del({ kind: 'noBall', wicket: { type: 'caught', batterOutId: 'a1' } }))).toMatch(/no-ball/);
    sc.push(del({ kind: 'wide', wicket: { type: 'stumped', batterOutId: 'a1', fielderId: 'b9' } }));
    expect(sc.inn.runs).toBe(1);
    expect(sc.inn.legalBalls).toBe(0);
    expect(sc.inn.bowlers[0].wickets).toBe(1);
  });

  it('rejects striker-only dismissals of the non-striker and runs on a catch', () => {
    const sc = new Scorer(setupFor()).start('A', 'a1', 'a2', 'b1');
    expect(checkEvent(sc.setup, sc.events, bowled('a2'))).toMatch(/striker/);
    expect(checkEvent(sc.setup, sc.events, del({ batRuns: 1, wicket: { type: 'caught', batterOutId: 'a1' } }))).toMatch(/No runs/);
    expect(checkEvent(sc.setup, sc.events, bowled('a5'))).toMatch(/not at the crease/);
  });

  it('handles retired hurt (not a wicket) and lets the batter return', () => {
    const setup = setupFor('CUSTOM', {}, 3, 11);
    const sc = new Scorer(setup).start('A', 'a1', 'a2', 'b1');
    sc.push({ type: 'NON_DELIVERY_DISMISSAL', batterId: 'a1', how: 'retiredHurt' });
    expect(sc.inn.wickets).toBe(0);
    sc.batter('a3');
    sc.push(bowled('a3'));
    expect(availableBatters(sc.state, sc.inn)).toEqual(['a1']);
    sc.batter('a1');
    expect(sc.inn.batters.find(b => b.playerId === 'a1')!.retiredHurt).toBe(false);
  });

  it('records retired out and timed out as wickets with no bowler credit', () => {
    const sc = new Scorer(setupFor()).start('A', 'a1', 'a2', 'b1');
    sc.push({ type: 'NON_DELIVERY_DISMISSAL', batterId: 'a1', how: 'retiredOut' });
    expect(sc.inn.wickets).toBe(1);
    sc.push({ type: 'NON_DELIVERY_DISMISSAL', batterId: 'a3', how: 'timedOut' });
    expect(sc.inn.wickets).toBe(2);
    expect(sc.inn.bowlers[0].wickets).toBe(0);
    sc.batter('a4');
    expect(sc.inn.strikerId).toBe('a4');
  });

  it('allows the non-striker to be run out backing up', () => {
    const sc = new Scorer(setupFor()).start('A', 'a1', 'a2', 'b1');
    expect(checkEvent(sc.setup, sc.events, { type: 'NON_DELIVERY_DISMISSAL', batterId: 'a1', how: 'runOutNonStriker' })).toMatch(/non-striker/);
    sc.push({ type: 'NON_DELIVERY_DISMISSAL', batterId: 'a2', how: 'runOutNonStriker' });
    expect(sc.inn.batters[1].dismissal?.type).toBe('runOut');
    expect(sc.inn.legalBalls).toBe(0);
  });
});

describe('innings completion', () => {
  it('ends the innings when all out', () => {
    const setup = setupFor('CUSTOM', {}, 3, 3);
    const sc = new Scorer(setup).start('A', 'a1', 'a2', 'b1');
    sc.push(bowled('a1')).batter('a3').push(bowled('a3'));
    const s = sc.state;
    expect(s.innings[0].completed).toBe(true);
    expect(s.innings[0].endReason).toBe('allOut');
    expect(s.awaiting).toEqual({ kind: 'startInnings', battingTeamOptions: ['B'], reason: 'next' });
  });

  it('ends the innings when the overs are done', () => {
    const setup = setupFor('CUSTOM', { oversPerInnings: 1 });
    const sc = new Scorer(setup).start('A', 'a1', 'a2', 'b1');
    sc.push(...repeat(5, dot), runs(1));
    expect(sc.state.innings[0].endReason).toBe('oversComplete');
    expect(sc.state.awaiting.kind).toBe('startInnings');
  });

  it('lets the last batter bat alone with last man stands', () => {
    const setup = setupFor('CUSTOM', { lastManStands: true, oversPerInnings: 5 }, 3, 3);
    const sc = new Scorer(setup).start('A', 'a1', 'a2', 'b1');
    sc.push(bowled('a1')).batter('a3').push(bowled('a3'));
    let i = sc.inn;
    expect(i.completed).toBe(false);
    expect(i.strikerId).toBe('a2');
    expect(i.nonStrikerId).toBeNull();
    expect(sc.state.awaiting.kind).toBe('delivery');
    sc.push(runs(1));
    i = sc.inn;
    expect(i.strikerId).toBe('a2'); // strike never changes when batting alone
    sc.push(bowled('a2'));
    expect(sc.inn.completed).toBe(true);
    expect(sc.inn.wickets).toBe(3);
  });
});

function playFirstInnings(sc: Scorer, total: number) {
  // 1-over-per-innings custom game helper: score `total` runs off the over with fours and singles
  sc.start('A', 'a1', 'a2', 'b1');
  const evs = [];
  let left = total;
  for (let i = 0; i < 6; i++) {
    if (left >= 6) {
      evs.push(six());
      left -= 6;
    } else if (left > 0 && i === 5) {
      evs.push(runs(left));
      left = 0;
    } else {
      evs.push(dot());
    }
  }
  sc.push(...evs);
}

describe('results', () => {
  it('chasing side wins by wickets with balls left', () => {
    const sc = new Scorer(setupFor('CUSTOM', { oversPerInnings: 1 }));
    playFirstInnings(sc, 12);
    expect(sc.state.innings[0].runs).toBe(12);
    sc.start('B', 'b1', 'b2', 'a1');
    expect(sc.inn.target).toBe(13);
    sc.push(six(), six(), runs(1));
    const s = sc.state;
    expect(s.completed).toBe(true);
    expect(s.result).toMatchObject({ type: 'win', winnerTeamId: 'B', marginWickets: 10, ballsRemaining: 3 });
    expect(s.result!.summary).toBe('Bravo won by 10 wickets (3 balls left)');
    expect(checkEvent(sc.setup, sc.events, dot())).toMatch(/over/);
  });

  it('side batting first wins by runs', () => {
    const sc = new Scorer(setupFor('CUSTOM', { oversPerInnings: 1 }));
    playFirstInnings(sc, 12);
    sc.start('B', 'b1', 'b2', 'a1');
    sc.push(...repeat(5, dot), runs(1));
    expect(sc.state.result).toMatchObject({ winnerTeamId: 'A', marginRuns: 11, summary: 'Alpha won by 11 runs' });
  });

  it('a tie leads to a super over, which decides the match', () => {
    const sc = new Scorer(setupFor('CUSTOM', { oversPerInnings: 1 }));
    playFirstInnings(sc, 12);
    sc.start('B', 'b1', 'b2', 'a1');
    sc.push(six(), six(), ...repeat(4, dot));
    expect(sc.state.awaiting.kind).toBe('superOverDecision');
    expect(sc.state.result).toBeNull();
    sc.push({ type: 'START_SUPER_OVER' });
    // the side that batted second (B) bats first in the super over
    expect(sc.state.awaiting).toEqual({ kind: 'startInnings', battingTeamOptions: ['B'], reason: 'superOver' });
    sc.start('B', 'b1', 'b2', 'a3');
    expect(sc.inn.maxWickets).toBe(2);
    sc.push(bowled('b1')).batter('b3').push(bowled('b3'));
    expect(sc.inn.endReason).toBe('allOut');
    sc.start('A', 'a1', 'a2', 'b4');
    expect(sc.inn.target).toBe(1);
    sc.push(runs(1));
    const s = sc.state;
    expect(s.result).toMatchObject({ winnerTeamId: 'A', decidedBySuperOver: true });
    expect(s.result!.summary).toBe('Alpha won in the Super Over');
  });

  it('a tie without super overs is a tie', () => {
    const sc = new Scorer(setupFor('CUSTOM', { oversPerInnings: 1, superOverOnTie: false }));
    playFirstInnings(sc, 6);
    sc.start('B', 'b1', 'b2', 'a1');
    sc.push(six(), ...repeat(5, dot));
    expect(sc.state.result?.type).toBe('tie');
  });

  it('a tied match can be ended as a tie instead of a super over', () => {
    const sc = new Scorer(setupFor('CUSTOM', { oversPerInnings: 1 }));
    playFirstInnings(sc, 6);
    sc.start('B', 'b1', 'b2', 'a1');
    sc.push(six(), ...repeat(5, dot));
    sc.push({ type: 'END_MATCH', result: 'draw' });
    expect(sc.state.result?.type).toBe('tie');
  });

  it('supports no result and conceded matches', () => {
    const sc = new Scorer(setupFor()).start('A', 'a1', 'a2', 'b1');
    expect(checkEvent(sc.setup, sc.events, { type: 'END_MATCH', result: 'conceded' })).toMatch(/team/);
    sc.push({ type: 'END_MATCH', result: 'noResult' });
    expect(sc.state.result?.summary).toBe('No result');
    expect(sc.state.innings[0].endReason).toBe('matchEnded');
  });
});

describe('Test matches', () => {
  function allOut(sc: Scorer, team: 'A' | 'B', runsEach: number[], bowlers: [string, string]) {
    // 3-player sides: 2 wickets end an innings
    const p = team === 'A' ? 'a' : 'b';
    sc.start(team, `${p}1`, `${p}2`, bowlers[0]);
    const evs = runsEach.map(r => (r === 4 ? four() : r === 6 ? six() : runs(r)));
    sc.push(...evs);
    sc.push(bowled(sc.inn.strikerId!));
    sc.batter(`${p}3`);
    sc.push(bowled(sc.inn.strikerId!));
  }

  it('wins by an innings when the follow-on side is bowled out short', () => {
    const setup = setupFor('TEST', { followOnMargin: 10 }, 3, 3);
    const sc = new Scorer(setup);
    allOut(sc, 'A', [6, 6, 6], ['b1', 'b2']); // 18
    allOut(sc, 'B', [4], ['a1', 'a2']); // 4
    expect(sc.state.awaiting).toEqual({ kind: 'startInnings', battingTeamOptions: ['A', 'B'], reason: 'next' });
    allOut(sc, 'B', [6], ['a1', 'a2']); // follow-on: 6
    const s = sc.state;
    expect(s.innings[2].followOn).toBe(true);
    expect(s.result).toMatchObject({ winnerTeamId: 'A', byInnings: true, marginRuns: 8 });
    expect(s.result!.summary).toBe('Alpha won by an innings and 8 runs');
  });

  it('sets the fourth-innings target from the aggregates', () => {
    const setup = setupFor('TEST', {}, 3, 3);
    const sc = new Scorer(setup);
    allOut(sc, 'A', [6], ['b1', 'b2']); // 6
    allOut(sc, 'B', [4, 4], ['a1', 'a2']); // 8
    expect(sc.state.awaiting).toMatchObject({ battingTeamOptions: ['A'] });
    allOut(sc, 'A', [6, 6], ['b1', 'b2']); // 12 → A total 18
    sc.start('B', 'b1', 'b2', 'a1');
    expect(sc.inn.target).toBe(11); // 18 - 8 + 1
    sc.push(six(), four(), runs(1));
    expect(sc.state.result).toMatchObject({ winnerTeamId: 'B', marginWickets: 2, ballsRemaining: null });
  });

  it('supports declarations and draws', () => {
    const sc = new Scorer(setupFor('TEST')).start('A', 'a1', 'a2', 'b1');
    sc.push(six());
    sc.push({ type: 'DECLARE' });
    expect(sc.state.innings[0]).toMatchObject({ declared: true, endReason: 'declared' });
    sc.start('B', 'b1', 'b2', 'a1');
    sc.push({ type: 'END_MATCH', result: 'draw' });
    expect(sc.state.result?.summary).toBe('Match drawn');
  });

  it('rejects declarations in limited-overs matches', () => {
    const sc = new Scorer(setupFor()).start('A', 'a1', 'a2', 'b1');
    expect(checkEvent(sc.setup, sc.events, { type: 'DECLARE' })).toMatch(/two-innings/);
  });
});

describe('bowler changes', () => {
  it('lets a bowler be replaced mid-over and credits balls to each', () => {
    const sc = new Scorer(setupFor()).start('A', 'a1', 'a2', 'b1');
    sc.push(dot(), dot());
    sc.push({ type: 'SET_BOWLER', bowlerId: 'b2', midOver: true });
    sc.push(...repeat(4, dot));
    const i = sc.inn;
    expect(i.bowlers.find(b => b.playerId === 'b1')!.legalBalls).toBe(2);
    expect(i.bowlers.find(b => b.playerId === 'b2')!.legalBalls).toBe(4);
    expect(i.overs[0].bowlerIds).toEqual(['b1', 'b2']);
    expect(i.bowlers.find(b => b.playerId === 'b2')!.maidens).toBe(0);
    expect(i.lastOverBowlerId).toBe('b2');
  });

  it('rejects a mid-over change before the over starts', () => {
    const sc = new Scorer(setupFor()).start('A', 'a1', 'a2', 'b1');
    expect(checkEvent(sc.setup, sc.events, { type: 'SET_BOWLER', bowlerId: 'b2', midOver: true })).toMatch(/not started/);
  });
});

describe('penalties and revised targets', () => {
  it('adds penalty runs to the batting side immediately', () => {
    const sc = new Scorer(setupFor()).start('A', 'a1', 'a2', 'b1');
    sc.push({ type: 'PENALTY', toTeamId: 'A', runs: 5 });
    expect(sc.inn.runs).toBe(5);
    expect(sc.inn.extras.penalty).toBe(5);
  });

  it('holds penalty runs for the fielding side until it bats', () => {
    const sc = new Scorer(setupFor('CUSTOM', { oversPerInnings: 1 })).start('A', 'a1', 'a2', 'b1');
    sc.push({ type: 'PENALTY', toTeamId: 'B', runs: 5 });
    sc.push(...repeat(6, dot));
    sc.start('B', 'b1', 'b2', 'a1');
    expect(sc.inn.runs).toBe(5);
    expect(sc.state.result?.winnerTeamId).toBeUndefined();
  });

  it('a penalty to the batting side can complete a chase', () => {
    const sc = new Scorer(setupFor('CUSTOM', { oversPerInnings: 1 }));
    playFirstInnings(sc, 4);
    sc.start('B', 'b1', 'b2', 'a1');
    sc.push({ type: 'PENALTY', toTeamId: 'B', runs: 5 });
    expect(sc.state.result?.winnerTeamId).toBe('B');
  });

  it('revises the target and overs for the chase', () => {
    const sc = new Scorer(setupFor('CUSTOM', { oversPerInnings: 2 }));
    sc.start('A', 'a1', 'a2', 'b1').over(repeat(6, dot), 'b2').push(...repeat(5, dot), six());
    sc.push({ type: 'REVISE_TARGET', target: 4, overs: 1 });
    sc.start('B', 'b1', 'b2', 'a1');
    expect(sc.inn.target).toBe(4);
    expect(sc.inn.maxOvers).toBe(1);
    sc.push(...repeat(5, dot), runs(2));
    expect(sc.state.result).toMatchObject({ winnerTeamId: 'A', marginRuns: 1 });
  });
});

describe('partnerships and replay determinism', () => {
  it('tracks partnership runs and balls per batter', () => {
    const sc = new Scorer(setupFor()).start('A', 'a1', 'a2', 'b1');
    sc.push(four(), runs(1), runs(2), wide(), bowled('a2'));
    const p = sc.inn.partnerships[0];
    expect(p).toMatchObject({ runs: 8, balls: 4, batter1Runs: 4 + 1, batter2Runs: 2, unbroken: false });
  });

  it('replay produces identical state from the same events', () => {
    const sc = new Scorer(setupFor()).start('A', 'a1', 'a2', 'b1');
    sc.push(four(), runs(1), noBall(2), wide(1), dot(), bowled(sc.inn.strikerId!));
    sc.batter('a3');
    expect(JSON.stringify(replay(sc.setup, sc.events))).toEqual(JSON.stringify(replay(sc.setup, sc.events)));
  });

  it('reports the failing event index on replay', () => {
    const setup = setupFor();
    expect(() => replay(setup, [dot()])).toThrow(EngineError);
    expect(() => replay(setup, [dot()])).toThrow(/Event 1/);
  });
});
