import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Canvas, Circle, Group, Line, RoundedRect, vec } from '@shopify/react-native-skia';
import { Easing, useDerivedValue, useSharedValue, withTiming } from 'react-native-reanimated';
import type { ManhattanBar } from '../../core/engine/analytics';
import { useMotion } from '../../stores/settingsStore';
import { spacing, useTheme } from '../../theme';
import { AppText } from '../AppText';

export interface ManhattanSeries {
  label: string;
  color: string;
  bars: ManhattanBar[];
}

const H = 180;
const PAD_BOTTOM = 20;
const PAD_LEFT = 26;

/** Runs per over, side by side for each innings, with wicket markers. Tap a bar for details. */
export function ManhattanChart({ series }: { series: ManhattanSeries[] }) {
  const { colors } = useTheme();
  const m = useMotion();
  const [width, setWidth] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const progress = useSharedValue(m === 'full' ? 0 : 1);
  useEffect(() => {
    if (m === 'full') {
      progress.value = 0;
      progress.value = withTiming(1, { duration: 900, easing: Easing.out(Easing.cubic) });
    } else {
      progress.value = 1;
    }
  }, [series, m, progress]);
  const overs = Math.max(1, ...series.map(s => s.bars.length));
  const maxRuns = Math.max(6, ...series.flatMap(s => s.bars.map(b => b.runs)));
  const plotW = Math.max(0, width - PAD_LEFT);
  const slot = plotW / overs;
  const barW = Math.max(2, (slot * 0.8) / Math.max(1, series.length));
  const plotH = H - PAD_BOTTOM - 8;
  const scale = (r: number) => (r / maxRuns) * plotH;
  const baseY = H - PAD_BOTTOM;
  const transform = useDerivedValue(() => [{ scaleY: progress.value }]);
  const gridLines = useMemo(() => {
    const step = maxRuns > 18 ? 10 : maxRuns > 10 ? 5 : 2;
    const out: number[] = [];
    for (let v = step; v <= maxRuns; v += step) {
      out.push(v);
    }
    return out;
  }, [maxRuns]);

  const a11y = series.map(s => `${s.label}: ${s.bars.map(b => b.runs).join(', ')}`).join('. ');

  return (
    <View onLayout={e => setWidth(e.nativeEvent.layout.width)} accessible accessibilityLabel={`Manhattan chart, runs per over. ${a11y}`}>
      {width > 0 ? (
        <Pressable onPress={e => setSelected(Math.min(overs - 1, Math.max(0, Math.floor((e.nativeEvent.locationX - PAD_LEFT) / slot))))}>
          <Canvas style={{ width, height: H }}>
            {gridLines.map(v => (
              <Line key={v} p1={vec(PAD_LEFT, baseY - scale(v))} p2={vec(width, baseY - scale(v))} color={colors.border} strokeWidth={1} />
            ))}
            <Group transform={transform} origin={vec(0, baseY)}>
              {series.map((s, si) =>
                s.bars.map((b, i) => {
                  const x = PAD_LEFT + i * slot + slot * 0.1 + si * barW;
                  const h = Math.max(1, scale(b.runs));
                  const dim = selected !== null && selected !== i;
                  return <RoundedRect key={`${si}-${i}`} x={x} y={baseY - h} width={barW - 1} height={h} r={Math.min(3, barW / 2)} color={s.color} opacity={dim ? 0.35 : 1} />;
                }),
              )}
            </Group>
            {series.map((s, si) =>
              s.bars.map((b, i) =>
                b.wickets > 0
                  ? Array.from({ length: b.wickets }).map((_, k) => (
                      <Circle key={`w-${si}-${i}-${k}`} cx={PAD_LEFT + i * slot + slot * 0.1 + si * barW + barW / 2} cy={baseY - scale(b.runs) - 6 - k * 8} r={3.5} color={colors.danger} />
                    ))
                  : null,
              ),
            )}
            <Line p1={vec(PAD_LEFT, baseY)} p2={vec(width, baseY)} color={colors.textMuted} strokeWidth={1} />
          </Canvas>
          {gridLines.map(v => (
            <AppText key={v} variant="caption" tone="muted" style={[styles.yLabel, { top: baseY - scale(v) - 8 }]}>
              {v}
            </AppText>
          ))}
          <View style={[styles.xLabels, { left: PAD_LEFT }]}>
            {Array.from({ length: overs }).map((_, i) =>
              overs <= 12 || (i + 1) % 5 === 0 || i === 0 ? (
                <AppText key={i} variant="caption" tone="muted" style={[styles.xLabel, { left: i * slot, width: slot }]}>
                  {i + 1}
                </AppText>
              ) : null,
            )}
          </View>
        </Pressable>
      ) : (
        <View style={{ height: H }} />
      )}
      <View style={styles.legend}>
        {selected !== null ? (
          <AppText variant="label" testID="manhattan-selected">
            Over {selected + 1}: {series.map(s => `${s.label} ${s.bars[selected]?.runs ?? '–'}${s.bars[selected]?.wickets ? ` (${s.bars[selected].wickets}w)` : ''}`).join('  ·  ')}
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
  yLabel: { position: 'absolute', left: 0, width: 22, textAlign: 'right', fontSize: 10 },
  xLabels: { position: 'absolute', right: 0, bottom: 0, height: PAD_BOTTOM },
  xLabel: { position: 'absolute', textAlign: 'center', fontSize: 10 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginTop: spacing.xs, minHeight: 20 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  swatch: { width: 12, height: 12, borderRadius: 3 },
});
