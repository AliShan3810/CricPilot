import React, { useEffect, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  SlideInDown,
  SlideOutDown,
  ZoomIn,
  ZoomOut,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import {
  BlurMask,
  Canvas,
  Circle,
  Path,
  Skia,
} from '@shopify/react-native-skia';
import { AppText } from '../../../components/AppText';
import { useMotion } from '../../../stores/settingsStore';
import { fonts, radius, spacing, useTheme, withAlpha } from '../../../theme';
import type { ScoringEffect } from '../effects';
import { Confetti } from './Confetti';
import { DuckCelebration, HatTrickCelebration } from './DuckCelebration';
import { useAutoDone } from './useAutoDone';

interface Active {
  key: number;
  effect: ScoringEffect;
}

/**
 * Celebration overlay. pointerEvents="none" everywhere: animations never block the
 * scoring keys, and the score has already been saved before they start.
 */
export function CelebrationLayer({
  effects,
  names,
}: {
  effects: { id: number; list: ScoringEffect[] };
  names: Record<string, string>;
}) {
  const m = useMotion();
  const [active, setActive] = useState<Active[]>([]);
  useEffect(() => {
    if (effects.id === 0 || m === 'off') {
      return;
    }
    const shown = effects.list.filter(
      e =>
        e.kind !== 'victory' &&
        e.kind !== 'strikeChange' &&
        e.kind !== 'inningsComplete',
    );
    setActive(shown.map((effect, i) => ({ key: effects.id * 10 + i, effect })));
  }, [effects, m]);
  const remove = (key: number) => setActive(a => a.filter(x => x.key !== key));
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {active.map(({ key, effect }) => {
        const done = () => remove(key);
        switch (effect.kind) {
          case 'four':
            return m === 'full' ? (
              <FourBurst key={key} onDone={done} />
            ) : (
              <Banner key={key} text="FOUR" tone="four" onDone={done} />
            );
          case 'six':
            return m === 'full' ? (
              <SixTrajectory key={key} onDone={done} />
            ) : (
              <Banner key={key} text="SIX" tone="six" onDone={done} />
            );
          case 'wicket':
            return m === 'full' ? (
              <FallingStumps
                key={key}
                name={names[effect.batterId]}
                showWord={
                  !active.some(
                    a =>
                      a.effect.kind === 'duck' || a.effect.kind === 'hatTrick',
                  )
                }
                onDone={done}
              />
            ) : (
              <Banner key={key} text="WICKET" tone="wicket" onDone={done} />
            );
          case 'duck':
            // starts as the falling stumps settle, in time with the duck sting
            return m === 'full' ? (
              <DuckCelebration
                key={key}
                name={names[effect.batterId] ?? ''}
                balls={effect.balls}
                golden={effect.golden}
                dismissal={effect.dismissal}
                names={names}
                delay={900}
                onDone={done}
              />
            ) : (
              <Banner key={key} text="DUCK" tone="wicket" small onDone={done} />
            );
          case 'hatTrick':
            return m === 'full' ? (
              <HatTrickCelebration
                key={key}
                bowler={names[effect.bowlerId] ?? ''}
                delay={700}
                onDone={done}
              />
            ) : (
              <Banner
                key={key}
                text="HAT-TRICK"
                tone="six"
                small
                onDone={done}
              />
            );
          case 'milestone':
            return (
              <Milestone
                key={key}
                runs={effect.runs}
                name={names[effect.batterId] ?? ''}
                onDone={done}
                full={m === 'full'}
              />
            );
          case 'overComplete':
            return (
              <OverBanner
                key={key}
                over={effect.over}
                runs={effect.runs}
                maiden={effect.maiden}
                onDone={done}
              />
            );
          case 'freeHit':
            return (
              <Banner
                key={key}
                text="FREE HIT"
                tone="six"
                small
                onDone={done}
              />
            );
          default:
            return null;
        }
      })}
    </View>
  );
}

function FourBurst({ onDone }: { onDone: () => void }) {
  const { colors } = useTheme();
  useAutoDone(1300, onDone);
  const ring = useSharedValue(0);
  useEffect(() => {
    ring.value = withTiming(1, {
      duration: 900,
      easing: Easing.out(Easing.cubic),
    });
  }, [ring]);
  const ringStyle = useAnimatedStyle(() => ({
    opacity: 1 - ring.value,
    transform: [{ scale: 0.3 + ring.value * 2.4 }],
  }));
  return (
    <View style={styles.center}>
      <Animated.View
        style={[styles.ring, { borderColor: colors.primary }, ringStyle]}
      />
      <Animated.View
        entering={ZoomIn.springify().damping(10)}
        exiting={ZoomOut.duration(180)}
      >
        <AppText
          style={[styles.bigWord, { textShadowColor: colors.primary }]}
          color="#FFFFFF"
        >
          FOUR
        </AppText>
      </Animated.View>
    </View>
  );
}

function SixTrajectory({ onDone }: { onDone: () => void }) {
  const { width, height } = useWindowDimensions();
  useAutoDone(1700, onDone);
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withTiming(1, {
      duration: 1100,
      easing: Easing.out(Easing.quad),
    });
  }, [t]);
  // ball flies from the bottom-left over a high arc and out of the top-right of the screen
  const sx = width * 0.15;
  const sy = height * 0.78;
  const ex = width * 1.05;
  const ey = height * 0.12;
  const peakY = -height * 0.05;
  const point = (k: number) => {
    'worklet';
    const x = sx + (ex - sx) * k;
    const y = (1 - k) * (1 - k) * sy + 2 * (1 - k) * k * peakY + k * k * ey;
    return { x, y };
  };
  const cx = useDerivedValue(() => point(t.value).x);
  const cy = useDerivedValue(() => point(t.value).y);
  const trail = useDerivedValue(() => {
    const p = Skia.PathBuilder.Make();
    const start = Math.max(0, t.value - 0.35);
    const steps = 16;
    for (let i = 0; i <= steps; i++) {
      const k = start + ((t.value - start) * i) / steps;
      const q = point(k);
      if (i === 0) {
        p.moveTo(q.x, q.y);
      } else {
        p.lineTo(q.x, q.y);
      }
    }
    return p.detach();
  });
  return (
    <View style={StyleSheet.absoluteFill}>
      <Canvas style={StyleSheet.absoluteFill}>
        <Path
          path={trail}
          style="stroke"
          strokeWidth={10}
          strokeCap="round"
          color="rgba(255,140,66,0.6)"
        >
          <BlurMask blur={6} style="normal" />
        </Path>
        <Circle cx={cx} cy={cy} r={14} color="#EF4444" />
        <Circle cx={cx} cy={cy} r={22} color="rgba(251,191,36,0.4)">
          <BlurMask blur={10} style="normal" />
        </Circle>
      </Canvas>
      <View style={styles.center}>
        <Animated.View
          entering={ZoomIn.delay(250).springify().damping(8)}
          exiting={ZoomOut.duration(200)}
        >
          <AppText
            style={[styles.bigWord, styles.six, { textShadowColor: '#FF6B00' }]}
            color="#FBBF24"
          >
            SIX!
          </AppText>
        </Animated.View>
      </View>
    </View>
  );
}

function Stump({
  angle,
  delay,
  x,
}: {
  angle: number;
  delay: number;
  x: number;
}) {
  const r = useSharedValue(0);
  useEffect(() => {
    r.value = withDelay(
      delay,
      withSpring(angle, { damping: 6, stiffness: 60 }),
    );
  }, [angle, delay, r]);
  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: x },
      { translateY: 60 },
      { rotate: `${r.value}deg` },
      { translateY: -60 },
    ],
  }));
  return <Animated.View style={[styles.stump, style]} />;
}

function Bail({ dx, delay }: { dx: number; delay: number }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withDelay(
      delay,
      withTiming(1, { duration: 800, easing: Easing.out(Easing.quad) }),
    );
  }, [delay, t]);
  const style = useAnimatedStyle(() => ({
    opacity: 1 - t.value * 0.6,
    transform: [
      { translateX: dx * t.value * 120 },
      { translateY: -64 - Math.sin(t.value * Math.PI) * 90 + t.value * 40 },
      { rotate: `${t.value * 540 * Math.sign(dx)}deg` },
    ],
  }));
  return <Animated.View style={[styles.bail, style]} />;
}

function FallingStumps({
  name,
  onDone,
  showWord = true,
}: {
  name?: string;
  onDone: () => void;
  showWord?: boolean;
}) {
  const { colors } = useTheme();
  useAutoDone(1800, onDone);
  const flash = useSharedValue(0.5);
  useEffect(() => {
    flash.value = withTiming(0, { duration: 700 });
  }, [flash]);
  const flashStyle = useAnimatedStyle(() => ({ opacity: flash.value }));
  return (
    <View style={StyleSheet.absoluteFill}>
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: colors.danger },
          flashStyle,
        ]}
      />
      <View style={styles.center}>
        <View style={styles.stumps}>
          <Stump angle={-38} delay={0} x={-26} />
          <Stump angle={8} delay={60} x={0} />
          <Stump angle={44} delay={30} x={26} />
          <Bail dx={-1} delay={0} />
          <Bail dx={1} delay={20} />
        </View>
        {showWord ? (
          <Animated.View
            entering={SlideInDown.springify().damping(14)}
            exiting={FadeOut}
            style={styles.wicketText}
          >
            <AppText
              style={[styles.bigWord, { textShadowColor: colors.danger }]}
              color="#FFFFFF"
            >
              WICKET
            </AppText>
            {name ? (
              <AppText variant="h3" color="#FFFFFF" align="center">
                {name}
              </AppText>
            ) : null}
          </Animated.View>
        ) : null}
      </View>
    </View>
  );
}

function Milestone({
  runs,
  name,
  onDone,
  full,
}: {
  runs: number;
  name: string;
  onDone: () => void;
  full: boolean;
}) {
  const { colors } = useTheme();
  useAutoDone(2600, onDone);
  const label = runs === 50 ? 'FIFTY' : runs === 100 ? 'CENTURY' : `${runs}`;
  return (
    <View style={StyleSheet.absoluteFill}>
      {full ? <Confetti count={40} duration={2400} /> : null}
      <View style={styles.center}>
        <Animated.View
          entering={full ? ZoomIn.springify().damping(9) : FadeIn}
          exiting={FadeOut}
          style={[
            styles.milestone,
            {
              backgroundColor: withAlpha(colors.background, 0.85),
              borderColor: colors.gold,
            },
          ]}
        >
          <AppText variant="overline" tone="gold">
            Milestone
          </AppText>
          <AppText style={styles.milestoneWord} color={colors.gold}>
            {label}
          </AppText>
          <AppText variant="h3" align="center">
            {name} · {runs}*
          </AppText>
        </Animated.View>
      </View>
    </View>
  );
}

function OverBanner({
  over,
  runs,
  maiden,
  onDone,
}: {
  over: number;
  runs: number;
  maiden: boolean;
  onDone: () => void;
}) {
  const { colors } = useTheme();
  useAutoDone(1800, onDone);
  return (
    <Animated.View
      entering={SlideInDown.springify().damping(16)}
      exiting={SlideOutDown.duration(200)}
      style={[
        styles.overBanner,
        {
          backgroundColor: colors.card,
          borderColor: maiden ? colors.gold : colors.primary,
        },
      ]}
    >
      <AppText variant="overline" tone={maiden ? 'gold' : 'accent'}>
        {maiden ? 'Maiden over' : 'End of over'}
      </AppText>
      <AppText variant="h3">
        Over {over} · {runs} run{runs === 1 ? '' : 's'}
      </AppText>
    </Animated.View>
  );
}

function Banner({
  text,
  tone,
  onDone,
  small,
}: {
  text: string;
  tone: 'four' | 'six' | 'wicket';
  onDone: () => void;
  small?: boolean;
}) {
  const { colors } = useTheme();
  useAutoDone(1100, onDone);
  const c =
    tone === 'four'
      ? colors.primary
      : tone === 'six'
      ? colors.gold
      : colors.danger;
  const pulse = useSharedValue(1);
  useEffect(() => {
    pulse.value = withSequence(
      withTiming(1.06, { duration: 120 }),
      withTiming(1, { duration: 120 }),
    );
  }, [pulse]);
  const style = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));
  return (
    <View style={small ? styles.topBanner : styles.center}>
      <Animated.View
        entering={FadeIn.duration(120)}
        exiting={FadeOut.duration(150)}
        style={[styles.banner, { backgroundColor: c }, style]}
      >
        <AppText
          variant={small ? 'overline' : 'h2'}
          color={
            tone === 'four'
              ? colors.onPrimary
              : tone === 'six'
              ? colors.onGold
              : colors.onDanger
          }
        >
          {text}
        </AppText>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 8,
  },
  bigWord: {
    fontFamily: fonts.scoreHeavy,
    fontSize: 84,
    lineHeight: 92,
    letterSpacing: 2,
    textShadowRadius: 24,
    textShadowOffset: { width: 0, height: 0 },
  },
  six: { fontSize: 110, lineHeight: 120 },
  stumps: {
    width: 120,
    height: 140,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  stump: {
    position: 'absolute',
    bottom: 0,
    width: 10,
    height: 120,
    borderRadius: 5,
    backgroundColor: '#F1DDB0',
  },
  bail: {
    position: 'absolute',
    bottom: 120,
    width: 26,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#FF8C42',
  },
  wicketText: { alignItems: 'center', marginTop: spacing.md },
  milestone: {
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    borderRadius: radius.xl,
    borderWidth: 2,
  },
  milestoneWord: { fontFamily: fonts.scoreHeavy, fontSize: 72, lineHeight: 78 },
  overBanner: {
    position: 'absolute',
    alignSelf: 'center',
    top: '42%',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    alignItems: 'center',
  },
  topBanner: { position: 'absolute', top: 120, alignSelf: 'center' },
  banner: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
  },
});
