import React, { useId } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Defs, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg';

interface Props {
  colors: string[];
  /** 0..1 positions, same length as colors */
  locations?: number[];
  direction?: 'vertical' | 'horizontal' | 'diagonal';
  style?: StyleProp<ViewStyle>;
  radial?: boolean;
}

/**
 * react-native-svg ignores the alpha channel of rgba() stop colours (it would draw them opaque),
 * so translucent stops are split into a solid colour and a stopOpacity.
 */
export function splitStop(c: string): { color: string; opacity: number } {
  const m = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)$/i.exec(c.trim());
  if (m) {
    const hex = (n: string) => Math.max(0, Math.min(255, Number(n))).toString(16).padStart(2, '0');
    return { color: `#${hex(m[1])}${hex(m[2])}${hex(m[3])}`, opacity: m[4] === undefined ? 1 : Number(m[4]) };
  }
  if (/^#[0-9a-f]{8}$/i.test(c)) {
    return { color: c.slice(0, 7), opacity: parseInt(c.slice(7, 9), 16) / 255 };
  }
  return { color: c, opacity: 1 };
}

/** Gradient fill drawn with react-native-svg (no extra native module). */
export function Gradient({ colors, locations, direction = 'vertical', style, radial }: Props) {
  const id = useId().replace(/:/g, '');
  const stops = colors.map((c, i) => {
    const { color, opacity } = splitStop(c);
    return <Stop key={i} offset={locations?.[i] ?? i / Math.max(1, colors.length - 1)} stopColor={color} stopOpacity={opacity} />;
  });
  const coords =
    direction === 'horizontal'
      ? { x1: '0', y1: '0', x2: '1', y2: '0' }
      : direction === 'diagonal'
        ? { x1: '0', y1: '0', x2: '1', y2: '1' }
        : { x1: '0', y1: '0', x2: '0', y2: '1' };
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, style]}>
      <Svg width="100%" height="100%" preserveAspectRatio="none">
        <Defs>
          {radial ? (
            <RadialGradient id={id} cx="50%" cy="40%" r="75%">
              {stops}
            </RadialGradient>
          ) : (
            <LinearGradient id={id} {...coords}>
              {stops}
            </LinearGradient>
          )}
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}
