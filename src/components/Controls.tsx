import React from 'react';
import { StyleSheet, Switch, TextInput, View, type TextInputProps, type StyleProp, type ViewStyle } from 'react-native';
import { BottomSheetTextInput } from '@gorhom/bottom-sheet';
import Animated, { useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { HIT, MAX_FONT_SCALE, fonts, motion, radius, readableOn, spacing, useTheme } from '../theme';
import { haptic } from '../services/haptics';
import { AppText } from './AppText';
import { Icon } from './Icon';
import { PressableScale } from './PressableScale';

/* ---------------- Chip ---------------- */
export function Chip({ label, selected, onPress, color, testID, icon }: { label: string; selected?: boolean; onPress?: () => void; color?: string; testID?: string; icon?: React.ReactNode }) {
  const { colors } = useTheme();
  const c = color ?? colors.primary;
  return (
    <PressableScale
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      accessibilityLabel={label}
      onPress={onPress}
      hapticKind="select"
      style={[
        styles.chip,
        { backgroundColor: selected ? c : colors.surface, borderColor: selected ? c : colors.border },
      ]}>
      {icon}
      <AppText variant="label" color={selected ? (c === colors.primary ? colors.onPrimary : readableOn(c)) : colors.text}>
        {label}
      </AppText>
    </PressableScale>
  );
}

/* ---------------- Segmented control ---------------- */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  testIDPrefix,
}: {
  options: Array<{ value: T; label: string }>;
  value: T;
  onChange: (v: T) => void;
  testIDPrefix?: string;
}) {
  const { colors } = useTheme();
  const [width, setWidth] = React.useState(0);
  const idx = Math.max(0, options.findIndex(o => o.value === value));
  const seg = width / options.length;
  const indicator = useAnimatedStyle(() => ({
    transform: [{ translateX: withSpring(idx * seg, motion.spring) }],
    width: seg,
  }));
  return (
    <View
      accessibilityRole="tablist"
      onLayout={e => setWidth(e.nativeEvent.layout.width - 8)}
      style={[styles.segment, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      {width > 0 ? <Animated.View style={[styles.segIndicator, { backgroundColor: colors.primary, borderColor: colors.primaryBright }, indicator]} /> : null}
      {options.map(o => (
        <PressableScale
          key={o.value}
          testID={testIDPrefix ? `${testIDPrefix}-${o.value}` : undefined}
          accessibilityRole="tab"
          accessibilityState={{ selected: o.value === value }}
          accessibilityLabel={o.label}
          hapticKind="select"
          onPress={() => onChange(o.value)}
          style={styles.segItem}>
          <AppText variant="label" color={o.value === value ? colors.onPrimary : colors.textSecondary} numberOfLines={1}>
            {o.label}
          </AppText>
        </PressableScale>
      ))}
    </View>
  );
}

/* ---------------- Text field ---------------- */
export function FormField({ label, error, style, inSheet, ...props }: TextInputProps & { label: string; error?: string | null; style?: StyleProp<ViewStyle>; inSheet?: boolean }) {
  const { colors } = useTheme();
  // inside bottom sheets the sheet-aware input keeps focus and keyboard in sync
  const Input = inSheet ? BottomSheetTextInput : TextInput;
  return (
    <View style={[styles.field, style]}>
      <AppText variant="caption" tone="secondary">
        {label}
      </AppText>
      <Input
        placeholderTextColor={colors.textMuted}
        maxFontSizeMultiplier={MAX_FONT_SCALE}
        accessibilityLabel={label}
        autoCorrect={false}
        spellCheck={false}
        {...props}
        style={[
          styles.input,
          { color: colors.text, backgroundColor: colors.surface, borderColor: error ? colors.danger : colors.border },
        ]}
      />
      {error ? (
        <AppText variant="caption" tone="danger" accessibilityLiveRegion="polite">
          {error}
        </AppText>
      ) : null}
    </View>
  );
}

/* ---------------- Stepper ---------------- */
export function Stepper({ label, value, onChange, min = 0, max = 99, step = 1, suffix, testID, allowNull, nullLabel }: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  testID?: string;
  allowNull?: boolean;
  nullLabel?: string;
}) {
  const { colors } = useTheme();
  const v = value ?? min;
  return (
    <View style={styles.stepRow}>
      <AppText variant="bodyStrong" style={styles.flex}>
        {label}
      </AppText>
      <View style={[styles.stepper, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <PressableScale
          testID={testID ? `${testID}-minus` : undefined}
          accessibilityLabel={`Decrease ${label}`}
          hapticKind="select"
          disabled={value === null ? true : v <= min && !allowNull}
          onPress={() => (allowNull && v <= min ? onChange(null) : onChange(Math.max(min, v - step)))}
          style={styles.stepBtn}>
          <Icon name="minus" size={18} />
        </PressableScale>
        <AppText variant="statSmall" style={styles.stepValue} accessibilityLabel={`${label}: ${value ?? nullLabel ?? 'none'}`} testID={testID ? `${testID}-value` : undefined}>
          {value === null ? nullLabel ?? '∞' : `${value}${suffix ?? ''}`}
        </AppText>
        <PressableScale
          testID={testID ? `${testID}-plus` : undefined}
          accessibilityLabel={`Increase ${label}`}
          hapticKind="select"
          disabled={value !== null && v >= max}
          onPress={() => onChange(value === null ? min : Math.min(max, v + step))}
          style={styles.stepBtn}>
          <Icon name="plus" size={18} />
        </PressableScale>
      </View>
    </View>
  );
}

/* ---------------- Switch row ---------------- */
export function SwitchRow({ label, description, value, onChange, testID }: { label: string; description?: string; value: boolean; onChange: (v: boolean) => void; testID?: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.stepRow}>
      <View style={styles.flex}>
        <AppText variant="bodyStrong">{label}</AppText>
        {description ? (
          <AppText variant="caption" tone="secondary">
            {description}
          </AppText>
        ) : null}
      </View>
      <Switch
        testID={testID}
        accessibilityLabel={label}
        value={value}
        onValueChange={v => {
          haptic('select');
          onChange(v);
        }}
        trackColor={{ true: colors.primary, false: colors.surfaceHigh }}
        thumbColor="#FFFFFF"
      />
    </View>
  );
}

/* ---------------- Section header ---------------- */
export function SectionHeader({ title, action, onAction, testID }: { title: string; action?: string; onAction?: () => void; testID?: string }) {
  return (
    <View style={styles.section}>
      <AppText variant="h3" accessibilityRole="header">
        {title}
      </AppText>
      {action && onAction ? (
        <PressableScale onPress={onAction} hapticKind="select" testID={testID} accessibilityLabel={action} hitSlop={10}>
          <AppText variant="label" tone="accent">
            {action} →
          </AppText>
        </PressableScale>
      ) : null}
    </View>
  );
}

/* ---------------- Option row (for sheets and lists) ---------------- */
export function OptionRow({ title, subtitle, onPress, selected, right, testID, disabled, left }: { title: string; subtitle?: string; onPress?: () => void; selected?: boolean; right?: React.ReactNode; left?: React.ReactNode; testID?: string; disabled?: boolean }) {
  const { colors } = useTheme();
  return (
    <PressableScale
      testID={testID}
      accessibilityLabel={subtitle ? `${title}, ${subtitle}` : title}
      accessibilityState={{ selected: !!selected, disabled: !!disabled }}
      onPress={onPress}
      disabled={disabled}
      scaleTo={0.98}
      hapticKind="select"
      style={[
        styles.option,
        { backgroundColor: selected ? colors.surfaceHigh : colors.surface, borderColor: selected ? colors.primary : colors.border },
      ]}>
      {left}
      <View style={styles.flex}>
        <AppText variant="bodyStrong" numberOfLines={1}>
          {title}
        </AppText>
        {subtitle ? (
          <AppText variant="caption" tone="secondary" numberOfLines={1}>
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {right ?? (selected ? <Icon name="check" size={20} color={colors.primary} /> : null)}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.sm,
    height: 40,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  segment: { flexDirection: 'row', borderRadius: radius.pill, borderWidth: 1, padding: 4, height: HIT },
  segIndicator: { position: 'absolute', top: 4, bottom: 4, left: 4, borderRadius: radius.pill, borderWidth: 1 },
  segItem: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  field: { gap: 6 },
  input: {
    height: 52,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    fontFamily: fonts.semibold,
    fontSize: 16,
  },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: HIT },
  flex: { flex: 1 },
  stepper: { flexDirection: 'row', alignItems: 'center', borderRadius: radius.md, borderWidth: 1 },
  stepBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  stepValue: { minWidth: 44, textAlign: 'center' },
  section: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.lg, marginBottom: spacing.sm },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 56,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
    borderWidth: 1,
  },
});
