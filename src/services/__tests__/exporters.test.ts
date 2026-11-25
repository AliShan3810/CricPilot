import { ballByBallCsv, careersCsv, dismissalText, escapeHtml, safeFileName, scorecardCsv, scorecardHtml, toCsv } from '../exporters';
import { Scorer, setupFor, four, six, runs, del, bowled } from '../../core/engine/__tests__/helpers';
import type { CareerStats } from '../../data/repositories/statsRepository';

const names = (n: number, p: string) => Object.fromEntries(Array.from({ length: n }, (_, i) => [`${p}${i + 1}`, `${p.toUpperCase()} Player ${i + 1}`]));
const NAMES = { ...names(11, 'a'), ...names(11, 'b') };

function sample() {
  const sc = new Scorer(setupFor('CUSTOM', { oversPerInnings: 2 })).start('A', 'a1', 'a2', 'b1');
  sc.push(four(), runs(1), six(), del({ kind: 'wide' }), del({ wicket: { type: 'caught', batterOutId: 'a2', fielderId: 'b3' } }));
  return sc.state;
}

describe('exporters', () => {
  it('formats dismissals the way scorecards do', () => {
    const base = { teamScore: 0, wicketNumber: 1, overBall: '0.1' };
    expect(dismissalText({ ...base, type: 'bowled', bowlerId: 'b1', fielderId: null }, NAMES)).toBe('b B Player 1');
    expect(dismissalText({ ...base, type: 'caught', bowlerId: 'b1', fielderId: 'b1' }, NAMES)).toBe('c & b B Player 1');
    expect(dismissalText({ ...base, type: 'caught', bowlerId: 'b1', fielderId: 'b2' }, NAMES)).toBe('c B Player 2 b B Player 1');
    expect(dismissalText({ ...base, type: 'runOut', bowlerId: null, fielderId: 'b4' }, NAMES)).toBe('run out (B Player 4)');
    expect(dismissalText(null, NAMES)).toBe('not out');
    expect(dismissalText(null, NAMES, true)).toBe('retired hurt');
  });

  it('escapes HTML and builds a complete scorecard document', () => {
    expect(escapeHtml('<b>"A&B"</b>')).toBe('&lt;b&gt;&quot;A&amp;B&quot;&lt;/b&gt;');
    const html = scorecardHtml(sample(), NAMES, { title: 'Final <Cup>', venue: 'Main Ground', date: 0, tossText: null });
    expect(html).toContain('Final &lt;Cup&gt;');
    expect(html).toContain('A Player 1');
    expect(html).toContain('c B Player 3 b B Player 1');
    expect(html).toContain('<b>Extras</b> 1 (b 0, lb 0, w 1, nb 0)');
    expect(html).not.toContain('<Cup>');
  });

  it('quotes CSV cells safely', () => {
    expect(toCsv([['a,b', 'he said "hi"', 3, null]])).toBe('"a,b","he said ""hi""",3,\n');
  });

  it('exports ball-by-ball and scorecard CSV', () => {
    const state = sample();
    const balls = ballByBallCsv(state, NAMES).trim().split('\n');
    expect(balls).toHaveLength(1 + 5);
    expect(balls[1]).toContain('A Player 1');
    expect(balls[4]).toContain('wide');
    expect(balls[5]).toContain('caught');
    const card = scorecardCsv(state, NAMES);
    expect(card).toContain('batting,1,A Player 1,not out,5,2,1,0,250.00');
    expect(card).toContain('batting,1,A Player 2,c B Player 3 b B Player 1,6,2,0,1');
    expect(card).toContain('bowling,1,B Player 1');
  });

  it('exports career statistics', () => {
    const c: CareerStats = {
      playerId: 'p', name: 'Ali, Jr', teamId: 't', matches: 3, innings: 3, runs: 120, balls: 90, notOuts: 1, dismissals: 2, highest: 70, highestNotOut: true,
      fifties: 1, hundreds: 0, fours: 10, sixes: 4, ducks: 0, battingAverage: 60, strikeRate: 133.33, bowlBalls: 20, runsConceded: 30, wickets: 2, maidens: 0,
      wides: 1, noBalls: 0, dots: 8, bestWickets: 2, bestRuns: 12, bowlingAverage: 15, economy: 9, bowlingStrikeRate: 10, catches: 1, stumpings: 0, runOuts: 0,
    };
    const csv = careersCsv([c], { t: 'Tigers' });
    expect(csv.split('\n')[1]).toBe('"Ali, Jr",Tigers,3,3,120,90,1,70*,60.00,133.33,1,0,10,4,3.2,30,2,2/12,15.00,9.00,1,0,0');
  });

  it('makes safe file names', () => {
    expect(safeFileName('LHR vs KHI: Final!')).toBe('lhr-vs-khi-final');
    expect(safeFileName('***')).toBe('match');
  });

  it('handles an all-out innings in the HTML', () => {
    const sc = new Scorer(setupFor('CUSTOM', {}, 2, 2)).start('A', 'a1', 'a2', 'b1');
    sc.push(bowled('a1'));
    expect(sc.state.innings[0].endReason).toBe('allOut');
    const names2 = { a1: 'X', a2: 'Y', b1: 'Z', b2: 'W' };
    expect(scorecardHtml(sc.state, names2, { title: 't', venue: null, date: 0, tossText: 'A won the toss' })).toContain('A won the toss');
  });
});
