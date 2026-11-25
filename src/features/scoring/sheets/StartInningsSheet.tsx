import React, { forwardRef, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { AppBottomSheet, type SheetRef } from '../../../components/AppBottomSheet';
import { AppText } from '../../../components/AppText';
import { Button } from '../../../components/Button';
import { Chip, SegmentedControl } from '../../../components/Controls';
import { squadOf } from '../../../core/engine/engine';
import type { MatchEvent, MatchState } from '../../../core/engine/types';
import type { Team } from '../../../data/models';
import { spacing } from '../../../theme';

interface Props {
  state: MatchState;
  teams: Record<string, Team>;
  names: Record<string, string>;
  onSubmit: (e: MatchEvent) => void;
}

/** Choose batting side (when there is a choice), openers and the opening bowler. */
export const StartInningsSheet = forwardRef<SheetRef, Props>(function StartInningsSheetImpl({ state, teams, names, onSubmit }, ref) {
  const aw = state.awaiting.kind === 'startInnings' ? state.awaiting : null;
  const options = aw?.battingTeamOptions ?? [];
  const [batting, setBatting] = useState<string | null>(options[0] ?? null);
  const [striker, setStriker] = useState<string | null>(null);
  const [nonStriker, setNonStriker] = useState<string | null>(null);
  const [bowler, setBowler] = useState<string | null>(null);

  useEffect(() => {
    setBatting(options[0] ?? null);
    setStriker(null);
    setNonStriker(null);
    setBowler(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options.join(','), state.innings.length]);

  if (!aw || !batting) {
    return <AppBottomSheet ref={ref} title="Start innings" required><View /></AppBottomSheet>;
  }
  const bowlingId = batting === state.setup.teamA.id ? state.setup.teamB.id : state.setup.teamA.id;
  const batSquad = squadOf(state, batting).playerIds;
  // In a super over or a second innings, batters who are out may bat again; all players are available.
  const bowlSquad = squadOf(state, bowlingId).playerIds;
  const last = state.innings[state.innings.length - 1];
  const title = aw.reason === 'superOver' ? 'Super over' : aw.reason === 'first' ? 'Start the match' : 'Innings break';
  let subtitle = 'Choose the opening batters and bowler.';
  if (aw.reason !== 'first' && last) {
    const target = state.setup.rules.inningsPerSide === 1 || aw.reason === 'superOver' ? last.runs + 1 : null;
    subtitle = `${teams[last.battingTeamId]?.name} ${last.runs}/${last.wickets}.${target ? ` ${teams[batting]?.name} need ${target} to win.` : ''}`;
  }
  const pickBat = (id: string) => {
    if (striker === id) {
      setStriker(null);
    } else if (nonStriker === id) {
      setNonStriker(null);
    } else if (!striker) {
      setStriker(id);
    } else if (!nonStriker) {
      setNonStriker(id);
    } else {
      setNonStriker(id);
    }
  };
  const ready = striker && (nonStriker || batSquad.length === 1) && bowler;
  return (
    <AppBottomSheet ref={ref} title={title} subtitle={subtitle} required snapPoints={['88%']} testID="sheet-start-innings">
      {options.length > 1 ? (
        <>
          <AppText variant="overline" tone="secondary">
            {aw.reason === 'next' ? 'Follow-on decision: who bats?' : 'Batting side'}
          </AppText>
          <SegmentedControl value={batting} onChange={v => { setBatting(v); setStriker(null); setNonStriker(null); setBowler(null); }} options={options.map(o => ({ value: o, label: teams[o]?.name ?? o }))} />
        </>
      ) : null}
      <AppText variant="overline" tone="secondary">
        {teams[batting]?.name} openers · tap striker, then non-striker
      </AppText>
      <View style={styles.wrap}>
        {batSquad.map(id => (
          <Chip
            key={id}
            testID={`opener-${names[id]}`}
            label={`${names[id] ?? id}${striker === id ? ' · striker' : nonStriker === id ? ' · non-striker' : ''}`}
            selected={striker === id || nonStriker === id}
            onPress={() => pickBat(id)}
          />
        ))}
      </View>
      <AppText variant="overline" tone="secondary">
        {teams[bowlingId]?.name} opening bowler
      </AppText>
      <View style={styles.wrap}>
        {bowlSquad.map(id => (
          <Chip key={id} testID={`openbowler-${names[id]}`} label={names[id] ?? id} selected={bowler === id} color={teams[bowlingId]?.color} onPress={() => setBowler(id)} />
        ))}
      </View>
      <Button
        label="Start innings"
        size="lg"
        disabled={!ready}
        testID="start-innings-confirm"
        onPress={() => onSubmit({ type: 'START_INNINGS', battingTeamId: batting, strikerId: striker!, nonStrikerId: nonStriker, bowlerId: bowler! })}
        style={styles.btn}
      />
    </AppBottomSheet>
  );
});

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  btn: { marginTop: spacing.sm },
});
