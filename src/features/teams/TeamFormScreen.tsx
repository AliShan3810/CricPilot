import React, { useEffect, useState } from 'react';
import { confirmAlert } from '../../components/ConfirmDialog';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppHeader } from '../../components/AppHeader';
import { AppText } from '../../components/AppText';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { FormField } from '../../components/Controls';
import { PressableScale } from '../../components/PressableScale';
import { ScreenBackground } from '../../components/ScreenBackground';
import { TeamBadge } from '../../components/TeamBadge';
import { Icon } from '../../components/Icon';
import { ValidationError, shortNameFrom } from '../../core/utils/validation';
import { haptic } from '../../services/haptics';
import { teamService } from '../../services/teamService';
import { errorMessage, toast } from '../../stores/appStore';
import { TEAM_COLORS, images, radius, spacing, useTheme } from '../../theme';
import type { RootScreenProps } from '../../app/navigation/types';

export function TeamFormScreen({ navigation, route }: RootScreenProps<'TeamForm'>) {
  const teamId = route.params?.teamId;
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const [name, setName] = useState('');
  const [shortName, setShortName] = useState('');
  const [shortTouched, setShortTouched] = useState(false);
  const [color, setColor] = useState(TEAM_COLORS[0]);
  const [ground, setGround] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!teamId) {
      return;
    }
    teamService.get(teamId).then(t => {
      if (t) {
        setName(t.name);
        setShortName(t.shortName);
        setShortTouched(true);
        setColor(t.color);
        setGround(t.homeGround ?? '');
      }
    });
  }, [teamId]);

  const effectiveShort = shortTouched ? shortName : shortNameFrom(name);

  const save = async () => {
    setSaving(true);
    setErrors({});
    try {
      const t = await teamService.save({ name, shortName: effectiveShort, color, homeGround: ground }, teamId);
      haptic('success');
      toast(teamId ? 'Team updated' : `${t?.name} created`, 'success');
      if (!teamId && t) {
        navigation.replace('TeamDetail', { teamId: t.id });
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
    if (!teamId) {
      return;
    }
    confirmAlert('Delete team?', 'Its players stay in your squad list without a team.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await teamService.remove(teamId);
            toast('Team deleted', 'success');
            navigation.navigate('Main', { screen: 'Teams' });
          } catch (e) {
            toast(errorMessage(e), 'error');
          }
        },
      },
    ]);
  };

  return (
    <ScreenBackground source={images.bat} dim={0.35}>
      <AppHeader title={teamId ? 'Edit team' : 'New team'} subtitle="Team" actions={teamId ? [{ icon: 'trash', label: 'Delete team', onPress: remove }] : []} />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]} keyboardShouldPersistTaps="handled">
          <Card glass style={styles.preview}>
            <TeamBadge name={name || 'Team'} shortName={effectiveShort || 'TM'} color={color} size={88} />
            <AppText variant="h2" numberOfLines={1}>
              {name || 'Your team'}
            </AppText>
          </Card>
          <FormField label="Team name" value={name} onChangeText={setName} placeholder="e.g. Lahore Lions" maxLength={32} error={errors.teamName} testID="team-name" autoCapitalize="words" />
          <FormField
            label="Short name (2–4 letters)"
            value={effectiveShort}
            onChangeText={v => {
              setShortTouched(true);
              setShortName(v.toUpperCase());
            }}
            autoCapitalize="characters"
            maxLength={4}
            error={errors.shortName}
            testID="team-short"
          />
          <FormField label="Home ground (optional)" value={ground} onChangeText={setGround} placeholder="e.g. Model Town Ground" maxLength={60} testID="team-ground" />
          <AppText variant="caption" tone="secondary">
            Team colour
          </AppText>
          <View style={styles.colors} accessibilityRole="radiogroup">
            {TEAM_COLORS.map(c => (
              <PressableScale
                key={c}
                hapticKind="select"
                accessibilityRole="radio"
                accessibilityLabel={`Colour ${c}`}
                accessibilityState={{ selected: c === color }}
                onPress={() => setColor(c)}
                style={[styles.swatch, { backgroundColor: c, borderColor: c === color ? colors.text : 'transparent' }]}>
                {c === color ? <Icon name="check" size={18} color="#0B1222" /> : null}
              </PressableScale>
            ))}
          </View>
          <Button label={teamId ? 'Save changes' : 'Create team'} size="lg" onPress={save} loading={saving} testID="team-save" />
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: spacing.md, gap: spacing.md },
  preview: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.lg },
  colors: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  swatch: { width: 44, height: 44, borderRadius: radius.pill, borderWidth: 3, alignItems: 'center', justifyContent: 'center' },
});
