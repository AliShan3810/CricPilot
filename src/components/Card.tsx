import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewProps, type ViewStyle } from 'react-native';
import { radius, spacing, useTheme, withAlpha } from '../theme';
import { Gradient } from './Gradient';

interface Props extends ViewProps {
  style?: StyleProp<ViewStyle>;
  /** translucent card for use over photography */
  glass?: boolean;
  /** coloured accent (thin top bar + tinted border) */
  accent?: string;
  /** featured card: warm orange wash and glow */
  featured?: boolean;
  padded?: boolean;
  children?: React.ReactNode;
}

export function Card({ style, glass, accent, featured, padded = true, children, ...rest }: Props) {
  const { colors, isDark } = useTheme();
  const tint = featured ? colors.primary : accent;
  return (
    <View
      {...rest}
      style={[
        styles.card,
        {
          backgroundColor: glass ? colors.glass : colors.card,
          borderColor: tint ? withAlpha(tint, 0.45) : colors.border,
          shadowColor: tint ?? colors.shadow,
          shadowOpacity: isDark ? (tint ? 0.35 : 0.3) : 0.08,
        },
        padded ? styles.padded : null,
        style,
      ]}>
      {featured ? <Gradient colors={[withAlpha(colors.primary, 0.22), withAlpha(colors.primary, 0.0)]} direction="diagonal" /> : null}
      {accent && !featured ? <View style={[styles.accentBar, { backgroundColor: accent }]} /> : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 22,
    elevation: 3,
    overflow: 'hidden',
  },
  padded: { padding: spacing.md },
  accentBar: { position: 'absolute', top: 0, left: 0, width: 4, bottom: 0, opacity: 0.95 },
});
