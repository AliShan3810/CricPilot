import {
  CompletedLeagueMatch,
  formatNrr,
  generateFixtures,
  knockoutBracket,
  leagueKnockout,
  pointsTable,
  roundRobin,
  seedOrder,
} from '../tournament';

const pairKey = (a: string | null, b: string | null) => [a, b].sort().join('-');

describe('round robin', () => {
  it.each([2, 3, 4, 5, 6, 7, 8])('every pair of %i teams meets exactly once', n => {
    const teams = Array.from({ length: n }, (_, i) => `T${i}`);
    const fx = roundRobin(teams);
    expect(fx).toHaveLength((n * (n - 1)) / 2);
    const pairs = new Set(fx.map(f => pairKey(f.teamAId, f.teamBId)));
    expect(pairs.size).toBe(fx.length);
    // no team plays twice in a round
    const byRound = new Map<number, string[]>();
    for (const f of fx) {
      const list = byRound.get(f.round) ?? [];
      list.push(f.teamAId!, f.teamBId!);
      byRound.set(f.round, list);
    }
    for (const list of byRound.values()) {
      expect(new Set(list).size).toBe(list.length);
    }
  });

  it('double round robin plays each pair twice with home and away swapped', () => {
    const fx = roundRobin(['A', 'B', 'C', 'D'], true);
    expect(fx).toHaveLength(12);
    const ab = fx.filter(f => pairKey(f.teamAId, f.teamBId) === 'A-B');
    expect(ab).toHaveLength(2);
    expect(ab[0].teamAId).toBe(ab[1].teamBId);
  });

  it('rejects fewer than two teams', () => {
    expect(() => roundRobin(['A'])).toThrow();
  });
});

describe('knockout brackets', () => {
  it('seeds 1 v 8, 4 v 5, 2 v 7, 3 v 6', () => {
    expect(seedOrder(8)).toEqual([1, 8, 4, 5, 2, 7, 3, 6]);
  });

  it('builds a full bracket for 8 teams and links winners forward', () => {
    const fx = knockoutBracket(Array.from({ length: 8 }, (_, i) => ({ teamId: `S${i + 1}` })));
    expect(fx).toHaveLength(7);
    expect(fx.filter(f => f.stage === 'quarterFinal')).toHaveLength(4);
    expect(fx.filter(f => f.stage === 'semiFinal')).toHaveLength(2);
    const final = fx.find(f => f.stage === 'final')!;
    expect(final.nextKey).toBeNull();
    const qf1 = fx[0];
    expect([qf1.teamAId, qf1.teamBId]).toEqual(['S1', 'S8']);
    expect(qf1.nextKey).toBe('K2-0');
    expect(qf1.nextSlot).toBe('a');
  });

  it('gives top seeds byes when the team count is not a power of two', () => {
    const fx = knockoutBracket(['S1', 'S2', 'S3', 'S4', 'S5', 'S6'].map(teamId => ({ teamId })));
    // 6 teams → 8-bracket: seeds 1 and 2 get byes, 2 quarter-finals are played
    const qfs = fx.filter(f => f.round === 1);
    expect(qfs).toHaveLength(2);
    const semis = fx.filter(f => f.round === 2);
    const seeded = semis.flatMap(s => [s.teamAId, s.teamBId]).filter(Boolean);
    expect(seeded.sort()).toEqual(['S1', 'S2']);
    expect(fx).toHaveLength(5);
  });

  it('builds a final for two teams', () => {
    const fx = generateFixtures('knockout', ['A', 'B']);
    expect(fx).toEqual([expect.objectContaining({ stage: 'final', teamAId: 'A', teamBId: 'B' })]);
  });

  it('league + knockout adds placeholder semi-finals and final', () => {
    const fx = leagueKnockout(['A', 'B', 'C', 'D', 'E'], 4);
    expect(fx.filter(f => f.stage === 'league')).toHaveLength(10);
    const semis = fx.filter(f => f.stage === 'semiFinal');
    expect(semis).toHaveLength(2);
    expect(semis[0].labelA).toBe('1st in table');
    expect(semis[0].labelB).toBe('4th in table');
    expect(semis[0].teamAId).toBeNull();
    expect(() => leagueKnockout(['A', 'B'], 4)).toThrow();
  });
});

describe('points table and NRR', () => {
  const base = { quotaBalls: 120, ballsPerOver: 6 };
  it('awards points and orders by points then NRR', () => {
    const matches: CompletedLeagueMatch[] = [
      // A 180/5 (20) beat B 150/8 (20)
      { ...base, teamAId: 'A', teamBId: 'B', winnerTeamId: 'A', resultType: 'win', teamARuns: 180, teamABalls: 120, teamAAllOut: false, teamBRuns: 150, teamBBalls: 120, teamBAllOut: false },
      // C 100 all out (15) lost to B 101/2 (10)
      { ...base, teamAId: 'C', teamBId: 'B', winnerTeamId: 'B', resultType: 'win', teamARuns: 100, teamABalls: 90, teamAAllOut: true, teamBRuns: 101, teamBBalls: 60, teamBAllOut: false },
      { ...base, teamAId: 'A', teamBId: 'C', winnerTeamId: null, resultType: 'noResult', teamARuns: 20, teamABalls: 12, teamAAllOut: false, teamBRuns: 0, teamBBalls: 0, teamBAllOut: false },
    ];
    const table = pointsTable(['A', 'B', 'C'], matches, { win: 2, tie: 1, noResult: 1 });
    const a = table.find(r => r.teamId === 'A')!;
    const b = table.find(r => r.teamId === 'B')!;
    const c = table.find(r => r.teamId === 'C')!;
    expect(a).toMatchObject({ played: 2, won: 1, noResult: 1, points: 3 });
    expect(b).toMatchObject({ played: 2, won: 1, lost: 1, points: 2 });
    expect(c).toMatchObject({ played: 2, lost: 1, noResult: 1, points: 1 });
    // A: 180/20 - 150/20 = 1.5
    expect(a.nrr).toBeCloseTo(1.5, 5);
    // B: for (150+101)/(20+10) = 8.3667, against (180+100)/(20+20) = 7.0 → all-out C counts as 20 overs
    expect(b.nrr).toBeCloseTo(251 / 30 - 280 / 40, 5);
    // C: 100/20 - 101/10 = -5.1
    expect(c.nrr).toBeCloseTo(-5.1, 5);
    expect(table.map(r => r.teamId)).toEqual(['A', 'B', 'C']);
    expect(formatNrr(a.nrr)).toBe('+1.500');
    expect(formatNrr(c.nrr)).toBe('-5.100');
  });

  it('handles ties', () => {
    const table = pointsTable(
      ['A', 'B'],
      [{ ...base, teamAId: 'A', teamBId: 'B', winnerTeamId: null, resultType: 'tie', teamARuns: 100, teamABalls: 120, teamAAllOut: false, teamBRuns: 100, teamBBalls: 120, teamBAllOut: false }],
      { win: 2, tie: 1, noResult: 1 },
    );
    expect(table[0]).toMatchObject({ tied: 1, points: 1, nrr: 0 });
  });
});
