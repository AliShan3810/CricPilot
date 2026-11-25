import React from 'react';
import { confirmAlert } from '../../components/ConfirmDialog';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, useAnimatedScrollHandler, useSharedValue } from 'react-native-reanimated';
import Swipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppHeader } from '../../components/AppHeader';
import { AppText } from '../../components/AppText';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { SectionHeader } from '../../components/Controls';
import { EmptyState } from '../../components/EmptyState';
import { Icon } from '../../components/Icon';
import { MatchCard } from '../../components/MatchCard';
import { PlayerCard } from '../../components/PlayerCard';
import { PressableScale } from '../../components/PressableScale';
import { ScreenBackground } from '../../components/ScreenBackground';
import { StatTile } from '../../components/StatTile';
import { TeamBadge } from '../../components/TeamBadge';
import { useAsync } from '../../hooks/useAsync';
import { playerService, teamService } from '../../services/teamService';
import { errorMessage, toast } from '../../stores/appStore';
import { images, radius, spacing, useTheme, withAlpha } from '../../theme';
import type { RootScreenProps } from '../../app/navigation/types';

export function TeamDetailScreen({ navigation, route }: RootScreenProps<'TeamDetail'>) {
  const { teamId } = route.params;
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { data, loading } = useAsync(() => teamService.detail(teamId), [teamId]);
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler(e => {
    scrollY.value = e.contentOffset.y;
  });

  if (!data) {
    return (
      <ScreenBackground source={images.teams}>
        <AppHeader title={loading ? 'Loading…' : 'Team not found'} />
      </ScreenBackground>
    );
  }
  const { team, players, stats, careers, matches, teams } = data;

  const removePlayer = (id: string, name: string) => {
    confirmAlert(`Remove ${name}?`, 'Players who have played matches are moved out of the team instead of being deleted.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await playerService.remove(id);
            toast(`${name} deleted`, 'success');
          } catch {
            try {
              const p = players.find(x => x.id === id)!;
              await playerService.save({ name: p.name, teamId: null, role: p.role, battingStyle: p.battingStyle, bowlingStyle: p.bowlingStyle, jerseyNumber: p.jerseyNumber }, id);
              toast(`${name} moved out of ${team.name}`, 'success');
            } catch (e2) {
              toast(errorMessage(e2), 'error');
            }
          }
        },
      },
    ]);
  };

  return (
    <ScreenBackground source={images.teams} scrollY={scrollY} height={380}>
      <AppHeader title="" actions={[{ icon: 'edit', label: 'Edit team', onPress: () => navigation.navigate('TeamForm', { teamId }), testID: 'team-edit' }]} />
      <Animated.ScrollView onScroll={onScroll} scrollEventThrottle={16} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxl }]}>
        <View style={styles.hero}>
          <View style={[styles.heroGlow, { backgroundColor: withAlpha(team.color, 0.35) }]} />
          <TeamBadge name={team.name} shortName={team.shortName} color={team.color} size={96} />
          <AppText variant="h1" align="center" testID="team-detail-name">
            {team.name}
          </AppText>
          {team.homeGround ? (
            <View style={styles.row}>
              <Icon name="pin" size={14} color={colors.textSecondary} />
              <AppText variant="caption" tone="secondary">
                {team.homeGround}
              </AppText>
            </View>
          ) : null}
          {stats.form.length ? (
            <View style={styles.row} accessibilityLabel={`Recent form ${stats.form.join(' ')}`}>
              {stats.form.map((f, i) => (
                <View key={i} style={[styles.form, { backgroundColor: f === 'W' ? colors.success : f === 'L' ? colors.danger : colors.surfaceHigh }]}>
                  <AppText variant="caption" color="#FFFFFF">
                    {f}
                  </AppText>
                </View>
              ))}
            </View>
          ) : null}
        </View>

        {team.isTemporary ? (
          <Card featured style={styles.gapSm}>
            <AppText variant="h3">Quick-match team</AppText>
            <AppText variant="caption" tone="secondary">
              This team was created for a single match and is hidden from your team list.
            </AppText>
            <Button
              label="Save as a permanent team"
              onPress={async () => {
                try {
                  await teamService.makePermanent(team.id);
                  toast(`${team.name} saved to your teams`, 'success');
                } catch (e) {
                  toast(errorMessage(e), 'error');
                }
              }}
              testID="team-make-permanent"
            />
          </Card>
        ) : null}
        <View style={styles.tiles}>
          <StatTile label="Played" value={stats.played} />
          <StatTile label="Won" value={stats.won} accent={colors.success} />
          <StatTile label="Lost" value={stats.lost} accent={colors.danger} />
          <StatTile label="Win %" value={stats.winPercent} decimals={0} accent={colors.gold} />
        </View>
        {stats.highest || stats.lowest ? (
          <View style={styles.tiles}>
            <StatTile label="Highest total" value={stats.highest ? `${stats.highest.runs}/${stats.highest.wickets}` : '–'} hint={stats.highest ? `vs ${stats.highest.vs}` : undefined} />
            <StatTile label="Lowest all-out" value={stats.lowest ? `${stats.lowest.runs}` : '–'} hint={stats.lowest ? `vs ${stats.lowest.vs}` : undefined} />
          </View>
        ) : null}

        <SectionHeader title={`Squad · ${players.length}`} action="Add player" onAction={() => navigation.navigate('PlayerForm', { teamId })} testID="team-add-player" />
        {players.length === 0 ? (
          <Card>
            <EmptyState kind="players" title="No players yet" message="Add at least two players to pick this team for a match." action="Add players" onAction={() => navigation.navigate('PlayerForm', { teamId })} />
          </Card>
        ) : (
          <View style={styles.list}>
            {players.map((p, i) => {
              const c = careers[p.id];
              return (
                <Animated.View key={p.id} entering={FadeInDown.delay(Math.min(i, 10) * 30)}>
                  <Swipeable
                    friction={2}
                    rightThreshold={60}
                    renderRightActions={() => (
                      <PressableScale onPress={() => removePlayer(p.id, p.name)} style={[styles.swipeAction, { backgroundColor: colors.danger }]} accessibilityLabel={`Remove ${p.name}`}>
                        <Icon name="trash" color="#FFFFFF" />
                      </PressableScale>
                    )}>
                    <PlayerCard
                      player={p}
                      color={team.color}
                      testID={`team-player-${p.name}`}
                      subtitle={c ? `${c.matches} M · ${c.runs} runs · ${c.wickets} wkts` : undefined}
                      onPress={() => navigation.navigate('PlayerProfile', { playerId: p.id })}
                    />
                  </Swipeable>
                </Animated.View>
              );
            })}
            <AppText variant="caption" tone="muted" align="center">
              Swipe a player left to remove them.
            </AppText>
          </View>
        )}

        {matches.length > 0 ? (
          <>
            <SectionHeader title="Matches" />
            <View style={styles.list}>
              {matches.slice(0, 5).map(m => (
                <MatchCard key={m.id} match={m} teams={teams} onPress={() => navigation.navigate(m.status === 'completed' ? 'Scorecard' : m.status === 'live' ? 'LiveScoring' : 'Toss', { matchId: m.id })} />
              ))}
            </View>
          </>
        ) : null}
        <Button label="Start a match with this team" variant="secondary" onPress={() => navigation.navigate('MatchCreate')} style={styles.cta} />
      </Animated.ScrollView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.md, gap: spacing.sm },
  hero: { alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.md },
  heroGlow: { position: 'absolute', width: 200, height: 200, borderRadius: 100, top: -20 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  form: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  tiles: { flexDirection: 'row', gap: spacing.xs },
  gapSm: { gap: spacing.sm },
  list: { gap: spacing.xs },
  swipeAction: { width: 80, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', marginLeft: spacing.xs },
  cta: { marginTop: spacing.md },
});
