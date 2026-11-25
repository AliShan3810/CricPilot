import { CUES, SOUND_CATEGORY, planCues } from '../cues';
import type { ScoringEffect } from '../../../features/scoring/effects';

const wicket: ScoringEffect = { kind: 'wicket', batterId: 'a1', how: 'bowled' };
const duck: ScoringEffect = { kind: 'duck', batterId: 'a1', balls: 1, golden: true, dismissal: { type: 'bowled', bowlerId: 'b1', fielderId: null, teamScore: 0, wicketNumber: 1, overBall: '0.1' } };

describe('cue planning', () => {
  it('gives every event its own identity', () => {
    expect(planCues([{ kind: 'four' }])).toEqual([{ cue: 'four', at: 0 }]);
    expect(planCues([{ kind: 'six' }])).toEqual([{ cue: 'six', at: 0 }]);
    expect(planCues([wicket])).toEqual([{ cue: 'wicket', at: 0 }]);
  });

  it('plays a coordinated duck sequence instead of wicket + duck', () => {
    const plan = planCues([wicket, duck]);
    expect(plan.map(p => p.cue)).toEqual(['duck']);
  });

  it('a hat-trick outranks the duck and the plain wicket', () => {
    expect(planCues([wicket, duck, { kind: 'hatTrick', bowlerId: 'b1' }]).map(p => p.cue)).toEqual(['hatTrick']);
  });

  it('sequences a milestone after the boundary, and the innings cue after both', () => {
    const plan = planCues([{ kind: 'six' }, { kind: 'milestone', batterId: 'a1', runs: 100 }, { kind: 'inningsComplete' }]);
    expect(plan.map(p => p.cue)).toEqual(['six', 'century', 'innings']);
    expect(plan[1].at).toBeGreaterThan(0);
    expect(plan[2].at).toBeGreaterThanOrEqual(plan[1].at + CUES.century.length);
  });

  it('leaves the victory cue to the result screen', () => {
    expect(planCues([{ kind: 'four' }, { kind: 'victory', summary: 'x', winnerTeamId: 'A' }, { kind: 'inningsComplete' }]).map(p => p.cue)).toEqual(['four']);
  });

  it('plans nothing for dots, singles and strike changes', () => {
    expect(planCues([{ kind: 'strikeChange' }])).toEqual([]);
    expect(planCues([])).toEqual([]);
  });

  it('maps every sound to a category and keeps cues short', () => {
    for (const def of Object.values(CUES)) {
      for (const l of def.layers) {
        expect(SOUND_CATEGORY[l.sound]).toBeDefined();
        expect(l.at).toBeLessThan(3000);
      }
      expect(def.length).toBeLessThanOrEqual(6000);
    }
  });
});
