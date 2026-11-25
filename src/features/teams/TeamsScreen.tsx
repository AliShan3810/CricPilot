import React, { useMemo, useState } from 'react';
import { FlatList, StyleSheet, TextInput, View } from 'react-native';
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GapSm, GapXs } from '../../components/Separator';
import { AppHeader } from '../../components/AppHeader';
import { AppText } from '../../components/AppText';
import { SegmentedControl } from '../../components/Controls';
import { EmptyState } from '../../components/EmptyState';
import { Icon } from '../../components/Icon';
import { PlayerCard } from '../../components/PlayerCard';
import { PressableScale } from '../../components/PressableScale';
import { ScreenBackground } from '../../components/ScreenBackground';
import { TeamBadge } from '../../components/TeamBadge';
import { useAsync } from '../../hooks/useAsync';
import { playerService, teamService } from '../../services/teamService';
import { fonts, images, radius, spacing, useTheme, withAlpha } from '../../theme';
import { TAB_BAR_SPACE } from '../../app/navigation/TabBar';

export function TeamsScreen() {
  const nav = useNavigation();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const [tab, setTab] = useState<'teams' | 'players'>('teams');
  const [query, setQuery] = useState('');
  const teams = useAsync(() => teamService.list());
  const players = useAsync(() => playerService.list());
  const teamMap = useMemo(() => Object.fromEntries((teams.data ?? []).map(t => [t.id, t])), [teams.data]);
  const q = query.trim().toLowerCase();
  const filteredTeams = (teams.data ?? []).filter(t => !q || t.name.toLowerCase().includes(q) || t.shortName.toLowerCase().includes(q));
  const filteredPlayers = (players.data ?? []).filter(p => !q || p.name.toLowerCase().includes(q));

  return (
    <ScreenBackground source={images.teams} dim={0.15}>
      <AppHeader
        title="Teams & Players"
        subtitle="Squad management"
        back={false}
        large
        actions={[
          {
            icon: 'plus',
            label: tab === 'teams' ? 'New team' : 'New player',
            onPress: () => (tab === 'teams' ? nav.navigate('TeamForm') : nav.navigate('PlayerForm')),
            testID: tab === 'teams' ? 'teams-add' : 'players-add',
          },
        ]}
      />
      <View style={styles.controls}>
        <SegmentedControl
          value={tab}
          onChange={setTab}
          testIDPrefix="teams-tab"
          options={[
            { value: 'teams', label: `Teams (${teams.data?.length ?? 0})` },
            { value: 'players', label: `Players (${players.data?.length ?? 0})` },
          ]}
        />
        <View style={[styles.search, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Icon name="search" size={18} color={colors.textMuted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={tab === 'teams' ? 'Search teams' : 'Search players'}
            placeholderTextColor={colors.textMuted}
            style={[styles.searchInput, { color: colors.text }]}
            accessibilityLabel="Search"
            testID="teams-search"
          />
        </View>
      </View>
      {tab === 'teams' ? (
        <FlatList
          data={filteredTeams}
          keyExtractor={t => t.id}
          contentContainerStyle={[styles.list, { paddingBottom: TAB_BAR_SPACE + insets.bottom }]}
          initialNumToRender={12}
          ListEmptyComponent={
            teams.loading ? undefined : q ? (
              <EmptyState kind="search" title="No matches" message={`No team matches “${query}”.`} />
            ) : (
              <EmptyState kind="teams" title="No teams yet" message="Create a team, pick its colours and add its players." action="Create team" onAction={() => nav.navigate('TeamForm')} testID="teams-empty" />
            )
          }
          renderItem={({ item, index }) => (
            <Animated.View entering={FadeInDown.delay(Math.min(index, 8) * 40)} layout={LinearTransition}>
              <PressableScale
                testID={`team-row-${item.name}`}
                onPress={() => nav.navigate('TeamDetail', { teamId: item.id })}
                accessibilityLabel={`${item.name}, ${item.playerCount ?? 0} players`}
                style={[styles.teamCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={[styles.teamGlow, { backgroundColor: withAlpha(item.color, 0.16) }]} />
                <TeamBadge name={item.name} shortName={item.shortName} color={item.color} size={52} />
                <View style={styles.flex}>
                  <AppText variant="h3" numberOfLines={1}>
                    {item.name}
                  </AppText>
                  <AppText variant="caption" tone="secondary" numberOfLines={1}>
                    {item.playerCount ?? 0} players{item.homeGround ? ` · ${item.homeGround}` : ''}
                  </AppText>
                </View>
                <AppText style={styles.short} color={withAlpha(item.color, 0.5)}>
                  {item.shortName}
                </AppText>
                <Icon name="chevronRight" size={18} color={colors.textMuted} />
              </PressableScale>
            </Animated.View>
          )}
          ItemSeparatorComponent={GapSm}
        />
      ) : (
        <FlatList
          data={filteredPlayers}
          keyExtractor={p => p.id}
          contentContainerStyle={[styles.list, { paddingBottom: TAB_BAR_SPACE + insets.bottom }]}
          initialNumToRender={16}
          windowSize={7}
          ListEmptyComponent={
            players.loading ? undefined : q ? (
              <EmptyState kind="search" title="No matches" message={`No player matches “${query}”.`} />
            ) : (
              <EmptyState kind="players" title="No players yet" message="Add players to your squads. You can also add them from a team’s page." action="Add player" onAction={() => nav.navigate('PlayerForm')} />
            )
          }
          renderItem={({ item }) => {
            const team = item.teamId ? teamMap[item.teamId] : undefined;
            return (
              <PlayerCard
                player={item}
                color={team?.color ?? colors.primary}
                subtitle={`${team?.name ?? 'No team'} · ${item.role === 'allRounder' ? 'All-rounder' : item.role === 'wicketKeeper' ? 'Wicket-keeper' : item.role === 'bowler' ? 'Bowler' : 'Batter'}`}
                onPress={() => nav.navigate('PlayerProfile', { playerId: item.id })}
                testID={`player-row-${item.name}`}
              />
            );
          }}
          ItemSeparatorComponent={GapXs}
        />
      )}
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  controls: { paddingHorizontal: spacing.md, gap: spacing.sm, marginBottom: spacing.sm },
  search: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, height: 46, borderRadius: radius.md, borderWidth: 1, paddingHorizontal: spacing.sm },
  searchInput: { flex: 1, fontFamily: fonts.semibold, fontSize: 15 },
  list: { paddingHorizontal: spacing.md, paddingTop: spacing.xs },
  teamCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderRadius: radius.lg, borderWidth: 1, overflow: 'hidden' },
  teamGlow: { position: 'absolute', left: -40, top: -40, width: 140, height: 140, borderRadius: 70 },
  flex: { flex: 1 },
  short: { fontFamily: fonts.scoreHeavy, fontSize: 30 },
});
