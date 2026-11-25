import React, { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppHeader } from '../../components/AppHeader';
import { AppText } from '../../components/AppText';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Chip, FormField, SectionHeader, SegmentedControl, Stepper, SwitchRow } from '../../components/Controls';
import { EmptyState } from '../../components/EmptyState';
import { PressableScale } from '../../components/PressableScale';
import { ScreenBackground } from '../../components/ScreenBackground';
import { TeamBadge } from '../../components/TeamBadge';
import { FORMAT_LABELS, applyBallType, presetRules, validateRules } from '../../core/engine/rules';
import type { MatchFormat, MatchRules } from '../../core/engine/types';
import type { TournamentFormat } from '../../core/tournament/tournament';
import { ValidationError } from '../../core/utils/validation';
import { useAsync } from '../../hooks/useAsync';
import { haptic } from '../../services/haptics';
import { teamService } from '../../services/teamService';
import { tournamentService } from '../../services/tournamentService';
import { bumpData, errorMessage, toast } from '../../stores/appStore';
import { images, radius, spacing, useTheme, withAlpha } from '../../theme';
import type { RootScreenProps } from '../../app/navigation/types';

const FORMATS: MatchFormat[] = ['T10', 'T20', 'ODI', 'CUSTOM'];

export function TournamentCreateScreen({ navigation }: RootScreenProps<'TournamentCreate'>) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const teams = useAsync(() => teamService.list());
  const [name, setName] = useState('');
  const [format, setFormat] = useState<TournamentFormat>('league');
  const [rules, setRules] = useState<MatchRules>(presetRules('T20'));
  const [selected, setSelected] = useState<string[]>([]);
  const [double, setDouble] = useState(false);
  const [qualifiers, setQualifiers] = useState(4);
  const [points, setPoints] = useState({ win: 2, tie: 1, noResult: 1 });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const toggle = (id: string) => setSelected(s => (s.includes(id) ? s.filter(x => x !== id) : [...s, id]));
  const issues = validateRules(rules);
  const fixtures =
    format === 'knockout'
      ? Math.max(0, selected.length - 1)
      : ((selected.length * (selected.length - 1)) / 2) * (double ? 2 : 1) + (format === 'leagueKnockout' ? qualifiers - 1 : 0);

  const create = async () => {
    setSaving(true);
    setError(null);
    try {
      const id = await tournamentService.create({ name, format, rules, teamIds: selected, doubleRoundRobin: double, qualifiers, points });
      bumpData();
      haptic('success');
      toast('Tournament created. Fixtures are ready.', 'success');
      navigation.replace('TournamentDetail', { tournamentId: id });
    } catch (e) {
      haptic('error');
      setError(e instanceof ValidationError ? e.message : errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScreenBackground source={images.trophy} dim={0.35}>
      <AppHeader title="New tournament" subtitle="Setup" />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxl }]} keyboardShouldPersistTaps="handled">
        <FormField label="Tournament name" value={name} onChangeText={setName} placeholder="e.g. Ramadan Night Cup" maxLength={40} testID="tournament-name" />
        <SectionHeader title="Structure" />
        <SegmentedControl
          value={format}
          onChange={setFormat}
          testIDPrefix="tformat"
          options={[
            { value: 'league', label: 'League' },
            { value: 'knockout', label: 'Knockout' },
            { value: 'leagueKnockout', label: 'League + KO' },
          ]}
        />
        <AppText variant="caption" tone="secondary">
          {format === 'league'
            ? 'Round robin. Every team plays every other team; the points table and NRR decide the winner.'
            : format === 'knockout'
              ? 'Single elimination with seeded byes. Winners move on automatically.'
              : 'A league stage, then the top teams play semi-finals and a final, seeded from the table.'}
        </AppText>
        {format !== 'knockout' ? <SwitchRow label="Double round robin" description="Teams meet twice (home and away)" value={double} onChange={setDouble} /> : null}
        {format === 'leagueKnockout' ? (
          <View style={styles.wrap}>
            {[2, 4, 8].map(q => (
              <Chip key={q} label={q === 2 ? 'Top 2 → Final' : q === 4 ? 'Top 4 → Semis' : 'Top 8 → Quarters'} selected={qualifiers === q} onPress={() => setQualifiers(q)} />
            ))}
          </View>
        ) : null}

        <SectionHeader title={`Teams · ${selected.length} selected`} />
        {(teams.data ?? []).length < 2 && !teams.loading ? (
          <Card>
            <EmptyState kind="teams" title="You need teams first" message="Create at least two teams to run a tournament." action="Create a team" onAction={() => navigation.navigate('TeamForm')} />
          </Card>
        ) : (
          <View style={styles.teamGrid}>
            {(teams.data ?? []).map(t => {
              const on = selected.includes(t.id);
              return (
                <PressableScale key={t.id} onPress={() => toggle(t.id)} hapticKind="select" testID={`tteam-${t.shortName}`} accessibilityState={{ selected: on }} accessibilityLabel={t.name} style={[styles.team, { backgroundColor: on ? withAlpha(t.color, 0.2) : colors.card, borderColor: on ? t.color : colors.border }]}>
                  <TeamBadge name={t.name} shortName={t.shortName} color={t.color} size={34} />
                  <AppText variant="label" numberOfLines={1} style={styles.flex}>
                    {t.name}
                  </AppText>
                  {on ? (
                    <AppText variant="caption" tone="gold">
                      #{selected.indexOf(t.id) + 1}
                    </AppText>
                  ) : null}
                </PressableScale>
              );
            })}
          </View>
        )}
        <AppText variant="caption" tone="muted">
          Selection order sets the knockout seeding.
        </AppText>

        <SectionHeader title="Match rules" />
        <View style={styles.wrap}>
          {FORMATS.map(f => (
            <Chip key={f} label={FORMAT_LABELS[f]} selected={rules.format === f} onPress={() => setRules(r => ({ ...presetRules(f, r.ballType), playersPerSide: r.playersPerSide }))} />
          ))}
        </View>
        <SegmentedControl value={rules.ballType} onChange={b => setRules(r => applyBallType(r, b))} options={[{ value: 'hard', label: 'Hard ball' }, { value: 'tape', label: 'Tape ball' }]} />
        <Card style={styles.gap}>
          <Stepper label="Overs per innings" value={rules.oversPerInnings} min={1} max={50} onChange={v => setRules(r => ({ ...r, oversPerInnings: v ?? 1 }))} testID="t-overs" />
          <Stepper label="Players per side" value={rules.playersPerSide} min={2} max={11} onChange={v => setRules(r => ({ ...r, playersPerSide: v ?? 11 }))} />
          <Stepper label="Max overs per bowler" value={rules.maxOversPerBowler} min={1} max={20} allowNull nullLabel="No limit" onChange={v => setRules(r => ({ ...r, maxOversPerBowler: v }))} />
          <SwitchRow label="Super over on a tie" value={rules.superOverOnTie} onChange={v => setRules(r => ({ ...r, superOverOnTie: v }))} />
        </Card>
        {format !== 'knockout' ? (
          <Card style={styles.gap}>
            <AppText variant="overline" tone="secondary">
              Points
            </AppText>
            <Stepper label="Win" value={points.win} min={1} max={10} onChange={v => setPoints(p => ({ ...p, win: v ?? 2 }))} />
            <Stepper label="Tie" value={points.tie} min={0} max={10} onChange={v => setPoints(p => ({ ...p, tie: v ?? 1 }))} />
            <Stepper label="No result" value={points.noResult} min={0} max={10} onChange={v => setPoints(p => ({ ...p, noResult: v ?? 1 }))} />
          </Card>
        ) : null}
        {issues.map(i => (
          <AppText key={i.field} variant="caption" tone="danger">
            {i.message}
          </AppText>
        ))}
        {error ? (
          <AppText variant="label" tone="danger" accessibilityLiveRegion="polite">
            {error}
          </AppText>
        ) : null}
        <Button label={`Create tournament${selected.length >= 2 ? ` · ${fixtures} matches` : ''}`} size="lg" onPress={create} loading={saving} disabled={issues.length > 0} testID="tournament-create" />
      </ScrollView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.md, gap: spacing.sm },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  teamGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  team: { width: '48.8%', flexDirection: 'row', alignItems: 'center', gap: spacing.xs, padding: spacing.sm, borderRadius: radius.md, borderWidth: 1.5 },
  flex: { flex: 1 },
  gap: { gap: spacing.xs },
});
