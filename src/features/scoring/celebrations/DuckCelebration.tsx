import React, { useEffect } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  ZoomIn,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Ellipse, G, Path } from 'react-native-svg';
import { AppText } from '../../../components/AppText';
import { Icon } from '../../../components/Icon';
import type { Dismissal } from '../../../core/engine/types';
import { dismissalText } from '../../../services/exporters';
import { fonts, radius, spacing, useTheme, withAlpha } from '../../../theme';
import { useAutoDone } from './useAutoDone';

const AnimatedG = Animated.createAnimatedComponent(G);

/** Original duck illustration with legs that step while it walks. */
function Duck({ size = 92 }: { size?: number }) {
  const step = useSharedValue(0);
  useEffect(() => {
    step.value = withRepeat(withSequence(withTiming(1, { duration: 180 }), withTiming(-1, { duration: 180 })), -1, true);
  }, [step]);
  const leftLeg = useAnimatedProps(() => ({ transform: [{ rotate: `${step.value * 22}deg` }] }) as never);
  const rightLeg = useAnimatedProps(() => ({ transform: [{ rotate: `${-step.value * 22}deg` }] }) as never);
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <AnimatedG animatedProps={leftLeg} origin="44, 74">
        <Path d="M44 74 L42 90 L34 92" stroke="#FF8C42" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </AnimatedG>
      <AnimatedG animatedProps={rightLeg} origin="56, 74">
        <Path d="M56 74 L58 90 L50 92" stroke="#FF6B00" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </AnimatedG>
      <Ellipse cx="50" cy="60" rx="30" ry="20" fill="#FDE68A" />
      <Path d="M30 54 Q18 44 22 62 Q28 68 36 64 Z" fill="#FBBF24" />
      <Path d="M44 54 Q54 46 66 54 Q58 66 44 62 Z" fill="#FCD34D" />
      <Circle cx="70" cy="36" r="15" fill="#FDE68A" />
      <Path d="M82 34 L96 38 L83 43 Z" fill="#FF6B00" />
      <Circle cx="73" cy="32" r="3" fill="#0B1120" />
      <Circle cx="74" cy="31" r="1" fill="#FFFFFF" />
      {/* a small tear for the dismissed batter */}
      <Path d="M76 40 Q78 45 76 47 Q74 45 76 40 Z" fill="#38BDF8" opacity={0.85} />
    </Svg>
  );
}

export function DuckCelebration({ name, balls, golden, dismissal, names, delay = 0, onDone }: { name: string; balls: number; golden: boolean; dismissal: Dismissal; names: Record<string, string>; delay?: number; onDone: () => void }) {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const x = useSharedValue(-120);
  const bob = useSharedValue(0);
  useAutoDone(delay + 3400, onDone);
  useEffect(() => {
    x.value = withDelay(delay, withTiming(width + 120, { duration: 3000, easing: Easing.linear }));
    bob.value = withRepeat(withSequence(withTiming(-5, { duration: 180 }), withTiming(0, { duration: 180 })), -1);
  }, [delay, width, x, bob]);
  const walk = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }, { translateY: bob.value }] }));
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Animated.View style={[styles.walker, walk]}>
        <Duck />
      </Animated.View>
      <View style={styles.center}>
        <Animated.View entering={ZoomIn.delay(delay).springify().damping(13)} exiting={FadeOut.duration(200)} style={[styles.card, { backgroundColor: withAlpha('#0B1120', 0.92), borderColor: withAlpha(colors.danger, 0.6) }]}>
          <View style={styles.row}>
            <Icon name="target" size={16} color={colors.danger} />
            <AppText variant="overline" color={colors.danger}>
              {golden ? 'Golden duck' : 'Out for a duck'}
            </AppText>
          </View>
          <AppText style={styles.word} color="#FFFFFF">
            DUCK
          </AppText>
          <AppText variant="h3" color="#FFFFFF" align="center">
            {name}
          </AppText>
          <Animated.View entering={FadeIn.delay(delay + 300)} style={styles.row}>
            <AppText style={styles.figure} color={colors.primaryBright}>
              0
            </AppText>
            <AppText variant="statSmall" color="#94A3B8">
              ({balls})
            </AppText>
          </Animated.View>
          <AppText variant="caption" color="#CBD5E1" align="center">
            {dismissalText(dismissal, names)}
          </AppText>
        </Animated.View>
      </View>
    </View>
  );
}

export function HatTrickCelebration({ bowler, delay = 0, onDone }: { bowler: string; delay?: number; onDone: () => void }) {
  const { colors } = useTheme();
  useAutoDone(delay + 3000, onDone);
  return (
    <View style={[StyleSheet.absoluteFill, styles.center]} pointerEvents="none">
      <Animated.View entering={ZoomIn.delay(delay).springify().damping(10)} exiting={FadeOut.duration(220)} style={[styles.card, { backgroundColor: withAlpha('#0B1120', 0.92), borderColor: colors.gold }]}>
        <View style={styles.stumps}>
          {[0, 1, 2].map(i => (
            <Animated.View key={i} entering={ZoomIn.delay(delay + 200 + i * 260).springify().damping(9)} style={[styles.stumpIcon, { backgroundColor: withAlpha(colors.gold, 0.18), borderColor: colors.gold }]}>
              <AppText style={styles.stumpNum} color={colors.gold}>
                W
              </AppText>
            </Animated.View>
          ))}
        </View>
        <AppText style={styles.word} color={colors.gold}>
          HAT-TRICK
        </AppText>
        <AppText variant="h3" color="#FFFFFF" align="center">
          {bowler}
        </AppText>
        <AppText variant="caption" color="#CBD5E1">
          Three wickets in three balls
        </AppText>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  walker: { position: 'absolute', bottom: '22%', left: 0 },
  card: { alignItems: 'center', gap: 4, paddingHorizontal: spacing.xl, paddingVertical: spacing.lg, borderRadius: radius.xl, borderWidth: 1.5, minWidth: 240 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  word: { fontFamily: fonts.scoreHeavy, fontSize: 64, lineHeight: 68, letterSpacing: 2 },
  figure: { fontFamily: fonts.scoreHeavy, fontSize: 40, lineHeight: 44 },
  stumps: { flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.xs },
  stumpIcon: { width: 40, height: 40, borderRadius: 12, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  stumpNum: { fontFamily: fonts.scoreHeavy, fontSize: 24 },
});
