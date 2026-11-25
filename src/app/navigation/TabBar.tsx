import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '../../components/AppText';
import { Gradient } from '../../components/Gradient';
import { Icon, type IconName } from '../../components/Icon';
import { PressableScale } from '../../components/PressableScale';
import { useMotion } from '../../stores/settingsStore';
import { motion, radius, spacing, useTheme, withAlpha } from '../../theme';

const ICONS: Record<string, IconName> = {
  Home: 'home',
  Matches: 'bat',
  Teams: 'users',
  Tournaments: 'trophy',
};

/**
 * Floating glass tab bar. Two tabs either side of a raised orange Play button;
 * the active tab gets a sliding pill and its label.
 */
export function TabBar({ state, navigation, descriptors }: BottomTabBarProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const m = useMotion();
  const [w, setW] = React.useState(0);
  const slots = state.routes.length + 1; // + the Play button
  const seg = w / slots;
  // computed on the JS thread; the worklet below only receives plain numbers
  const target = (state.index >= 2 ? state.index + 1 : state.index) * seg + 5;
  const instant = m === 'off';
  const pill = useAnimatedStyle(() => ({
    width: seg - 10,
    transform: [{ translateX: instant ? target : withSpring(target, motion.spring) }],
  }));
  const breathe = useSharedValue(0);
  useEffect(() => {
    breathe.value = m === 'full' ? withRepeat(withSequence(withTiming(1, { duration: 1600 }), withTiming(0, { duration: 1600 })), -1) : 0;
  }, [m, breathe]);
  const fabGlow = useAnimatedStyle(() => ({ opacity: 0.35 + breathe.value * 0.3, transform: [{ scale: 1 + breathe.value * 0.08 }] }));

  const tab = (route: (typeof state.routes)[number], i: number) => {
    const focused = state.index === i;
    const label = (descriptors[route.key].options.title ?? route.name) as string;
    return (
      <PressableScale
        key={route.key}
        testID={`tab-${route.name}`}
        accessibilityRole="tab"
        accessibilityState={{ selected: focused }}
        accessibilityLabel={label}
        hapticKind="select"
        onPress={() => {
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) {
            navigation.navigate(route.name as never);
          }
        }}
        style={styles.item}>
        <Icon name={ICONS[route.name] ?? 'home'} size={22} color={focused ? colors.primary : colors.textSecondary} strokeWidth={focused ? 2.4 : 2} />
        <AppText variant="nav" color={focused ? colors.text : colors.textMuted} numberOfLines={1}>
          {label}
        </AppText>
      </PressableScale>
    );
  };

  return (
    <View style={[styles.outer, { paddingBottom: Math.max(insets.bottom, spacing.xs) }]} pointerEvents="box-none">
      <View style={[styles.bar, { backgroundColor: colors.glass, borderColor: colors.border }]} onLayout={e => setW(e.nativeEvent.layout.width)} accessibilityRole="tablist">
        {w > 0 ? <Animated.View style={[styles.pill, { backgroundColor: withAlpha(colors.primary, 0.14), borderColor: withAlpha(colors.primary, 0.35) }, pill]} /> : null}
        {state.routes.slice(0, 2).map((r, i) => tab(r, i))}
        <View style={styles.item} />
        {state.routes.slice(2).map((r, i) => tab(r, i + 2))}
      </View>
      <View style={[styles.fabWrap, { bottom: Math.max(insets.bottom, spacing.xs) + 22 }]} pointerEvents="box-none">
        <Animated.View style={[styles.fabGlow, { backgroundColor: colors.primary }, fabGlow]} pointerEvents="none" />
        <PressableScale
          testID="tab-play"
          accessibilityRole="button"
          accessibilityLabel="Start a new match"
          hapticKind="boundary"
          onPress={() => navigation.getParent()?.navigate('MatchCreate')}
          style={[styles.fab, { borderColor: colors.background }]}>
          <Gradient colors={colors.heat} direction="diagonal" style={styles.fabGrad} />
          <Icon name="play" size={26} color={colors.onPrimary} strokeWidth={2.6} />
        </PressableScale>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: spacing.md },
  bar: {
    flexDirection: 'row',
    height: 66,
    borderRadius: radius.xl,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 12,
  },
  pill: { position: 'absolute', top: 7, bottom: 7, borderRadius: radius.lg, borderWidth: 1 },
  item: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3 },
  fabWrap: { position: 'absolute', alignSelf: 'center', left: 0, right: 0, alignItems: 'center' },
  fabGlow: { position: 'absolute', width: 74, height: 74, borderRadius: 26, top: -4 },
  fab: { width: 66, height: 66, borderRadius: 24, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderWidth: 4, transform: [{ rotate: '0deg' }] },
  fabGrad: { borderRadius: 20 },
});

export const TAB_BAR_SPACE = 110;
