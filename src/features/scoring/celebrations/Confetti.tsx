import React, { useEffect, useMemo } from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';
import { Canvas, Group, RoundedRect } from '@shopify/react-native-skia';
import { Easing, useDerivedValue, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';

const COLORS = ['#FF6B00', '#FF8C42', '#FBBF24', '#F8FAFC', '#38BDF8', '#F43F5E'];

interface Piece {
  x: number;
  drift: number;
  delay: number;
  speed: number;
  size: number;
  spin: number;
  color: string;
}

function ConfettiPiece({ p, t, height }: { p: Piece; t: SharedValue<number>; height: number }) {
  const transform = useDerivedValue(() => {
    const local = Math.max(0, Math.min(1, (t.value - p.delay) / p.speed));
    const y = -40 + local * (height + 80);
    const x = p.x + Math.sin(local * 6 + p.drift) * 30;
    return [{ translateX: x }, { translateY: y }, { rotate: local * p.spin }];
  });
  const opacity = useDerivedValue(() => (t.value < p.delay ? 0 : t.value > p.delay + p.speed * 0.9 ? 0.4 : 1));
  return (
    <Group transform={transform} opacity={opacity}>
      <RoundedRect x={-p.size / 2} y={-p.size / 4} width={p.size} height={p.size / 2} r={2} color={p.color} />
    </Group>
  );
}

/** Skia confetti shower; draws nothing interactive (pointerEvents none). */
export function Confetti({ count = 70, duration = 3200, loop = false }: { count?: number; duration?: number; loop?: boolean }) {
  const { width, height } = useWindowDimensions();
  const t = useSharedValue(0);
  const pieces = useMemo<Piece[]>(
    () =>
      Array.from({ length: count }, (_, i) => ({
        x: Math.random() * width,
        drift: Math.random() * Math.PI * 2,
        delay: Math.random() * 0.35,
        speed: 0.5 + Math.random() * 0.45,
        size: 8 + Math.random() * 8,
        spin: (Math.random() - 0.5) * 18,
        color: COLORS[i % COLORS.length],
      })),
    [count, width],
  );
  useEffect(() => {
    const run = () => {
      t.value = 0;
      t.value = withTiming(1, { duration, easing: Easing.linear }, finished => {
        if (finished && loop) {
          t.value = 0;
          t.value = withTiming(1, { duration, easing: Easing.linear });
        }
      });
    };
    run();
  }, [duration, loop, t]);
  return (
    <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
      {pieces.map((p, i) => (
        <ConfettiPiece key={i} p={p} t={t} height={height} />
      ))}
    </Canvas>
  );
}
