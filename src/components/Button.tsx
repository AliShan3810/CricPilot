import React from 'react';
import { ActivityIndicator, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { HIT, fonts, radius, spacing, useTheme, withAlpha } from '../theme';
import { AppText } from './AppText';
import { Gradient } from './Gradient';
import { PressableScale } from './PressableScale';

interface Props {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'gold' | 'glass';
  size?: 'md' | 'lg';
  icon?: React.ReactNode;
  trailing?: React.ReactNode;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  accessibilityHint?: string;
}

/** Orange gradient for the primary action; quieter variants for everything else. */
export function Button({ label, onPress, variant = 'primary', size = 'md', icon, trailing, loading, disabled, style, testID, accessibilityHint }: Props) {
  const { colors } = useTheme();
  const bg = {
    primary: colors.primary,
    secondary: colors.surface,
    ghost: 'transparent',
    danger: colors.danger,
    gold: colors.gold,
    glass: colors.glass,
  }[variant];
  const fg = {
    primary: colors.onPrimary,
    secondary: colors.text,
    ghost: colors.primary,
    danger: colors.onDanger,
    gold: colors.onGold,
    glass: colors.text,
  }[variant];
  const height = size === 'lg' ? 60 : HIT + 2;
  return (
    <PressableScale
      testID={testID}
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!disabled || !!loading, busy: !!loading }}
      onPress={onPress}
      disabled={disabled || loading}
      style={[
        styles.base,
        {
          height,
          backgroundColor: bg,
          borderColor: variant === 'secondary' || variant === 'glass' ? colors.border : 'transparent',
          shadowColor: variant === 'primary' ? colors.primary : '#000',
          shadowOpacity: variant === 'primary' ? 0.45 : 0,
        },
        variant === 'ghost' ? styles.ghost : null,
        style,
      ]}>
      {variant === 'primary' ? <Gradient colors={colors.heat} direction="diagonal" style={styles.grad} /> : null}
      {variant === 'primary' ? <View style={[styles.shine, { backgroundColor: withAlpha('#FFFFFF', 0.18) }]} /> : null}
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <View style={styles.row}>
          {icon}
          <AppText style={[styles.label, { fontSize: size === 'lg' ? 17 : 15 }]} color={fg}>
            {label}
          </AppText>
          {trailing}
        </View>
      )}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 18,
    elevation: 0,
  },
  grad: { borderRadius: radius.md },
  shine: { position: 'absolute', top: 0, left: 0, right: 0, height: '45%' },
  ghost: { paddingHorizontal: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  label: { fontFamily: fonts.extrabold, letterSpacing: 0.2 },
});
