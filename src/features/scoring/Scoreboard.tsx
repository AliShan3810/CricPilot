import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, useAnimatedStyle, withSpring, withTiming } from 'react-native-reanimated';
import { AppText } from '../../components/AppText';
import { RollingNumber } from '../../components/AnimatedNumber';
import { BallChip, BallSlot } from '../../components/BallChip';
import { Gradient } from '../../components/Gradient';
import { Icon } from '../../components/Icon';
import { ProgressBar } from '../../components/ProgressBar';
import { TeamBadge } from '../../components/TeamBadge';
import { formatOvers } from '../../core/engine/engine';
import { chaseInfo, economy, fixed, inningsTitle, projectedScore, runRate, strikeRate } from '../../core/engine/selectors';
import type { InningsState, MatchState } from '../../core/engine/types';
import type { Team } from '../../data/models';
import { useMotion } from '../../stores/settingsStore';
import { fonts, motion, radius, spacing, useTheme, withAlpha } from '../../theme';

interface Props {
  state: MatchState;
  teams: Record<string, Team>;
}

/** Broadcast scoreboard: crests, oversized score, overs, rates and animated progress. */
export function Scoreboard({ state, teams }: Props) {
  const { colors } = useTheme();
  const inn = state.innings[state.currentInningsIndex];
  if (!inn) {
    return null;
  }
  const bpo = state.setup.rules.ballsPerOver;
  const bat = teams[inn.battingTeamId];
  const bowl = teams[inn.bowlingTeamId];
  const chase = chaseInfo(state, inn);
  const crr = runRate(inn.runs, inn.legalBalls, bpo);
  const proj = projectedScore(state, inn);
  const partnership = inn.partnerships[inn.partnerships.length - 1];
  const prev = state.innings.filter(i => i.index < inn.index && i.completed);
  const totalBalls = inn.maxOvers !== null ? inn.maxOvers * bpo : null;
  const extras = inn.extras.wides + inn.extras.noBalls + inn.extras.byes + inn.extras.legByes + inn.extras.penalty;

  return (
    <View style={[styles.board, { borderColor: withAlpha(bat?.color ?? colors.primary, 0.45), backgroundColor: colors.card }]} testID="scoreboard">
      <Gradient colors={[withAlpha(bat?.color ?? colors.primary, 0.42), withAlpha(colors.card, 0.4), colors.card]} locations={[0, 0.55, 1]} direction="diagonal" />
      <View style={[styles.accent, { backgroundColor: colors.primary }]} />

      <View style={styles.topRow}>
        {bat ? <TeamBadge name={bat.name} shortName={bat.shortName} color={bat.color} size={40} /> : null}
        <View style={styles.flex}>
          <AppText variant="overline" tone="accent" numberOfLines={1}>
            {inningsTitle(state, inn)}
          </AppText>
          <AppText variant="caption" tone="secondary" numberOfLines={1}>
            {bat?.shortName} v {bowl?.shortName}
            {prev.length ? `  ·  ${prev.map(i => `${teams[i.battingTeamId]?.shortName ?? ''} ${i.runs}/${i.wickets}`).join(' · ')}` : ''}
          </AppText>
        </View>
        {bowl ? <TeamBadge name={bowl.name} shortName={bowl.shortName} color={bowl.color} size={28} /> : null}
      </View>

      <View style={styles.scoreRow} accessible accessibilityLabel={`${bat?.name} ${inn.runs} for ${inn.wickets} after ${formatOvers(inn.legalBalls, bpo)} overs`}>
        <RollingNumber value={inn.runs} variant="hero" testID="score-runs" />
        <AppText style={styles.slash} tone="muted">
          /
        </AppText>
        <RollingNumber value={inn.wickets} variant="display" color={inn.wickets > 0 ? colors.danger : colors.text} testID="score-wickets" />
        <View style={styles.flex} />
        <View style={styles.oversBox}>
          <AppText style={styles.overs} testID="score-overs">
            {formatOvers(inn.legalBalls, bpo)}
            {inn.maxOvers !== null ? `/${inn.maxOvers}` : ''}
          </AppText>
          <AppText variant="overline" tone="muted">
            Overs
          </AppText>
        </View>
        {inn.freeHitNext ? (
          <Animated.View entering={FadeIn} style={[styles.freeHit, { backgroundColor: colors.gold }]}>
            <AppText variant="overline" color={colors.onGold}>
              Free hit
            </AppText>
          </Animated.View>
        ) : null}
      </View>

      {totalBalls ? <ProgressBar value={inn.legalBalls / totalBalls} height={5} accessibilityLabel="Innings progress" /> : null}

      {chase ? (
        <View style={[styles.chase, { backgroundColor: withAlpha(colors.background, 0.55), borderColor: colors.border }]}>
          <Metric label="Target" value={String(chase.target)} highlight={colors.gold} />
          <Metric label="Need" value={String(chase.runsNeeded)} highlight={colors.primaryBright} />
          {chase.ballsRemaining !== null ? <Metric label="Balls" value={String(chase.ballsRemaining)} /> : null}
          <Metric label="Req RR" value={chase.requiredRate !== null ? fixed(chase.requiredRate) : '–'} highlight={chase.requiredRate !== null && chase.requiredRate > crr ? colors.danger : colors.success} />
          <Metric label="CRR" value={fixed(crr)} />
        </View>
      ) : (
        <View style={[styles.chase, { backgroundColor: withAlpha(colors.background, 0.55), borderColor: colors.border }]}>
          <Metric label="CRR" value={fixed(crr)} highlight={colors.primaryBright} />
          {proj !== null ? <Metric label="Projected" value={String(proj)} /> : null}
          {totalBalls ? <Metric label="Balls left" value={String(Math.max(0, totalBalls - inn.legalBalls))} /> : null}
          <Metric label="Extras" value={String(extras)} />
        </View>
      )}

      {chase ? (
        <View style={styles.gapXs}>
          <ProgressBar value={inn.runs / Math.max(1, chase.target)} height={8} colors={[colors.success, colors.primaryBright]} accessibilityLabel={`Chase progress: ${inn.runs} of ${chase.target}`} />
          <AppText variant="bodyStrong" tone="accent" testID="score-situation">
            {chase.ballsRemaining !== null
              ? `${bat?.shortName} need ${chase.runsNeeded} off ${chase.ballsRemaining} ball${chase.ballsRemaining === 1 ? '' : 's'}`
              : `${bat?.shortName} need ${chase.runsNeeded} to win`}
          </AppText>
        </View>
      ) : null}

      {partnership && partnership.unbroken ? (
        <View style={styles.partnership}>
          <Icon name="users" size={14} color={colors.textSecondary} />
          <AppText variant="caption" tone="secondary">
            Partnership <AppText variant="caption">{partnership.runs}</AppText> off {partnership.balls}
          </AppText>
        </View>
      ) : null}
    </View>
  );
}

function Metric({ label, value, highlight }: { label: string; value: string; highlight?: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.metric} accessible accessibilityLabel={`${label} ${value}`}>
      <AppText style={styles.metricValue} color={highlight ?? colors.text}>
        {value}
      </AppText>
      <AppText variant="overline" tone="muted" style={styles.metricLabel}>
        {label}
      </AppText>
    </View>
  );
}

function BatterCard({ id, inn, names, striker, testID }: { id: string; inn: InningsState; names: Record<string, string>; striker: boolean; testID: string }) {
  const { colors } = useTheme();
  const m = useMotion();
  const b = inn.batters.find(x => x.playerId === id);
  const glow = useAnimatedStyle(() => ({
    opacity: m === 'off' ? (striker ? 1 : 0) : withTiming(striker ? 1 : 0, { duration: 220 }),
    transform: [{ scale: m === 'full' ? withSpring(striker ? 1 : 0.96, motion.spring) : 1 }],
  }));
  return (
    <View style={[styles.batter, { backgroundColor: colors.card, borderColor: colors.border }]} accessible accessibilityLabel={`${names[id]}${striker ? ', on strike' : ''}, ${b?.runs ?? 0} off ${b?.balls ?? 0}`} testID={testID}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.batterGlow, { borderColor: colors.primary, backgroundColor: withAlpha(colors.primary, 0.1) }, glow]} pointerEvents="none" />
      <View style={styles.batterHead}>
        {striker ? <Icon name="bat" size={14} color={colors.primary} /> : null}
        <AppText variant="label" numberOfLines={1} style={styles.flex} color={striker ? colors.text : colors.textSecondary}>
          {names[id] ?? '—'}
        </AppText>
      </View>
      <View style={styles.batterScore}>
        <AppText style={styles.batterRuns} color={striker ? colors.text : colors.textSecondary}>
          {b?.runs ?? 0}
        </AppText>
        <AppText variant="statSmall" tone="muted">
          ({b?.balls ?? 0})
        </AppText>
      </View>
      <AppText variant="caption" tone="secondary">
        4s {b?.fours ?? 0} · 6s {b?.sixes ?? 0} · SR {fixed(strikeRate(b?.runs ?? 0, b?.balls ?? 0), 0)}
      </AppText>
    </View>
  );
}

/** Striker and non-striker cards plus the bowler card. The strike highlight animates between batters. */
export function CreasePanel({ state, inn, names }: { state: MatchState; inn: InningsState; names: Record<string, string> }) {
  const { colors } = useTheme();
  const bpo = state.setup.rules.ballsPerOver;
  const p = inn.partnerships[inn.partnerships.length - 1];
  const order = [p?.batter1Id ?? inn.strikerId, p?.batter2Id ?? inn.nonStrikerId].filter((x, i, arr) => x && arr.indexOf(x) === i) as string[];
  for (const id of [inn.strikerId, inn.nonStrikerId]) {
    if (id && !order.includes(id)) {
      order.push(id);
    }
  }
  const atCrease = order.filter(id => id === inn.strikerId || id === inn.nonStrikerId).slice(0, 2);
  const bowler = inn.bowlers.find(b => b.playerId === inn.currentBowlerId) ?? inn.bowlers.find(b => b.playerId === inn.lastOverBowlerId);
  return (
    <View style={styles.gapXs}>
      <View style={styles.batters}>
        {atCrease.map(id => (
          <BatterCard key={id} id={id} inn={inn} names={names} striker={id === inn.strikerId} testID={id === inn.strikerId ? 'striker-row' : 'nonstriker-row'} />
        ))}
      </View>
      <View style={[styles.bowler, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={[styles.bowlerIcon, { backgroundColor: withAlpha(colors.info, 0.15) }]}>
          <Icon name="ball" size={18} color={colors.info} />
        </View>
        <View style={styles.flex}>
          <AppText variant="label" numberOfLines={1} testID="bowler-name">
            {bowler ? names[bowler.playerId] : 'Bowler'}
            {inn.currentBowlerId === null && bowler ? ' · last over' : ''}
          </AppText>
          <AppText variant="caption" tone="secondary">
            Econ {bowler ? fixed(economy(bowler.runs, bowler.legalBalls, bpo)) : '–'} · dots {bowler?.dots ?? 0}
          </AppText>
        </View>
        <AppText style={styles.figures} accessibilityLabel={bowler ? `${formatOvers(bowler.legalBalls, bpo)} overs, ${bowler.maidens} maidens, ${bowler.runs} runs, ${bowler.wickets} wickets` : undefined}>
          {bowler ? `${bowler.wickets}-${bowler.runs}` : '–'}
        </AppText>
        <AppText variant="caption" tone="muted">
          {bowler ? `(${formatOvers(bowler.legalBalls, bpo)})` : ''}
        </AppText>
      </View>
    </View>
  );
}

/** This over as ball chips plus the previous over's total. */
export function OverTimeline({ state, inn }: { state: MatchState; inn: InningsState }) {
  const { colors } = useTheme();
  const bpo = state.setup.rules.ballsPerOver;
  const overIndex = Math.floor(inn.legalBalls / bpo);
  const between = inn.legalBalls > 0 && inn.legalBalls % bpo === 0 && inn.currentBowlerId === null;
  const current = between ? inn.overs[overIndex - 1] : inn.overs[overIndex];
  const balls = current?.balls ?? [];
  const legal = balls.filter(b => b.kind === 'legal').length;
  const prev = inn.overs[(between ? overIndex - 1 : overIndex) - 1];
  return (
    <View style={[styles.timeline, { backgroundColor: colors.glass, borderColor: colors.border }]} testID="over-timeline">
      <View style={styles.overLabel}>
        <AppText variant="overline" tone="muted">
          Over
        </AppText>
        <AppText style={styles.overNum}>{between ? overIndex : overIndex + 1}</AppText>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {balls.map((b, i) => (
          <BallChip key={`${b.eventIndex}`} ball={b} animate={i === balls.length - 1} size={32} />
        ))}
        {Array.from({ length: Math.max(0, bpo - legal) }).map((_, i) => (
          <BallSlot key={`slot-${i}`} size={32} />
        ))}
      </ScrollView>
      <View style={[styles.overTotal, { backgroundColor: colors.surface }]}>
        <AppText variant="statSmall">{current?.runs ?? 0}</AppText>
        <AppText variant="caption" tone="muted">
          {prev ? `prev ${prev.runs}` : 'runs'}
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  gapXs: { gap: spacing.xs },
  board: { borderRadius: radius.xl, borderWidth: 1, padding: spacing.md, overflow: 'hidden', gap: spacing.sm },
  accent: { position: 'absolute', left: 0, top: 18, width: 4, height: 64, borderTopRightRadius: 3, borderBottomRightRadius: 3 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  scoreRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 2, marginTop: -6 },
  slash: { fontFamily: fonts.scoreSemibold, fontSize: 52, lineHeight: 70, marginHorizontal: 2 },
  oversBox: { alignItems: 'flex-end', marginBottom: 12 },
  overs: { fontFamily: fonts.score, fontSize: 30, lineHeight: 32 },
  freeHit: { position: 'absolute', right: 0, top: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill },
  chase: { flexDirection: 'row', justifyContent: 'space-between', borderRadius: radius.md, borderWidth: 1, paddingVertical: spacing.xs, paddingHorizontal: spacing.sm },
  metric: { alignItems: 'center', minWidth: 48 },
  metricValue: { fontFamily: fonts.score, fontSize: 24, lineHeight: 26 },
  metricLabel: { fontSize: 9, letterSpacing: 1.2 },
  partnership: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  batters: { flexDirection: 'row', gap: spacing.xs },
  batter: { flex: 1, borderRadius: radius.lg, borderWidth: 1, padding: spacing.sm, overflow: 'hidden', gap: 2 },
  batterGlow: { borderRadius: radius.lg, borderWidth: 2 },
  batterHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  batterScore: { flexDirection: 'row', alignItems: 'flex-end', gap: 4 },
  batterRuns: { fontFamily: fonts.scoreHeavy, fontSize: 38, lineHeight: 40 },
  bowler: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderRadius: radius.lg, borderWidth: 1, padding: spacing.sm },
  bowlerIcon: { width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  figures: { fontFamily: fonts.scoreHeavy, fontSize: 30, lineHeight: 32 },
  timeline: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderRadius: radius.lg, borderWidth: 1, padding: spacing.xs },
  overLabel: { alignItems: 'center', width: 44 },
  overNum: { fontFamily: fonts.scoreHeavy, fontSize: 26, lineHeight: 28 },
  chips: { gap: 6, alignItems: 'center', paddingRight: spacing.xs },
  overTotal: { alignItems: 'center', paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radius.sm, minWidth: 56 },
});
