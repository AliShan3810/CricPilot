import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Canvas, Circle, Line, Rect, vec } from '@shopify/react-native-skia';
import type { WagonShot } from '../../core/engine/analytics';
import { spacing, useTheme } from '../../theme';
import { AppText } from '../AppText';

/** Shots drawn from the batter's position. Lines are coloured by runs scored. */
export function WagonWheel({ shots, size = 260 }: { shots: WagonShot[]; size?: number }) {
  const { colors } = useTheme();
  const c = size / 2;
  const origin = { x: c, y: c + 20 };
  const colorFor = (s: WagonShot) => (s.boundary === 6 ? colors.gold : s.boundary === 4 ? colors.primary : s.runs >= 2 ? '#22C55E' : '#E2E8F0');
  const totals = { ones: shots.filter(s => s.runs === 1).length, fours: shots.filter(s => s.boundary === 4).length, sixes: shots.filter(s => s.boundary === 6).length };
  return (
    <View style={styles.wrap} accessible accessibilityLabel={`Wagon wheel: ${shots.length} shots recorded, ${totals.fours} fours, ${totals.sixes} sixes`}>
      <Canvas style={{ width: size, height: size }}>
        <Circle cx={c} cy={c} r={c - 2} color="#14532D" />
        <Circle cx={c} cy={c} r={c - 2} color="#E2E8F0" style="stroke" strokeWidth={2} />
        <Circle cx={c} cy={c} r={c * 0.55} color="rgba(255,255,255,0.25)" style="stroke" strokeWidth={1} />
        <Rect x={c - 7} y={c - 26} width={14} height={52} color="#C9A66B" />
        {shots.map((s, i) => {
          const rad = (s.angle * Math.PI) / 180;
          const len = (s.boundary ? 1 : Math.max(0.15, s.distance)) * (c - 6);
          const x = origin.x + Math.sin(rad) * len;
          const y = origin.y - Math.cos(rad) * len;
          return <Line key={i} p1={vec(origin.x, origin.y)} p2={vec(x, y)} color={colorFor(s)} strokeWidth={s.boundary ? 2.5 : 1.6} />;
        })}
        <Circle cx={origin.x} cy={origin.y} r={4} color="#FFFFFF" />
      </Canvas>
      <View style={styles.legend}>
        {[
          ['1–3', '#E2E8F0'],
          ['2+', '#22C55E'],
          ['4', colors.primary],
          ['6', colors.gold],
        ].map(([l, col]) => (
          <View key={l} style={styles.item}>
            <View style={[styles.sw, { backgroundColor: col }]} />
            <AppText variant="caption" tone="secondary">
              {l}
            </AppText>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: spacing.xs },
  legend: { flexDirection: 'row', gap: spacing.md },
  item: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  sw: { width: 12, height: 4, borderRadius: 2 },
});
