import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Canvas, Circle, Line, Path, Skia, vec } from '@shopify/react-native-skia';
import { Easing, useSharedValue, withTiming } from 'react-native-reanimated';
import type { WormPoint } from '../../core/engine/analytics';
import { useMotion } from '../../stores/settingsStore';
import { spacing, useTheme } from '../../theme';
import { AppText } from '../AppText';

export interface WormSeries {
  label: string;
  color: string;
  points: WormPoint[];
}

const H = 200;
const PAD_LEFT = 30;
const PAD_BOTTOM = 20;

/** Cumulative runs by over for each innings. Tap anywhere to read the scores at that point. */
export function WormChart({ series, maxOvers }: { series: WormSeries[]; maxOvers?: number | null }) {
  const { colors } = useTheme();
  const m = useMotion();
  const [width, setWidth] = useState(0);
  const [at, setAt] = useState<number | null>(null);
  const end = useSharedValue(m === 'full' ? 0 : 1);
  useEffect(() => {
    if (m === 'full') {
      end.value = 0;
      end.value = withTiming(1, { duration: 1200, easing: Easing.out(Easing.cubic) });
    } else {
      end.value = 1;
    }
  }, [series, m, end]);
  const xMax = Math.max(1, maxOvers ?? 0, ...series.flatMap(s => s.points.map(p => p.over)));
  const yMax = Math.max(10, ...series.flatMap(s => s.points.map(p => p.runs)));
  const plotW = Math.max(1, width - PAD_LEFT - 6);
  const plotH = H - PAD_BOTTOM - 10;
  const X = (o: number) => PAD_LEFT + (o / xMax) * plotW;
  const Y = (r: number) => H - PAD_BOTTOM - (r / yMax) * plotH;
  const paths = useMemo(
    () =>
      series.map(s => {
        const b = Skia.PathBuilder.Make();
        s.points.forEach((p, i) => (i === 0 ? b.moveTo(X(p.over), Y(p.runs)) : b.lineTo(X(p.over), Y(p.runs))));
        return b.detach();
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [series, width, xMax, yMax],
  );
  const step = yMax > 150 ? 50 : yMax > 60 ? 20 : 10;
  const grid: number[] = [];
  for (let v = step; v <= yMax; v += step) {
    grid.push(v);
  }
  const valueAt = (s: WormSeries, over: number) => {
    let last = s.points[0];
    for (const p of s.points) {
      if (p.over <= over) {
        last = p;
      } else {
        break;
      }
    }
    return last?.runs ?? 0;
  };
  return (
    <View onLayout={e => setWidth(e.nativeEvent.layout.width)} accessible accessibilityLabel={`Worm chart. ${series.map(s => `${s.label} ${s.points[s.points.length - 1]?.runs ?? 0} runs`).join(', ')}`}>
      {width > 0 ? (
        <Pressable onPress={e => setAt(Math.max(0, Math.min(xMax, ((e.nativeEvent.locationX - PAD_LEFT) / plotW) * xMax)))}>
          <Canvas style={{ width, height: H }}>
            {grid.map(v => (
              <Line key={v} p1={vec(PAD_LEFT, Y(v))} p2={vec(width, Y(v))} color={colors.border} strokeWidth={1} />
            ))}
            <Line p1={vec(PAD_LEFT, Y(0))} p2={vec(width, Y(0))} color={colors.textMuted} strokeWidth={1} />
            {series.map((s, i) => (
              <Path key={s.label} path={paths[i]} style="stroke" strokeWidth={3} strokeJoin="round" strokeCap="round" color={s.color} start={0} end={end} />
            ))}
            {series.map(s => s.points.filter(p => p.wicket).map((p, k) => <Circle key={`${s.label}-${k}`} cx={X(p.over)} cy={Y(p.runs)} r={4} color={colors.danger} />))}
            {at !== null ? <Line p1={vec(X(at), 6)} p2={vec(X(at), Y(0))} color={colors.textSecondary} strokeWidth={1} /> : null}
          </Canvas>
          {grid.map(v => (
            <AppText key={v} variant="caption" tone="muted" style={[styles.yLabel, { top: Y(v) - 8 }]}>
              {v}
            </AppText>
          ))}
          <AppText variant="caption" tone="muted" style={[styles.xEnd]}>
            {Math.ceil(xMax)} ov
          </AppText>
        </Pressable>
      ) : (
        <View style={{ height: H }} />
      )}
      <View style={styles.legend}>
        {at !== null ? (
          <AppText variant="label">
            After {at.toFixed(1)} ov: {series.map(s => `${s.label} ${valueAt(s, at)}`).join('  ·  ')}
          </AppText>
        ) : (
          series.map(s => (
            <View key={s.label} style={styles.legendItem}>
              <View style={[styles.swatch, { backgroundColor: s.color }]} />
              <AppText variant="caption" tone="secondary">
                {s.label}
              </AppText>
            </View>
          ))
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  yLabel: { position: 'absolute', left: 0, width: 26, textAlign: 'right', fontSize: 10 },
  xEnd: { position: 'absolute', right: 4, bottom: 0, fontSize: 10 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginTop: spacing.xs, minHeight: 20 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  swatch: { width: 12, height: 4, borderRadius: 2 },
});
