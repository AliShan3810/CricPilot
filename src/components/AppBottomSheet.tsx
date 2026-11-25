import React, {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useRef,
} from 'react';
import { StyleSheet, View } from 'react-native';
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetScrollView,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMotion } from '../stores/settingsStore';
import { ThemeOverride, radius, spacing, useTheme } from '../theme';
import { AppText } from './AppText';

export interface SheetRef {
  present: () => void;
  dismiss: () => void;
}

interface Props {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  onDismiss?: () => void;
  /** e.g. ['55%', '90%'] — defaults to content height */
  snapPoints?: Array<string | number>;
  footer?: React.ReactNode;
  testID?: string;
  /** blocks swipe/backdrop dismissal (used when the scorer must choose, e.g. next batter) */
  required?: boolean;
}

/** Animated bottom sheet used for wickets, extras, bowler/batter selection and corrections. */
export const AppBottomSheet = forwardRef<SheetRef, Props>(
  function AppBottomSheetImpl(
    {
      title,
      subtitle,
      children,
      onDismiss,
      snapPoints,
      footer,
      testID,
      required,
    },
    ref,
  ) {
    const inner = useRef<BottomSheetModal>(null);
    const { colors, isDark } = useTheme();
    const insets = useSafeAreaInsets();
    const m = useMotion();
    useImperativeHandle(ref, () => ({
      present: () => inner.current?.present(),
      dismiss: () => inner.current?.dismiss(),
    }));
    const backdrop = useCallback(
      (p: BottomSheetBackdropProps) => (
        <BottomSheetBackdrop
          {...p}
          appearsOnIndex={0}
          disappearsOnIndex={-1}
          opacity={0.6}
          pressBehavior={required ? 'none' : 'close'}
        />
      ),
      [required],
    );
    return (
      <BottomSheetModal
        ref={inner}
        snapPoints={snapPoints}
        enableDynamicSizing={!snapPoints}
        enablePanDownToClose={!required}
        backdropComponent={backdrop}
        onDismiss={onDismiss}
        animationConfigs={m === 'off' ? { duration: 1 } : undefined}
        backgroundStyle={{
          backgroundColor: colors.card,
          borderRadius: radius.xl,
        }}
        handleIndicatorStyle={{ backgroundColor: colors.textMuted, width: 44 }}
        maxDynamicContentSize={undefined}
      >
        {/* sheet content renders in a portal at the app root: re-provide the screen's theme */}
        <ThemeOverride mode={isDark ? 'dark' : 'light'}>
          <BottomSheetScrollView
            testID={testID}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={[
              styles.content,
              { paddingBottom: insets.bottom + spacing.lg },
            ]}
          >
            <View style={styles.head}>
              <AppText variant="h2" accessibilityRole="header">
                {title}
              </AppText>
              {subtitle ? (
                <AppText variant="body" tone="secondary">
                  {subtitle}
                </AppText>
              ) : null}
            </View>
            {children}
            {footer}
          </BottomSheetScrollView>
        </ThemeOverride>
      </BottomSheetModal>
    );
  },
);

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.lg, gap: spacing.sm },
  head: { marginBottom: spacing.xs, gap: 2 },
});
