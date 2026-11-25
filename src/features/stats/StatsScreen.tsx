import React, { useMemo, useState } from 'react';
import { FlatList, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInRight } from 'react-native-reanimated';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GapXs } from '../../components/Separator';
import { AppHeader } from '../../components/AppHeader';
import { AppText } from '../../components/AppText';
import { Card } from '../../components/Card';
import { Chip, SectionHeader, SegmentedControl } from '../../components/Controls';
import { EmptyState } from '../../components/EmptyState';
import { Avatar } from '../../components/PlayerCard';
import { PressableScale } from '../../components/PressableScale';
import { ScreenBackground } from '../../components/ScreenBackground';
import { TeamBadge } from '../../components/TeamBadge';
import { fixed } from '../../core/engine/selectors';
import { getDb } from '../../data/db/database';
import { matchRepository } from '../../data/repositories/matchRepository';
import { statsRepository, type CareerStats, type LeaderboardKey } from '../../data/repositories/statsRepository';
import { teamRepository } from '../../data/repositories/teamRepository';
import { useAsync } from '../../hooks/useAsync';
import { fileService } from '../../services/fileService';
import { computeTeamStats } from '../../services/teamService';
import { errorMessage, toast } from '../../stores/appStore';
import { fonts, images, radius, spacing, useTheme, withAlpha } from '../../theme';
import { TAB_BAR_SPACE } from '../../app/navigation/TabBar';

const BOARDS: Array<{ key: LeaderboardKey; label: string; value: (c: CareerStats) => string; sub: (c: CareerStats) => string }> = [
  { key: 'runs', label: 'Most runs', value: c => String(c.runs), sub: c => `${c.innings} inn · avg ${c.battingAverage !== null ? fixed(c.battingAverage) : '–'} · SR ${c.strikeRate !== null ? fixed(c.strikeRate) : '–'}` },
  { key: 'wickets', label: 'Most wickets', value: c => String(c.wickets), sub: c => `best ${c.bestWickets}/${c.bestRuns} · econ ${c.economy !== null ? fixed(c.economy) : '–'}` },
  { key: 'sixes', label: 'Most sixes', value: c => String(c.sixes), sub: c => `${c.fours} fours · ${c.runs} runs` },
  { key: 'battingAverage', label: 'Best average', value: c => fixed(c.battingAverage ?? 0), sub: c => `${c.runs} runs · ${c.dismissals} outs (min 2 inns)` },
  { key: 'strikeRate', label: 'Best strike rate', value: c => fixed(c.strikeRate ?? 0, 1), sub: c => `${c.runs} off ${c.balls} (min 10 balls)` },
  { key: 'economy', label: 'Best economy', value: c => fixed(c.economy ?? 0), sub: c => `${Math.floor(c.bowlBalls / 6)}.${c.bowlBalls % 6} ov · ${c.wickets} wkts (min 2 ov)` },
  { key: 'catches', label: 'Most catches', value: c => String(c.catches), sub: c => `${c.stumpings} st · ${c.runOuts} run outs` },
];

async function loadStats() {
  const db = await getDb();
  const [teams, matches, boards] = await Promise.all([
    teamRepository.list(db, true),
    matchRepository.list(db, { status: ['completed'] }),
    Promise.all(BOARDS.map(b => statsRepository.leaderboard(db, b.key, 20))),
  ]);
  const teamMap = Object.fromEntries(teams.map(t => [t.id, t]));
  const teamTable = teams
    .map(t => ({ team: t, s: computeTeamStats(t.id, matches, teamMap) }))
    .filter(x => x.s.played > 0)
    .sort((a, b) => b.s.won - a.s.won || b.s.winPercent - a.s.winPercent);
  return { teams: teamMap, teamTable, boards: Object.fromEntries(BOARDS.map((b, i) => [b.key, boards[i]])) as Record<LeaderboardKey, CareerStats[]>, matches: matches.length };
}

export function StatsScreen() {
  const nav = useNavigation();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { data, loading } = useAsync(loadStats);
  const [view, setView] = useState<'players' | 'teams'>('players');
  const [board, setBoard] = useState<LeaderboardKey>('runs');
  const [exporting, setExporting] = useState(false);
  const def = BOARDS.find(b => b.key === board)!;
  const rows = useMemo(() => data?.boards[board] ?? [], [data, board]);
  const max = Math.max(1, ...rows.map(r => Number(def.value(r))));

  return (
    <ScreenBackground source={images.stats}>
      <AppHeader
        title="Leaderboards"
        subtitle={`${data?.matches ?? 0} completed matches`}
        large
        actions={[
          {
            icon: 'download',
            label: 'Export statistics CSV',
            testID: 'stats-export',
            disabled: exporting,
            onPress: async () => {
              setExporting(true);
              try {
                await fileService.exportCareersCsv();
              } catch (e) {
                toast(errorMessage(e), 'error');
              } finally {
                setExporting(false);
              }
            },
          },
        ]}
      />
      <View style={styles.controls}>
        <SegmentedControl value={view} onChange={setView} testIDPrefix="stats-view" options={[{ value: 'players', label: 'Leaderboards' }, { value: 'teams', label: 'Teams' }]} />
      </View>
      {view === 'players' ? (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} style={styles.chipBar}>
            {BOARDS.map(b => (
              <Chip key={b.key} label={b.label} selected={board === b.key} onPress={() => setBoard(b.key)} testID={`board-${b.key}`} />
            ))}
          </ScrollView>
          <FlatList
            data={rows}
            keyExtractor={r => r.playerId}
            contentContainerStyle={[styles.list, { paddingBottom: TAB_BAR_SPACE + insets.bottom }]}
            ItemSeparatorComponent={GapXs}
            ListHeaderComponent={rows.length >= 3 ? <Podium rows={rows} def={def} teams={data?.teams ?? {}} onOpen={id => nav.navigate('PlayerProfile', { playerId: id })} /> : undefined}
            ListEmptyComponent={loading ? undefined : <EmptyState kind="stats" title="No statistics yet" message="Leaderboards fill up as you complete matches. Every figure is calculated from the balls you scored." />}
            renderItem={({ item, index }) => {
              const team = item.teamId ? data?.teams[item.teamId] : undefined;
              const v = Number(def.value(item));
              const pct = board === 'economy' ? 100 - Math.min(100, (v / max) * 100) + 10 : (v / max) * 100;
              return (
                <Animated.View entering={FadeInRight.delay(Math.min(index, 10) * 40)}>
                  <PressableScale onPress={() => nav.navigate('PlayerProfile', { playerId: item.playerId })} accessibilityLabel={`${index + 1}. ${item.name}, ${def.value(item)}`} style={[styles.row, { backgroundColor: colors.card, borderColor: index === 0 ? colors.gold : colors.border }]}>
                    <View style={[styles.bar, { width: `${Math.min(100, pct)}%`, backgroundColor: withAlpha(index === 0 ? colors.gold : colors.primary, 0.1) }]} />
                    <AppText variant="stat" style={styles.rank} color={index === 0 ? colors.gold : colors.textSecondary}>
                      {index + 1}
                    </AppText>
                    <Avatar name={item.name} color={team?.color ?? colors.primary} size={38} />
                    <View style={styles.flex}>
                      <AppText variant="label" numberOfLines={1}>
                        {item.name}
                      </AppText>
                      <AppText variant="caption" tone="secondary" numberOfLines={1}>
                        {team?.shortName ? `${team.shortName} · ` : ''}
                        {def.sub(item)}
                      </AppText>
                    </View>
                    <AppText variant="stat" color={index === 0 ? colors.gold : colors.text}>
                      {def.value(item)}
                    </AppText>
                  </PressableScale>
                </Animated.View>
              );
            }}
          />
        </>
      ) : (
        <ScrollView contentContainerStyle={[styles.list, { paddingBottom: TAB_BAR_SPACE + insets.bottom }]}>
          {(data?.teamTable ?? []).length === 0 && !loading ? <EmptyState kind="stats" title="No team results yet" message="Team records appear once matches are completed." /> : null}
          {(data?.teamTable ?? []).map(({ team, s }, i) => (
            <Animated.View key={team.id} entering={FadeInRight.delay(i * 50)} style={styles.teamCard}>
              <Card>
                <PressableScale onPress={() => nav.navigate('TeamDetail', { teamId: team.id })} accessibilityLabel={`${team.name}: ${s.won} wins from ${s.played}`} style={styles.teamHead}>
                  <TeamBadge name={team.name} shortName={team.shortName} color={team.color} size={44} />
                  <View style={styles.flex}>
                    <AppText variant="h3">{team.name}</AppText>
                    <AppText variant="caption" tone="secondary">
                      P {s.played} · W {s.won} · L {s.lost} · T {s.tied} · NR {s.noResult}
                    </AppText>
                  </View>
                  <AppText variant="stat" tone="gold">
                    {fixed(s.winPercent, 0)}%
                  </AppText>
                </PressableScale>
                <View style={[styles.winTrack, { backgroundColor: colors.surface }]}>
                  <View style={{ flex: Math.max(0.001, s.won), backgroundColor: colors.success }} />
                  <View style={{ flex: Math.max(0.001, s.tied + s.noResult), backgroundColor: colors.textMuted }} />
                  <View style={{ flex: Math.max(0.001, s.lost), backgroundColor: colors.danger }} />
                </View>
                <View style={styles.teamStats}>
                  <AppText variant="caption" tone="secondary">
                    Highest {s.highest ? `${s.highest.runs}/${s.highest.wickets} v ${s.highest.vs}` : '–'}
                  </AppText>
                  <AppText variant="caption" tone="secondary">
                    Form {s.form.join(' ') || '–'}
                  </AppText>
                </View>
              </Card>
            </Animated.View>
          ))}
          <SectionHeader title="About these numbers" />
          <AppText variant="caption" tone="muted">
            Only completed matches count. Super overs are left out of career figures, as in official records. Economy uses 6-ball overs.
          </AppText>
        </ScrollView>
      )}
    </ScreenBackground>
  );
}

function Podium({ rows, def, teams, onOpen }: { rows: CareerStats[]; def: (typeof BOARDS)[number]; teams: Record<string, { color: string; shortName: string }>; onOpen: (id: string) => void }) {
  const { colors } = useTheme();
  const order = [1, 0, 2];
  const heights = [118, 150, 96];
  return (
    <View style={styles.podium} accessibilityLabel={`Top three: ${rows.slice(0, 3).map(r => `${r.name} ${def.value(r)}`).join(', ')}`}>
      {order.map((idx, i) => {
        const r = rows[idx];
        const team = r.teamId ? teams[r.teamId] : undefined;
        const first = idx === 0;
        return (
          <Animated.View key={r.playerId} entering={FadeInRight.delay(i * 90).springify()} style={styles.podiumCol}>
            <PressableScale onPress={() => onOpen(r.playerId)} accessibilityLabel={`${idx + 1}. ${r.name}`} style={styles.podiumInner}>
              <Avatar name={r.name} color={team?.color ?? colors.primary} size={first ? 60 : 48} />
              <AppText variant="label" numberOfLines={1} align="center">
                {r.name}
              </AppText>
              <View style={[styles.podiumBlock, { height: heights[i], borderColor: first ? colors.primaryBright : colors.border, backgroundColor: first ? colors.primary : colors.card }]}>
                <AppText style={styles.podiumValue} color={first ? colors.onPrimary : colors.text}>
                  {def.value(r)}
                </AppText>
                <AppText variant="overline" color={first ? colors.onPrimary : colors.textSecondary}>
                  #{idx + 1}
                </AppText>
              </View>
            </PressableScale>
          </Animated.View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  podium: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.xs, marginBottom: spacing.md },
  podiumCol: { flex: 1 },
  podiumInner: { alignItems: 'center', gap: 6 },
  podiumBlock: { alignSelf: 'stretch', borderRadius: radius.lg, borderWidth: 1, alignItems: 'center', justifyContent: 'center', gap: 2 },
  podiumValue: { fontFamily: fonts.scoreHeavy, fontSize: 36, lineHeight: 38 },
  controls: { paddingHorizontal: spacing.md, marginBottom: spacing.sm },
  chipBar: { flexGrow: 0, marginBottom: spacing.sm },
  chips: { paddingHorizontal: spacing.md, gap: spacing.xs },
  list: { paddingHorizontal: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm, borderRadius: radius.md, borderWidth: 1, overflow: 'hidden' },
  bar: { position: 'absolute', left: 0, top: 0, bottom: 0 },
  rank: { width: 28, textAlign: 'center' },
  flex: { flex: 1 },
  teamCard: { marginBottom: spacing.sm },
  teamHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  winTrack: { flexDirection: 'row', height: 8, borderRadius: 4, overflow: 'hidden', marginTop: spacing.sm },
  teamStats: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.xs },
});
