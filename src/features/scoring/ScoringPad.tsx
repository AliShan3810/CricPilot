import React from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText } from '../../components/AppText';
import { Gradient } from '../../components/Gradient';
import { Icon, type IconName } from '../../components/Icon';
import { PressableScale } from '../../components/PressableScale';
import { fonts, radius, spacing, useTheme, withAlpha } from '../../theme';

export type PadAction =
  | { type: 'runs'; runs: number }
  | { type: 'wicket' }
  | { type: 'wide' }
  | { type: 'noBall' }
  | { type: 'bye' }
  | { type: 'legBye' }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'more' };

interface Props {
  onAction: (a: PadAction) => void;
  disabled: boolean;
  canUndo: boolean;
  canRedo: boolean;
  legByesAllowed: boolean;
}

type Haptic = 'run' | 'boundary' | 'six' | 'wicket' | 'select';

/**
 * Scoring keypad for one-handed use in sunlight: quick extras on top, boundaries and the
 * wicket in the middle, 0–3 nearest the thumb, then undo / more / redo.
 */
export function ScoringPad({ onAction, disabled, canUndo, canRedo, legByesAllowed }: Props) {
  const { colors } = useTheme();

  const key = (
    label: string,
    action: PadAction,
    o: { testID: string; a11y: string; sub?: string; grad?: [string, string]; bg?: string; fg?: string; haptic?: Haptic; flex?: number; size?: number },
  ) => (
    <PressableScale
      key={o.testID}
      testID={o.testID}
      accessibilityLabel={o.a11y}
      disabled={disabled}
      hapticKind={o.haptic ?? 'run'}
      scaleTo={0.9}
      onPress={() => onAction(action)}
      style={[styles.key, { flex: o.flex ?? 1, backgroundColor: o.bg ?? colors.card, borderColor: o.grad ? withAlpha('#FFFFFF', 0.18) : colors.border }]}>
      {o.grad ? <Gradient colors={o.grad} direction="diagonal" style={styles.keyGrad} /> : null}
      <AppText allowFontScaling={false} style={[styles.keyText, { fontSize: o.size ?? 36 }]} color={o.fg ?? colors.text}>
        {label}
      </AppText>
      {o.sub ? (
        <AppText allowFontScaling={false} style={styles.sub} color={withAlpha(o.fg ?? colors.text, 0.72)}>
          {o.sub}
        </AppText>
      ) : null}
    </PressableScale>
  );

  const extra = (label: string, sub: string, action: PadAction, testID: string, a11y: string) => (
    <PressableScale
      key={testID}
      testID={testID}
      accessibilityLabel={a11y}
      disabled={disabled}
      hapticKind="select"
      scaleTo={0.93}
      onPress={() => onAction(action)}
      style={[styles.extra, { backgroundColor: withAlpha(colors.extra, 0.16), borderColor: withAlpha(colors.extra, 0.55) }]}>
      <AppText allowFontScaling={false} style={styles.extraText} color={colors.extra}>
        {label}
      </AppText>
      <AppText allowFontScaling={false} style={styles.extraSub} color={withAlpha(colors.extra, 0.85)}>
        {sub}
      </AppText>
    </PressableScale>
  );

  const util = (icon: IconName, label: string, action: PadAction, testID: string, enabled: boolean) => (
    <PressableScale
      key={testID}
      testID={testID}
      accessibilityLabel={label}
      disabled={disabled || !enabled}
      hapticKind="select"
      onPress={() => onAction(action)}
      style={[styles.util, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Icon name={icon} size={20} color={colors.text} />
      <AppText variant="label">{label}</AppText>
    </PressableScale>
  );

  return (
    <View style={styles.pad} accessibilityLabel="Scoring keys">
      <View style={styles.row}>
        {extra('WD', 'wide', { type: 'wide' }, 'key-wide', 'Wide')}
        {extra('NB', 'no ball', { type: 'noBall' }, 'key-noball', 'No ball')}
        {extra('B', 'byes', { type: 'bye' }, 'key-bye', 'Byes')}
        {legByesAllowed ? extra('LB', 'leg byes', { type: 'legBye' }, 'key-legbye', 'Leg byes') : null}
      </View>
      <View style={styles.row}>
        {key('4', { type: 'runs', runs: 4 }, { grad: colors.heat, fg: colors.onPrimary, sub: 'FOUR', testID: 'key-4', a11y: 'Four, boundary', haptic: 'boundary' })}
        {key('6', { type: 'runs', runs: 6 }, { grad: ['#FDE68A', colors.gold], fg: '#1F1300', sub: 'SIX', testID: 'key-6', a11y: 'Six', haptic: 'six' })}
        {key('5', { type: 'runs', runs: 5 }, { testID: 'key-5', a11y: '5 runs', sub: 'RUNS', size: 30 })}
        {key('OUT', { type: 'wicket' }, { grad: ['#FB7185', colors.danger], fg: '#FFFFFF', sub: 'WICKET', testID: 'key-wicket', a11y: 'Wicket', haptic: 'wicket', size: 28 })}
      </View>
      <View style={styles.row}>
        {key('0', { type: 'runs', runs: 0 }, { bg: colors.surface, sub: 'DOT', testID: 'key-0', a11y: 'Dot ball', haptic: 'select' })}
        {key('1', { type: 'runs', runs: 1 }, { testID: 'key-1', a11y: '1 run' })}
        {key('2', { type: 'runs', runs: 2 }, { testID: 'key-2', a11y: '2 runs' })}
        {key('3', { type: 'runs', runs: 3 }, { testID: 'key-3', a11y: '3 runs' })}
      </View>
      <View style={styles.row}>
        {util('undo', 'Undo', { type: 'undo' }, 'key-undo', canUndo)}
        {util('more', 'More', { type: 'more' }, 'key-more', true)}
        {util('redo', 'Redo', { type: 'redo' }, 'key-redo', canRedo)}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pad: { gap: spacing.xs },
  row: { flexDirection: 'row', gap: spacing.xs },
  key: { height: 70, borderRadius: radius.key, alignItems: 'center', justifyContent: 'center', borderWidth: 1, overflow: 'hidden' },
  keyGrad: { borderRadius: radius.key },
  keyText: { fontFamily: fonts.scoreHeavy, lineHeight: 38 },
  sub: { fontFamily: fonts.headingSemi, fontSize: 9, lineHeight: 11, letterSpacing: 1.2, marginTop: -2 },
  extra: { flex: 1, height: 50, borderRadius: radius.md, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  extraText: { fontFamily: fonts.scoreHeavy, fontSize: 22, lineHeight: 24 },
  extraSub: { fontFamily: fonts.headingSemi, fontSize: 9, lineHeight: 11, letterSpacing: 0.8, textTransform: 'uppercase' },
  util: { flex: 1, height: 48, borderRadius: radius.md, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
});
