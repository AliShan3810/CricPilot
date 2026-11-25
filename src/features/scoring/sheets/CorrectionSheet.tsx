import React, { forwardRef, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { AppBottomSheet, type SheetRef } from '../../../components/AppBottomSheet';
import { AppText } from '../../../components/AppText';
import { BallChip } from '../../../components/BallChip';
import { Button } from '../../../components/Button';
import { Chip, SegmentedControl, Stepper } from '../../../components/Controls';
import { PressableScale } from '../../../components/PressableScale';
import { squadOf } from '../../../core/engine/engine';
import { DISMISSAL_LABELS } from '../../../core/engine/rules';
import { inningsTitle } from '../../../core/engine/selectors';
import type { BallRecord, DeliveryDismissalType, DeliveryKind, DeliveryPayload, MatchState } from '../../../core/engine/types';
import type { StoredEvent } from '../../../data/models';
import { radius, spacing, useTheme } from '../../../theme';

interface Props {
  state: MatchState;
  events: StoredEvent[];
  names: Record<string, string>;
  onSubmit: (eventId: string, d: DeliveryPayload) => Promise<boolean>;
}

const TYPES: DeliveryDismissalType[] = ['bowled', 'caught', 'lbw', 'runOut', 'stumped', 'hitWicket', 'obstructingField', 'hitBallTwice'];

export const CorrectionSheet = forwardRef<SheetRef, Props>(function CorrectionSheetImpl({ state, events, names, onSubmit }, ref) {
  const { colors } = useTheme();
  const [selected, setSelected] = useState<{ ball: BallRecord; eventId: string } | null>(null);
  const groups = useMemo(
    () =>
      [...state.innings]
        .reverse()
        .map(inn => ({ inn, balls: [...inn.balls].reverse() }))
        .filter(g => g.balls.length > 0),
    [state.innings],
  );
  const bpo = state.setup.rules.ballsPerOver;

  return (
    <AppBottomSheet ref={ref} title={selected ? 'Edit ball' : 'Edit a past ball'} subtitle={selected ? `Over ${selected.ball.over}.${selected.ball.ballInOver} · ${names[selected.ball.bowlerId]} to ${names[selected.ball.strikerId]}` : 'The match is recalculated from this ball onwards.'} snapPoints={['90%']} onDismiss={() => setSelected(null)} testID="sheet-correct">
      {selected ? (
        <DeliveryEditor
          key={selected.eventId}
          state={state}
          ball={selected.ball}
          names={names}
          onCancel={() => setSelected(null)}
          onSave={async d => {
            const ok = await onSubmit(selected.eventId, d);
            if (ok) {
              setSelected(null);
            }
          }}
        />
      ) : (
        groups.map(({ inn, balls }) => (
          <View key={inn.index} style={styles.group}>
            <AppText variant="overline" tone="secondary">
              {inningsTitle(state, inn)}
            </AppText>
            <View style={styles.balls}>
              {balls.map(b => {
                const ev = events[b.eventIndex];
                if (!ev) {
                  return null;
                }
                return (
                  <PressableScale key={ev.id} onPress={() => setSelected({ ball: b, eventId: ev.id })} accessibilityLabel={`Edit over ${b.over}.${b.ballInOver}`} style={[styles.ballCell, { backgroundColor: colors.surface, borderColor: colors.border }]} hapticKind="select" testID={`correct-ball-${inn.index}-${b.eventIndex}`}>
                    <BallChip ball={b} size={30} />
                    <AppText variant="caption" tone="secondary">
                      {b.over}.{b.ballInOver || (b.kind === 'legal' ? bpo : 0)}
                    </AppText>
                  </PressableScale>
                );
              })}
            </View>
          </View>
        ))
      )}
    </AppBottomSheet>
  );
});

function DeliveryEditor({ state, ball, names, onSave, onCancel }: { state: MatchState; ball: BallRecord; names: Record<string, string>; onSave: (d: DeliveryPayload) => void; onCancel: () => void }) {
  const inn = state.innings.find(i => i.balls.includes(ball))!;
  const [kind, setKind] = useState<DeliveryKind>(ball.kind);
  const initialSource = ball.byes > 0 ? 'byes' : ball.legByes > 0 ? 'legByes' : 'bat';
  const [source, setSource] = useState<'bat' | 'byes' | 'legByes'>(initialSource);
  const [runs, setRuns] = useState(ball.kind === 'wide' ? ball.wideRuns : ball.batRuns + ball.byes + ball.legByes);
  const [boundary, setBoundary] = useState(ball.boundary !== null);
  const [hasWicket, setHasWicket] = useState(!!ball.wicket);
  const [wType, setWType] = useState<DeliveryDismissalType>(ball.wicket?.type ?? 'bowled');
  const [outId, setOutId] = useState(ball.wicket?.batterOutId ?? ball.strikerId);
  const [end, setEnd] = useState<'striker' | 'nonStriker'>(ball.wicket?.end ?? 'striker');
  const [fielder, setFielder] = useState<string | null>(ball.wicket?.fielderId ?? null);
  const fielders = squadOf(state, inn.bowlingTeamId).playerIds;
  const batters = [ball.strikerId, ball.nonStrikerId].filter(Boolean) as string[];
  const canBoundary = runs === 4 || (runs === 6 && source === 'bat' && kind !== 'wide');

  const build = (): DeliveryPayload => {
    const b = boundary && canBoundary ? (runs as 4 | 6) : null;
    return {
      kind,
      batRuns: kind !== 'wide' && source === 'bat' ? runs : 0,
      byes: kind !== 'wide' && source === 'byes' ? runs : 0,
      legByes: kind !== 'wide' && source === 'legByes' ? runs : 0,
      wideRuns: kind === 'wide' ? runs : 0,
      boundary: b,
      wicket: hasWicket ? { type: wType, batterOutId: wType === 'runOut' || wType === 'obstructingField' ? outId : ball.strikerId, fielderId: fielder, end: wType === 'runOut' || wType === 'obstructingField' ? end : undefined } : null,
      shot: ball.shot,
    };
  };

  return (
    <View style={styles.editor}>
      <SegmentedControl value={kind} onChange={setKind} testIDPrefix="edit-kind" options={[{ value: 'legal', label: 'Legal' }, { value: 'wide', label: 'Wide' }, { value: 'noBall', label: 'No-ball' }]} />
      {kind !== 'wide' ? (
        <SegmentedControl
          value={source}
          onChange={setSource}
          options={[
            { value: 'bat', label: 'Off the bat' },
            { value: 'byes', label: 'Byes' },
            ...(state.setup.rules.legByesAllowed ? [{ value: 'legByes' as const, label: 'Leg byes' }] : []),
          ]}
        />
      ) : null}
      <Stepper label={kind === 'wide' ? 'Extra runs taken' : 'Runs'} value={runs} min={0} max={7} onChange={v => setRuns(v ?? 0)} testID="edit-runs" />
      {canBoundary ? <Chip label={`Boundary ${runs}`} selected={boundary} onPress={() => setBoundary(!boundary)} /> : null}
      <Chip label={hasWicket ? 'Wicket on this ball' : 'No wicket'} selected={hasWicket} onPress={() => setHasWicket(!hasWicket)} testID="edit-wicket" />
      {hasWicket ? (
        <>
          <View style={styles.wrap}>
            {TYPES.map(t => (
              <Chip key={t} label={DISMISSAL_LABELS[t]} selected={wType === t} onPress={() => setWType(t)} />
            ))}
          </View>
          {wType === 'runOut' || wType === 'obstructingField' ? (
            <>
              <SegmentedControl value={outId} onChange={setOutId} options={batters.map(b => ({ value: b, label: names[b] }))} />
              <SegmentedControl value={end} onChange={setEnd} options={[{ value: 'striker', label: "Striker's end" }, { value: 'nonStriker', label: "Bowler's end" }]} />
            </>
          ) : null}
          {['caught', 'runOut', 'stumped'].includes(wType) ? (
            <View style={styles.wrap}>
              {fielders.map(f => (
                <Chip key={f} label={names[f]} selected={fielder === f} onPress={() => setFielder(fielder === f ? null : f)} />
              ))}
            </View>
          ) : null}
        </>
      ) : null}
      <View style={styles.row}>
        <Button label="Cancel" variant="secondary" onPress={onCancel} style={styles.flex} />
        <Button label="Save correction" onPress={() => onSave(build())} style={styles.flex} testID="edit-save" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: spacing.xs, marginBottom: spacing.sm },
  balls: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  ballCell: { alignItems: 'center', padding: 6, borderRadius: radius.sm, borderWidth: 1, gap: 2, minWidth: 48 },
  editor: { gap: spacing.sm },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  row: { flexDirection: 'row', gap: spacing.sm },
  flex: { flex: 1 },
});
