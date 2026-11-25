import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, SlideInLeft, SlideInRight, SlideOutLeft, SlideOutRight } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { SheetRef } from '../../components/AppBottomSheet';
import { AppHeader } from '../../components/AppHeader';
import { AppText } from '../../components/AppText';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Chip, FormField, SectionHeader, SegmentedControl, Stepper, SwitchRow } from '../../components/Controls';
import { Icon } from '../../components/Icon';
import { Avatar } from '../../components/PlayerCard';
import { PressableScale } from '../../components/PressableScale';
import { ProgressBar } from '../../components/ProgressBar';
import { ScreenBackground } from '../../components/ScreenBackground';
import { TeamBadge } from '../../components/TeamBadge';
import { SplitColors, TeamVersus } from '../../components/TeamVersus';
import { FORMAT_LABELS, applyBallType, presetRules, validateRules } from '../../core/engine/rules';
import type { BallType, MatchFormat, MatchRules } from '../../core/engine/types';
import type { Player, Team } from '../../data/models';
import { getDb } from '../../data/db/database';
import { tournamentRepository } from '../../data/repositories/tournamentRepository';
import { useAsync } from '../../hooks/useAsync';
import { haptic } from '../../services/haptics';
import { matchService } from '../../services/matchService';
import { playerService, teamService, type HeadToHead } from '../../services/teamService';
import { errorMessage, toast } from '../../stores/appStore';
import { useMotion } from '../../stores/settingsStore';
import { fonts, images, radius, spacing, useTheme, withAlpha } from '../../theme';
import type { RootScreenProps } from '../../app/navigation/types';
import { TeamPickerSheet } from './TeamPickerSheet';

type Step = 0 | 1 | 2;
const FORMATS: Array<{ f: MatchFormat; sub: string }> = [
  { f: 'T10', sub: '10 overs' },
  { f: 'T20', sub: '20 overs' },
  { f: 'ODI', sub: '50 overs' },
  { f: 'TEST', sub: '2 innings' },
  { f: 'CUSTOM', sub: 'Your rules' },
];
const OVER_CHIPS = [5, 6, 8, 10, 12, 15, 20, 25, 30, 40, 50];
export const FLOW_STEPS = ['Teams', 'Setup', 'XI', 'Toss', 'Openers'];

interface XI {
  ids: string[];
  captain: string | null;
  keeper: string | null;
}

/** Step indicator for the whole match flow (shared with the toss screen). */
export function FlowSteps({ current }: { current: number }) {
  const { colors } = useTheme();
  return (
    <View style={styles.flow} accessibilityLabel={`Step ${current + 1} of ${FLOW_STEPS.length}: ${FLOW_STEPS[current]}`}>
      {FLOW_STEPS.map((s, i) => (
        <View key={s} style={styles.flowItem}>
          <View style={[styles.flowBar, { backgroundColor: i <= current ? colors.primary : withAlpha(colors.text, 0.18) }]} />
          <AppText variant="nav" color={i === current ? colors.text : colors.textMuted}>
            {s}
          </AppText>
        </View>
      ))}
    </View>
  );
}

export function MatchCreateScreen({ navigation, route }: RootScreenProps<'MatchCreate'>) {
  const fixtureId = route.params?.fixtureId;
  const tournamentId = route.params?.tournamentId;
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const m = useMotion();
  const teams = useAsync(() => teamService.all());
  const players = useAsync(() => playerService.list());
  const [step, setStep] = useState<Step>(0);
  const [dir, setDir] = useState<1 | -1>(1);
  const [teamA, setTeamA] = useState<string | null>(null);
  const [teamB, setTeamB] = useState<string | null>(null);
  const [rules, setRules] = useState<MatchRules>(presetRules('T20'));
  const [rulesLocked, setRulesLocked] = useState(false);
  const [title, setTitle] = useState('');
  const [venue, setVenue] = useState('');
  const [xi, setXi] = useState<Record<string, XI>>({});
  const [xiTab, setXiTab] = useState<'a' | 'b'>('a');
  const [advanced, setAdvanced] = useState(false);
  const [saving, setSaving] = useState(false);
  const [h2h, setH2h] = useState<HeadToHead | null>(null);
  const pickerA = useRef<SheetRef>(null);
  const pickerB = useRef<SheetRef>(null);

  useEffect(() => {
    if (!fixtureId || !tournamentId) {
      return;
    }
    (async () => {
      const db = await getDb();
      const [f, t] = await Promise.all([tournamentRepository.fixture(db, fixtureId), tournamentRepository.get(db, tournamentId)]);
      if (f && t) {
        setTeamA(f.teamAId);
        setTeamB(f.teamBId);
        setRules(t.rules);
        setRulesLocked(true);
        setTitle(t.name);
      }
    })();
  }, [fixtureId, tournamentId]);

  useEffect(() => {
    setH2h(null);
    if (teamA && teamB) {
      teamService.headToHead(teamA, teamB).then(setH2h).catch(() => setH2h(null));
    }
  }, [teamA, teamB]);

  const teamMap = useMemo(() => Object.fromEntries((teams.data ?? []).map(t => [t.id, t])) as Record<string, Team>, [teams.data]);
  const squads = useMemo(() => {
    const map: Record<string, Player[]> = {};
    for (const p of players.data ?? []) {
      if (p.teamId) {
        (map[p.teamId] ??= []).push(p);
      }
    }
    return map;
  }, [players.data]);

  // default XI: first N players of each squad (kept when the squad still contains them)
  useEffect(() => {
    setXi(prev => {
      const next = { ...prev };
      for (const id of [teamA, teamB]) {
        if (!id) {
          continue;
        }
        const squad = squads[id] ?? [];
        const current = next[id];
        const valid = current ? current.ids.filter(p => squad.some(s => s.id === p)).slice(0, rules.playersPerSide) : [];
        if (!current || valid.length === 0) {
          const ids = squad.slice(0, rules.playersPerSide).map(p => p.id);
          next[id] = { ids, captain: ids[0] ?? null, keeper: squad.find(p => p.role === 'wicketKeeper' && ids.includes(p.id))?.id ?? null };
        } else {
          next[id] = { ...current, ids: valid };
        }
      }
      return next;
    });
  }, [teamA, teamB, squads, rules.playersPerSide]);

  const a = teamA ? teamMap[teamA] ?? null : null;
  const b = teamB ? teamMap[teamB] ?? null : null;
  const ruleIssues = validateRules(rules);
  const xiProblems = [teamA, teamB]
    .filter((t): t is string => !!t)
    .map(t => ((xi[t]?.ids.length ?? 0) < 2 ? `${teamMap[t]?.name ?? 'A team'} needs at least 2 players in the XI.` : null))
    .filter(Boolean) as string[];
  const permanentTeams = (teams.data ?? []).filter(t => !t.isTemporary || t.id === teamA || t.id === teamB);

  const go = (s: Step) => {
    setDir(s > step ? 1 : -1);
    setStep(s);
    haptic('select');
  };
  const openPicker = (side: 'a' | 'b') => {
    if (fixtureId) {
      toast('Tournament fixtures have fixed teams.');
      return;
    }
    // one sheet per side: opening the second side never races the first sheet's close animation
    (side === 'a' ? pickerA : pickerB).current?.present();
  };
  const setFormat = (f: MatchFormat) => setRules(r => ({ ...presetRules(f, r.ballType), playersPerSide: r.playersPerSide }));
  const setBallType = (bt: BallType) => setRules(r => applyBallType(r, bt));
  const patch = (p: Partial<MatchRules>) => setRules(r => ({ ...r, ...p }));
  const captainName = (tid: string | null) => {
    const c = tid ? xi[tid]?.captain : null;
    return c ? `Captain: ${(players.data ?? []).find(p => p.id === c)?.name ?? ''}` : undefined;
  };

  const create = async () => {
    if (!teamA || !teamB) {
      return;
    }
    if (xiProblems.length) {
      toast(xiProblems[0], 'error');
      return;
    }
    setSaving(true);
    try {
      const id = await matchService.create({
        title,
        rules,
        teamAId: teamA,
        teamBId: teamB,
        venue,
        squadA: xi[teamA].ids,
        squadB: xi[teamB].ids,
        captainA: xi[teamA].captain,
        captainB: xi[teamB].captain,
        keeperA: xi[teamA].keeper,
        keeperB: xi[teamB].keeper,
        tournamentId: tournamentId ?? null,
        fixtureId: fixtureId ?? null,
      });
      haptic('success');
      navigation.replace('Toss', { matchId: id });
    } catch (e) {
      haptic('error');
      toast(errorMessage(e), 'error');
    } finally {
      setSaving(false);
    }
  };

  const entering = m === 'full' ? (dir > 0 ? SlideInRight : SlideInLeft).springify().damping(20) : FadeIn;
  const exiting = m === 'full' ? (dir > 0 ? SlideOutLeft : SlideOutRight).duration(160) : undefined;
  const bg = step === 0 ? images.matchup : step === 1 ? images.aerial : images.xi;

  return (
    <ScreenBackground source={bg} dim={step === 0 ? 0.05 : 0.3} imageOpacity={1}>
      {step === 0 && a && b ? <SplitColors a={a.color} b={b.color} opacity={0.35} /> : null}
      <AppHeader title={step === 0 ? 'Head to head' : step === 1 ? 'Match setup' : 'Playing XI'} subtitle={fixtureId ? 'Tournament fixture' : 'New match'} onBack={() => (step > 0 ? go((step - 1) as Step) : navigation.goBack())} />
      <View style={styles.flowWrap}>
        <FlowSteps current={step} />
      </View>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 130 }]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Animated.View key={step} entering={entering} exiting={exiting} style={styles.gap}>
          {step === 0 ? (
            <>
              <View style={styles.versus}>
                <TeamVersus
                  a={a ? { ...a, caption: captainName(teamA) } : null}
                  b={b ? { ...b, caption: captainName(teamB) } : null}
                  size={118}
                  onPressA={() => openPicker('a')}
                  onPressB={() => openPicker('b')}
                  introKey={`${teamA}-${teamB}`}
                  placeholder="Choose team"
                />
              </View>
              {!fixtureId && (a || b) ? (
                <View style={styles.swapRow}>
                  <PressableScale onPress={() => { setTeamA(teamB); setTeamB(teamA); }} accessibilityLabel="Swap home and away" style={[styles.swap, { backgroundColor: colors.glass, borderColor: colors.border }]} hapticKind="select">
                    <Icon name="swap" size={18} color={colors.primary} />
                    <AppText variant="label">Swap sides</AppText>
                  </PressableScale>
                </View>
              ) : null}
              {a && b ? (
                <Animated.View entering={FadeInDown.delay(300)}>
                  <Card glass style={styles.gapSm}>
                    <AppText variant="overline" tone="accent">
                      Head-to-head record
                    </AppText>
                    {h2h && h2h.played > 0 ? (
                      <>
                        <View style={styles.h2hRow}>
                          <AppText style={styles.h2hNum} color={a.color === '#F8FAFC' ? colors.text : a.color}>
                            {h2h.aWins}
                          </AppText>
                          <View style={styles.flex}>
                            <View style={[styles.h2hBar, { backgroundColor: colors.surfaceHigh }]}>
                              <View style={{ flex: Math.max(0.001, h2h.aWins), backgroundColor: a.color }} />
                              <View style={{ flex: Math.max(0.001, h2h.other), backgroundColor: colors.textMuted }} />
                              <View style={{ flex: Math.max(0.001, h2h.bWins), backgroundColor: b.color }} />
                            </View>
                            <AppText variant="caption" tone="secondary" align="center">
                              {h2h.played} played · {h2h.other} tied/NR
                            </AppText>
                          </View>
                          <AppText style={styles.h2hNum} color={b.color === '#F8FAFC' ? colors.text : b.color}>
                            {h2h.bWins}
                          </AppText>
                        </View>
                        {h2h.last ? (
                          <AppText variant="caption" tone="secondary">
                            Last time: {h2h.last.resultText}
                          </AppText>
                        ) : null}
                        <AppText variant="caption" tone="secondary">
                          Best totals: {a.shortName} {h2h.aBest ?? '–'} · {b.shortName} {h2h.bBest ?? '–'}
                        </AppText>
                      </>
                    ) : (
                      <AppText variant="body" tone="secondary">
                        First meeting between these sides. Make it count.
                      </AppText>
                    )}
                  </Card>
                </Animated.View>
              ) : (
                <Card glass>
                  <AppText variant="body" tone="secondary" align="center">
                    Tap each side to pick a saved team or create a quick team just for this match.
                  </AppText>
                </Card>
              )}
            </>
          ) : null}

          {step === 1 ? (
            <>
              {rulesLocked ? (
                <Card glass>
                  <AppText variant="h3">Tournament rules apply</AppText>
                  <AppText variant="caption" tone="secondary">
                    {FORMAT_LABELS[rules.format]} · {rules.oversPerInnings ?? 'Unlimited'} overs · {rules.playersPerSide} players · {rules.ballType === 'tape' ? 'Tape ball' : 'Hard ball'}
                  </AppText>
                </Card>
              ) : (
                <>
                  <SectionHeader title="Format" />
                  <View style={styles.formats}>
                    {FORMATS.map(({ f, sub }) => {
                      const on = rules.format === f;
                      return (
                        <PressableScale key={f} testID={`format-${f}`} onPress={() => setFormat(f)} hapticKind="select" accessibilityState={{ selected: on }} accessibilityLabel={`${FORMAT_LABELS[f]}, ${sub}`} style={[styles.formatCard, { backgroundColor: on ? colors.primary : colors.glass, borderColor: on ? colors.primaryBright : colors.border }]}>
                          <AppText style={styles.formatName} color={on ? colors.onPrimary : colors.text}>
                            {f === 'TEST' ? 'TEST' : f === 'CUSTOM' ? 'CUSTOM' : f}
                          </AppText>
                          <AppText variant="caption" color={on ? colors.onPrimary : colors.textSecondary}>
                            {sub}
                          </AppText>
                        </PressableScale>
                      );
                    })}
                  </View>
                  {rules.inningsPerSide === 1 ? (
                    <>
                      <SectionHeader title={`Overs · ${rules.oversPerInnings}`} />
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
                        {OVER_CHIPS.map(o => (
                          <Chip key={o} label={`${o}`} selected={rules.oversPerInnings === o} onPress={() => patch({ oversPerInnings: o, format: rules.format === 'CUSTOM' || ![10, 20, 50].includes(o) ? 'CUSTOM' : rules.format, maxOversPerBowler: Math.max(1, Math.ceil(o / 5)) })} testID={`overs-${o}`} />
                        ))}
                      </ScrollView>
                    </>
                  ) : null}
                  <SegmentedControl value={rules.ballType} onChange={setBallType} testIDPrefix="ball" options={[{ value: 'hard', label: 'Hard ball' }, { value: 'tape', label: 'Tape ball' }]} />
                  <Card glass style={styles.gapSm}>
                    <Stepper label="Players per side" value={rules.playersPerSide} min={2} max={11} onChange={v => patch({ playersPerSide: v ?? 11 })} testID="rule-players" />
                    {rules.format === 'CUSTOM' ? <Stepper label="Overs per innings" value={rules.oversPerInnings} min={1} max={100} onChange={v => patch({ oversPerInnings: v ?? 1 })} testID="rule-overs" allowNull={rules.inningsPerSide === 2} /> : null}
                    <Stepper label="Max overs per bowler" value={rules.maxOversPerBowler} min={1} max={50} allowNull nullLabel="No limit" onChange={v => patch({ maxOversPerBowler: v })} testID="rule-bowler-limit" />
                  </Card>
                  <PressableScale onPress={() => setAdvanced(!advanced)} accessibilityLabel="Advanced rules" style={styles.advToggle} hapticKind="select">
                    <AppText variant="h3">Advanced rules</AppText>
                    <Icon name={advanced ? 'chevronDown' : 'chevronRight'} size={18} color={colors.textSecondary} />
                  </PressableScale>
                  {advanced ? (
                    <Animated.View entering={FadeInDown}>
                      <Card glass style={styles.gapSm}>
                        {rules.format === 'CUSTOM' ? <Stepper label="Innings per side" value={rules.inningsPerSide} min={1} max={2} onChange={v => patch({ inningsPerSide: (v === 2 ? 2 : 1) as 1 | 2, oversPerInnings: v === 2 ? null : rules.oversPerInnings ?? 20 })} /> : null}
                        <Stepper label="Balls per over" value={rules.ballsPerOver} min={4} max={8} onChange={v => patch({ ballsPerOver: v ?? 6 })} />
                        <Stepper label="Wide penalty" value={rules.wideRuns} min={0} max={5} onChange={v => patch({ wideRuns: v ?? 1 })} />
                        <Stepper label="No-ball penalty" value={rules.noBallRuns} min={0} max={5} onChange={v => patch({ noBallRuns: v ?? 1 })} />
                        <SwitchRow label="Free hit after a no-ball" value={rules.freeHit} onChange={v => patch({ freeHit: v })} />
                        <SwitchRow label="LBW" value={rules.lbwAllowed} onChange={v => patch({ lbwAllowed: v })} />
                        <SwitchRow label="Leg byes" value={rules.legByesAllowed} onChange={v => patch({ legByesAllowed: v })} />
                        <SwitchRow label="Last man stands" description="The last batter can bat alone" value={rules.lastManStands} onChange={v => patch({ lastManStands: v })} />
                        {rules.inningsPerSide === 1 ? <SwitchRow label="Super over on a tie" value={rules.superOverOnTie} onChange={v => patch({ superOverOnTie: v })} /> : null}
                        {rules.inningsPerSide === 2 ? <Stepper label="Follow-on margin" value={rules.followOnMargin} min={50} max={400} step={25} allowNull nullLabel="Off" onChange={v => patch({ followOnMargin: v })} /> : null}
                      </Card>
                    </Animated.View>
                  ) : null}
                  {ruleIssues.map(i => (
                    <AppText key={i.field} variant="caption" tone="danger">
                      {i.message}
                    </AppText>
                  ))}
                </>
              )}
              <SectionHeader title="Match info" />
              <FormField label="Match title (optional)" value={title} onChangeText={setTitle} placeholder={a && b ? `${a.shortName} vs ${b.shortName}` : 'Sunday Final'} maxLength={60} testID="match-title" />
              <FormField label="Venue (optional)" value={venue} onChangeText={setVenue} placeholder={a?.homeGround ?? 'Ground name'} maxLength={60} testID="match-venue" />
            </>
          ) : null}

          {step === 2 && a && b ? (
            <>
              <SegmentedControl value={xiTab} onChange={setXiTab} testIDPrefix="xi-team" options={[{ value: 'a', label: a.name }, { value: 'b', label: b.name }]} />
              {[a, b]
                .filter((t, i) => (xiTab === 'a' ? i === 0 : i === 1))
                .map(t => (
                  <XIPicker
                    key={t.id}
                    team={t}
                    squad={squads[t.id] ?? []}
                    value={xi[t.id] ?? { ids: [], captain: null, keeper: null }}
                    max={rules.playersPerSide}
                    onChange={v => setXi(prev => ({ ...prev, [t.id]: v }))}
                    onAddPlayer={() => navigation.navigate('PlayerForm', { teamId: t.id })}
                  />
                ))}
              {xiProblems.map(p => (
                <AppText key={p} variant="caption" tone="danger">
                  {p}
                </AppText>
              ))}
            </>
          ) : null}
        </Animated.View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.sm, backgroundColor: colors.overlay, borderColor: colors.border }]}>
        {step === 0 ? (
          <View style={styles.footRow}>
            <Button label="Quick start" variant="secondary" disabled={!a || !b} onPress={create} loading={saving} testID="match-quick-start" icon={<Icon name="bolt" size={16} color={colors.primary} />} />
            <Button label="Set up match" size="lg" style={styles.flex} disabled={!a || !b} onPress={() => go(1)} testID="match-next" />
          </View>
        ) : step === 1 ? (
          <Button label="Pick the Playing XI" size="lg" disabled={ruleIssues.length > 0} onPress={() => go(2)} testID="match-to-xi" />
        ) : (
          <Button label="Continue to toss" size="lg" disabled={xiProblems.length > 0} loading={saving} onPress={create} testID="match-create" />
        )}
        {step === 0 && a && b ? (
          <AppText variant="caption" tone="muted" align="center">
            Quick start uses {FORMAT_LABELS[rules.format]} rules and the first {rules.playersPerSide} players of each squad.
          </AppText>
        ) : null}
      </View>

      {(['a', 'b'] as const).map(side => (
        <TeamPickerSheet
          key={side}
          ref={side === 'a' ? pickerA : pickerB}
          side={side}
          teams={permanentTeams.filter(t => !t.isTemporary)}
          disabledId={side === 'a' ? teamB : teamA}
          onPick={t => {
            if (side === 'a') {
              setTeamA(t.id);
            } else {
              setTeamB(t.id);
            }
            teams.reload();
            players.reload();
            (side === 'a' ? pickerA : pickerB).current?.dismiss();
          }}
        />
      ))}
    </ScreenBackground>
  );
}

function XIPicker({ team, squad, value, max, onChange, onAddPlayer }: { team: Team; squad: Player[]; value: XI; max: number; onChange: (v: XI) => void; onAddPlayer: () => void }) {
  const { colors } = useTheme();
  const selected = value.ids.map(id => squad.find(p => p.id === id)).filter(Boolean) as Player[];
  const bench = squad.filter(p => !value.ids.includes(p.id));
  const toggle = (id: string) => {
    if (value.ids.includes(id)) {
      onChange({ ids: value.ids.filter(x => x !== id), captain: value.captain === id ? null : value.captain, keeper: value.keeper === id ? null : value.keeper });
    } else if (value.ids.length < max) {
      onChange({ ...value, ids: [...value.ids, id] });
    } else {
      toast(`The XI is full (${max} players). Remove someone first.`);
    }
  };
  const move = (i: number, d: -1 | 1) => {
    const ids = [...value.ids];
    const j = i + d;
    if (j < 0 || j >= ids.length) {
      return;
    }
    [ids[i], ids[j]] = [ids[j], ids[i]];
    onChange({ ...value, ids });
  };
  return (
    <Card glass style={styles.gapSm}>
      <View style={styles.xiHead}>
        <TeamBadge name={team.name} shortName={team.shortName} color={team.color} size={44} />
        <View style={styles.flex}>
          <AppText variant="h3">{team.name}</AppText>
          <AppText variant="caption" tone="secondary">
            Batting order · tap a name to bench them
          </AppText>
        </View>
        <AppText style={styles.xiCount} color={colors.primary}>
          {value.ids.length}/{max}
        </AppText>
      </View>
      <ProgressBar value={value.ids.length / max} height={5} />
      {selected.map((p, i) => (
        <Animated.View key={p.id} entering={FadeInDown.delay(i * 25)} style={[styles.xiRow, { borderColor: colors.border }]}>
          <AppText style={styles.order} color={colors.textMuted}>
            {String(i + 1).padStart(2, '0')}
          </AppText>
          <Avatar name={p.name} color={team.color} size={34} />
          <PressableScale onPress={() => toggle(p.id)} style={styles.flex} accessibilityLabel={`Remove ${p.name} from the XI`} hapticKind="select">
            <AppText variant="bodyStrong" numberOfLines={1}>
              {p.name}
            </AppText>
            <AppText variant="caption" tone="secondary">
              {value.captain === p.id ? 'Captain' : ''}
              {value.captain === p.id && value.keeper === p.id ? ' · ' : ''}
              {value.keeper === p.id ? 'Wicket-keeper' : ''}
            </AppText>
          </PressableScale>
          <MiniBtn label="C" active={value.captain === p.id} onPress={() => onChange({ ...value, captain: value.captain === p.id ? null : p.id })} a11y={`Make ${p.name} captain`} />
          <MiniBtn label="WK" active={value.keeper === p.id} onPress={() => onChange({ ...value, keeper: value.keeper === p.id ? null : p.id })} a11y={`Make ${p.name} wicket-keeper`} />
          <MiniBtn label="↑" onPress={() => move(i, -1)} a11y={`Move ${p.name} up`} />
          <MiniBtn label="↓" onPress={() => move(i, 1)} a11y={`Move ${p.name} down`} />
        </Animated.View>
      ))}
      {bench.length > 0 ? (
        <>
          <AppText variant="overline" tone="muted">
            Bench · tap to add
          </AppText>
          <View style={styles.wrap}>
            {bench.map(p => (
              <Chip key={p.id} label={p.name} onPress={() => toggle(p.id)} testID={`bench-${p.name}`} />
            ))}
          </View>
        </>
      ) : null}
      <Button label={`Add a player to ${team.name}`} variant="ghost" onPress={onAddPlayer} icon={<Icon name="plus" size={16} color={colors.primary} />} />
    </Card>
  );
}

function MiniBtn({ label, onPress, active, a11y }: { label: string; onPress: () => void; active?: boolean; a11y: string }) {
  const { colors } = useTheme();
  return (
    <PressableScale onPress={onPress} accessibilityLabel={a11y} hapticKind="select" hitSlop={4} style={[styles.mini, { backgroundColor: active ? colors.primary : colors.surface, borderColor: active ? colors.primaryBright : colors.border }]}>
      <AppText variant="caption" color={active ? colors.onPrimary : colors.text}>
        {label}
      </AppText>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  flowWrap: { paddingHorizontal: spacing.md, marginBottom: spacing.xs },
  flow: { flexDirection: 'row', gap: 6 },
  flowItem: { flex: 1, gap: 4 },
  flowBar: { height: 4, borderRadius: 2 },
  content: { padding: spacing.md },
  gap: { gap: spacing.md },
  gapSm: { gap: spacing.sm },
  versus: { paddingTop: spacing.xl, paddingBottom: spacing.md },
  swapRow: { alignItems: 'center' },
  swap: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: spacing.md, height: 40, borderRadius: radius.pill, borderWidth: 1 },
  h2hRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  h2hNum: { fontFamily: fonts.scoreHeavy, fontSize: 40, lineHeight: 44, minWidth: 34, textAlign: 'center' },
  h2hBar: { flexDirection: 'row', height: 10, borderRadius: 5, overflow: 'hidden', marginBottom: 4 },
  formats: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  formatCard: { width: '31.6%', paddingVertical: spacing.sm, paddingHorizontal: spacing.sm, borderRadius: radius.md, borderWidth: 1 },
  formatName: { fontFamily: fonts.scoreHeavy, fontSize: 26, lineHeight: 28 },
  chips: { gap: spacing.xs },
  advToggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.xs },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  xiHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  xiCount: { fontFamily: fonts.scoreHeavy, fontSize: 30 },
  xiRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6, borderTopWidth: StyleSheet.hairlineWidth },
  order: { width: 24, fontFamily: fonts.score, fontSize: 18 },
  mini: { minWidth: 32, height: 32, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: spacing.md, paddingTop: spacing.sm, gap: 6, borderTopWidth: 1 },
  footRow: { flexDirection: 'row', gap: spacing.xs },
});
