import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { radius, spacing, useTheme } from '../theme';
import { AppText } from './AppText';
import { CountUp } from './AnimatedNumber';

interface Props {
  label: string;
  value: number | string;
  hint?: string;
  accent?: string;
  decimals?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function StatTile({ label, value, hint, accent, decimals = 0, style, testID }: Props) {
  const { colors } = useTheme();
  return (
    <View testID={testID} style={[styles.tile, { backgroundColor: colors.surface, borderColor: colors.border }, style]} accessible accessibilityLabel={`${label}: ${value}${hint ? `, ${hint}` : ''}`}>
      {typeof value === 'number' ? (
        <CountUp variant="stat" value={value} format={n => n.toFixed(decimals)} color={accent ?? colors.text} />
      ) : (
        <AppText variant="stat" color={accent ?? colors.text} numberOfLines={1}>
          {value}
        </AppText>
      )}
      <AppText variant="caption" tone="secondary" numberOfLines={1}>
        {label}
      </AppText>
      {hint ? (
        <AppText variant="caption" tone="muted" numberOfLines={1}>
          {hint}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    flex: 1,
    minWidth: 92,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: 2,
  },
});
