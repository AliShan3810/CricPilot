import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View, type TextStyle, type StyleProp } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useMotion } from '../stores/settingsStore';
import { AppText, type AppTextProps } from './AppText';

interface Props extends Omit<AppTextProps, 'children'> {
  value: number | string;
  style?: StyleProp<TextStyle>;
}

/**
 * Broadcast-style rolling counter: when the value changes, the new value slides up into place.
 * The text node is always mounted (no enter/exit layout animations), so the score can never
 * disappear while heavy celebrations are running.
 */
export function RollingNumber({ value, style, ...text }: Props) {
  const m = useMotion();
  const y = useSharedValue(0);
  const o = useSharedValue(1);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (m === 'off') {
      return;
    }
    if (m === 'full') {
      y.value = 22;
      y.value = withSpring(0, { damping: 18, stiffness: 240 });
    }
    o.value = 0.2;
    o.value = withTiming(1, { duration: m === 'full' ? 180 : 120 });
  }, [value, m, y, o]);
  const anim = useAnimatedStyle(() => ({ opacity: o.value, transform: [{ translateY: y.value }] }));
  return (
    <View style={styles.clip} accessible accessibilityLabel={String(value)} accessibilityLiveRegion="polite">
      <Animated.View style={anim}>
        <AppText {...text} style={style} tabular>
          {value}
        </AppText>
      </Animated.View>
    </View>
  );
}

/** Counts up from the previous value (for dashboard statistics). */
export function CountUp({ value, duration = 700, format = (n: number) => String(Math.round(n)), ...text }: Omit<AppTextProps, 'children'> & { value: number; duration?: number; format?: (n: number) => string }) {
  const m = useMotion();
  const [shown, setShown] = useState(m === 'full' ? 0 : value);
  const from = useRef(m === 'full' ? 0 : value);
  useEffect(() => {
    if (m !== 'full') {
      setShown(value);
      from.current = value;
      return;
    }
    const start = Date.now();
    const a = from.current;
    let raf = 0;
    const tick = () => {
      const t = Math.min(1, (Date.now() - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setShown(a + (value - a) * eased);
      if (t < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        from.current = value;
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration, m]);
  return (
    <AppText {...text} tabular accessibilityLabel={format(value)}>
      {format(shown)}
    </AppText>
  );
}

const styles = StyleSheet.create({ clip: { overflow: 'hidden' } });
