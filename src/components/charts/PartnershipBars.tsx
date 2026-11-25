import React from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInRight } from 'react-native-reanimated';
import type { Partnership } from '../../core/engine/types';
import { radius, spacing, useTheme, withAlpha } from '../../theme';
import { AppText } from '../AppText';

const ORD = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th', '10th', '11th'];

/** Each partnership as a bar split by each batter's contribution. */
export function PartnershipBars({ partnerships, names, color }: { partnerships: Partnership[]; names: Record<string, string>; color: string }) {
  const { colors } = useTheme();
  const max = Math.max(10, ...partnerships.map(p => p.runs));
  return (
    <View style={styles.list}>
      {partnerships.map((p, i) => {
        const extras = Math.max(0, p.runs - p.batter1Runs - p.batter2Runs);
        const w = (p.runs / max) * 100;
        return (
          <Animated.View key={i} entering={FadeInRight.delay(i * 40)} style={styles.row} accessible accessibilityLabel={`${ORD[p.wicket - 1] ?? p.wicket} wicket partnership: ${names[p.batter1Id]} and ${p.batter2Id ? names[p.batter2Id] : 'alone'}, ${p.runs} runs off ${p.balls} balls`}>
            <View style={styles.labels}>
              <AppText variant="caption" tone="secondary" style={styles.ord}>
                {ORD[p.wicket - 1] ?? p.wicket}
              </AppText>
              <AppText variant="caption" numberOfLines={1} style={styles.flex}>
                {names[p.batter1Id]} {p.batter1Runs}({p.batter1Balls}){p.batter2Id ? ` · ${names[p.batter2Id]} ${p.batter2Runs}(${p.batter2Balls})` : ''}
              </AppText>
              <AppText variant="label">
                {p.runs}
                <AppText variant="caption" tone="secondary">
                  {' '}
                  ({p.balls}){p.unbroken ? '*' : ''}
                </AppText>
              </AppText>
            </View>
            <View style={[styles.track, { backgroundColor: colors.surface }]}>
              <View style={[styles.fill, { width: `${w}%` }]}>
                <View style={{ flex: Math.max(0.001, p.batter1Runs), backgroundColor: color }} />
                <View style={{ flex: Math.max(0.001, p.batter2Runs), backgroundColor: withAlpha(color, 0.55) }} />
                <View style={{ flex: Math.max(0.001, extras), backgroundColor: colors.extra }} />
              </View>
            </View>
          </Animated.View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.sm },
  row: { gap: 4 },
  labels: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  ord: { width: 34 },
  flex: { flex: 1 },
  track: { height: 10, borderRadius: radius.pill, overflow: 'hidden' },
  fill: { flexDirection: 'row', height: '100%', borderRadius: radius.pill, overflow: 'hidden' },
});
