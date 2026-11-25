import React, { forwardRef, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { AppBottomSheet, type SheetRef } from '../../../components/AppBottomSheet';
import { AppText } from '../../../components/AppText';
import { Button } from '../../../components/Button';
import { Chip, SegmentedControl, Stepper } from '../../../components/Controls';
import { squadOf } from '../../../core/engine/engine';
import { ALLOWED_ON_FREE_HIT, ALLOWED_ON_NO_BALL, ALLOWED_ON_WIDE, DISMISSAL_LABELS } from '../../../core/engine/rules';
import type { DeliveryDismissalType, DeliveryKind, DeliveryPayload, InningsState, MatchState } from '../../../core/engine/types';
import { spacing } from '../../../theme';

const ALL: DeliveryDismissalType[] = ['bowled', 'caught', 'lbw', 'runOut', 'stumped', 'hitWicket', 'obstructingField', 'hitBallTwice'];
const NEEDS_FIELDER: DeliveryDismissalType[] = ['caught', 'runOut', 'stumped'];

export function allowedDismissals(state: MatchState, inn: InningsState, kind: DeliveryKind): DeliveryDismissalType[] {
  return ALL.filter(t => {
    if (t === 'lbw' && !state.setup.rules.lbwAllowed) {
      return false;
    }
    if (kind === 'wide' && !ALLOWED_ON_WIDE.has(t)) {
      return false;
    }
    if (kind === 'noBall' && !ALLOWED_ON_NO_BALL.has(t)) {
      return false;
    }
    if (inn.freeHitNext && !ALLOWED_ON_FREE_HIT.has(t)) {
      return false;
    }
    return true;
  });
}

interface Props {
  state: MatchState;
  inn: InningsState;
  names: Record<string, string>;
  kind: DeliveryKind;
  onSubmit: (d: DeliveryPayload) => void;
}

export const WicketSheet = forwardRef<SheetRef, Props>(function WicketSheetImpl({ state, inn, names, kind, onSubmit }, ref) {
  const allowed = useMemo(() => allowedDismissals(state, inn, kind), [state, inn, kind]);
  const [type, setType] = useState<DeliveryDismissalType>(allowed[0] ?? 'runOut');
  const [outId, setOutId] = useState<string | null>(inn.strikerId);
  const [fielder, setFielder] = useState<string | null>(null);
  const [runs, setRuns] = useState(0);
  const [end, setEnd] = useState<'striker' | 'nonStriker'>('striker');

  useEffect(() => {
    setType(allowed[0] ?? 'runOut');
    setOutId(inn.strikerId);
    setFielder(null);
    setRuns(0);
    setEnd('striker');
  }, [allowed, inn.strikerId, kind]);

  const runOutLike = type === 'runOut' || type === 'obstructingField';
  const fielders = squadOf(state, inn.bowlingTeamId).playerIds;
  const batters = [inn.strikerId, inn.nonStrikerId].filter(Boolean) as string[];
  const kindLabel = kind === 'wide' ? 'off a wide' : kind === 'noBall' ? 'off a no-ball' : inn.freeHitNext ? 'on a free hit' : '';

  const submit = () => {
    const batter = runOutLike ? outId ?? inn.strikerId! : inn.strikerId!;
    const d: DeliveryPayload = {
      kind,
      batRuns: kind !== 'wide' && runOutLike ? runs : 0,
      byes: 0,
      legByes: 0,
      wideRuns: kind === 'wide' && runOutLike ? runs : 0,
      boundary: null,
      wicket: {
        type,
        batterOutId: batter,
        fielderId: NEEDS_FIELDER.includes(type) ? fielder : null,
        end: runOutLike ? end : undefined,
      },
    };
    onSubmit(d);
  };

  return (
    <AppBottomSheet ref={ref} title="Wicket!" subtitle={`How was the batter out${kindLabel ? ` ${kindLabel}` : ''}?`} snapPoints={['88%']} testID="sheet-wicket">
      <View style={styles.wrap}>
        {allowed.map(t => (
          <Chip key={t} label={DISMISSAL_LABELS[t]} selected={type === t} onPress={() => setType(t)} testID={`dismissal-${t}`} />
        ))}
      </View>
      {runOutLike && batters.length > 1 ? (
        <>
          <AppText variant="overline" tone="secondary">
            Who is out?
          </AppText>
          <SegmentedControl value={outId ?? batters[0]} onChange={setOutId} testIDPrefix="out-batter" options={batters.map(b => ({ value: b, label: `${names[b]}${b === inn.strikerId ? ' *' : ''}` }))} />
          <AppText variant="overline" tone="secondary">
            Wicket broken at
          </AppText>
          <SegmentedControl value={end} onChange={setEnd} testIDPrefix="out-end" options={[{ value: 'striker', label: "Striker's end" }, { value: 'nonStriker', label: "Bowler's end" }]} />
        </>
      ) : null}
      {runOutLike ? <Stepper label={kind === 'wide' ? 'Runs completed (wides)' : 'Runs completed'} value={runs} min={0} max={5} onChange={v => setRuns(v ?? 0)} testID="wicket-runs" /> : null}
      {NEEDS_FIELDER.includes(type) ? (
        <>
          <AppText variant="overline" tone="secondary">
            {type === 'caught' ? 'Caught by' : type === 'stumped' ? 'Wicket-keeper' : 'Fielder'} (optional)
          </AppText>
          <View style={styles.wrap}>
            {fielders.map(f => (
              <Chip key={f} label={`${names[f]}${f === inn.currentBowlerId ? ' (bowler)' : ''}`} selected={fielder === f} onPress={() => setFielder(fielder === f ? null : f)} testID={`fielder-${names[f]}`} />
            ))}
          </View>
        </>
      ) : null}
      <Button label={`Confirm ${DISMISSAL_LABELS[type].toLowerCase()}`} variant="danger" size="lg" onPress={submit} testID="wicket-confirm" style={styles.btn} />
    </AppBottomSheet>
  );
});

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  btn: { marginTop: spacing.sm },
});
