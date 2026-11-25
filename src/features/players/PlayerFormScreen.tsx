import React, { useEffect, useState } from 'react';
import { confirmAlert } from '../../components/ConfirmDialog';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppHeader } from '../../components/AppHeader';
import { AppText } from '../../components/AppText';
import { Button } from '../../components/Button';
import { Chip, FormField, SegmentedControl } from '../../components/Controls';
import { ScreenBackground } from '../../components/ScreenBackground';
import { ValidationError } from '../../core/utils/validation';
import type { PlayerRole } from '../../data/models';
import { ROLE_LABELS } from '../../data/repositories/playerRepository';
import { useAsync } from '../../hooks/useAsync';
import { haptic } from '../../services/haptics';
import { playerService, teamService } from '../../services/teamService';
import { errorMessage, toast } from '../../stores/appStore';
import { images, spacing } from '../../theme';
import type { RootScreenProps } from '../../app/navigation/types';

const BOWLING = ['Right-arm fast', 'Right-arm medium', 'Left-arm fast', 'Left-arm medium', 'Off spin', 'Leg spin', 'Left-arm orthodox', 'Left-arm wrist spin'];

export function PlayerFormScreen({ navigation, route }: RootScreenProps<'PlayerForm'>) {
  const playerId = route.params?.playerId;
  const insets = useSafeAreaInsets();
  const teams = useAsync(() => teamService.list());
  const [name, setName] = useState('');
  const [teamId, setTeamId] = useState<string | null>(route.params?.teamId ?? null);
  const [role, setRole] = useState<PlayerRole>('batter');
  const [bat, setBat] = useState<'right' | 'left'>('right');
  const [bowl, setBowl] = useState<string | null>(null);
  const [jersey, setJersey] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [addMore, setAddMore] = useState(false);

  useEffect(() => {
    if (!playerId) {
      return;
    }
    playerService.get(playerId).then(p => {
      if (p) {
        setName(p.name);
        setTeamId(p.teamId);
        setRole(p.role);
        setBat(p.battingStyle);
        setBowl(p.bowlingStyle);
        setJersey(p.jerseyNumber !== null ? String(p.jerseyNumber) : '');
      }
    });
  }, [playerId]);

  const save = async (another: boolean) => {
    setSaving(true);
    setAddMore(another);
    setErrors({});
    try {
      const jn = jersey.trim() === '' ? null : Number(jersey);
      const p = await playerService.save({ name, teamId, role, battingStyle: bat, bowlingStyle: bowl, jerseyNumber: jn }, playerId);
      haptic('success');
      toast(playerId ? 'Player updated' : `${p?.name} added`, 'success');
      if (another) {
        setName('');
        setJersey('');
      } else {
        navigation.goBack();
      }
    } catch (e) {
      haptic('error');
      if (e instanceof ValidationError) {
        setErrors({ [e.field]: e.message });
      } else {
        toast(errorMessage(e), 'error');
      }
    } finally {
      setSaving(false);
    }
  };

  const remove = () => {
    if (!playerId) {
      return;
    }
    confirmAlert('Delete player?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await playerService.remove(playerId);
            toast('Player deleted', 'success');
            navigation.goBack();
          } catch (e) {
            toast(errorMessage(e), 'error');
          }
        },
      },
    ]);
  };

  return (
    <ScreenBackground source={images.bat} dim={0.2}>
      <AppHeader title={playerId ? 'Edit player' : 'New player'} subtitle="Player" actions={playerId ? [{ icon: 'trash', label: 'Delete player', onPress: remove }] : []} />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]} keyboardShouldPersistTaps="handled">
          <FormField label="Full name" value={name} onChangeText={setName} placeholder="e.g. Ahmed Khan" maxLength={40} error={errors.playerName} autoCapitalize="words" testID="player-name" />
          <FormField label="Jersey number (optional)" value={jersey} onChangeText={v => setJersey(v.replace(/[^0-9]/g, ''))} keyboardType="number-pad" maxLength={3} error={errors.jerseyNumber} testID="player-jersey" />
          <AppText variant="caption" tone="secondary">
            Team
          </AppText>
          <View style={styles.wrap}>
            <Chip label="No team" selected={teamId === null} onPress={() => setTeamId(null)} />
            {(teams.data ?? []).map(t => (
              <Chip key={t.id} label={t.name} color={t.color} selected={teamId === t.id} onPress={() => setTeamId(t.id)} testID={`player-team-${t.shortName}`} />
            ))}
          </View>
          <AppText variant="caption" tone="secondary">
            Role
          </AppText>
          <View style={styles.wrap}>
            {(Object.keys(ROLE_LABELS) as PlayerRole[]).map(r => (
              <Chip key={r} label={ROLE_LABELS[r]} selected={role === r} onPress={() => setRole(r)} testID={`player-role-${r}`} />
            ))}
          </View>
          <AppText variant="caption" tone="secondary">
            Batting
          </AppText>
          <SegmentedControl value={bat} onChange={setBat} options={[{ value: 'right', label: 'Right-hand' }, { value: 'left', label: 'Left-hand' }]} />
          <AppText variant="caption" tone="secondary">
            Bowling style (optional)
          </AppText>
          <View style={styles.wrap}>
            <Chip label="None" selected={bowl === null} onPress={() => setBowl(null)} />
            {BOWLING.map(b => (
              <Chip key={b} label={b} selected={bowl === b} onPress={() => setBowl(b)} />
            ))}
          </View>
          <Button label={playerId ? 'Save changes' : 'Add player'} size="lg" onPress={() => save(false)} loading={saving && !addMore} testID="player-save" />
          {!playerId ? <Button label="Save and add another" variant="secondary" onPress={() => save(true)} loading={saving && addMore} testID="player-save-another" /> : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: spacing.md, gap: spacing.md },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
});
