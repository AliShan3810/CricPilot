import React, { useEffect } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming, Easing } from 'react-native-reanimated';
import { useMotion } from '../stores/settingsStore';
import { radius, useTheme } from '../theme';
import { Gradient } from './Gradient';

interface Props {
  /** 0..1 */
  value: number;
  /** optional second marker, e.g. par score */
  marker?: number | null;
  height?: number;
  colors?: [string, string];
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

/** Animated progress track (innings progress, chase progress, win bars). */
export function ProgressBar({ value, marker, height = 8, colors: grad, style, accessibilityLabel }: Props) {
  const { colors } = useTheme();
  const m = useMotion();
  const v = useSharedValue(0);
  useEffect(() => {
    const clamped = Math.max(0, Math.min(1, value));
    v.value = m === 'off' ? clamped : withTiming(clamped, { duration: m === 'full' ? 700 : 200, easing: Easing.out(Easing.cubic) });
  }, [value, m, v]);
  // scaleX from the left edge: reliable on the UI thread and cheaper than animating width
  const fill = useAnimatedStyle(() => ({ transform: [{ scaleX: Math.max(0.0001, v.value) }] }));
  return (
    <View
      style={[styles.track, { height, backgroundColor: colors.surfaceHigh }, style]}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(Math.max(0, Math.min(1, value)) * 100) }}>
      <Animated.View style={[styles.fill, fill]}>
        <Gradient colors={grad ?? colors.heat} direction="horizontal" />
      </Animated.View>
      {marker !== null && marker !== undefined ? <View style={[styles.marker, { left: `${Math.max(0, Math.min(1, marker)) * 100}%`, backgroundColor: colors.text }]} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  track: { borderRadius: radius.pill, overflow: 'hidden', width: '100%' },
  fill: { height: '100%', width: '100%', borderRadius: radius.pill, overflow: 'hidden', transformOrigin: 'left' },
  marker: { position: 'absolute', top: -2, bottom: -2, width: 2 },
});
