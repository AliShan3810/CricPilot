import { milestoneCrossed } from '../../core/engine/selectors';
import type { BallRecord, Dismissal, InningsState, MatchEvent, MatchState } from '../../core/engine/types';

export type ScoringEffect =
  | { kind: 'four' }
  | { kind: 'six' }
  | { kind: 'wicket'; batterId: string; how: string }
  | { kind: 'duck'; batterId: string; balls: number; golden: boolean; dismissal: Dismissal }
  | { kind: 'hatTrick'; bowlerId: string }
  | { kind: 'milestone'; batterId: string; runs: number }
  | { kind: 'overComplete'; over: number; runs: number; maiden: boolean }
  | { kind: 'strikeChange' }
  | { kind: 'freeHit' }
  | { kind: 'inningsComplete' }
  | { kind: 'victory'; summary: string; winnerTeamId: string | null };

/**
 * A hat-trick: the bowler's last three deliveries (ignoring wides and no-balls that did not
 * take a wicket) each produced a wicket credited to the bowler.
 */
export function isHatTrick(inn: InningsState, bowlerId: string): boolean {
  const deliveries = inn.balls.filter((b: BallRecord) => b.bowlerId === bowlerId && (b.kind === 'legal' || b.wicket));
  if (deliveries.length < 3) {
    return false;
  }
  return deliveries.slice(-3).every(b => b.wicket?.bowlerCredited === true);
}

/** Works out which celebrations an event deserves by comparing state before and after. Pure. */
export function detectEffects(before: MatchState, after: MatchState, event: MatchEvent): ScoringEffect[] {
  const out: ScoringEffect[] = [];
  if (after.completed && !before.completed) {
    out.push({ kind: 'victory', summary: after.result?.summary ?? '', winnerTeamId: after.result?.winnerTeamId ?? null });
  }
  if (event.type !== 'DELIVERY') {
    return out;
  }
  // the innings the ball was bowled in (it may have just completed)
  const prevInn = before.innings[before.currentInningsIndex];
  const inn = prevInn ? after.innings[prevInn.index] : undefined;
  if (!inn || !prevInn) {
    return out;
  }
  const ball = inn.balls[inn.balls.length - 1];
  if (!ball || ball.eventIndex !== before.eventCount) {
    return out;
  }
  if (ball.wicket) {
    out.push({ kind: 'wicket', batterId: ball.wicket.batterOutId, how: ball.wicket.type });
    const out_ = inn.batters.find(b => b.playerId === ball.wicket!.batterOutId);
    if (out_ && out_.runs === 0 && out_.dismissal) {
      out.push({ kind: 'duck', batterId: out_.playerId, balls: out_.balls, golden: out_.balls <= 1, dismissal: out_.dismissal });
    }
    if (ball.wicket.bowlerCredited && isHatTrick(inn, ball.bowlerId)) {
      out.push({ kind: 'hatTrick', bowlerId: ball.bowlerId });
    }
  } else if (ball.boundary === 6) {
    out.push({ kind: 'six' });
  } else if (ball.boundary === 4) {
    out.push({ kind: 'four' });
  }
  const strikerBefore = prevInn.batters.find(b => b.playerId === ball.strikerId)?.runs ?? 0;
  const strikerAfter = inn.batters.find(b => b.playerId === ball.strikerId)?.runs ?? 0;
  const m = milestoneCrossed(strikerBefore, strikerAfter);
  if (m) {
    out.push({ kind: 'milestone', batterId: ball.strikerId, runs: m });
  }
  if (inn.completed && !prevInn.completed && !after.completed) {
    out.push({ kind: 'inningsComplete' });
  } else if (ball.kind === 'legal' && ball.ballInOver === after.setup.rules.ballsPerOver && !inn.completed) {
    const over = inn.overs[ball.over];
    out.push({ kind: 'overComplete', over: ball.over + 1, runs: over?.runs ?? 0, maiden: !!over?.isMaiden });
  } else if (!inn.completed && inn.strikerId !== null && prevInn.strikerId !== null && inn.strikerId !== prevInn.strikerId && !ball.wicket) {
    out.push({ kind: 'strikeChange' });
  }
  if (inn.freeHitNext && !prevInn.freeHitNext) {
    out.push({ kind: 'freeHit' });
  }
  return out;
}
