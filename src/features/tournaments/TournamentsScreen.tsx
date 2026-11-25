import React from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GapSm } from '../../components/Separator';
import { AppHeader } from '../../components/AppHeader';
import { AppText } from '../../components/AppText';
import { EmptyState } from '../../components/EmptyState';
import { Gradient } from '../../components/Gradient';
import { Icon } from '../../components/Icon';
import { PressableScale } from '../../components/PressableScale';
import { ScreenBackground } from '../../components/ScreenBackground';
import { TeamBadge } from '../../components/TeamBadge';
import { FORMAT_LABELS } from '../../core/engine/rules';
import { useAsync } from '../../hooks/useAsync';
import { teamService } from '../../services/teamService';
import { tournamentService } from '../../services/tournamentService';
import { images, radius, spacing, useTheme, withAlpha } from '../../theme';
import { TAB_BAR_SPACE } from '../../app/navigation/TabBar';

const FORMAT_NAMES = { league: 'League', knockout: 'Knockout', leagueKnockout: 'League + knockout' } as const;

export function TournamentsScreen() {
  const nav = useNavigation();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const list = useAsync(() => tournamentService.list());
  const teams = useAsync(() => teamService.list());
  const teamMap = Object.fromEntries((teams.data ?? []).map(t => [t.id, t]));
  return (
    <ScreenBackground source={images.trophy} height={420}>
      <AppHeader title="Tournaments" subtitle="Leagues & cups" back={false} large actions={[{ icon: 'plus', label: 'New tournament', onPress: () => nav.navigate('TournamentCreate'), testID: 'tournaments-new' }]} />
      <FlatList
        data={list.data ?? []}
        keyExtractor={t => t.id}
        contentContainerStyle={[styles.list, { paddingBottom: TAB_BAR_SPACE + insets.bottom, paddingTop: 120 }]}
        ItemSeparatorComponent={GapSm}
        ListEmptyComponent={
          list.loading ? undefined : (
            <EmptyState kind="tournament" title="No tournaments yet" message="Create a league or knockout cup. Fixtures, points tables and brackets are generated for you." action="Create tournament" onAction={() => nav.navigate('TournamentCreate')} testID="tournaments-empty" />
          )
        }
        renderItem={({ item, index }) => {
          const champ = item.winnerTeamId ? teamMap[item.winnerTeamId] : null;
          return (
            <Animated.View entering={FadeInDown.delay(index * 60)}>
              <PressableScale onPress={() => nav.navigate('TournamentDetail', { tournamentId: item.id })} testID={`tournament-${item.name}`} accessibilityLabel={`${item.name}, ${FORMAT_NAMES[item.format]}, ${item.status === 'completed' ? 'completed' : 'in progress'}`} style={[styles.card, { borderColor: withAlpha(colors.gold, item.status === 'completed' ? 0.7 : 0.3) }]}>
                <Gradient colors={[withAlpha(colors.gold, 0.22), colors.card, colors.card]} direction="diagonal" />
                <View style={styles.row}>
                  <View style={[styles.icon, { backgroundColor: withAlpha(colors.gold, 0.18) }]}>
                    <Icon name="trophy" size={26} color={colors.gold} />
                  </View>
                  <View style={styles.flex}>
                    <AppText variant="h3" numberOfLines={1}>
                      {item.name}
                    </AppText>
                    <AppText variant="caption" tone="secondary">
                      {FORMAT_NAMES[item.format]} · {FORMAT_LABELS[item.rules.format]}
                      {item.rules.oversPerInnings ? ` · ${item.rules.oversPerInnings} ov` : ''}
                    </AppText>
                  </View>
                  <Icon name="chevronRight" size={18} color={colors.textMuted} />
                </View>
                {champ ? (
                  <View style={styles.champ}>
                    <TeamBadge name={champ.name} shortName={champ.shortName} color={champ.color} size={28} />
                    <AppText variant="label" tone="gold">
                      Champions: {champ.name}
                    </AppText>
                  </View>
                ) : (
                  <AppText variant="caption" tone="accent" style={styles.status}>
                    In progress
                  </AppText>
                )}
              </PressableScale>
            </Animated.View>
          );
        }}
      />
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: spacing.md },
  card: { borderRadius: radius.lg, borderWidth: 1, padding: spacing.md, overflow: 'hidden', gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  icon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
  champ: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  status: { marginLeft: 60 },
});
