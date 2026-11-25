import React from 'react';
import { Text, type TextProps, type TextStyle } from 'react-native';
import { MAX_FONT_SCALE, typography, type TypeVariant, useTheme } from '../theme';

export interface AppTextProps extends TextProps {
  variant?: TypeVariant;
  color?: string;
  tone?: 'primary' | 'secondary' | 'muted' | 'accent' | 'gold' | 'danger' | 'success';
  align?: TextStyle['textAlign'];
  tabular?: boolean;
}

export function AppText({ variant = 'body', color, tone = 'primary', align, tabular, style, ...rest }: AppTextProps) {
  const { colors } = useTheme();
  const toneColor = {
    primary: colors.text,
    secondary: colors.textSecondary,
    muted: colors.textMuted,
    accent: colors.primary,
    gold: colors.gold,
    danger: colors.danger,
    success: colors.success,
  }[tone];
  return (
    <Text
      maxFontSizeMultiplier={MAX_FONT_SCALE}
      {...rest}
      style={[
        typography[variant],
        { color: color ?? toneColor, textAlign: align },
        tabular ? { fontVariant: ['tabular-nums'] } : null,
        style,
      ]}
    />
  );
}
