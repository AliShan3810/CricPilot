import React, { forwardRef, useEffect, useState } from 'react';
import { confirmAlert } from '../../../components/ConfirmDialog';
import { StyleSheet, View } from 'react-native';
import { AppBottomSheet, type SheetRef } from '../../../components/AppBottomSheet';
import { AppText } from '../../../components/AppText';
import { Button } from '../../../components/Button';
import { Chip, OptionRow, SegmentedControl, Stepper, SwitchRow } from '../../../components/Controls';
import { Icon } from '../../../components/Icon';
import { availableBatters, bowlerEligibility } from '../../../core/engine/engine';
import type { DeliveryPayload, InningsState, MatchEvent, MatchState } from '../../../core/engine/types';
import type { Team } from '../../../data/models';
import { useSettings } from '../../../stores/settingsStore';
import { spacing, useTheme } from '../../../theme';

type View_ = 'menu' | 'runs' | 'retire' | 'penalty' | 'revise' | 'bowler' | 'end' | 'timedOut';

interface Props {
  state: MatchState;
  inn: InningsState | null;
  teams: Record<string, Team>;
  names: Record<string, string>;
  onEvent: (e: MatchEvent) => void;
  onDelivery: (d: DeliveryPayload) => void;
  onCorrect: () => void;
  onScorecard: () => void;
}

/** Less common scoring actions, kept out of the main pad so it stays fast and simple. */
export const MoreSheet = forwardRef<SheetRef, Props>(function MoreSheetImpl({ state, inn, teams, names, onEvent, onDelivery, onCorrect, onScorecard }, ref) {
  const { colors } = useTheme();
  const [view, setView] = useState<View_>('menu');
  const recordShots = useSettings(s => s.recordShots);
  const update = useSettings(s => s.update);
  const [penaltyTeam, setPenaltyTeam] = useState(inn?.battingTeamId ?? state.setup.teamA.id);
  const [penaltyRuns, setPenaltyRuns] = useState(5);
  const [target, setTarget] = useState(inn?.target ?? 1);
  const [overs, setOvers] = useState<number | null>(inn?.maxOvers ?? null);
  const [retireWho, setRetireWho] = useState<string | null>(inn?.strikerId ?? null);
  const [retireHow, setRetireHow] = useState<'retiredHurt' | 'retiredOut'>('retiredHurt');

  useEffect(() => {
    setTarget(inn?.target ?? 1);
    setOvers(inn?.maxOvers ?? null);
    setRetireWho(inn?.strikerId ?? null);
    setPenaltyTeam(inn?.battingTeamId ?? state.setup.teamA.id);
  }, [inn?.target, inn?.maxOvers, inn?.strikerId, inn?.battingTeamId, state.setup.teamA.id]);

  const live = inn && !inn.completed && !state.completed;
  const canDeliver = state.awaiting.kind === 'delivery';
  const chasing = live && inn.target !== null && !inn.isSuperOver && state.setup.rules.inningsPerSide === 1;
  const go = (v: View_) => setView(v);
  const done = (e: MatchEvent) => {
    setView('menu');
    onEvent(e);
  };
  const base: DeliveryPayload = { kind: 'legal', batRuns: 0, byes: 0, legByes: 0, wideRuns: 0, boundary: null, wicket: null };

  const confirmEnd = (label: string, e: MatchEvent) =>
    confirmAlert(label, 'You can undo this afterwards if it was a mistake.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Confirm', style: 'destructive', onPress: () => done(e) },
    ]);

  const back = (
    <Button label="Back" variant="ghost" onPress={() => setView('menu')} icon={<Icon name="back" size={18} color={colors.primary} />} />
  );

  return (
    <AppBottomSheet ref={ref} title={view === 'menu' ? 'More options' : titleFor(view)} snapPoints={['85%']} onDismiss={() => setView('menu')} testID="sheet-more">
      {view === 'menu' ? (
        <>
          {canDeliver ? <OptionRow title="Other runs" subtitle="All-run 4, 5 or 7, or a six that was run" onPress={() => go('runs')} testID="more-runs" left={<Icon name="ball" color={colors.primary} />} /> : null}
          {live && inn.strikerId && inn.nonStrikerId ? (
            <OptionRow title="Swap strike" subtitle="Correct who is facing" onPress={() => done({ type: 'SWAP_STRIKE' })} testID="more-swap" left={<Icon name="swap" color={colors.primary} />} />
          ) : null}
          {live && inn.currentBowlerId ? <OptionRow title="Change bowler mid-over" subtitle="Injury or suspension" onPress={() => go('bowler')} testID="more-bowler" left={<Icon name="bolt" color={colors.primary} />} /> : null}
          {live && (inn.strikerId || inn.nonStrikerId) ? <OptionRow title="Retire batter" subtitle="Retired hurt or retired out" onPress={() => go('retire')} testID="more-retire" left={<Icon name="user" color={colors.primary} />} /> : null}
          {live && state.awaiting.kind === 'newBatter' ? <OptionRow title="Timed out" subtitle="The incoming batter was too late" onPress={() => go('timedOut')} left={<Icon name="clock" color={colors.primary} />} /> : null}
          {live && inn.nonStrikerId && canDeliver ? (
            <OptionRow title="Run out (backing up)" subtitle={`${names[inn.nonStrikerId]} at the non-striker's end`} onPress={() => confirmEnd('Run out the non-striker?', { type: 'NON_DELIVERY_DISMISSAL', batterId: inn.nonStrikerId!, how: 'runOutNonStriker' })} left={<Icon name="target" color={colors.danger} />} />
          ) : null}
          {!state.completed ? <OptionRow title="Penalty runs" subtitle="5 runs to either side (Law 41)" onPress={() => go('penalty')} testID="more-penalty" left={<Icon name="flag" color={colors.gold} />} /> : null}
          {chasing || (state.awaiting.kind === 'startInnings' && state.awaiting.reason === 'next' && state.setup.rules.inningsPerSide === 1) ? (
            <OptionRow title="Revise target" subtitle="Interrupted match (enter the DLS or local target)" onPress={() => go('revise')} testID="more-revise" left={<Icon name="target" color={colors.gold} />} />
          ) : null}
          <OptionRow title="Edit a past ball" subtitle="Correct runs, extras or a wicket" onPress={onCorrect} testID="more-correct" left={<Icon name="edit" color={colors.primary} />} />
          <OptionRow title="Full scorecard" subtitle="Batting, bowling, partnerships and charts" onPress={onScorecard} testID="more-scorecard" left={<Icon name="list" color={colors.primary} />} />
          <SwitchRow label="Record shot directions" description="Ask where the ball went after runs off the bat (wagon wheel)" value={recordShots} onChange={v => update({ recordShots: v })} testID="more-shots" />
          {live && state.setup.rules.inningsPerSide === 2 && !inn.isSuperOver ? (
            <OptionRow title="Declare innings" onPress={() => confirmEnd('Declare the innings?', { type: 'DECLARE' })} testID="more-declare" left={<Icon name="flag" color={colors.danger} />} />
          ) : null}
          {live ? <OptionRow title="End innings" subtitle="No fit batters left, or by agreement" onPress={() => confirmEnd('End this innings now?', { type: 'END_INNINGS' })} testID="more-end-innings" left={<Icon name="close" color={colors.danger} />} /> : null}
          {!state.completed ? <OptionRow title="End match" subtitle="Draw, no result, abandoned or conceded" onPress={() => go('end')} testID="more-end-match" left={<Icon name="close" color={colors.danger} />} /> : null}
        </>
      ) : null}

      {view === 'runs' ? (
        <>
          <AppText variant="body" tone="secondary">
            Runs off the bat that were all run (not boundaries).
          </AppText>
          <View style={styles.wrap}>
            {[4, 5, 6, 7].map(r => (
              <Chip key={r} label={`${r} run`} onPress={() => { setView('menu'); onDelivery({ ...base, batRuns: r }); }} testID={`more-runs-${r}`} />
            ))}
          </View>
          {back}
        </>
      ) : null}

      {view === 'bowler' && inn ? (
        <>
          <AppText variant="body" tone="secondary">
            The new bowler finishes the over. Each bowler is credited with their own balls.
          </AppText>
          {bowlerEligibility(state, inn, true).map(b => (
            <OptionRow key={b.playerId} title={names[b.playerId]} subtitle={b.reason ?? undefined} disabled={!b.eligible} onPress={() => done({ type: 'SET_BOWLER', bowlerId: b.playerId, midOver: true })} />
          ))}
          {back}
        </>
      ) : null}

      {view === 'retire' && inn ? (
        <>
          <SegmentedControl value={retireHow} onChange={setRetireHow} options={[{ value: 'retiredHurt', label: 'Retired hurt' }, { value: 'retiredOut', label: 'Retired out' }]} />
          <AppText variant="caption" tone="secondary">
            {retireHow === 'retiredHurt' ? 'Not a wicket. The batter may return later.' : 'Counts as a wicket.'}
          </AppText>
          <View style={styles.wrap}>
            {[inn.strikerId, inn.nonStrikerId].filter(Boolean).map(id => (
              <Chip key={id!} label={names[id!]} selected={retireWho === id} onPress={() => setRetireWho(id)} />
            ))}
          </View>
          <Button label="Confirm" variant="danger" disabled={!retireWho} onPress={() => done({ type: 'NON_DELIVERY_DISMISSAL', batterId: retireWho!, how: retireHow })} />
          {back}
        </>
      ) : null}

      {view === 'timedOut' && inn ? (
        <>
          <AppText variant="body" tone="secondary">
            Choose the incoming batter who was timed out.
          </AppText>
          {availableBatters(state, inn)
            .filter(id => !inn.batters.some(b => b.playerId === id))
            .map(id => (
              <OptionRow key={id} title={names[id]} onPress={() => done({ type: 'NON_DELIVERY_DISMISSAL', batterId: id, how: 'timedOut' })} />
            ))}
          {back}
        </>
      ) : null}

      {view === 'penalty' ? (
        <>
          <SegmentedControl value={penaltyTeam} onChange={setPenaltyTeam} options={[state.setup.teamA.id, state.setup.teamB.id].map(id => ({ value: id, label: teams[id]?.name ?? id }))} />
          <Stepper label="Penalty runs" value={penaltyRuns} min={1} max={10} onChange={v => setPenaltyRuns(v ?? 5)} />
          <Button label={`Award ${penaltyRuns} runs`} onPress={() => done({ type: 'PENALTY', toTeamId: penaltyTeam, runs: penaltyRuns })} testID="penalty-confirm" />
          {back}
        </>
      ) : null}

      {view === 'revise' ? (
        <>
          <Stepper label="Target" value={target} min={1} max={999} onChange={v => setTarget(v ?? 1)} testID="revise-target" />
          <Stepper label="Overs" value={overs} min={1} max={state.setup.rules.oversPerInnings ?? 100} allowNull nullLabel="Same" onChange={setOvers} />
          <Button label="Revise target" onPress={() => done({ type: 'REVISE_TARGET', target, overs })} testID="revise-confirm" />
          {back}
        </>
      ) : null}

      {view === 'end' ? (
        <>
          <OptionRow title="Draw" subtitle="Time ran out (Test) or tie by agreement" onPress={() => confirmEnd('End the match as a draw?', { type: 'END_MATCH', result: 'draw' })} />
          <OptionRow title="No result / abandoned" subtitle="Rain, light or another stoppage" onPress={() => confirmEnd('End with no result?', { type: 'END_MATCH', result: 'noResult' })} testID="end-noresult" />
          {[state.setup.teamA.id, state.setup.teamB.id].map(id => (
            <OptionRow key={id} title={`${teams[id]?.name} win (conceded)`} subtitle="The other side conceded" onPress={() => confirmEnd(`Award the match to ${teams[id]?.name}?`, { type: 'END_MATCH', result: 'conceded', winnerTeamId: id })} />
          ))}
          {back}
        </>
      ) : null}
    </AppBottomSheet>
  );
});

function titleFor(v: View_): string {
  return {
    menu: 'More options',
    runs: 'Other runs',
    retire: 'Retire batter',
    penalty: 'Penalty runs',
    revise: 'Revise target',
    bowler: 'Change bowler',
    end: 'End match',
    timedOut: 'Timed out',
  }[v];
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
});
