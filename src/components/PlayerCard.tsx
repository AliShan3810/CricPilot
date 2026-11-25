import React from 'react';
import { StyleSheet, View } from 'react-native';
import type { Player } from '../data/models';
import { ROLE_LABELS } from '../data/repositories/playerRepository';
import { fonts, radius, spacing, useTheme, withAlpha } from '../theme';
import { AppText } from './AppText';
import { Icon } from './Icon';
import { PressableScale } from './PressableScale';

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

export function Avatar({ name, color, size = 44, number }: { name: string; color: string; size?: number; number?: number | null }) {
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2, backgroundColor: withAlpha(color, 0.22), borderColor: withAlpha(color, 0.6) }]}>
      <AppText allowFontScaling={false} style={{ fontFamily: fonts.scoreHeavy, fontSize: size * 0.4 }} color={color}>
        {initials(name)}
      </AppText>
      {number !== null && number !== undefined ? (
        <View style={[styles.num, { backgroundColor: color }]}>
          <AppText allowFontScaling={false} style={styles.numText} color="#0B1222">
            {number}
          </AppText>
        </View>
      ) : null}
    </View>
  );
}

interface Props {
  player: Player;
  color: string;
  subtitle?: string;
  right?: React.ReactNode;
  onPress?: () => void;
  testID?: string;
}

export function PlayerCard({ player, color, subtitle, right, onPress, testID }: Props) {
  const { colors } = useTheme();
  return (
    <PressableScale
      testID={testID}
      onPress={onPress}
      disabled={!onPress}
      scaleTo={0.98}
      accessibilityLabel={`${player.name}, ${ROLE_LABELS[player.role]}`}
      style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Avatar name={player.name} color={color} number={player.jerseyNumber} />
      <View style={styles.flex}>
        <AppText variant="bodyStrong" numberOfLines={1}>
          {player.name}
        </AppText>
        <AppText variant="caption" tone="secondary" numberOfLines={1}>
          {subtitle ?? `${ROLE_LABELS[player.role]} · ${player.battingStyle === 'left' ? 'Left' : 'Right'}-hand bat${player.bowlingStyle ? ` · ${player.bowlingStyle}` : ''}`}
        </AppText>
      </View>
      {right ?? (onPress ? <Icon name="chevronRight" size={18} color={colors.textMuted} /> : null)}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  avatar: { alignItems: 'center', justifyContent: 'center', borderWidth: 1.5 },
  num: { position: 'absolute', right: -4, bottom: -4, minWidth: 20, height: 18, borderRadius: 9, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center' },
  numText: { fontFamily: fonts.score, fontSize: 12, lineHeight: 14 },
  card: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm, borderRadius: radius.md, borderWidth: 1 },
  flex: { flex: 1 },
});
