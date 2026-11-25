import { replay } from '../../../core/engine/engine';
import { Scorer, setupFor, four, six, runs, dot, bowled, del, repeat } from '../../../core/engine/__tests__/helpers';
import { detectEffects } from '../effects';
import type { MatchEvent } from '../../../core/engine/types';

function effectsOf(sc: Scorer, e: MatchEvent) {
  const before = replay(sc.setup, sc.events);
  sc.push(e);
  return detectEffects(before, sc.state, e).map(x => x.kind);
}

describe('celebration effects', () => {
  it('detects fours, sixes and wickets', () => {
    const sc = new Scorer(setupFor()).start('A', 'a1', 'a2', 'b1');
    expect(effectsOf(sc, four())).toEqual(['four']);
    expect(effectsOf(sc, six())).toEqual(['six']);
    expect(effectsOf(sc, bowled('a1'))).toEqual(['wicket']);
  });

  it('detects strike changes and the end of an over', () => {
    const sc = new Scorer(setupFor()).start('A', 'a1', 'a2', 'b1');
    expect(effectsOf(sc, runs(1))).toEqual(['strikeChange']);
    sc.push(...repeat(4, dot));
    expect(effectsOf(sc, dot())).toEqual(['overComplete']);
  });

  it('detects fifties', () => {
    const sc = new Scorer(setupFor('CUSTOM', { oversPerInnings: 20, maxOversPerBowler: null })).start('A', 'a1', 'a2', 'b1');
    // 8 sixes = 48 in 8 balls over two overs
    sc.push(six(), six(), six(), six(), six(), dot());
    sc.bowler('b2');
    // over change put a2 on strike: a2 takes a single, a1 back on strike
    sc.push(runs(1), six(), six());
    expect(sc.inn.batters[0].runs).toBe(42);
    expect(effectsOf(sc, six())).toEqual(['six']);
    const fx = effectsOf(sc, del({ batRuns: 2 }));
    expect(fx).toContain('milestone');
  });

  it('detects free hits and victory', () => {
    const sc = new Scorer(setupFor('CUSTOM', { oversPerInnings: 1 }, 2, 2)).start('A', 'a1', 'a2', 'b1');
    expect(effectsOf(sc, del({ kind: 'noBall' }))).toContain('freeHit');
    sc.push(...repeat(6, dot));
    sc.start('B', 'b1', 'b2', 'a1');
    expect(effectsOf(sc, runs(2))).toContain('victory');
  });
});

describe('ducks and hat-tricks', () => {
  it('flags a golden duck and a duck after facing balls', () => {
    const sc = new Scorer(setupFor()).start('A', 'a1', 'a2', 'b1');
    const fx = (() => {
      const before = replay(sc.setup, sc.events);
      const e = bowled('a1');
      sc.push(e);
      return detectEffects(before, sc.state, e);
    })();
    const duck = fx.find(e => e.kind === 'duck');
    expect(duck).toMatchObject({ kind: 'duck', batterId: 'a1', balls: 1, golden: true });
    sc.batter('a3');
    sc.push(dot(), dot());
    expect(effectsOf(sc, bowled('a3'))).toEqual(['wicket', 'duck']);
  });

  it('does not flag a duck when the batter scored', () => {
    const sc = new Scorer(setupFor()).start('A', 'a1', 'a2', 'b1');
    sc.push(runs(2));
    expect(effectsOf(sc, bowled('a1'))).toEqual(['wicket']);
  });

  it('detects a hat-trick across consecutive deliveries, ignoring a wide in between', () => {
    const sc = new Scorer(setupFor()).start('A', 'a1', 'a2', 'b1');
    sc.push(bowled('a1')).batter('a3');
    sc.push(bowled('a3')).batter('a4');
    sc.push(del({ kind: 'wide' }));
    const fx = effectsOf(sc, bowled('a4'));
    expect(fx).toContain('hatTrick');
    expect(fx).toContain('duck');
  });

  it('does not count run outs or a dot in between', () => {
    const sc = new Scorer(setupFor()).start('A', 'a1', 'a2', 'b1');
    sc.push(bowled('a1')).batter('a3');
    sc.push(dot());
    sc.push(bowled('a3')).batter('a4');
    expect(effectsOf(sc, bowled('a4'))).not.toContain('hatTrick');
  });

  it('spans overs for the same bowler', () => {
    const sc = new Scorer(setupFor()).start('A', 'a1', 'a2', 'b1');
    sc.push(...repeat(4, dot), bowled('a1')).batter('a3');
    sc.push(bowled('a3')).batter('a4'); // end of over 1 (2 wickets)
    sc.bowler('b2').push(dot(), dot(), dot(), dot(), dot(), dot()).bowler('b1');
    expect(effectsOf(sc, bowled(sc.inn.strikerId!))).toContain('hatTrick');
  });
});
