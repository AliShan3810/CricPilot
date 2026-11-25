import type { MatchState } from './types';

/** Per-player stats for one match, built from the replayed state. Super overs are excluded (standard practice). */
export interface PlayerMatchStats {
  playerId: string;
  teamId: string;
  batInnings: number;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  notOuts: number;
  dismissals: number;
  highest: number;
  highestNotOut: boolean;
  fifties: number;
  hundreds: number;
  ducks: number;
  bowlBalls: number;
  runsConceded: number;
  wickets: number;
  maidens: number;
  wides: number;
  noBalls: number;
  dots: number;
  bestWickets: number;
  bestRuns: number;
  catches: number;
  stumpings: number;
  runOuts: number;
}

function blank(playerId: string, teamId: string): PlayerMatchStats {
  return {
    playerId,
    teamId,
    batInnings: 0,
    runs: 0,
    balls: 0,
    fours: 0,
    sixes: 0,
    notOuts: 0,
    dismissals: 0,
    highest: 0,
    highestNotOut: false,
    fifties: 0,
    hundreds: 0,
    ducks: 0,
    bowlBalls: 0,
    runsConceded: 0,
    wickets: 0,
    maidens: 0,
    wides: 0,
    noBalls: 0,
    dots: 0,
    bestWickets: 0,
    bestRuns: 0,
    catches: 0,
    stumpings: 0,
    runOuts: 0,
  };
}

export function playerMatchStats(state: MatchState): PlayerMatchStats[] {
  const map = new Map<string, PlayerMatchStats>();
  const get = (playerId: string, teamId: string) => {
    let s = map.get(playerId);
    if (!s) {
      s = blank(playerId, teamId);
      map.set(playerId, s);
    }
    return s;
  };
  for (const team of [state.setup.teamA, state.setup.teamB]) {
    for (const p of team.playerIds) {
      get(p, team.id);
    }
  }

  const hasBest = new Set<string>();
  for (const inn of state.innings) {
    if (inn.isSuperOver) {
      continue;
    }
    for (const b of inn.batters) {
      // A retired-hurt batter who faced no ball still counts as an innings (they went in).
      const s = get(b.playerId, inn.battingTeamId);
      s.batInnings += 1;
      s.runs += b.runs;
      s.balls += b.balls;
      s.fours += b.fours;
      s.sixes += b.sixes;
      const out = b.dismissal !== null && b.dismissal.type !== 'retiredHurt';
      if (out) {
        s.dismissals += 1;
        if (b.runs === 0) {
          s.ducks += 1;
        }
      } else {
        s.notOuts += 1;
      }
      if (b.runs > s.highest || (b.runs === s.highest && !out)) {
        s.highest = b.runs;
        s.highestNotOut = !out;
      }
      if (b.runs >= 100) {
        s.hundreds += 1;
      } else if (b.runs >= 50) {
        s.fifties += 1;
      }
      if (b.dismissal?.fielderId) {
        const f = get(b.dismissal.fielderId, inn.bowlingTeamId);
        if (b.dismissal.type === 'caught') {
          f.catches += 1;
        } else if (b.dismissal.type === 'stumped') {
          f.stumpings += 1;
        } else if (b.dismissal.type === 'runOut') {
          f.runOuts += 1;
        }
      }
    }
    for (const bw of inn.bowlers) {
      const s = get(bw.playerId, inn.bowlingTeamId);
      s.bowlBalls += bw.legalBalls;
      s.runsConceded += bw.runs;
      s.wickets += bw.wickets;
      s.maidens += bw.maidens;
      s.wides += bw.wides;
      s.noBalls += bw.noBalls;
      s.dots += bw.dots;
      const bowled = bw.legalBalls + bw.wides + bw.noBalls > 0;
      if (
        bowled &&
        (!hasBest.has(bw.playerId) ||
          bw.wickets > s.bestWickets ||
          (bw.wickets === s.bestWickets && bw.runs < s.bestRuns))
      ) {
        hasBest.add(bw.playerId);
        s.bestWickets = bw.wickets;
        s.bestRuns = bw.runs;
      }
    }
  }
  return [...map.values()];
}
