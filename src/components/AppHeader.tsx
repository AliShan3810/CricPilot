import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HIT, spacing, useTheme } from '../theme';
import { AppText } from './AppText';
import { Icon, type IconName } from './Icon';
import { PressableScale } from './PressableScale';

export interface HeaderAction {
  icon: IconName;
  label: string;
  onPress: () => void;
  testID?: string;
  disabled?: boolean;
}

interface Props {
  title?: string;
  subtitle?: string;
  back?: boolean;
  onBack?: () => void;
  actions?: HeaderAction[];
  transparent?: boolean;
  /** large editorial title for top-level tabs */
  large?: boolean;
}

export function AppHeader({ title, subtitle, back = true, onBack, actions = [], transparent = true, large }: Props) {
  const nav = useNavigation();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  return (
    <View style={[styles.wrap, { paddingTop: insets.top + spacing.xs, backgroundColor: transparent ? 'transparent' : colors.background }]}>
      <View style={styles.row}>
        {back ? <IconButton icon="back" label="Go back" onPress={onBack ?? (() => nav.goBack())} testID="header-back" /> : null}
        {!large ? (
          <View style={styles.titles}>
            {subtitle ? (
              <AppText variant="overline" tone="accent" numberOfLines={1}>
                {subtitle}
              </AppText>
            ) : null}
            {title ? (
              <AppText variant="h2" numberOfLines={1} accessibilityRole="header">
                {title}
              </AppText>
            ) : null}
          </View>
        ) : (
          <View style={styles.titles} />
        )}
        <View style={styles.actions}>
          {actions.map(a => (
            <IconButton key={a.label} {...a} />
          ))}
        </View>
      </View>
      {large ? (
        <View style={styles.large}>
          {subtitle ? (
            <AppText variant="overline" tone="accent" numberOfLines={1}>
              {subtitle}
            </AppText>
          ) : null}
          {title ? (
            <AppText variant="h1" style={styles.largeTitle} numberOfLines={1} accessibilityRole="header">
              {title}
            </AppText>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

export function IconButton({ icon, label, onPress, testID, disabled, color, size = 20, filled }: HeaderAction & { color?: string; size?: number; filled?: boolean }) {
  const { colors } = useTheme();
  return (
    <PressableScale
      testID={testID}
      accessibilityLabel={label}
      onPress={onPress}
      disabled={disabled}
      hitSlop={6}
      style={[styles.iconBtn, { backgroundColor: filled ? colors.primary : colors.glass, borderColor: filled ? colors.primary : colors.border }]}>
      <Icon name={icon} size={size} color={color ?? (filled ? colors.onPrimary : colors.text)} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: spacing.md, paddingBottom: spacing.xs },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: HIT, gap: spacing.sm },
  titles: { flex: 1 },
  actions: { flexDirection: 'row', gap: spacing.xs },
  large: { marginTop: spacing.xs, gap: 2 },
  largeTitle: { fontSize: 36, lineHeight: 40 },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
});
