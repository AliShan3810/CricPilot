import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useMotion } from '../stores/settingsStore';
import { fonts, motion, spacing, useTheme, withAlpha } from '../theme';
import { AppText } from './AppText';
import { Gradient } from './Gradient';
import { PressableScale } from './PressableScale';
import { TeamBadge } from './TeamBadge';

export interface VersusTeam {
  id?: string;
  name: string;
  shortName: string;
  color: string;
  /** e.g. captain name or score line */
  caption?: string;
}

interface Props {
  a: VersusTeam | null;
  b: VersusTeam | null;
  size?: number;
  onPressA?: () => void;
  onPressB?: () => void;
  /** replays the intro whenever this key changes */
  introKey?: string;
  compact?: boolean;
  placeholder?: string;
}

/**
 * Head-to-head hero: crests slide in from either side, the VS badge springs in with a
 * glow, and each side carries its team colour.
 */
export function TeamVersus({ a, b, size = 112, onPressA, onPressB, introKey, compact, placeholder = 'Choose team' }: Props) {
  const { colors } = useTheme();
  const m = useMotion();
  const left = useSharedValue(m === 'full' ? -160 : 0);
  const right = useSharedValue(m === 'full' ? 160 : 0);
  const vs = useSharedValue(m === 'full' ? 0 : 1);
  const pulse = useSharedValue(0);

  useEffect(() => {
    if (m !== 'full') {
      left.value = 0;
      right.value = 0;
      vs.value = 1;
      return;
    }
    left.value = -160;
    right.value = 160;
    vs.value = 0;
    left.value = withSpring(0, motion.bouncy);
    right.value = withDelay(80, withSpring(0, motion.bouncy));
    vs.value = withDelay(320, withSpring(1, { damping: 9, stiffness: 140 }));
    pulse.value = withDelay(900, withRepeat(withSequence(withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.quad) }), withTiming(0, { duration: 1100 })), -1));
  }, [introKey, m, left, right, vs, pulse]);

  const aStyle = useAnimatedStyle(() => ({ transform: [{ translateX: left.value }], opacity: 1 - Math.min(1, Math.abs(left.value) / 200) }));
  const bStyle = useAnimatedStyle(() => ({ transform: [{ translateX: right.value }], opacity: 1 - Math.min(1, Math.abs(right.value) / 200) }));
  const vsStyle = useAnimatedStyle(() => ({ transform: [{ scale: vs.value }, { rotate: `${(1 - vs.value) * -30}deg` }], opacity: vs.value }));
  const glowStyle = useAnimatedStyle(() => ({ opacity: 0.25 + pulse.value * 0.35, transform: [{ scale: 1 + pulse.value * 0.15 }] }));

  const side = (t: VersusTeam | null, onPress: (() => void) | undefined, style: object, testID: string) => (
    <Animated.View style={[styles.side, style]}>
      <Wrapper onPress={onPress} testID={testID} label={t ? `${t.name}${onPress ? ', tap to change' : ''}` : placeholder}>
        <View style={[styles.crestGlow, { width: size * 1.25, height: size * 1.25, borderRadius: size, backgroundColor: withAlpha(t?.color ?? colors.textMuted, 0.28) }]} />
        {t ? (
          <TeamBadge name={t.name} shortName={t.shortName} color={t.color} size={size} />
        ) : (
          <View style={[styles.empty, { width: size * 0.86, height: size, borderColor: colors.borderStrong }]}>
            <AppText style={{ fontFamily: fonts.headingHeavy, fontSize: size * 0.32 }} tone="muted">
              +
            </AppText>
          </View>
        )}
        <AppText variant={compact ? 'label' : 'h3'} align="center" numberOfLines={2} style={styles.name}>
          {t?.name ?? placeholder}
        </AppText>
        {t?.caption ? (
          <AppText variant="caption" tone="secondary" align="center" numberOfLines={1}>
            {t.caption}
          </AppText>
        ) : null}
      </Wrapper>
    </Animated.View>
  );

  return (
    <View style={styles.row}>
      {side(a, onPressA, aStyle, 'versus-a')}
      <Animated.View style={[styles.vsWrap, vsStyle]} pointerEvents="none">
        <Animated.View style={[styles.vsGlow, { backgroundColor: colors.primary }, glowStyle]} />
        <View style={[styles.vs, { borderColor: withAlpha('#FFFFFF', 0.25) }]}>
          <Gradient colors={colors.heat} direction="diagonal" style={styles.vsGrad} />
          <AppText style={[styles.vsText, { fontSize: compact ? 18 : 24 }]} color={colors.onPrimary}>
            VS
          </AppText>
        </View>
      </Animated.View>
      {side(b, onPressB, bStyle, 'versus-b')}
    </View>
  );
}

/** Diagonal split of two team colours, used behind matchups. */
export function SplitColors({ a, b, opacity = 0.55 }: { a: string; b: string; opacity?: number }) {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Gradient colors={[withAlpha(a, opacity), withAlpha(a, 0), withAlpha(b, 0), withAlpha(b, opacity)]} locations={[0, 0.48, 0.52, 1]} direction="horizontal" />
    </View>
  );
}

/** Tappable side when there is a handler; otherwise a plain view (no dimmed "disabled" look). */
function Wrapper({ onPress, testID, label, children }: { onPress?: () => void; testID: string; label: string; children: React.ReactNode }) {
  if (!onPress) {
    return (
      <View testID={testID} accessible accessibilityLabel={label} style={styles.sideInner}>
        {children}
      </View>
    );
  }
  return (
    <PressableScale onPress={onPress} testID={testID} accessibilityLabel={label} style={styles.sideInner}>
      {children}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.xs },
  side: { flex: 1 },
  sideInner: { alignItems: 'center', gap: 6 },
  crestGlow: { position: 'absolute', top: -14 },
  empty: { borderWidth: 2, borderStyle: 'dashed', borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  name: { marginTop: 4 },
  vsWrap: { alignItems: 'center', justifyContent: 'center', marginTop: -28 },
  vsGlow: { position: 'absolute', width: 76, height: 76, borderRadius: 38 },
  vs: { width: 58, height: 58, borderRadius: 18, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderWidth: 1, transform: [{ rotate: '45deg' }] },
  vsGrad: { borderRadius: 18 },
  vsText: { fontFamily: fonts.headingBlack, transform: [{ rotate: '-45deg' }] },
});
