import { situationText } from '../core/engine/selectors';
import type { MatchState } from '../core/engine/types';
import type { MatchStatus, MatchSummary } from '../data/models';

export function buildSummary(state: MatchState, names: Record<string, string>): MatchSummary {
  const inn = state.innings[state.currentInningsIndex];
  const live = inn && !inn.completed;
  const { rules } = state.setup;
  return {
    innings: state.innings.map(i => ({
      teamId: i.battingTeamId,
      runs: i.runs,
      wickets: i.wickets,
      balls: i.legalBalls,
      allOut: i.endReason === 'allOut',
      declared: i.declared,
      isSuperOver: i.isSuperOver,
      completed: i.completed,
    })),
    situation: situationText(state),
    battingTeamId: live ? inn.battingTeamId : null,
    strikerName: live && inn.strikerId ? names[inn.strikerId] ?? null : null,
    bowlerName: live && inn.currentBowlerId ? names[inn.currentBowlerId] ?? null : null,
    resultType: state.result?.type ?? null,
    ballsPerOver: rules.ballsPerOver,
    quotaBalls: rules.oversPerInnings !== null ? rules.oversPerInnings * rules.ballsPerOver : null,
  };
}

export function statusFor(state: MatchState, eventCount: number): MatchStatus {
  if (state.completed) {
    return 'completed';
  }
  return eventCount > 0 ? 'live' : 'scheduled';
}
