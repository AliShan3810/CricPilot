import React, { useMemo, useRef, useState } from 'react';
import { PanResponder, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { radius, useTheme } from '../theme';
import { Gradient } from './Gradient';

interface Props {
  value: number;
  onChange: (v: number) => void;
  /** called when the finger lifts (e.g. to persist or play a preview) */
  onCommit?: (v: number) => void;
  label: string;
  testID?: string;
}

/** Lightweight 0–1 slider: drag or tap the track; VoiceOver/TalkBack can step it in 10% increments. */
export function Slider({ value, onChange, onCommit, label, testID }: Props) {
  const { colors } = useTheme();
  const [width, setWidth] = useState(1);
  const latest = useRef(value);
  const clamp = (v: number) => Math.max(0, Math.min(1, v));
  const fromX = (x: number) => clamp(x / width);
  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: e => {
          latest.current = fromX(e.nativeEvent.locationX);
          onChange(latest.current);
        },
        onPanResponderMove: e => {
          latest.current = fromX(e.nativeEvent.locationX);
          onChange(latest.current);
        },
        onPanResponderRelease: () => onCommit?.(latest.current),
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [width, onChange, onCommit],
  );
  const step = (d: number) => {
    const v = clamp(Math.round((value + d) * 10) / 10);
    onChange(v);
    onCommit?.(v);
  };
  return (
    <View
      testID={testID}
      onLayout={(e: LayoutChangeEvent) => setWidth(Math.max(1, e.nativeEvent.layout.width))}
      style={styles.hit}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(value * 100), text: `${Math.round(value * 100)}%` }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={e => step(e.nativeEvent.actionName === 'increment' ? 0.1 : -0.1)}
      {...responder.panHandlers}>
      <View style={[styles.track, { backgroundColor: colors.surfaceHigh }]} pointerEvents="none">
        <View style={[styles.fill, { width: `${value * 100}%` }]}>
          <Gradient colors={colors.heat} direction="horizontal" />
        </View>
      </View>
      <View pointerEvents="none" style={[styles.thumb, { left: value * width - 13, backgroundColor: colors.card, borderColor: colors.primary }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  hit: { height: 44, justifyContent: 'center' },
  track: { height: 8, borderRadius: radius.pill, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: radius.pill, overflow: 'hidden' },
  thumb: { position: 'absolute', width: 26, height: 26, borderRadius: 13, borderWidth: 3, top: 9 },
});
