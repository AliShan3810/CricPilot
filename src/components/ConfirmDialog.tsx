import React from 'react';
import { Modal, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';
import { create } from 'zustand';
import { haptic } from '../services/haptics';
import { useMotion } from '../stores/settingsStore';
import { radius, spacing, useTheme, withAlpha } from '../theme';
import { AppText } from './AppText';
import { Button } from './Button';
import { Icon, type IconName } from './Icon';

export interface ConfirmOption {
  label: string;
  /** primary (orange), danger (red) or secondary */
  style?: 'primary' | 'danger' | 'secondary';
  onPress?: () => void;
  testID?: string;
}

interface DialogState {
  open: boolean;
  title: string;
  message?: string;
  icon?: IconName;
  tone?: 'default' | 'danger';
  options: ConfirmOption[];
  show: (d: { title: string; message?: string; icon?: IconName; tone?: 'default' | 'danger'; options: ConfirmOption[] }) => void;
  close: () => void;
}

const useDialog = create<DialogState>(set => ({
  open: false,
  title: '',
  options: [],
  show: d => set({ ...d, open: true }),
  close: () => set({ open: false }),
}));

/**
 * Themed replacement for Alert.alert. The last option is the main action.
 * A "Cancel" option is added automatically unless `cancel: false`.
 */
export function confirm(d: { title: string; message?: string; icon?: IconName; tone?: 'default' | 'danger'; options: ConfirmOption[]; cancel?: boolean }) {
  const options = d.cancel === false ? d.options : [{ label: 'Cancel', style: 'secondary' as const, testID: 'confirm-cancel' }, ...d.options];
  if (d.tone === 'danger') {
    haptic('warning');
  }
  useDialog.getState().show({ ...d, options });
}

export function ConfirmHost() {
  const s = useDialog();
  const { colors } = useTheme();
  const m = useMotion();
  const danger = s.tone === 'danger';
  const accent = danger ? colors.danger : colors.primary;
  return (
    <Modal visible={s.open} transparent animationType="none" onRequestClose={s.close} statusBarTranslucent>
      {s.open ? (
        <Animated.View entering={m === 'off' ? undefined : FadeIn.duration(150)} style={[styles.scrim, { backgroundColor: colors.scrim }]}>
          <Animated.View
            entering={m === 'full' ? ZoomIn.springify().damping(16) : undefined}
            accessibilityViewIsModal
            style={[styles.card, { backgroundColor: colors.card, borderColor: withAlpha(accent, 0.4) }]}
            testID="confirm-dialog">
            <View style={[styles.icon, { backgroundColor: withAlpha(accent, 0.16) }]}>
              <Icon name={s.icon ?? (danger ? 'trash' : 'info')} size={26} color={accent} />
            </View>
            <AppText variant="h2" align="center" accessibilityRole="header">
              {s.title}
            </AppText>
            {s.message ? (
              <AppText variant="body" tone="secondary" align="center">
                {s.message}
              </AppText>
            ) : null}
            <View style={styles.actions}>
              {s.options.map((o, i) => (
                <Button
                  key={`${o.label}-${i}`}
                  label={o.label}
                  testID={o.testID}
                  variant={o.style === 'danger' ? 'danger' : o.style === 'secondary' ? 'secondary' : 'primary'}
                  onPress={() => {
                    s.close();
                    o.onPress?.();
                  }}
                />
              ))}
            </View>
          </Animated.View>
        </Animated.View>
      ) : null}
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, justifyContent: 'center', padding: spacing.xl },
  card: { borderRadius: radius.xl, borderWidth: 1, padding: spacing.xl, gap: spacing.sm, alignItems: 'stretch' },
  icon: { width: 56, height: 56, borderRadius: 20, alignSelf: 'center', alignItems: 'center', justifyContent: 'center', marginBottom: spacing.xs },
  actions: { gap: spacing.xs, marginTop: spacing.sm, flexDirection: 'column-reverse' },
});

/** Drop-in for Alert.alert(title, message, buttons) that renders the themed dialog. */
export function confirmAlert(
  title: string,
  message: string | undefined,
  buttons: Array<{ text?: string; style?: 'default' | 'cancel' | 'destructive'; onPress?: () => void }>,
) {
  const hasCancel = buttons.some(b => b.style === 'cancel');
  const options: ConfirmOption[] = buttons
    .filter(b => b.style !== 'cancel')
    .map(b => ({ label: b.text ?? 'OK', style: b.style === 'destructive' ? 'danger' : 'primary', onPress: b.onPress, testID: `confirm-${(b.text ?? 'ok').toLowerCase().replace(/[^a-z]+/g, '-')}` }));
  confirm({ title, message, tone: buttons.some(b => b.style === 'destructive') ? 'danger' : 'default', options, cancel: hasCancel });
}
