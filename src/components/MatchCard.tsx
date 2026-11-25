import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { formatOvers } from '../core/engine/engine';
import { FORMAT_LABELS } from '../core/engine/rules';
import type { MatchRecord, Team } from '../data/models';
import { radius, spacing, useTheme, withAlpha } from '../theme';
import { AppText } from './AppText';
import { Card } from './Card';
import { PressableScale } from './PressableScale';
import { TeamBadge } from './TeamBadge';
import { SplitColors } from './TeamVersus';

interface Props {
  match: MatchRecord;
  teams: Record<string, Team>;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
  compact?: boolean;
  testID?: string;
}

function teamScore(match: MatchRecord, teamId: string): string {
  const inns = match.summary?.innings.filter(i => i.teamId === teamId && !i.isSuperOver) ?? [];
  if (inns.length === 0) {
    return '';
  }
  const bpo = match.summary?.ballsPerOver ?? 6;
  return inns
    .map(i => `${i.runs}${i.allOut ? '' : `/${i.wickets}`}${i.declared ? 'd' : ''}${inns.length === 1 ? ` (${formatOvers(i.balls, bpo)})` : ''}`)
    .join(' & ');
}

export function MatchCard({ match, teams, onPress, style, compact, testID }: Props) {
  const { colors } = useTheme();
  const a = teams[match.teamAId];
  const b = teams[match.teamBId];
  const live = match.status === 'live';
  const batting = match.summary?.battingTeamId;
  const statusColor = live ? colors.danger : match.status === 'completed' ? colors.success : colors.primary;
  const statusText = live ? 'LIVE' : match.status === 'completed' ? 'RESULT' : 'UPCOMING';
  const date = new Date(match.completedAt ?? match.scheduledAt ?? match.createdAt);
  return (
    <PressableScale onPress={onPress} testID={testID} accessibilityLabel={`${a?.name ?? 'Team'} versus ${b?.name ?? 'Team'}, ${statusText}. ${match.resultText ?? match.summary?.situation ?? ''}`} style={style}>
      <Card accent={live ? colors.danger : undefined} style={compact ? styles.compact : undefined}>
        {a && b ? <SplitColors a={a.color} b={b.color} opacity={0.16} /> : null}
        <View style={styles.top}>
          <View style={[styles.badge, { backgroundColor: withAlpha(statusColor, 0.16) }]}>
            {live ? <View style={[styles.liveDot, { backgroundColor: colors.danger }]} /> : null}
            <AppText variant="overline" color={statusColor}>
              {statusText}
            </AppText>
          </View>
          <AppText variant="caption" tone="secondary" numberOfLines={1} style={styles.meta}>
            {FORMAT_LABELS[match.format]} · {match.title}
          </AppText>
        </View>
        {[a, b].map(t =>
          t ? (
            <View key={t.id} style={styles.teamRow}>
              <TeamBadge name={t.name} shortName={t.shortName} color={t.color} size={34} />
              <AppText variant="h3" numberOfLines={1} style={styles.teamName}>
                {t.name}
              </AppText>
              {batting === t.id ? <View style={[styles.batDot, { backgroundColor: colors.gold }]} accessibilityLabel="batting" /> : null}
              <AppText variant="stat" color={match.winnerTeamId === t.id ? colors.primary : colors.text}>
                {teamScore(match, t.id)}
              </AppText>
            </View>
          ) : null,
        )}
        <AppText variant="caption" tone={match.status === 'completed' ? 'gold' : 'secondary'} numberOfLines={2} style={styles.result}>
          {match.status === 'scheduled'
            ? `${date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}${match.venue ? ` · ${match.venue}` : ''} · Tap to start`
            : match.resultText ?? match.summary?.situation ?? ''}
        </AppText>
      </Card>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  compact: { minHeight: 168 },
  top: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.sm },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill },
  liveDot: { width: 7, height: 7, borderRadius: 4 },
  meta: { flex: 1 },
  teamRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 4 },
  teamName: { flex: 1 },
  batDot: { width: 8, height: 8, borderRadius: 4 },
  result: { marginTop: spacing.xs },
});
