import { ballLabel, ballTone, chaseInfo, milestoneCrossed, projectedScore, runRate, situationText, strikeRate } from '../selectors';
import { playerMatchStats } from '../stats';
import { manhattan, phaseSplit, scoringDistribution, wagonWheel, worm } from '../analytics';
import { presetRules, validateRules, applyBallType } from '../rules';
import { Scorer, setupFor, del, four, six, runs, dot, bowled, repeat, wide } from './helpers';

describe('selectors', () => {
  it('labels balls like a broadcast ticker', () => {
    const sc = new Scorer(setupFor()).start('A', 'a1', 'a2', 'b1');
    sc.push(dot(), runs(2), four(), six(), wide(), wide(2), del({ kind: 'noBall', batRuns: 4, boundary: 4 }), del({ byes: 2 }), del({ legByes: 1 }));
    // six legal balls: the over is complete and a new bowler is required
    expect(sc.state.awaiting.kind).toBe('newBowler');
    sc.bowler('b2').push(bowled(sc.inn.strikerId!));
    const labels = sc.inn.balls.map(ballLabel);
    expect(labels).toEqual(['•', '2', '4', '6', 'wd', '3wd', 'nb+4', '2b', '1lb', 'W']);
    expect(sc.inn.balls.map(ballTone).slice(0, 5)).toEqual(['dot', 'run', 'four', 'six', 'extra']);
  });

  it('computes rates and chase information', () => {
    expect(runRate(30, 18, 6)).toBe(10);
    expect(runRate(0, 0, 6)).toBe(0);
    expect(strikeRate(50, 40)).toBe(125);
    const sc = new Scorer(setupFor('CUSTOM', { oversPerInnings: 2 }));
    sc.start('A', 'a1', 'a2', 'b1').over(repeat(6, () => runs(2)), 'b2').push(...repeat(6, () => runs(2)));
    sc.start('B', 'b1', 'b2', 'a1');
    sc.push(four(), runs(2));
    const s = sc.state;
    const c = chaseInfo(s, sc.inn)!;
    expect(c).toEqual({ target: 25, runsNeeded: 19, ballsRemaining: 10, requiredRate: (19 * 6) / 10 });
    expect(situationText(s)).toBe('Need 19 off 10 balls');
    expect(projectedScore(s, s.innings[0])).toBe(24);
  });

  it('detects milestones', () => {
    expect(milestoneCrossed(48, 52)).toBe(50);
    expect(milestoneCrossed(96, 100)).toBe(100);
    expect(milestoneCrossed(50, 54)).toBeNull();
  });
});

describe('player match stats', () => {
  it('aggregates batting, bowling and fielding, excluding super overs', () => {
    const sc = new Scorer(setupFor('CUSTOM', { oversPerInnings: 1 }, 3, 3));
    sc.start('A', 'a1', 'a2', 'b1').push(six(), dot(), dot(), dot(), dot(), del({ wicket: { type: 'caught', batterOutId: 'a1', fielderId: 'b2' } }));
    sc.start('B', 'b1', 'b2', 'a3').push(six(), dot(), dot(), dot(), dot(), dot());
    sc.push({ type: 'START_SUPER_OVER' });
    sc.start('B', 'b1', 'b2', 'a1').push(six(), six(), dot(), dot(), dot(), dot());
    const stats = playerMatchStats(sc.state);
    const a1 = stats.find(s => s.playerId === 'a1')!;
    expect(a1).toMatchObject({ batInnings: 1, runs: 6, balls: 6, sixes: 1, dismissals: 1, notOuts: 0, bowlBalls: 0 });
    const b1 = stats.find(s => s.playerId === 'b1')!;
    expect(b1).toMatchObject({ runs: 6, sixes: 1, wickets: 1, runsConceded: 6, bestWickets: 1, bestRuns: 6 });
    expect(stats.find(s => s.playerId === 'b2')!.catches).toBe(1);
    const a3 = stats.find(s => s.playerId === 'a3')!;
    expect(a3).toMatchObject({ bowlBalls: 6, runsConceded: 6, wickets: 0 });
    expect(stats.every(s => s.teamId === 'A' || s.teamId === 'B')).toBe(true);
  });
});

describe('analytics', () => {
  it('builds Manhattan, worm, distribution, phase and wagon data', () => {
    const sc = new Scorer(setupFor('CUSTOM', { oversPerInnings: 5, maxOversPerBowler: null })).start('A', 'a1', 'a2', 'b1');
    sc.over([four(), dot(), dot(), del({ batRuns: 1, shot: { angle: 90, distance: 0.5 } }), dot(), six()], 'b2');
    sc.push(bowled(sc.inn.strikerId!));
    const inn = sc.inn;
    expect(manhattan(inn)).toEqual([{ over: 1, runs: 11, wickets: 0 }, { over: 2, runs: 0, wickets: 1 }]);
    const w = worm(inn, 6);
    expect(w[0]).toEqual({ over: 0, runs: 0, wicket: false });
    expect(w[w.length - 1]).toMatchObject({ runs: 11, wicket: true });
    expect(scoringDistribution(inn.balls)).toMatchObject({ dots: 4, ones: 1, fours: 1, sixes: 1 });
    expect(wagonWheel(inn)).toEqual([{ angle: 90, distance: 0.5, runs: 1, boundary: null, batterId: 'a1' }]);
    const phases = phaseSplit(sc.state, inn);
    expect(phases.map(p => p.label)).toEqual(['Powerplay', 'Middle overs', 'Death overs']);
    expect(phases[0].runs).toBe(11);
  });
});

describe('rules', () => {
  it('provides presets and validates custom rules', () => {
    expect(presetRules('T20')).toMatchObject({ oversPerInnings: 20, maxOversPerBowler: 4, inningsPerSide: 1 });
    expect(presetRules('TEST')).toMatchObject({ oversPerInnings: null, inningsPerSide: 2, followOnMargin: 200, freeHit: false });
    expect(applyBallType(presetRules('T10'), 'tape')).toMatchObject({ lbwAllowed: false, legByesAllowed: false, freeHit: true });
    expect(validateRules(presetRules('ODI'))).toEqual([]);
    expect(validateRules({ ...presetRules('CUSTOM'), ballsPerOver: 3 }).map(i => i.field)).toContain('ballsPerOver');
    expect(validateRules({ ...presetRules('CUSTOM'), playersPerSide: 12 }).map(i => i.field)).toContain('playersPerSide');
    expect(validateRules({ ...presetRules('T20'), oversPerInnings: null }).map(i => i.field)).toContain('oversPerInnings');
    expect(validateRules({ ...presetRules('T20'), maxOversPerBowler: 1, playersPerSide: 5 }).map(i => i.field)).toContain('maxOversPerBowler');
  });
});
