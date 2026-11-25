import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Ellipse, G, Path, Rect } from 'react-native-svg';
import { spacing, useTheme, withAlpha } from '../theme';
import { AppText } from './AppText';
import { Button } from './Button';

export type EmptyKind = 'teams' | 'players' | 'matches' | 'tournament' | 'stats' | 'search';

interface Props {
  kind: EmptyKind;
  title: string;
  message: string;
  action?: string;
  onAction?: () => void;
  testID?: string;
}

/** Cricket-themed vector illustrations for empty screens. */
function Illustration({ kind }: { kind: EmptyKind }) {
  const { colors } = useTheme();
  const p = colors.primary;
  const g = colors.gold;
  const s = colors.surfaceHigh;
  const t = colors.textMuted;
  const ground = <Ellipse cx="80" cy="128" rx="62" ry="10" fill={withAlpha(p, 0.12)} />;
  switch (kind) {
    case 'teams':
      return (
        <Svg width={160} height={140} viewBox="0 0 160 140">
          {ground}
          {[40, 80, 120].map((x, i) => (
            <G key={x} opacity={i === 1 ? 1 : 0.7}>
              <Circle cx={x} cy={i === 1 ? 46 : 58} r={i === 1 ? 16 : 13} fill={i === 1 ? p : s} />
              <Path d={`M${x - 22} ${i === 1 ? 118 : 120} q0-${i === 1 ? 44 : 36} 22-${i === 1 ? 44 : 36} t22 ${i === 1 ? 44 : 36}`} fill={i === 1 ? withAlpha(p, 0.6) : s} />
            </G>
          ))}
          <Path d="M66 30 l14-10 14 10" stroke={g} strokeWidth={4} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      );
    case 'players':
      return (
        <Svg width={160} height={140} viewBox="0 0 160 140">
          {ground}
          <Circle cx="80" cy="40" r="18" fill={p} />
          <Path d="M50 120 q0-50 30-50 t30 50z" fill={withAlpha(p, 0.55)} />
          <Rect x="108" y="40" width="10" height="64" rx="5" transform="rotate(28 113 72)" fill={g} />
          <Circle cx="48" cy="104" r="8" fill={colors.danger} />
        </Svg>
      );
    case 'matches':
      return (
        <Svg width={160} height={140} viewBox="0 0 160 140">
          {ground}
          {[64, 80, 96].map(x => (
            <Rect key={x} x={x - 4} y="48" width="8" height="74" rx="3" fill={s} />
          ))}
          <Rect x="58" y="42" width="44" height="6" rx="3" fill={g} />
          <Circle cx="122" cy="56" r="11" fill={colors.danger} />
          <Path d="M20 64 q40-34 92-10" stroke={withAlpha(p, 0.7)} strokeWidth={3} strokeDasharray="6 6" fill="none" />
        </Svg>
      );
    case 'tournament':
      return (
        <Svg width={160} height={140} viewBox="0 0 160 140">
          {ground}
          <Path d="M56 30h48v22a24 24 0 01-48 0z" fill={g} />
          <Path d="M56 36H42v6a14 14 0 0014 14M104 36h14v6a14 14 0 01-14 14" stroke={g} strokeWidth={5} fill="none" />
          <Rect x="74" y="76" width="12" height="24" fill={g} />
          <Rect x="58" y="100" width="44" height="14" rx="3" fill={withAlpha(g, 0.7)} />
          <Circle cx="80" cy="44" r="7" fill={withAlpha('#FFFFFF', 0.5)} />
        </Svg>
      );
    case 'stats':
      return (
        <Svg width={160} height={140} viewBox="0 0 160 140">
          {ground}
          {[30, 54, 78, 102, 126].map((x, i) => (
            <Rect key={x} x={x - 9} y={120 - [30, 54, 40, 78, 62][i]} width="18" height={[30, 54, 40, 78, 62][i]} rx="4" fill={i === 3 ? g : withAlpha(p, 0.4 + i * 0.1)} />
          ))}
        </Svg>
      );
    case 'search':
    default:
      return (
        <Svg width={160} height={140} viewBox="0 0 160 140">
          {ground}
          <Circle cx="72" cy="62" r="30" stroke={p} strokeWidth={8} fill="none" />
          <Path d="M94 84l26 26" stroke={p} strokeWidth={10} strokeLinecap="round" />
          <Circle cx="72" cy="62" r="10" fill={t} opacity={0.4} />
        </Svg>
      );
  }
}

export function EmptyState({ kind, title, message, action, onAction, testID }: Props) {
  return (
    <View style={styles.wrap} testID={testID}>
      <Illustration kind={kind} />
      <AppText variant="h2" align="center">
        {title}
      </AppText>
      <AppText variant="body" tone="secondary" align="center" style={styles.msg}>
        {message}
      </AppText>
      {action && onAction ? <Button label={action} onPress={onAction} style={styles.btn} testID={testID ? `${testID}-action` : undefined} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', paddingVertical: spacing.xxl, paddingHorizontal: spacing.xl, gap: spacing.xs },
  msg: { maxWidth: 300 },
  btn: { marginTop: spacing.md, alignSelf: 'stretch' },
});
