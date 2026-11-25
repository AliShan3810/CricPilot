import React, { forwardRef, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { BottomSheetTextInput } from '@gorhom/bottom-sheet';
import { AppBottomSheet, type SheetRef } from '../../components/AppBottomSheet';
import { AppText } from '../../components/AppText';
import { Button } from '../../components/Button';
import { FormField, OptionRow, SegmentedControl } from '../../components/Controls';
import { PressableScale } from '../../components/PressableScale';
import { TeamBadge } from '../../components/TeamBadge';
import { ValidationError } from '../../core/utils/validation';
import type { Team } from '../../data/models';
import { haptic } from '../../services/haptics';
import { teamService } from '../../services/teamService';
import { errorMessage, toast } from '../../stores/appStore';
import { TEAM_COLORS, fonts, radius, spacing, useTheme } from '../../theme';

interface Props {
  side: 'a' | 'b';
  teams: Team[];
  disabledId: string | null;
  onPick: (team: Team) => void;
}

/** Choose an existing team, or create a temporary team just for this match. */
export const TeamPickerSheet = forwardRef<SheetRef, Props>(function TeamPickerSheetImpl({ side, teams, disabledId, onPick }, ref) {
  const { colors } = useTheme();
  const [mode, setModeState] = useState<'existing' | 'quick'>(teams.length >= 2 ? 'existing' : 'quick');
  // teams load asynchronously: follow the count until the scorer picks a mode themselves
  const modeChosen = useRef(false);
  const setMode = (m: 'existing' | 'quick') => {
    modeChosen.current = true;
    setModeState(m);
  };
  useEffect(() => {
    if (!modeChosen.current) {
      setModeState(teams.length >= 2 ? 'existing' : 'quick');
    }
  }, [teams.length]);
  // uncontrolled: the input keeps its own text (no per-keystroke round-trip, so fast typing never drops characters)
  const nameRef = useRef('');
  const [formKey, setFormKey] = useState(0);
  const [color, setColor] = useState(side === 'a' ? TEAM_COLORS[0] : TEAM_COLORS[1]);
  const [roster, setRoster] = useState('');
  const [count, setCount] = useState(6);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // one sheet instance serves both sides: reset the form when the side changes
  useEffect(() => {
    setColor(side === 'a' ? TEAM_COLORS[0] : TEAM_COLORS[1]);
    nameRef.current = '';
    setFormKey(k => k + 1);
    setRoster('');
    setError(null);
  }, [side]);

  const fill = () => {
    const base = nameRef.current.trim() || (side === 'a' ? 'Home' : 'Away');
    setRoster(Array.from({ length: count }, (_, i) => `${base} ${i + 1}`).join('\n'));
    setError(null);
  };

  const createQuick = async () => {
    setSaving(true);
    setError(null);
    try {
      const { team } = await teamService.createQuick({ name: nameRef.current.trim() || (side === 'a' ? 'Home XI' : 'Away XI'), color, playerNames: roster.split('\n') });
      haptic('success');
      onPick(team);
      nameRef.current = '';
      setFormKey(k => k + 1);
      setRoster('');
    } catch (e) {
      setError(e instanceof ValidationError ? e.message : errorMessage(e));
      if (!(e instanceof ValidationError)) {
        toast(errorMessage(e), 'error');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppBottomSheet ref={ref} title={side === 'a' ? 'Home side' : 'Away side'} subtitle="Pick a saved team or create one just for this match." snapPoints={['88%']} testID={`sheet-team-${side}`}>
      <SegmentedControl value={mode} onChange={setMode} testIDPrefix={`team-mode-${side}`} options={[{ value: 'existing', label: `Saved teams (${teams.length})` }, { value: 'quick', label: 'Quick team' }]} />
      {mode === 'existing' ? (
        <>
          {teams.length === 0 ? (
            <AppText variant="body" tone="secondary">
              No saved teams yet. Create a quick team instead.
            </AppText>
          ) : null}
          {teams.map(t => {
            const tooFew = (t.playerCount ?? 0) < 2;
            return (
              <OptionRow
                key={t.id}
                testID={`pick-team-${side}-${t.shortName}`}
                title={t.name}
                subtitle={t.id === disabledId ? 'Already playing on the other side' : tooFew ? `${t.playerCount ?? 0} players: add at least 2` : `${t.playerCount} players${t.homeGround ? ` · ${t.homeGround}` : ''}`}
                disabled={t.id === disabledId || tooFew}
                left={<TeamBadge name={t.name} shortName={t.shortName} color={t.color} size={36} />}
                onPress={() => onPick(t)}
              />
            );
          })}
        </>
      ) : (
        <View style={styles.gap}>
          <FormField key={`name-${formKey}`} inSheet label="Team name" defaultValue="" onChangeText={t => (nameRef.current = t)} placeholder={side === 'a' ? 'e.g. Street Strikers' : 'e.g. Night Owls'} maxLength={28} testID={`quick-name-${side}`} />
          <View style={styles.colors}>
            {TEAM_COLORS.slice(0, 10).map(c => (
              <PressableScale key={c} onPress={() => setColor(c)} hapticKind="select" accessibilityLabel={`Colour ${c}`} accessibilityState={{ selected: c === color }} style={[styles.swatch, { backgroundColor: c, borderColor: c === color ? colors.text : 'transparent' }]} />
            ))}
          </View>
          <AppText variant="caption" tone="secondary">
            Players, one per line (2–11)
          </AppText>
          <BottomSheetTextInput
            value={roster}
            onChangeText={t => {
              setRoster(t);
              setError(null);
            }}
            autoCorrect={false}
            spellCheck={false}
            autoCapitalize="words"
            multiline
            placeholder={'Ali\nBilal\nChand'}
            placeholderTextColor={colors.textMuted}
            style={[styles.roster, { color: colors.text, backgroundColor: colors.surface, borderColor: error ? colors.danger : colors.border }]}
            accessibilityLabel="Player names, one per line"
            testID={`quick-roster-${side}`}
          />
          <View style={styles.fillRow}>
            <SegmentedControl value={String(count)} onChange={v => setCount(Number(v))} options={['4', '6', '8', '11'].map(v => ({ value: v, label: `${v} players` }))} />
          </View>
          <Button label="Auto-fill player names" variant="secondary" onPress={fill} testID={`quick-fill-${side}`} />
          {error ? (
            <AppText variant="label" tone="danger">
              {error}
            </AppText>
          ) : null}
          <Button label="Use this team" onPress={createQuick} loading={saving} testID={`quick-create-${side}`} />
          <AppText variant="caption" tone="muted">
            Quick teams are kept with the match but hidden from your team list. You can save one as a permanent team from its page.
          </AppText>
        </View>
      )}
    </AppBottomSheet>
  );
});

const styles = StyleSheet.create({
  gap: { gap: spacing.sm },
  colors: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  swatch: { width: 34, height: 34, borderRadius: 12, borderWidth: 3 },
  roster: { minHeight: 130, borderRadius: radius.md, borderWidth: 1, padding: spacing.sm, fontFamily: fonts.semibold, fontSize: 15, textAlignVertical: 'top' },
  fillRow: {},
});
