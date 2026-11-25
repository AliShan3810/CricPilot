import React from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';
import { ballLabel, ballTone } from '../core/engine/selectors';
import type { BallRecord } from '../core/engine/types';
import { useMotion } from '../stores/settingsStore';
import { fonts, readableOn, useTheme } from '../theme';
import { AppText } from './AppText';

export function BallChip({ ball, size = 34, animate }: { ball: BallRecord; size?: number; animate?: boolean }) {
  const { colors } = useTheme();
  const m = useMotion();
  const tone = ballTone(ball);
  const bg = colors.ball[tone];
  const fg = tone === 'dot' || tone === 'run' ? colors.text : readableOn(bg);
  const label = ballLabel(ball);
  return (
    <Animated.View
      entering={animate && m === 'full' ? ZoomIn.springify().damping(14) : undefined}
      style={[styles.chip, { width: size, height: size, borderRadius: size / 2, backgroundColor: bg, borderColor: ball.freeHit ? colors.gold : 'transparent' }]}
      accessible
      accessibilityLabel={describeBall(ball)}>
      <AppText allowFontScaling={false} style={{ fontFamily: fonts.score, fontSize: label.length > 3 ? size * 0.3 : size * 0.44 }} color={fg}>
        {label}
      </AppText>
    </Animated.View>
  );
}

export function describeBall(b: BallRecord): string {
  if (b.wicket) {
    return `Wicket, ${b.wicket.type}`;
  }
  if (b.kind === 'wide') {
    return `Wide, ${b.totalRuns} run${b.totalRuns === 1 ? '' : 's'}`;
  }
  if (b.kind === 'noBall') {
    return `No ball, ${b.totalRuns} run${b.totalRuns === 1 ? '' : 's'}`;
  }
  if (b.byes) {
    return `${b.byes} bye${b.byes === 1 ? '' : 's'}`;
  }
  if (b.legByes) {
    return `${b.legByes} leg bye${b.legByes === 1 ? '' : 's'}`;
  }
  if (b.boundary === 6) {
    return 'Six';
  }
  if (b.boundary === 4) {
    return 'Four';
  }
  return b.batRuns === 0 ? 'Dot ball' : `${b.batRuns} run${b.batRuns === 1 ? '' : 's'}`;
}

/** Empty slots for the rest of the over. */
export function BallSlot({ size = 34 }: { size?: number }) {
  const { colors } = useTheme();
  return <View style={[styles.chip, { width: size, height: size, borderRadius: size / 2, borderColor: colors.border, borderStyle: 'dashed' }]} />;
}

const styles = StyleSheet.create({
  chip: { alignItems: 'center', justifyContent: 'center', borderWidth: 1.5 },
});
