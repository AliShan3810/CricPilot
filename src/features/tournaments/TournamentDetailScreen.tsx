import React, { useMemo, useState } from 'react';
import { confirmAlert } from '../../components/ConfirmDialog';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeInRight } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { AppHeader } from '../../components/AppHeader';
import { AppText } from '../../components/AppText';
import { Card } from '../../components/Card';
import { SegmentedControl } from '../../components/Controls';
import { EmptyState } from '../../components/EmptyState';
import { Icon } from '../../components/Icon';
import { PressableScale } from '../../components/PressableScale';
import { ScreenBackground } from '../../components/ScreenBackground';
import { TeamBadge } from '../../components/TeamBadge';
import { formatNrr } from '../../core/tournament/tournament';
import type { Fixture, MatchRecord, Team } from '../../data/models';
import { useAsync } from '../../hooks/useAsync';
import { teamService } from '../../services/teamService';
import { tournamentService } from '../../services/tournamentService';
import { bumpData, errorMessage, toast } from '../../stores/appStore';
import { images, radius, spacing, useTheme, withAlpha } from '../../theme';
import type { RootScreenProps } from '../../app/navigation/types';

type Tab = 'fixtures' | 'table' | 'bracket';

const STAGE: Record<string, string> = { league: 'League', quarterFinal: 'Quarter-final', semiFinal: 'Semi-final', final: 'Final', knockout: 'Knockout' };

export function TournamentDetailScreen({ navigation, route }: RootScreenProps<'TournamentDetail'>) {
  const { tournamentId } = route.params;
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { data } = useAsync(() => tournamentService.detail(tournamentId), [tournamentId]);
  const teams = useAsync(() => teamService.list());
  const teamMap = useMemo(() => Object.fromEntries((teams.data ?? []).map(t => [t.id, t])) as Record<string, Team>, [teams.data]);
  const hasKo = data ? data.fixtures.some(f => f.stage !== 'league') : false;
  const hasLeague = data ? data.fixtures.some(f => f.stage === 'league') : false;
  const [tab, setTab] = useState<Tab>('fixtures');

  if (!data) {
    return (
      <ScreenBackground source={images.tournament}>
        <AppHeader title="Loading…" />
      </ScreenBackground>
    );
  }
  const { tournament, fixtures, matches, table } = data;
  const champion = tournament.winnerTeamId ? teamMap[tournament.winnerTeamId] : null;
  const played = fixtures.filter(f => f.matchId && matches[f.matchId]?.status === 'completed').length;

  const openFixture = (f: Fixture) => {
    const m = f.matchId ? matches[f.matchId] : null;
    if (m) {
      navigation.navigate(m.status === 'completed' ? 'Scorecard' : m.status === 'live' ? 'LiveScoring' : 'Toss', { matchId: m.id });
      return;
    }
    if (!f.teamAId || !f.teamBId) {
      toast('The teams for this fixture are not decided yet.');
      return;
    }
    navigation.navigate('MatchCreate', { fixtureId: f.id, tournamentId });
  };

  const chooseWinner = (f: Fixture) => {
    if (!f.teamAId || !f.teamBId) {
      return;
    }
    confirmAlert('Who goes through?', 'This knockout match has no winner (tie or no result). Choose the team that advances, e.g. by the tournament’s tie-break rule.', [
      { text: 'Cancel', style: 'cancel' },
      ...[f.teamAId, f.teamBId].map(id => ({
        text: teamMap[id]?.name ?? id,
        onPress: async () => {
          try {
            await tournamentService.setManualWinner(f.id, id);
            bumpData();
          } catch (e) {
            toast(errorMessage(e), 'error');
          }
        },
      })),
    ]);
  };

  const remove = () =>
    confirmAlert('Delete tournament?', 'Fixtures and the table are deleted. Matches already played are kept in your match history.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await tournamentService.remove(tournamentId);
          bumpData();
          navigation.goBack();
        },
      },
    ]);

  const tabs: Array<{ value: Tab; label: string }> = [{ value: 'fixtures', label: 'Fixtures' }];
  if (hasLeague) {
    tabs.push({ value: 'table', label: 'Table' });
  }
  if (hasKo) {
    tabs.push({ value: 'bracket', label: 'Bracket' });
  }

  return (
    <ScreenBackground source={images.tournament} height={440}>
      <AppHeader title={tournament.name} subtitle={`${played}/${fixtures.length} played`} actions={[{ icon: 'trash', label: 'Delete tournament', onPress: remove }]} />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxl }]}>
        {champion ? (
          <Animated.View entering={FadeInDown}>
            <Card glass accent={colors.gold} style={styles.champ}>
              <Icon name="trophy" size={34} color={colors.gold} />
              <TeamBadge name={champion.name} shortName={champion.shortName} color={champion.color} size={64} />
              <AppText variant="overline" tone="gold">
                Champions
              </AppText>
              <AppText variant="h1" testID="tournament-champion">
                {champion.name}
              </AppText>
            </Card>
          </Animated.View>
        ) : (
          <View style={styles.spacer} />
        )}
        {tabs.length > 1 ? <SegmentedControl value={tab} onChange={setTab} options={tabs} testIDPrefix="ttab" /> : null}

        {tab === 'fixtures' ? (
          <View style={styles.gap}>
            {fixtures.map((f, i) => (
              <Animated.View key={f.id} entering={FadeInDown.delay(Math.min(i, 10) * 30)}>
                <FixtureRow f={f} match={f.matchId ? matches[f.matchId] : undefined} teamMap={teamMap} onPress={() => openFixture(f)} onChooseWinner={() => chooseWinner(f)} index={i} />
              </Animated.View>
            ))}
          </View>
        ) : null}

        {tab === 'table' ? (
          <Card padded={false}>
            <View style={[styles.th, { backgroundColor: colors.surface }]}>
              <AppText variant="overline" tone="secondary" style={styles.pos}>
                #
              </AppText>
              <AppText variant="overline" tone="secondary" style={styles.flex}>
                Team
              </AppText>
              {['P', 'W', 'L', 'T/NR', 'Pts', 'NRR'].map(h => (
                <AppText key={h} variant="overline" tone="secondary" style={h === 'NRR' ? styles.nrr : styles.col}>
                  {h}
                </AppText>
              ))}
            </View>
            {table.map((r, i) => {
              const t = teamMap[r.teamId];
              const qualifies = tournament.format === 'leagueKnockout' && i < tournament.qualifiers;
              return (
                <Animated.View key={r.teamId} entering={FadeInRight.delay(i * 50)} style={[styles.tr, { borderColor: colors.border, backgroundColor: qualifies ? withAlpha(colors.success, 0.08) : undefined }]} testID={`table-row-${i}`}>
                  <AppText variant="label" style={styles.pos} color={qualifies ? colors.success : colors.textSecondary}>
                    {i + 1}
                  </AppText>
                  <View style={[styles.flex, styles.teamCell]}>
                    {t ? <TeamBadge name={t.name} shortName={t.shortName} color={t.color} size={24} /> : null}
                    <AppText variant="label" numberOfLines={1} style={styles.flex}>
                      {t?.name ?? '—'}
                    </AppText>
                  </View>
                  <AppText variant="body" style={styles.col}>
                    {r.played}
                  </AppText>
                  <AppText variant="body" style={styles.col}>
                    {r.won}
                  </AppText>
                  <AppText variant="body" style={styles.col}>
                    {r.lost}
                  </AppText>
                  <AppText variant="body" style={styles.col}>
                    {r.tied + r.noResult}
                  </AppText>
                  <AppText variant="statSmall" style={styles.col} color={colors.gold}>
                    {r.points}
                  </AppText>
                  <AppText variant="caption" style={styles.nrr} color={r.nrr >= 0 ? colors.success : colors.danger}>
                    {formatNrr(r.nrr)}
                  </AppText>
                </Animated.View>
              );
            })}
            <View style={styles.note}>
              <AppText variant="caption" tone="muted">
                Win {tournament.pointsWin} · Tie {tournament.pointsTie} · No result {tournament.pointsNoResult}. NRR counts an all-out side as having faced its full overs.
              </AppText>
            </View>
          </Card>
        ) : null}

        {tab === 'bracket' ? <Bracket fixtures={fixtures.filter(f => f.stage !== 'league')} matches={matches} teamMap={teamMap} onPress={openFixture} /> : null}

        {fixtures.length === 0 ? <EmptyState kind="tournament" title="No fixtures" message="This tournament has no fixtures." /> : null}
      </ScrollView>
    </ScreenBackground>
  );
}

function FixtureRow({ f, match, teamMap, onPress, onChooseWinner, index }: { f: Fixture; match?: MatchRecord; teamMap: Record<string, Team>; onPress: () => void; onChooseWinner: () => void; index: number }) {
  const { colors } = useTheme();
  const a = f.teamAId ? teamMap[f.teamAId] : null;
  const b = f.teamBId ? teamMap[f.teamBId] : null;
  const needsDecision = f.stage !== 'league' && match?.status === 'completed' && !match.winnerTeamId && !f.winnerTeamId;
  const status = match ? (match.status === 'completed' ? match.resultText ?? 'Completed' : match.status === 'live' ? match.summary?.situation ?? 'Live' : 'Ready to start') : a && b ? 'Tap to play' : 'Awaiting teams';
  return (
    <PressableScale onPress={onPress} testID={`fixture-${index}`} accessibilityLabel={`${STAGE[f.stage]}: ${a?.name ?? f.labelA ?? 'To be decided'} versus ${b?.name ?? f.labelB ?? 'To be decided'}. ${status}`} style={[styles.fixture, { backgroundColor: colors.card, borderColor: match?.status === 'live' ? colors.danger : colors.border }]}>
      <AppText variant="overline" tone={f.stage === 'final' ? 'gold' : 'secondary'}>
        {STAGE[f.stage]}
        {f.stage === 'league' ? ` · Round ${f.round}` : ''}
      </AppText>
      <View style={styles.fxTeams}>
        <TeamSlot team={a} label={f.labelA} won={!!f.winnerTeamId && f.winnerTeamId === f.teamAId} />
        <AppText variant="statSmall" tone="muted">
          v
        </AppText>
        <TeamSlot team={b} label={f.labelB} won={!!f.winnerTeamId && f.winnerTeamId === f.teamBId} right />
      </View>
      <AppText variant="caption" tone={match?.status === 'completed' ? 'gold' : 'secondary'} numberOfLines={1}>
        {status}
      </AppText>
      {needsDecision ? (
        <PressableScale onPress={onChooseWinner} style={[styles.decide, { borderColor: colors.gold }]} accessibilityLabel="Choose who goes through">
          <AppText variant="label" tone="gold">
            Choose who goes through
          </AppText>
        </PressableScale>
      ) : null}
    </PressableScale>
  );
}

function TeamSlot({ team, label, won, right }: { team: Team | null; label: string | null; won: boolean; right?: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.slot, right ? styles.slotRight : null]}>
      {team ? <TeamBadge name={team.name} shortName={team.shortName} color={team.color} size={30} /> : <View style={[styles.tbd, { borderColor: colors.border }]} />}
      <AppText variant="label" numberOfLines={1} style={styles.flex} align={right ? 'right' : 'left'} color={won ? colors.gold : team ? colors.text : colors.textMuted}>
        {team?.name ?? label ?? 'TBD'}
      </AppText>
    </View>
  );
}

const BOX_H = 64;
const GAP = 14;

/** Knockout bracket: one column per round, with connector lines drawn in SVG. */
function Bracket({ fixtures, matches, teamMap, onPress }: { fixtures: Fixture[]; matches: Record<string, MatchRecord>; teamMap: Record<string, Team>; onPress: (f: Fixture) => void }) {
  const { colors } = useTheme();
  const rounds = [...new Set(fixtures.map(f => f.round))].sort((a, b) => a - b);
  const cols = rounds.map(r => fixtures.filter(f => f.round === r).sort((a, b) => a.slot - b.slot));
  if (cols.length === 0) {
    return null;
  }
  const firstCount = Math.max(...cols.map(c => c.length));
  const height = firstCount * (BOX_H + GAP);
  const COL_W = 168;
  const CONN = 26;
  const yOf = (ci: number, i: number) => {
    const n = cols[ci].length;
    const slotH = height / n;
    return slotH * i + slotH / 2 - BOX_H / 2;
  };
  const byId = new Map(fixtures.map(f => [f.id, f]));
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View style={{ width: cols.length * (COL_W + CONN), height: height + 30 }}>
        <Svg width={cols.length * (COL_W + CONN)} height={height + 30} style={StyleSheet.absoluteFill}>
          {cols.map((col, ci) =>
            col.map((f, i) => {
              if (!f.nextFixtureId) {
                return null;
              }
              const next = byId.get(f.nextFixtureId);
              if (!next) {
                return null;
              }
              const ni = cols[ci + 1]?.indexOf(next) ?? -1;
              if (ni < 0) {
                return null;
              }
              const x1 = ci * (COL_W + CONN) + COL_W;
              const y1 = 24 + yOf(ci, i) + BOX_H / 2;
              const x2 = (ci + 1) * (COL_W + CONN);
              const y2 = 24 + yOf(ci + 1, ni) + BOX_H / 2;
              const mx = x1 + CONN / 2;
              return <Path key={f.id} d={`M${x1} ${y1} H${mx} V${y2} H${x2}`} stroke={f.winnerTeamId ? colors.gold : colors.border} strokeWidth={2} fill="none" />;
            }),
          )}
        </Svg>
        {cols.map((col, ci) => (
          <View key={ci} style={{ position: 'absolute', left: ci * (COL_W + CONN), top: 0, width: COL_W }}>
            <AppText variant="overline" tone={col[0]?.stage === 'final' ? 'gold' : 'secondary'}>
              {STAGE[col[0]?.stage ?? 'knockout']}
            </AppText>
            {col.map((f, i) => {
              const m = f.matchId ? matches[f.matchId] : undefined;
              return (
                <Animated.View key={f.id} entering={FadeInRight.delay(ci * 150 + i * 60).springify().damping(16)} style={{ position: 'absolute', top: 24 + yOf(ci, i), width: COL_W }}>
                  <PressableScale onPress={() => onPress(f)} style={[styles.box, { backgroundColor: colors.card, borderColor: f.stage === 'final' ? colors.gold : m?.status === 'live' ? colors.danger : colors.border }]} accessibilityLabel={`${STAGE[f.stage]}: ${teamMap[f.teamAId ?? '']?.name ?? f.labelA ?? 'TBD'} versus ${teamMap[f.teamBId ?? '']?.name ?? f.labelB ?? 'TBD'}`}>
                    {[f.teamAId, f.teamBId].map((id, k) => {
                      const t = id ? teamMap[id] : null;
                      const won = !!f.winnerTeamId && f.winnerTeamId === id;
                      return (
                        <View key={k} style={styles.boxRow}>
                          <View style={[styles.dot, { backgroundColor: t?.color ?? colors.surfaceHigh }]} />
                          <AppText variant="caption" numberOfLines={1} style={styles.flex} color={won ? colors.gold : t ? colors.text : colors.textMuted}>
                            {t?.name ?? (k === 0 ? f.labelA : f.labelB) ?? 'TBD'}
                          </AppText>
                          {won ? <Icon name="check" size={14} color={colors.gold} /> : null}
                        </View>
                      );
                    })}
                  </PressableScale>
                </Animated.View>
              );
            })}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.md, gap: spacing.sm },
  spacer: { height: 120 },
  champ: { alignItems: 'center', gap: spacing.xs, marginTop: spacing.md },
  gap: { gap: spacing.sm },
  flex: { flex: 1 },
  th: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  tr: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.sm, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth },
  pos: { width: 22 },
  teamCell: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  col: { width: 32, textAlign: 'center' },
  nrr: { width: 56, textAlign: 'right' },
  note: { padding: spacing.sm },
  fixture: { padding: spacing.md, borderRadius: radius.lg, borderWidth: 1, gap: 6 },
  fxTeams: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  slot: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  slotRight: { flexDirection: 'row-reverse' },
  tbd: { width: 30, height: 30, borderRadius: 15, borderWidth: 1.5, borderStyle: 'dashed' },
  decide: { borderWidth: 1, borderRadius: radius.sm, paddingVertical: 6, alignItems: 'center' },
  box: { height: BOX_H, borderRadius: radius.sm, borderWidth: 1.5, paddingHorizontal: spacing.xs, justifyContent: 'center', gap: 4 },
  boxRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
});

