import React, { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../stores/appStore';
import { radius, spacing, useTheme } from '../theme';
import { AppText } from './AppText';
import { Icon } from './Icon';
import { PressableScale } from './PressableScale';

export function ToastHost() {
  const t = useApp(s => s.toast);
  const hide = useApp(s => s.hideToast);
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  useEffect(() => {
    if (!t) {
      return;
    }
    const timer = setTimeout(hide, t.tone === 'error' ? 4200 : 2600);
    return () => clearTimeout(timer);
  }, [t, hide]);
  if (!t) {
    return null;
  }
  const accent = t.tone === 'error' ? colors.danger : t.tone === 'success' ? colors.success : colors.primary;
  return (
    <Animated.View key={t.id} entering={FadeInUp} exiting={FadeOutUp} style={[styles.wrap, { top: insets.top + spacing.xs }]} pointerEvents="box-none">
      <PressableScale
        onPress={hide}
        hapticKind={null}
        accessibilityRole="alert"
        accessibilityLiveRegion="assertive"
        testID="toast"
        style={[styles.toast, { backgroundColor: colors.card, borderColor: accent }]}>
        <Icon name={t.tone === 'error' ? 'info' : t.tone === 'success' ? 'check' : 'bolt'} size={18} color={accent} />
        <AppText variant="label" style={styles.text}>
          {t.message}
        </AppText>
      </PressableScale>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: spacing.md, right: spacing.md, zIndex: 1000, elevation: 20 },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
  },
  text: { flex: 1 },
});
