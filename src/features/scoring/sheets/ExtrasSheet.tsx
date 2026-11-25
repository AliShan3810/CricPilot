import React, { forwardRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { AppBottomSheet, type SheetRef } from '../../../components/AppBottomSheet';
import { AppText } from '../../../components/AppText';
import { Button } from '../../../components/Button';
import { SegmentedControl } from '../../../components/Controls';
import { PressableScale } from '../../../components/PressableScale';
import type { DeliveryPayload, MatchRules } from '../../../core/engine/types';
import { fonts, radius, spacing, useTheme } from '../../../theme';

export type ExtraKind = 'wide' | 'noBall' | 'bye' | 'legBye';

interface Props {
  kind: ExtraKind;
  rules: MatchRules;
  onSubmit: (d: DeliveryPayload) => void;
  onWicket: (kind: 'wide' | 'noBall') => void;
}

const base: DeliveryPayload = { kind: 'legal', batRuns: 0, byes: 0, legByes: 0, wideRuns: 0, boundary: null, wicket: null };

/** One tap after choosing the extra: pick the runs and the ball is recorded. */
export const ExtrasSheet = forwardRef<SheetRef, Props>(function ExtrasSheetImpl({ kind, rules, onSubmit, onWicket }, ref) {
  const { colors } = useTheme();
  const [nbSource, setNbSource] = useState<'bat' | 'byes' | 'legByes'>('bat');
  const title = { wide: 'Wide', noBall: 'No-ball', bye: 'Byes', legBye: 'Leg byes' }[kind];
  let subtitle = '';
  let options: Array<{ label: string; sub?: string; d: DeliveryPayload; tone?: 'four' | 'six' }> = [];

  if (kind === 'wide') {
    subtitle = `${rules.wideRuns} penalty run${rules.wideRuns === 1 ? '' : 's'} + any runs taken`;
    options = [0, 1, 2, 3].map(r => ({ label: `+${r}`, sub: `${rules.wideRuns + r} total`, d: { ...base, kind: 'wide', wideRuns: r } }));
    options.push({ label: '4', sub: 'boundary', tone: 'four', d: { ...base, kind: 'wide', wideRuns: 4, boundary: 4 } });
  } else if (kind === 'noBall') {
    subtitle = `${rules.noBallRuns} penalty run${rules.noBallRuns === 1 ? '' : 's'} + runs${rules.freeHit ? ' · next ball is a free hit' : ''}`;
    if (nbSource === 'bat') {
      options = [0, 1, 2, 3].map(r => ({ label: `${r}`, sub: 'off bat', d: { ...base, kind: 'noBall', batRuns: r } }));
      options.push({ label: '4', sub: 'four', tone: 'four', d: { ...base, kind: 'noBall', batRuns: 4, boundary: 4 } });
      options.push({ label: '6', sub: 'six', tone: 'six', d: { ...base, kind: 'noBall', batRuns: 6, boundary: 6 } });
      options.push({ label: '5', sub: 'off bat', d: { ...base, kind: 'noBall', batRuns: 5 } });
    } else {
      const key = nbSource === 'byes' ? 'byes' : 'legByes';
      options = [1, 2, 3].map(r => ({ label: `${r}`, sub: nbSource === 'byes' ? 'byes' : 'leg byes', d: { ...base, kind: 'noBall', [key]: r } }));
      options.push({ label: '4', sub: 'boundary', tone: 'four', d: { ...base, kind: 'noBall', [key]: 4, boundary: 4 } });
    }
  } else {
    const key = kind === 'bye' ? 'byes' : 'legByes';
    subtitle = kind === 'bye' ? 'Runs taken without the ball touching the batter' : 'Runs off the batter’s body (not the bat)';
    options = [1, 2, 3].map(r => ({ label: `${r}`, d: { ...base, [key]: r } }));
    options.push({ label: '4', sub: 'boundary', tone: 'four', d: { ...base, [key]: 4, boundary: 4 } });
    options.push({ label: '5', d: { ...base, [key]: 5 } });
  }

  return (
    <AppBottomSheet ref={ref} title={title} subtitle={subtitle} testID={`sheet-${kind}`}>
      {kind === 'noBall' ? (
        <SegmentedControl
          value={nbSource}
          onChange={setNbSource}
          testIDPrefix="nb-source"
          options={[
            { value: 'bat', label: 'Off the bat' },
            { value: 'byes', label: 'Byes' },
            ...(rules.legByesAllowed ? [{ value: 'legByes' as const, label: 'Leg byes' }] : []),
          ]}
        />
      ) : null}
      <View style={styles.grid}>
        {options.map(o => (
          <PressableScale
            key={o.label + (o.sub ?? '')}
            testID={`extra-${kind}-${o.label.replace('+', '')}`}
            accessibilityLabel={`${title} ${o.label} ${o.sub ?? ''}`}
            hapticKind="run"
            onPress={() => onSubmit(o.d)}
            style={[
              styles.opt,
              {
                backgroundColor: o.tone === 'four' ? colors.primary : o.tone === 'six' ? colors.gold : colors.surface,
                borderColor: colors.border,
              },
            ]}>
            <AppText style={styles.optText} color={o.tone === 'four' ? colors.onPrimary : o.tone === 'six' ? colors.onGold : colors.text}>
              {o.label}
            </AppText>
            {o.sub ? (
              <AppText variant="caption" color={o.tone ? (o.tone === 'four' ? colors.onPrimary : colors.onGold) : colors.textSecondary}>
                {o.sub}
              </AppText>
            ) : null}
          </PressableScale>
        ))}
      </View>
      {kind === 'wide' || kind === 'noBall' ? (
        <Button label={kind === 'wide' ? 'Wicket on this wide (stumped / run out)' : 'Run out on this no-ball'} variant="secondary" onPress={() => onWicket(kind)} testID={`extra-${kind}-wicket`} />
      ) : null}
    </AppBottomSheet>
  );
});

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  opt: { width: '31.5%', height: 72, borderRadius: radius.md, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  optText: { fontFamily: fonts.scoreHeavy, fontSize: 30, lineHeight: 34 },
});
