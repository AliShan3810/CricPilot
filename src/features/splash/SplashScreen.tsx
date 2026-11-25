import React, { useEffect, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { AppText } from '../../components/AppText';
import { BrandMark } from '../../components/BrandMark';
import { Button } from '../../components/Button';
import { Gradient } from '../../components/Gradient';
import { getDb } from '../../data/db/database';
import { SoundManager } from '../../services/sound/SoundManager';
import { useMotion, useSettings } from '../../stores/settingsStore';
import { BRAND_NAME, BRAND_TAGLINE, ThemeOverride, dark, images, spacing, withAlpha } from '../../theme';
import type { RootScreenProps } from '../../app/navigation/types';

function hideNativeSplash() {
  try {
    require('react-native-bootsplash').default.hide({ fade: true });
  } catch {
    // not available in tests
  }
}

export function SplashScreen(props: RootScreenProps<'Splash'>) {
  return (
    <ThemeOverride mode="dark">
      <SplashInner {...props} />
    </ThemeOverride>
  );
}

function SplashInner({ navigation }: RootScreenProps<'Splash'>) {
  const colors = dark;
  const m = useMotion();
  const onboardingDone = useSettings(s => s.onboardingDone);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  const bgScale = useSharedValue(1.18);
  const bgOpacity = useSharedValue(0);
  const logoScale = useSharedValue(0.4);
  const logoOpacity = useSharedValue(0);
  const glow = useSharedValue(0);

  useEffect(() => {
    hideNativeSplash();
    const quick = m !== 'full';
    bgOpacity.value = withTiming(1, { duration: quick ? 150 : 700 });
    bgScale.value = quick ? 1 : withTiming(1, { duration: 2200, easing: Easing.out(Easing.cubic) });
    logoOpacity.value = withDelay(quick ? 0 : 250, withTiming(1, { duration: quick ? 150 : 500 }));
    logoScale.value = quick ? 1 : withDelay(250, withSpring(1, { damping: 11, stiffness: 120 }));
    glow.value = quick ? 0.6 : withDelay(600, withTiming(1, { duration: 900 }));
  }, [m, bgOpacity, bgScale, logoOpacity, logoScale, glow]);

  useEffect(() => {
    // preload and decode every sound while the splash plays (never blocks start-up)
    SoundManager.init().catch(() => undefined);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const started = Date.now();
    getDb()
      .then(() => {
        const minTime = m === 'full' ? 1900 : m === 'reduced' ? 600 : 0;
        const wait = Math.max(0, minTime - (Date.now() - started));
        setTimeout(() => {
          if (!cancelled) {
            navigation.replace(onboardingDone ? 'Main' : 'Onboarding');
          }
        }, wait);
      })
      .catch(e => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [navigation, onboardingDone, m, attempt]);

  const bgStyle = useAnimatedStyle(() => ({ opacity: bgOpacity.value, transform: [{ scale: bgScale.value }] }));
  const logoStyle = useAnimatedStyle(() => ({ opacity: logoOpacity.value, transform: [{ scale: logoScale.value }] }));
  const glowStyle = useAnimatedStyle(() => ({ opacity: glow.value * 0.55, transform: [{ scale: 0.8 + glow.value * 0.5 }] }));

  return (
    <View style={styles.root} testID="splash">
      <Animated.View style={[StyleSheet.absoluteFill, bgStyle]}>
        <Image source={images.splash} style={styles.fill} resizeMode="cover" />
        <Gradient colors={['rgba(11,17,32,0.25)', 'rgba(11,17,32,0.45)', '#0D1117']} locations={[0, 0.55, 1]} />
      </Animated.View>
      <View style={styles.center}>
        <Animated.View style={[styles.glow, glowStyle]} pointerEvents="none">
          <Gradient radial colors={[withAlpha(colors.primary, 0.55), withAlpha(colors.primary, 0)]} />
        </Animated.View>
        <Animated.View style={logoStyle}>
          <BrandMark size={120} />
        </Animated.View>
        <Animated.View entering={m === 'full' ? FadeIn.delay(700).duration(600) : undefined} style={styles.texts}>
          <AppText variant="h1" style={styles.wordmark} align="center" color="#FFFFFF" accessibilityRole="header">
            {BRAND_NAME}
          </AppText>
          <AppText variant="overline" align="center" color="#FF8C42">
            {BRAND_TAGLINE}
          </AppText>
        </Animated.View>
      </View>
      {error ? (
        <View style={styles.error}>
          <AppText variant="bodyStrong" align="center" color="#F8FAFC">
            The local database could not be opened.
          </AppText>
          <AppText variant="caption" align="center" color="#94A3B8">
            {error}
          </AppText>
          <Button label="Try again" onPress={() => { setError(null); setAttempt(a => a + 1); }} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0D1117' },
  fill: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.lg },
  glow: { position: 'absolute', width: 420, height: 420, top: '50%', marginTop: -330 },
  texts: { alignItems: 'center', gap: spacing.xs },
  wordmark: { fontSize: 44, lineHeight: 48, letterSpacing: -1.2 },
  error: { position: 'absolute', left: spacing.xl, right: spacing.xl, bottom: 80, gap: spacing.sm },
});
