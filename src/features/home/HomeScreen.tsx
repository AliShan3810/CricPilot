import React, { useMemo, useState } from 'react';
import { FlatList, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { FadeInDown, FadeInRight, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue, interpolate } from 'react-native-reanimated';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '../../components/AppText';
import { CountUp, RollingNumber } from '../../components/AnimatedNumber';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Chip, SectionHeader } from '../../components/Controls';
import { EmptyState } from '../../components/EmptyState';
import { Gradient } from '../../components/Gradient';
import { Icon, type IconName } from '../../components/Icon';
import { MatchCard } from '../../components/MatchCard';
import { PhotoCard } from '../../components/PhotoCard';
import { Avatar } from '../../components/PlayerCard';
import { PressableScale } from '../../components/PressableScale';
import { ProgressBar } from '../../components/ProgressBar';
import { ScreenBackground } from '../../components/ScreenBackground';
import { TeamBadge } from '../../components/TeamBadge';
import { SplitColors, TeamVersus } from '../../components/TeamVersus';
import { IconButton } from '../../components/AppHeader';
import { BrandMark } from '../../components/BrandMark';
import { formatOvers } from '../../core/engine/engine';
import type { MatchRecord, Team } from '../../data/models';
import type { CareerStats } from '../../data/repositories/statsRepository';
import { useAsync } from '../../hooks/useAsync';
import { loadDashboard } from '../../services/dashboardService';
import { useSettings } from '../../stores/settingsStore';
import { getLastMatch } from '../../data/storage/preferences';
import { fonts, images, radius, spacing, useTheme, withAlpha } from '../../theme';
import { TAB_BAR_SPACE } from '../../app/navigation/TabBar';

const HERO = 470;

function greeting(): string {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

function inningsLine(m: MatchRecord, teamId: string): string {
  const inns = m.summary?.innings.filter(i => i.teamId === teamId && !i.isSuperOver) ?? [];
  return inns.map(i => `${i.runs}/${i.wickets}`).join(' & ');
}

export function HomeScreen() {
  const nav = useNavigation();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const name = useSettings(s => s.userName);
  const { data, loading } = useAsync(loadDashboard);
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler(e => {
    scrollY.value = e.contentOffset.y;
  });
  const heroFade = useAnimatedStyle(() => ({ opacity: interpolate(scrollY.value, [0, 260], [1, 0.2], 'clamp'), transform: [{ translateY: interpolate(scrollY.value, [0, 300], [0, 60], 'clamp') }] }));
  const lastMatch = getLastMatch();
  const live = data?.live ?? [];
  const featured = live.find(m => m.id === lastMatch) ?? live[0] ?? null;
  const noTeams = !loading && data && data.teamList.length < 2;
  const cardW = Math.min(330, width - 64);

  return (
    <ScreenBackground source={images.homePanorama} scrollY={scrollY} height={HERO + 80} variant="hero">
      <Animated.ScrollView testID="home-scroll" onScroll={onScroll} scrollEventThrottle={16} contentContainerStyle={{ paddingBottom: TAB_BAR_SPACE + insets.bottom }} showsVerticalScrollIndicator={false}>
        {/* Hero */}
        <Animated.View style={[styles.hero, { paddingTop: insets.top + spacing.xs, minHeight: HERO }, heroFade]}>
          <View style={styles.topRow}>
            <BrandMark size={38} />
            <View style={styles.flex} />
            <IconButton icon="chart" label="Leaderboards" onPress={() => nav.navigate('Stats')} testID="home-stats" />
            <IconButton icon="settings" label="Settings" onPress={() => nav.navigate('Settings')} testID="home-settings" />
          </View>
          <View style={styles.heroText}>
            <AppText variant="overline" color={colors.primaryBright}>
              {greeting()}
            </AppText>
            <AppText style={styles.heroTitle} color="#FFFFFF" testID="home-welcome" numberOfLines={2}>
              {name ? `Game on,\n${name}.` : 'Every ball.\nEvery moment.'}
            </AppText>
            <AppText variant="body" color="rgba(255,255,255,0.78)">
              {live.length ? `${live.length} match${live.length === 1 ? '' : 'es'} in progress` : 'Score your next match ball by ball, fully offline.'}
            </AppText>
          </View>
          <View style={styles.heroCtas}>
            <Button label={noTeams ? 'Create your first team' : 'Start match'} size="lg" style={styles.flex} onPress={() => nav.navigate(noTeams ? 'TeamForm' : 'MatchCreate')} testID="home-start-match" icon={<Icon name="play" size={18} color={colors.onPrimary} strokeWidth={2.6} />} />
            <Button label="Quick" variant="glass" size="lg" onPress={() => nav.navigate('MatchCreate')} testID="home-quick-match" icon={<Icon name="bolt" size={18} color={colors.primaryBright} />} />
          </View>
        </Animated.View>

        <View style={styles.body}>
          {/* Featured: live match or head-to-head preview */}
          {featured && data ? (
            <Animated.View entering={FadeInDown.springify().damping(18)}>
              <FeaturedLive match={featured} teams={data.teams} onPress={() => nav.navigate('LiveScoring', { matchId: featured.id })} />
            </Animated.View>
          ) : data && data.upcoming[0] ? (
            <Animated.View entering={FadeInDown.springify().damping(18)}>
              <FeaturedPreview match={data.upcoming[0]} teams={data.teams} onPress={() => nav.navigate('Toss', { matchId: data.upcoming[0].id })} />
            </Animated.View>
          ) : noTeams ? (
            <Card style={styles.overlap}>
              <EmptyState kind="teams" title="Let’s build your squads" message="Create two teams, or jump straight into a quick match with temporary teams." action="Quick match" onAction={() => nav.navigate('MatchCreate')} testID="home-empty" />
            </Card>
          ) : null}

          {/* Asymmetric stats */}
          <SectionHeader title="Your season" action="Leaderboards" onAction={() => nav.navigate('Stats')} />
          <View style={styles.statGrid}>
            <View style={[styles.statBig, { backgroundColor: colors.card, borderColor: withAlpha(colors.primary, 0.35) }]}>
              <Gradient colors={[withAlpha(colors.primary, 0.25), withAlpha(colors.primary, 0)]} direction="diagonal" />
              <Icon name="bat" size={22} color={colors.primary} />
              <CountUp value={data?.totals.matches ?? 0} variant="display" />
              <AppText variant="label" tone="secondary">
                Matches completed
              </AppText>
            </View>
            <View style={styles.statCol}>
              <MiniStat label="Runs" value={data?.totals.runs ?? 0} />
              <View style={styles.statRow}>
                <MiniStat label="Wickets" value={data?.totals.wickets ?? 0} accent={colors.danger} />
                <MiniStat label="Sixes" value={data?.totals.sixes ?? 0} accent={colors.gold} />
              </View>
            </View>
          </View>
          {data && (data.topBatters.length > 0 || data.topBowlers.length > 0) ? <LeaderBars data={data} onOpen={id => nav.navigate('PlayerProfile', { playerId: id })} /> : null}

          {/* Quick actions */}
          <View style={styles.actions}>
            <QuickAction icon="users" label="New team" onPress={() => nav.navigate('TeamForm')} testID="qa-team" />
            <QuickAction icon="user" label="Add player" onPress={() => nav.navigate('PlayerForm')} testID="qa-player" />
            <QuickAction icon="trophy" label="Tournament" onPress={() => nav.navigate('TournamentCreate')} testID="qa-tournament" />
            <QuickAction icon="chart" label="Leaders" onPress={() => nav.navigate('Stats')} testID="qa-stats" />
          </View>
        </View>

        {/* More live matches */}
        {live.length > 1 && data ? (
          <>
            <View style={styles.pad}>
              <SectionHeader title={`Live now · ${live.length}`} action="All" onAction={() => nav.navigate('Main', { screen: 'Matches' })} />
            </View>
            <FlatList
              horizontal
              data={live}
              keyExtractor={m => m.id}
              showsHorizontalScrollIndicator={false}
              snapToInterval={cardW + spacing.sm}
              decelerationRate="fast"
              contentContainerStyle={styles.carousel}
              renderItem={({ item, index }) => (
                <Animated.View entering={FadeInRight.delay(index * 60)} style={{ width: cardW }}>
                  <MatchCard match={item} teams={data.teams} compact onPress={() => nav.navigate('LiveScoring', { matchId: item.id })} testID={`live-card-${index}`} />
                </Animated.View>
              )}
            />
          </>
        ) : null}

        {/* Upcoming fixtures */}
        {data && (data.upcoming.length > 0 || data.fixtures.length > 0) ? (
          <>
            <View style={styles.pad}>
              <SectionHeader title="Upcoming fixtures" />
            </View>
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.carousel}
              data={[
                ...data.upcoming.map(m => ({ key: m.id, a: m.teamAId, b: m.teamBId, label: m.title, sub: m.venue ?? 'Ready for the toss', onPress: () => nav.navigate('Toss', { matchId: m.id }) })),
                ...data.fixtures.map(f => ({ key: f.id, a: f.teamAId, b: f.teamBId, label: f.tournamentName, sub: f.stage === 'league' ? 'League match' : f.stage.replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase()), onPress: () => nav.navigate('MatchCreate', { fixtureId: f.id, tournamentId: f.tournamentId }) })),
              ]}
              keyExtractor={i => i.key}
              renderItem={({ item, index }) => {
                const ta = data.teams[item.a];
                const tb = data.teams[item.b];
                if (!ta || !tb) {
                  return null;
                }
                return (
                  <Animated.View entering={FadeInRight.delay(index * 50)}>
                    <PressableScale onPress={item.onPress} accessibilityLabel={`${ta.name} versus ${tb.name}, ${item.label}`} style={[styles.fixture, { backgroundColor: colors.card, borderColor: colors.border }]}>
                      <SplitColors a={ta.color} b={tb.color} opacity={0.35} />
                      <View style={styles.fixtureTeams}>
                        <TeamBadge name={ta.name} shortName={ta.shortName} color={ta.color} size={46} />
                        <AppText style={styles.fixtureVs} color={colors.primary}>
                          VS
                        </AppText>
                        <TeamBadge name={tb.name} shortName={tb.shortName} color={tb.color} size={46} />
                      </View>
                      <AppText variant="h3" numberOfLines={1} align="center">
                        {ta.shortName} v {tb.shortName}
                      </AppText>
                      <AppText variant="caption" tone="secondary" numberOfLines={1} align="center">
                        {item.label} · {item.sub}
                      </AppText>
                    </PressableScale>
                  </Animated.View>
                );
              }}
            />
          </>
        ) : null}

        {/* Tournament highlight */}
        {data && data.tournaments.length > 0 ? (
          <View style={styles.pad}>
            <SectionHeader title="Tournament highlights" action="All cups" onAction={() => nav.navigate('Main', { screen: 'Tournaments' })} />
            <View style={styles.tourRow}>
              {data.tournaments.slice(0, 2).map((t, i) => {
                const champ = t.winnerTeamId ? data.teams[t.winnerTeamId] : null;
                return (
                  <Animated.View key={t.id} entering={FadeInDown.delay(i * 70)} style={i === 0 ? styles.tourBig : styles.tourSmall}>
                    <PhotoCard source={i === 0 ? images.trophy : images.tournament} onPress={() => nav.navigate('TournamentDetail', { tournamentId: t.id })} style={styles.tourCard} accessibilityLabel={`${t.name} tournament`}>
                      <View style={[styles.tag, { backgroundColor: t.status === 'completed' ? colors.gold : colors.primary }]}>
                        <AppText variant="overline" color={colors.onPrimary}>
                          {t.status === 'completed' ? 'Champions' : 'Live cup'}
                        </AppText>
                      </View>
                      <AppText variant={i === 0 ? 'h2' : 'h3'} color="#FFFFFF" numberOfLines={2}>
                        {t.name}
                      </AppText>
                      <AppText variant="caption" color="rgba(255,255,255,0.8)" numberOfLines={1}>
                        {champ ? champ.name : t.format === 'league' ? 'League' : t.format === 'knockout' ? 'Knockout' : 'League + knockout'}
                      </AppText>
                    </PhotoCard>
                  </Animated.View>
                );
              })}
            </View>
          </View>
        ) : null}

        {/* Top performers */}
        {data && data.topBatters.length > 0 ? (
          <>
            <View style={styles.pad}>
              <SectionHeader title="Top performers" />
            </View>
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.carousel}
              data={[...data.topBatters.slice(0, 3).map(c => ({ c, kind: 'bat' as const })), ...data.topBowlers.slice(0, 3).map(c => ({ c, kind: 'bowl' as const }))]}
              keyExtractor={i => `${i.kind}-${i.c.playerId}`}
              renderItem={({ item, index }) => (
                <Animated.View entering={FadeInRight.delay(index * 50)}>
                  <PhotoCard source={item.kind === 'bat' ? images.onboardBatter : images.toss} style={styles.performer} onPress={() => nav.navigate('PlayerProfile', { playerId: item.c.playerId })} accessibilityLabel={`${item.c.name}, ${item.kind === 'bat' ? `${item.c.runs} runs` : `${item.c.wickets} wickets`}`} imagePosition="top">
                    <Avatar name={item.c.name} color={(item.c.teamId && data.teams[item.c.teamId]?.color) || colors.primary} size={38} />
                    <AppText style={styles.performerNum} color={item.kind === 'bat' ? colors.primaryBright : colors.gold}>
                      {item.kind === 'bat' ? item.c.runs : item.c.wickets}
                    </AppText>
                    <AppText variant="overline" color="rgba(255,255,255,0.75)">
                      {item.kind === 'bat' ? 'Runs' : 'Wickets'}
                    </AppText>
                    <AppText variant="label" color="#FFFFFF" numberOfLines={1}>
                      {item.c.name}
                    </AppText>
                  </PhotoCard>
                </Animated.View>
              )}
            />
          </>
        ) : null}

        {/* Recent results */}
        {data && data.recent.length > 0 ? (
          <View style={styles.pad}>
            <SectionHeader title="Recent results" action="History" onAction={() => nav.navigate('Main', { screen: 'Matches' })} />
            <View style={styles.list}>
              {data.recent.slice(0, 4).map((m, i) => (
                <Animated.View key={m.id} entering={FadeInDown.delay(i * 50)}>
                  <ResultRow match={m} teams={data.teams} onPress={() => nav.navigate('Scorecard', { matchId: m.id })} />
                </Animated.View>
              ))}
            </View>
          </View>
        ) : null}

        {/* Teams */}
        {data && data.teamList.length > 0 ? (
          <View style={styles.pad}>
            <SectionHeader title="Your teams" action="Manage" onAction={() => nav.navigate('Main', { screen: 'Teams' })} />
            <View style={styles.teamGrid}>
              {data.teamList.slice(0, 6).map(t => (
                <PressableScale key={t.id} onPress={() => nav.navigate('TeamDetail', { teamId: t.id })} style={[styles.teamTile, { backgroundColor: colors.card, borderColor: colors.border }]} accessibilityLabel={`${t.name}, ${t.playerCount ?? 0} players`}>
                  <View style={[styles.teamStripe, { backgroundColor: t.color }]} />
                  <TeamBadge name={t.name} shortName={t.shortName} color={t.color} size={36} />
                  <View style={styles.flex}>
                    <AppText variant="label" numberOfLines={1}>
                      {t.name}
                    </AppText>
                    <AppText variant="caption" tone="secondary">
                      {t.playerCount ?? 0} players
                    </AppText>
                  </View>
                </PressableScale>
              ))}
            </View>
          </View>
        ) : null}
      </Animated.ScrollView>
    </ScreenBackground>
  );
}

function FeaturedLive({ match, teams, onPress }: { match: MatchRecord; teams: Record<string, Team>; onPress: () => void }) {
  const { colors } = useTheme();
  const a = teams[match.teamAId];
  const b = teams[match.teamBId];
  const batting = match.summary?.battingTeamId;
  const cur = match.summary?.innings[match.summary.innings.length - 1];
  const quota = match.summary?.quotaBalls ?? null;
  return (
    <PressableScale onPress={onPress} testID="home-resume" accessibilityLabel={`Resume ${match.title}. ${match.summary?.situation ?? ''}`} scaleTo={0.98}>
      <Card featured style={styles.overlap}>
        {a && b ? <SplitColors a={a.color} b={b.color} opacity={0.22} /> : null}
        <View style={styles.liveHead}>
          <View style={[styles.liveBadge, { backgroundColor: colors.danger }]}>
            <View style={styles.liveDot} />
            <AppText variant="overline" color="#FFFFFF">
              Live
            </AppText>
          </View>
          <AppText variant="caption" tone="secondary" numberOfLines={1} style={styles.flex}>
            {match.title}
          </AppText>
          <AppText variant="label" tone="accent">
            Resume →
          </AppText>
        </View>
        <View style={styles.liveTeams}>
          {[a, b].map((t, i) =>
            t ? (
              <View key={t.id} style={[styles.liveTeam, i === 1 ? styles.alignEnd : null]}>
                <View style={[styles.row, i === 1 ? styles.rowReverse : null]}>
                  <TeamBadge name={t.name} shortName={t.shortName} color={t.color} size={42} />
                  <View style={i === 1 ? styles.alignEnd : null}>
                    <AppText variant="h3" numberOfLines={1}>
                      {t.shortName}
                    </AppText>
                    {batting === t.id ? (
                      <AppText variant="overline" tone="accent">
                        Batting
                      </AppText>
                    ) : null}
                  </View>
                </View>
                <RollingNumber value={inningsLine(match, t.id) || '—'} variant="score" color={batting === t.id ? colors.text : colors.textSecondary} />
              </View>
            ) : null,
          )}
        </View>
        {cur && quota ? <ProgressBar value={cur.balls / quota} accessibilityLabel={`${formatOvers(cur.balls, match.summary?.ballsPerOver ?? 6)} overs bowled`} /> : null}
        <AppText variant="bodyStrong" tone="accent" style={styles.situation}>
          {match.summary?.situation ?? 'In progress'}
          {match.summary?.strikerName ? `  ·  ${match.summary.strikerName} on strike` : ''}
        </AppText>
      </Card>
    </PressableScale>
  );
}

function FeaturedPreview({ match, teams, onPress }: { match: MatchRecord; teams: Record<string, Team>; onPress: () => void }) {
  const a = teams[match.teamAId];
  const b = teams[match.teamBId];
  return (
    <PressableScale onPress={onPress} accessibilityLabel={`Next up: ${a?.name} versus ${b?.name}`} scaleTo={0.98}>
      <Card featured style={styles.overlap}>
        {a && b ? <SplitColors a={a.color} b={b.color} opacity={0.3} /> : null}
        <AppText variant="overline" tone="accent" align="center">
          Next up · {match.title}
        </AppText>
        <View style={styles.previewVs}>
          <TeamVersus a={a ?? null} b={b ?? null} size={72} compact introKey={match.id} />
        </View>
        <Button label="Go to the toss" onPress={onPress} />
      </Card>
    </PressableScale>
  );
}

function MiniStat({ label, value, accent }: { label: string; value: number; accent?: string }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.mini, { backgroundColor: colors.card, borderColor: colors.border }]} accessible accessibilityLabel={`${label}: ${value}`}>
      <CountUp value={value} variant="stat" color={accent ?? colors.text} />
      <AppText variant="caption" tone="secondary">
        {label}
      </AppText>
    </View>
  );
}

function LeaderBars({ data, onOpen }: { data: { topBatters: CareerStats[]; topBowlers: CareerStats[] }; onOpen: (id: string) => void }) {
  const { colors } = useTheme();
  const [kind, setKind] = useState<'runs' | 'wickets' | 'sixes'>('runs');
  const rows = useMemo(() => {
    const src = kind === 'wickets' ? data.topBowlers : [...data.topBatters];
    const val = (c: CareerStats) => (kind === 'runs' ? c.runs : kind === 'wickets' ? c.wickets : c.sixes);
    return src
      .filter(c => val(c) > 0)
      .sort((x, y) => val(y) - val(x))
      .slice(0, 5)
      .map(c => ({ c, v: val(c) }));
  }, [data, kind]);
  const max = Math.max(1, ...rows.map(r => r.v));
  return (
    <Card style={styles.leaders}>
      <View style={styles.row}>
        {(['runs', 'wickets', 'sixes'] as const).map(k => (
          <Chip key={k} label={k[0].toUpperCase() + k.slice(1)} selected={kind === k} onPress={() => setKind(k)} testID={`leaders-${k}`} />
        ))}
      </View>
      {rows.length === 0 ? (
        <AppText variant="caption" tone="secondary">
          No {kind} yet.
        </AppText>
      ) : null}
      {rows.map(({ c, v }, i) => (
        <PressableScale key={`${kind}-${c.playerId}`} onPress={() => onOpen(c.playerId)} accessibilityLabel={`${c.name}: ${v} ${kind}`} scaleTo={0.98} style={styles.leaderRow}>
          <AppText variant="statSmall" tone={i === 0 ? 'accent' : 'muted'} style={styles.rank}>
            {i + 1}
          </AppText>
          <View style={styles.flex}>
            <View style={styles.leaderTop}>
              <AppText variant="label" numberOfLines={1} style={styles.flex}>
                {c.name}
              </AppText>
              <AppText variant="statSmall">{v}</AppText>
            </View>
            <ProgressBar value={v / max} height={6} colors={i === 0 ? colors.heat : [colors.surfaceHigh, colors.borderStrong]} />
          </View>
        </PressableScale>
      ))}
    </Card>
  );
}

function ResultRow({ match, teams, onPress }: { match: MatchRecord; teams: Record<string, Team>; onPress: () => void }) {
  const { colors } = useTheme();
  const a = teams[match.teamAId];
  const b = teams[match.teamBId];
  return (
    <PressableScale onPress={onPress} accessibilityLabel={`${a?.name} versus ${b?.name}. ${match.resultText ?? ''}`} scaleTo={0.98} style={[styles.result, { backgroundColor: colors.card, borderColor: colors.border }]}>
      {[a, b].map(t =>
        t ? (
          <View key={t.id} style={styles.resultTeam}>
            <TeamBadge name={t.name} shortName={t.shortName} color={t.color} size={28} />
            <AppText variant="label" numberOfLines={1} style={styles.flex} color={match.winnerTeamId === t.id ? colors.text : colors.textSecondary}>
              {t.shortName}
            </AppText>
            <AppText variant="statSmall" color={match.winnerTeamId === t.id ? colors.primary : colors.textSecondary}>
              {inningsLine(match, t.id) || '–'}
            </AppText>
          </View>
        ) : null,
      )}
      <AppText variant="caption" tone="gold" numberOfLines={1}>
        {match.resultText}
      </AppText>
    </PressableScale>
  );
}

function QuickAction({ icon, label, onPress, testID }: { icon: IconName; label: string; onPress: () => void; testID?: string }) {
  const { colors } = useTheme();
  return (
    <PressableScale testID={testID} onPress={onPress} accessibilityLabel={label} style={[styles.qa, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[styles.qaIcon, { backgroundColor: withAlpha(colors.primary, 0.14) }]}>
        <Icon name={icon} size={20} color={colors.primary} />
      </View>
      <AppText variant="caption" numberOfLines={1}>
        {label}
      </AppText>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  rowReverse: { flexDirection: 'row-reverse' },
  alignEnd: { alignItems: 'flex-end' },
  hero: { paddingHorizontal: spacing.md, justifyContent: 'space-between', paddingBottom: 84 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  heroText: { gap: spacing.xs, marginTop: spacing.xxxl },
  heroTitle: { fontFamily: fonts.headingBlack, fontSize: 46, lineHeight: 48, letterSpacing: -1.4 },
  heroCtas: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
  body: { paddingHorizontal: spacing.md, marginTop: -64 },
  overlap: { gap: spacing.sm },
  liveHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  liveBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#FFFFFF' },
  liveTeams: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },
  liveTeam: { flex: 1, gap: 4 },
  situation: { textAlign: 'center' },
  previewVs: { paddingVertical: spacing.sm },
  statGrid: { flexDirection: 'row', gap: spacing.xs },
  statBig: { flex: 1.1, borderRadius: radius.lg, borderWidth: 1, padding: spacing.md, justifyContent: 'flex-end', minHeight: 170, overflow: 'hidden', gap: 2 },
  statCol: { flex: 1, gap: spacing.xs },
  statRow: { flexDirection: 'row', gap: spacing.xs, flex: 1 },
  mini: { flex: 1, borderRadius: radius.md, borderWidth: 1, padding: spacing.sm, justifyContent: 'flex-end' },
  leaders: { marginTop: spacing.sm, gap: spacing.sm },
  leaderRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  leaderTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  rank: { width: 20, textAlign: 'center' },
  actions: { flexDirection: 'row', gap: spacing.xs, marginTop: spacing.md },
  qa: { flex: 1, alignItems: 'center', gap: 6, paddingVertical: spacing.sm, borderRadius: radius.md, borderWidth: 1 },
  qaIcon: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  pad: { paddingHorizontal: spacing.md },
  carousel: { paddingHorizontal: spacing.md, gap: spacing.sm },
  fixture: { width: 210, alignItems: 'center', gap: 4, padding: spacing.md, borderRadius: radius.lg, borderWidth: 1, overflow: 'hidden' },
  fixtureTeams: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs },
  fixtureVs: { fontFamily: fonts.headingBlack, fontSize: 16 },
  tourRow: { flexDirection: 'row', gap: spacing.xs },
  tourBig: { flex: 1.4 },
  tourSmall: { flex: 1 },
  tourCard: { height: 200 },
  tag: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill, marginBottom: 4 },
  performer: { width: 150, height: 210 },
  performerNum: { fontFamily: fonts.scoreHeavy, fontSize: 44, lineHeight: 46, marginTop: 6 },
  list: { gap: spacing.xs },
  result: { padding: spacing.sm, borderRadius: radius.md, borderWidth: 1, gap: 4 },
  resultTeam: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  teamGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  teamTile: { width: '48.8%', flexDirection: 'row', alignItems: 'center', gap: spacing.xs, padding: spacing.sm, borderRadius: radius.md, borderWidth: 1, overflow: 'hidden' },
  teamStripe: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 3 },
});
