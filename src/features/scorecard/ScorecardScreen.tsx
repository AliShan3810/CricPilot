import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppHeader } from '../../components/AppHeader';
import { AppText } from '../../components/AppText';
import { BallChip } from '../../components/BallChip';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Chip, SectionHeader, SegmentedControl } from '../../components/Controls';
import { ManhattanChart } from '../../components/charts/ManhattanChart';
import { PartnershipBars } from '../../components/charts/PartnershipBars';
import { WagonWheel } from '../../components/charts/WagonWheel';
import { WormChart } from '../../components/charts/WormChart';
import { ScreenBackground } from '../../components/ScreenBackground';
import { StatTile } from '../../components/StatTile';
import { TeamBadge } from '../../components/TeamBadge';
import { bowlerAnalysis, manhattan, phaseSplit, scoringDistribution, wagonWheel, worm } from '../../core/engine/analytics';
import { formatOvers, squadOf } from '../../core/engine/engine';
import { FORMAT_LABELS } from '../../core/engine/rules';
import { economy, fixed, inningsTitle, strikeRate } from '../../core/engine/selectors';
import type { InningsState } from '../../core/engine/types';
import { useAsync } from '../../hooks/useAsync';
import { dismissalText } from '../../services/exporters';
import { fileService } from '../../services/fileService';
import { matchService, type LoadedMatch } from '../../services/matchService';
import { errorMessage, toast } from '../../stores/appStore';
import { images, spacing, useTheme, withAlpha } from '../../theme';
import type { RootScreenProps } from '../../app/navigation/types';

type Tab = 'card' | 'analysis' | 'balls' | 'info';

export function ScorecardScreen({ navigation, route }: RootScreenProps<'Scorecard'>) {
  const { matchId } = route.params;
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { data: m, error } = useAsync(() => matchService.load(matchId), [matchId]);
  const [tab, setTab] = useState<Tab>('card');
  const [innIdx, setInnIdx] = useState(0);
  const [exporting, setExporting] = useState<string | null>(null);

  useEffect(() => {
    if (m) {
      setInnIdx(Math.max(0, m.state.currentInningsIndex));
    }
  }, [m]);

  const names = useMemo(() => {
    const n: Record<string, string> = {};
    if (m) {
      for (const p of Object.values(m.players)) {
        n[p.id] = p.name;
      }
    }
    return n;
  }, [m]);

  if (!m) {
    return (
      <ScreenBackground source={images.pitch}>
        <AppHeader title={error ? 'Could not load match' : 'Loading…'} subtitle={error ?? undefined} />
      </ScreenBackground>
    );
  }
  const { state } = m;
  const teams = { [m.teams.a.id]: m.teams.a, [m.teams.b.id]: m.teams.b };
  const inn = state.innings[innIdx];

  const run = async (key: string, fn: () => Promise<unknown>) => {
    setExporting(key);
    try {
      await fn();
    } catch (e) {
      toast(errorMessage(e), 'error');
    } finally {
      setExporting(null);
    }
  };

  return (
    <ScreenBackground source={images.pitch} dim={0.35}>
      <AppHeader
        title={m.record.title}
        subtitle={m.record.status === 'completed' ? 'Scorecard' : 'Live scorecard'}
        actions={[{ icon: 'file', label: 'Export PDF scorecard', onPress: () => run('pdf', () => fileService.exportScorecardPdf(m)), testID: 'scorecard-pdf' }]}
      />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxl }]}>
        <Card glass accent={m.record.status === 'completed' ? colors.gold : colors.danger}>
          <View style={styles.matchHead}>
            {[m.teams.a, m.teams.b].map(t => {
              const tInns = state.innings.filter(i => i.battingTeamId === t.id && !i.isSuperOver);
              return (
                <View key={t.id} style={styles.teamCol}>
                  <TeamBadge name={t.name} shortName={t.shortName} color={t.color} size={44} />
                  <AppText variant="label" numberOfLines={1}>
                    {t.name}
                  </AppText>
                  <AppText variant="stat">{tInns.map(i => `${i.runs}/${i.wickets}${i.declared ? 'd' : ''}`).join(' & ') || '–'}</AppText>
                  <AppText variant="caption" tone="secondary">
                    {tInns.map(i => `${formatOvers(i.legalBalls, state.setup.rules.ballsPerOver)} ov`).join(' & ')}
                  </AppText>
                </View>
              );
            })}
          </View>
          <AppText variant="bodyStrong" tone={state.result ? 'gold' : 'accent'} align="center" testID="scorecard-result">
            {state.result?.summary ?? m.record.summary?.situation ?? 'In progress'}
          </AppText>
        </Card>
        {m.record.status !== 'completed' ? <Button label="Resume scoring" onPress={() => navigation.navigate('LiveScoring', { matchId })} variant="gold" testID="scorecard-resume" /> : null}

        <SegmentedControl
          value={tab}
          onChange={setTab}
          testIDPrefix="sc-tab"
          options={[
            { value: 'card', label: 'Scorecard' },
            { value: 'analysis', label: 'Analysis' },
            { value: 'balls', label: 'Overs' },
            { value: 'info', label: 'Info' },
          ]}
        />
        {state.innings.length > 1 && tab !== 'info' ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            {state.innings.map((i, k) => (
              <Chip key={k} label={inningsTitle(state, i).replace(' · ', ' ')} selected={innIdx === k} color={teams[i.battingTeamId]?.color} onPress={() => setInnIdx(k)} />
            ))}
          </ScrollView>
        ) : null}

        {state.innings.length === 0 ? (
          <AppText variant="body" tone="secondary" align="center">
            The match has not started yet.
          </AppText>
        ) : null}

        {inn && tab === 'card' ? <InningsCard m={m} inn={inn} names={names} /> : null}
        {inn && tab === 'analysis' ? <Analysis m={m} inn={inn} names={names} /> : null}
        {inn && tab === 'balls' ? <BallByBall m={m} inn={inn} names={names} /> : null}
        {tab === 'info' ? (
          <Card style={styles.gap}>
            <InfoRow label="Format" value={`${FORMAT_LABELS[state.setup.rules.format]}${state.setup.rules.oversPerInnings ? ` · ${state.setup.rules.oversPerInnings} overs` : ''}`} />
            <InfoRow label="Ball" value={state.setup.rules.ballType === 'tape' ? 'Tape ball' : 'Hard ball'} />
            <InfoRow label="Players" value={`${state.setup.rules.playersPerSide} per side`} />
            <InfoRow label="Balls per over" value={String(state.setup.rules.ballsPerOver)} />
            <InfoRow label="Bowler limit" value={state.setup.rules.maxOversPerBowler ? `${state.setup.rules.maxOversPerBowler} overs` : 'None'} />
            <InfoRow label="Free hit" value={state.setup.rules.freeHit ? 'On' : 'Off'} />
            <InfoRow label="LBW / leg byes" value={`${state.setup.rules.lbwAllowed ? 'LBW on' : 'No LBW'} · ${state.setup.rules.legByesAllowed ? 'leg byes on' : 'no leg byes'}`} />
            {m.record.venue ? <InfoRow label="Venue" value={m.record.venue} /> : null}
            {m.record.tossWinnerId ? <InfoRow label="Toss" value={`${teams[m.record.tossWinnerId]?.name} chose to ${m.record.tossDecision}`} /> : null}
            <InfoRow label="Date" value={new Date(m.record.scheduledAt ?? m.record.createdAt).toDateString()} />
            {[m.teams.a, m.teams.b].map(t => (
              <InfoRow
                key={t.id}
                label={`${t.shortName} XI`}
                value={squadOf(state, t.id)
                  .playerIds.map(id => {
                    const mp = m.matchPlayers.find(x => x.playerId === id);
                    return `${names[id]}${mp?.isCaptain ? ' (c)' : ''}${mp?.isKeeper ? ' †' : ''}`;
                  })
                  .join(', ')}
              />
            ))}
          </Card>
        ) : null}

        <SectionHeader title="Export" />
        <View style={styles.exportRow}>
          <Button label="PDF" variant="secondary" onPress={() => run('pdf', () => fileService.exportScorecardPdf(m))} loading={exporting === 'pdf'} style={styles.flex} testID="export-pdf" />
          <Button label="CSV card" variant="secondary" onPress={() => run('csv', () => fileService.exportMatchCsv(m, 'scorecard'))} loading={exporting === 'csv'} style={styles.flex} testID="export-csv" />
          <Button label="Ball CSV" variant="secondary" onPress={() => run('balls', () => fileService.exportMatchCsv(m, 'balls'))} loading={exporting === 'balls'} style={styles.flex} />
        </View>
        {m.record.status === 'completed' ? <Button label="Result card" variant="ghost" onPress={() => navigation.navigate('Victory', { matchId })} /> : null}
      </ScrollView>
    </ScreenBackground>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <AppText variant="caption" tone="secondary" style={styles.infoLabel}>
        {label}
      </AppText>
      <AppText variant="label" style={styles.flex}>
        {value}
      </AppText>
    </View>
  );
}

function InningsCard({ m, inn, names }: { m: LoadedMatch; inn: InningsState; names: Record<string, string> }) {
  const { colors } = useTheme();
  const { state } = m;
  const bpo = state.setup.rules.ballsPerOver;
  const e = inn.extras;
  const yetToBat = squadOf(state, inn.battingTeamId).playerIds.filter(id => !inn.batters.some(b => b.playerId === id));
  return (
    <>
      <Card padded={false}>
        <View style={[styles.th, { backgroundColor: colors.surface }]}>
          <AppText variant="overline" tone="secondary" style={styles.flex}>
            Batter
          </AppText>
          {['R', 'B', '4s', '6s', 'SR'].map(h => (
            <AppText key={h} variant="overline" tone="secondary" style={styles.col}>
              {h}
            </AppText>
          ))}
        </View>
        {inn.batters.map(b => {
          const atCrease = !inn.completed && (b.playerId === inn.strikerId || b.playerId === inn.nonStrikerId);
          return (
            <View key={b.playerId} style={[styles.tr, { borderColor: colors.border }]}>
              <View style={styles.flex}>
                <AppText variant="label" numberOfLines={1} color={atCrease ? colors.primary : colors.text}>
                  {names[b.playerId]}
                  {b.playerId === inn.strikerId && !inn.completed ? ' *' : ''}
                </AppText>
                <AppText variant="caption" tone="secondary" numberOfLines={1}>
                  {dismissalText(b.dismissal, names, b.retiredHurt)}
                </AppText>
              </View>
              <AppText variant="statSmall" style={styles.col} color={b.runs >= 50 ? colors.gold : colors.text}>
                {b.runs}
              </AppText>
              <AppText variant="body" tone="secondary" style={styles.col}>
                {b.balls}
              </AppText>
              <AppText variant="body" tone="secondary" style={styles.col}>
                {b.fours}
              </AppText>
              <AppText variant="body" tone="secondary" style={styles.col}>
                {b.sixes}
              </AppText>
              <AppText variant="caption" tone="secondary" style={styles.col}>
                {fixed(strikeRate(b.runs, b.balls), 1)}
              </AppText>
            </View>
          );
        })}
        <View style={[styles.tr, { borderColor: colors.border }]}>
          <AppText variant="label" style={styles.flex}>
            Extras
          </AppText>
          <AppText variant="caption" tone="secondary">
            {e.wides + e.noBalls + e.byes + e.legByes + e.penalty} (b {e.byes}, lb {e.legByes}, w {e.wides}, nb {e.noBalls}
            {e.penalty ? `, p ${e.penalty}` : ''})
          </AppText>
        </View>
        <View style={[styles.tr, { borderColor: colors.border, backgroundColor: withAlpha(colors.primary, 0.08) }]}>
          <AppText variant="bodyStrong" style={styles.flex}>
            Total
          </AppText>
          <AppText variant="statSmall">
            {inn.runs}/{inn.wickets}
            {inn.declared ? 'd' : ''}
          </AppText>
          <AppText variant="caption" tone="secondary">
            {'  '}({formatOvers(inn.legalBalls, bpo)} ov · RR {fixed((inn.runs * bpo) / Math.max(1, inn.legalBalls))})
          </AppText>
        </View>
        {yetToBat.length > 0 ? (
          <View style={styles.pad}>
            <AppText variant="caption" tone="secondary">
              Yet to bat: {yetToBat.map(id => names[id]).join(', ')}
            </AppText>
          </View>
        ) : null}
        {inn.fallOfWickets.length > 0 ? (
          <View style={styles.pad}>
            <AppText variant="caption" tone="secondary">
              Fall of wickets: {inn.fallOfWickets.map(f => `${f.teamScore}-${f.wicketNumber} (${names[f.batterId]}, ${f.overBall})`).join(', ')}
            </AppText>
          </View>
        ) : null}
      </Card>

      <Card padded={false}>
        <View style={[styles.th, { backgroundColor: colors.surface }]}>
          <AppText variant="overline" tone="secondary" style={styles.flex}>
            Bowler
          </AppText>
          {['O', 'M', 'R', 'W', 'Econ'].map(h => (
            <AppText key={h} variant="overline" tone="secondary" style={styles.col}>
              {h}
            </AppText>
          ))}
        </View>
        {inn.bowlers.map(b => (
          <View key={b.playerId} style={[styles.tr, { borderColor: colors.border }]}>
            <View style={styles.flex}>
              <AppText variant="label" numberOfLines={1}>
                {names[b.playerId]}
              </AppText>
              <AppText variant="caption" tone="secondary">
                {b.dots} dots · {b.wides} wd · {b.noBalls} nb
              </AppText>
            </View>
            <AppText variant="body" style={styles.col}>
              {formatOvers(b.legalBalls, bpo)}
            </AppText>
            <AppText variant="body" tone="secondary" style={styles.col}>
              {b.maidens}
            </AppText>
            <AppText variant="body" style={styles.col}>
              {b.runs}
            </AppText>
            <AppText variant="statSmall" style={styles.col} color={b.wickets >= 3 ? colors.gold : colors.text}>
              {b.wickets}
            </AppText>
            <AppText variant="caption" tone="secondary" style={styles.col}>
              {fixed(economy(b.runs, b.legalBalls, bpo))}
            </AppText>
          </View>
        ))}
      </Card>
    </>
  );
}

function Analysis({ m, inn, names }: { m: LoadedMatch; inn: InningsState; names: Record<string, string> }) {
  const { colors } = useTheme();
  const { state } = m;
  const bpo = state.setup.rules.ballsPerOver;
  const teamColor = (id: string) => (id === m.teams.a.id ? m.teams.a.color : m.teams.b.color);
  // compare all innings of the same kind (main innings together; each super over with its pair)
  const series = state.innings.filter(i => i.isSuperOver === inn.isSuperOver && (!inn.isSuperOver || i.superOverNumber === inn.superOverNumber)).slice(0, 4);
  const dist = scoringDistribution(inn.balls);
  const phases = phaseSplit(state, inn);
  const [wagonBatter, setWagonBatter] = useState<string | null>(null);
  const shots = wagonWheel(inn, wagonBatter ?? undefined);
  const anyShots = wagonWheel(inn).length > 0;
  const label = (i: InningsState) => `${(i.battingTeamId === m.teams.a.id ? m.teams.a : m.teams.b).shortName}${series.filter(s => s.battingTeamId === i.battingTeamId).length > 1 ? ` ${i.index + 1}` : ''}`;
  return (
    <>
      <SectionHeader title="Manhattan · runs per over" />
      <Card>
        <ManhattanChart series={series.map(i => ({ label: label(i), color: teamColor(i.battingTeamId), bars: manhattan(i) }))} />
      </Card>
      <SectionHeader title="Worm · cumulative runs" />
      <Card>
        <WormChart series={series.map(i => ({ label: label(i), color: teamColor(i.battingTeamId), points: worm(i, bpo) }))} maxOvers={inn.maxOvers} />
      </Card>
      {phases.length > 0 ? (
        <>
          <SectionHeader title="Phases" />
          <View style={styles.tiles}>
            {phases.map(p => (
              <StatTile key={p.label} label={p.label} value={`${p.runs}/${p.wickets}`} hint={`RR ${fixed(p.runRate)} · ov ${p.fromOver}-${p.toOver}`} />
            ))}
          </View>
        </>
      ) : null}
      <SectionHeader title="Scoring shots" />
      <View style={styles.tiles}>
        <StatTile label="Dots" value={dist.dots} />
        <StatTile label="1s" value={dist.ones} />
        <StatTile label="2s/3s" value={dist.twos + dist.threes} />
        <StatTile label="4s" value={dist.fours} accent={colors.primary} />
        <StatTile label="6s" value={dist.sixes} accent={colors.gold} />
      </View>
      <SectionHeader title="Partnerships" />
      <Card>
        {inn.partnerships.length ? <PartnershipBars partnerships={inn.partnerships} names={names} color={teamColor(inn.battingTeamId)} /> : <AppText tone="secondary">No partnerships yet.</AppText>}
      </Card>
      <SectionHeader title="Bowling analysis" />
      <Card style={styles.gap}>
        {bowlerAnalysis(state, inn).map(b => (
          <View key={b.playerId} style={styles.analysisRow}>
            <AppText variant="label" style={styles.flex} numberOfLines={1}>
              {names[b.playerId]}
            </AppText>
            <AppText variant="caption" tone="secondary">
              {b.overs} ov · {b.wickets}/{b.runs} · econ {fixed(b.economy)} · dots {fixed(b.dotPercent, 0)}% · 4s/6s {b.boundariesConceded}
            </AppText>
          </View>
        ))}
      </Card>
      <SectionHeader title="Wagon wheel" />
      <Card style={styles.gap}>
        {anyShots ? (
          <>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
              <Chip label="All" selected={wagonBatter === null} onPress={() => setWagonBatter(null)} />
              {inn.batters
                .filter(b => b.shots.length > 0)
                .map(b => (
                  <Chip key={b.playerId} label={names[b.playerId]} selected={wagonBatter === b.playerId} onPress={() => setWagonBatter(b.playerId)} />
                ))}
            </ScrollView>
            <WagonWheel shots={shots} />
          </>
        ) : (
          <AppText variant="body" tone="secondary">
            No shot directions recorded. Turn on “Record shot directions” in the scoring screen’s More menu to build a wagon wheel.
          </AppText>
        )}
      </Card>
    </>
  );
}

function BallByBall({ m, inn, names }: { m: LoadedMatch; inn: InningsState; names: Record<string, string> }) {
  const { colors } = useTheme();
  const overs = [...inn.overs].filter(Boolean).reverse();
  return (
    <View style={styles.gap}>
      {overs.map(o => (
        <Card key={o.number} style={styles.overCard}>
          <View style={styles.overHead}>
            <AppText variant="h3">Over {o.number + 1}</AppText>
            <AppText variant="caption" tone="secondary" style={styles.flex} numberOfLines={1}>
              {'  '}
              {o.bowlerIds.map(id => names[id]).join(' / ')}
            </AppText>
            <AppText variant="statSmall" color={o.isMaiden ? colors.gold : colors.text}>
              {o.runs}
              {o.wickets ? `/${o.wickets}` : ''}
            </AppText>
          </View>
          <View style={styles.ballsRow}>
            {o.balls.map(b => (
              <BallChip key={b.eventIndex} ball={b} size={32} />
            ))}
          </View>
          {o.balls
            .filter(b => b.wicket)
            .map(b => (
              <AppText key={b.eventIndex} variant="caption" tone="danger">
                Wicket: {names[b.wicket!.batterOutId]} ({b.wicket!.type})
              </AppText>
            ))}
          <AppText variant="caption" tone="muted">
            {m.teams.a.id === inn.battingTeamId ? m.teams.a.shortName : m.teams.b.shortName} {o.balls[o.balls.length - 1]?.teamScoreAfter}/{o.balls[o.balls.length - 1]?.wicketsAfter}
          </AppText>
        </Card>
      ))}
      {overs.length === 0 ? (
        <AppText variant="body" tone="secondary" align="center">
          No balls bowled yet.
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingHorizontal: spacing.md, gap: spacing.sm },
  gap: { gap: spacing.sm },
  matchHead: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: spacing.sm },
  teamCol: { alignItems: 'center', gap: 2, flex: 1 },
  chips: { gap: spacing.xs },
  th: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  tr: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderTopWidth: StyleSheet.hairlineWidth },
  col: { width: 40, textAlign: 'right' },
  pad: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  analysisRow: { gap: 2 },
  overCard: { gap: spacing.xs },
  overHead: { flexDirection: 'row', alignItems: 'center' },
  ballsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  infoRow: { flexDirection: 'row', gap: spacing.sm },
  infoLabel: { width: 96 },
  exportRow: { flexDirection: 'row', gap: spacing.xs },
});

