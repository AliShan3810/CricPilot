import React, { useState } from 'react';
import { confirmAlert } from '../../components/ConfirmDialog';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppHeader } from '../../components/AppHeader';
import { AppText } from '../../components/AppText';
import { BrandMark } from '../../components/BrandMark';
import { Card } from '../../components/Card';
import { FormField, OptionRow, SectionHeader, SegmentedControl, SwitchRow } from '../../components/Controls';
import { Icon } from '../../components/Icon';
import { ScreenBackground } from '../../components/ScreenBackground';
import { getDb } from '../../data/db/database';
import { BACKUP_TABLES } from '../../data/repositories/backupRepository';
import { SCHEMA_VERSION } from '../../data/db/migrations';
import { setLastMatch } from '../../data/storage/preferences';
import { fileService } from '../../services/fileService';
import { SoundManager } from '../../services/sound/SoundManager';
import type { CueName } from '../../services/sound/cues';
import { Slider } from '../../components/Slider';
import { Chip } from '../../components/Controls';
import { Platform } from 'react-native';
import { haptic } from '../../services/haptics';
import { matchService } from '../../services/matchService';
import { bumpData, errorMessage, toast } from '../../stores/appStore';
import { effectiveMotion, useSettings } from '../../stores/settingsStore';
import { BRAND_NAME, BRAND_TAGLINE, images, spacing, useTheme } from '../../theme';
import type { RootScreenProps } from '../../app/navigation/types';

const VERSION = require('../../../package.json').version as string;

const PREVIEWS: Array<{ cue: CueName; label: string }> = [
  { cue: 'four', label: 'Four' },
  { cue: 'six', label: 'Six' },
  { cue: 'wicket', label: 'Wicket' },
  { cue: 'duck', label: 'Duck' },
  { cue: 'fifty', label: 'Fifty' },
  { cue: 'century', label: 'Century' },
  { cue: 'hatTrick', label: 'Hat-trick' },
  { cue: 'coin', label: 'Coin toss' },
  { cue: 'innings', label: 'Innings' },
  { cue: 'victory', label: 'Victory' },
  { cue: 'tournament', label: 'Champions' },
];

export function SettingsScreen({ navigation }: RootScreenProps<'Settings'>) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const s = useSettings();
  const [name, setName] = useState(s.userName);
  const [busy, setBusy] = useState<string | null>(null);
  const motion = effectiveMotion(s);
  const [volume, setVolume] = useState(s.soundVolume);

  const run = async (key: string, fn: () => Promise<string | null | void>) => {
    setBusy(key);
    try {
      const msg = await fn();
      if (msg) {
        haptic('success');
        toast(msg, 'success');
      }
    } catch (e) {
      haptic('error');
      toast(errorMessage(e), 'error');
    } finally {
      setBusy(null);
    }
  };

  const restore = () =>
    confirmAlert('Restore a backup?', 'All current teams, players, matches and tournaments will be replaced by the backup. This cannot be undone. Make a backup first if you are unsure.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Choose file',
        style: 'destructive',
        onPress: () =>
          run('restore', async () => {
            const counts = await fileService.restoreBackup();
            if (!counts) {
              return null;
            }
            setLastMatch(null);
            return `Restored ${counts.teams ?? 0} teams, ${counts.players ?? 0} players and ${counts.matches ?? 0} matches`;
          }),
      },
    ]);

  const erase = () =>
    confirmAlert('Erase all data?', 'Every team, player, match and tournament on this phone will be permanently deleted.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Erase everything',
        style: 'destructive',
        onPress: () =>
          run('erase', async () => {
            const db = await getDb();
            await db.transaction(async tx => {
              for (const t of [...BACKUP_TABLES].reverse()) {
                await tx.execute(`DELETE FROM ${t}`);
              }
            });
            setLastMatch(null);
            bumpData();
            return 'All data erased';
          }),
      },
    ]);

  return (
    <ScreenBackground source={images.settings} dim={0.3}>
      <AppHeader title="Settings" />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxl }]} keyboardShouldPersistTaps="handled">
        <SectionHeader title="Profile" />
        <Card style={styles.gap}>
          <FormField label="Your name (shown on the dashboard)" value={name} onChangeText={setName} onEndEditing={() => s.update({ userName: name.trim().slice(0, 24) })} maxLength={24} placeholder="Optional" testID="settings-name" />
        </Card>

        <SectionHeader title="Appearance" />
        <Card style={styles.gap}>
          <AppText variant="caption" tone="secondary">
            Theme
          </AppText>
          <SegmentedControl value={s.themeMode} onChange={v => s.update({ themeMode: v })} testIDPrefix="theme" options={[{ value: 'system', label: 'System' }, { value: 'dark', label: 'Dark' }, { value: 'light', label: 'Light' }]} />
          <AppText variant="caption" tone="secondary">
            Animations
          </AppText>
          <SegmentedControl value={s.motion} onChange={v => s.update({ motion: v })} testIDPrefix="motion" options={[{ value: 'full', label: 'Full' }, { value: 'reduced', label: 'Reduced' }, { value: 'off', label: 'Off' }]} />
          <SwitchRow label="Follow system “Reduce Motion”" description={`Now using: ${motion === 'full' ? 'full animations' : motion === 'reduced' ? 'reduced animations' : 'no animations'}`} value={s.followSystemMotion} onChange={v => s.update({ followSystemMotion: v })} />
        </Card>

        <SectionHeader title="Sound & haptics" />
        <Card style={styles.gap}>
          <SwitchRow label="Sound effects" description="All match sounds" value={s.sound} onChange={v => { s.update({ sound: v }); if (!v) { SoundManager.stopAll(); } }} testID="settings-sound" />
          <View style={[styles.gap, !s.sound ? styles.disabled : null]} pointerEvents={s.sound ? 'auto' : 'none'}>
            <SwitchRow label="Stadium crowd" description="Cheers, roars, groans and applause" value={s.soundCrowd} onChange={v => s.update({ soundCrowd: v })} testID="settings-sound-crowd" />
            <SwitchRow label="Scoring sounds" description="Bat on ball, stumps and the coin toss" value={s.soundScoring} onChange={v => s.update({ soundScoring: v })} testID="settings-sound-scoring" />
            <SwitchRow label="Celebration sounds" description="Milestones, hat-tricks, ducks and victories" value={s.soundCelebration} onChange={v => s.update({ soundCelebration: v })} testID="settings-sound-celebration" />
            <View style={styles.volumeHead}>
              <AppText variant="bodyStrong">Volume</AppText>
              <AppText variant="statSmall" tone="accent">
                {Math.round(volume * 100)}%
              </AppText>
            </View>
            <Slider label="Sound volume" value={volume} onChange={setVolume} onCommit={v => { s.update({ soundVolume: v }); SoundManager.play('four'); }} testID="settings-volume" />
            <AppText variant="caption" tone="secondary">
              Preview
            </AppText>
            <View style={styles.previews}>
              {PREVIEWS.map(p => (
                <Chip key={p.cue} label={p.label} onPress={() => SoundManager.play(p.cue)} testID={`preview-${p.cue}`} />
              ))}
            </View>
          </View>
          <SwitchRow label="Haptic feedback" description="Taps, boundaries, wickets and celebrations" value={s.haptics} onChange={v => s.update({ haptics: v })} testID="settings-haptics" />
          <AppText variant="caption" tone="muted">
            {Platform.OS === 'ios'
              ? 'Sounds follow the silent switch and mix with your music.'
              : 'Sounds play at your media volume and mix with other audio.'}
          </AppText>
        </Card>

        <SectionHeader title="Scoring" />
        <Card style={styles.gap}>
          <SwitchRow label="Record shot directions" description="Ask where each scoring shot went, to build wagon wheels" value={s.recordShots} onChange={v => s.update({ recordShots: v })} />
        </Card>

        <SectionHeader title="Data & backup" />
        <View style={styles.gap}>
          <OptionRow title="Create backup" subtitle="Save every team, player, match and tournament as one file" onPress={() => run('backup', async () => { const r = await fileService.createBackup(); return `Backup saved (${r.counts.matches ?? 0} matches)`; })} left={<Icon name="upload" color={colors.primary} />} testID="settings-backup" disabled={busy !== null} />
          <OptionRow title="Restore backup" subtitle="Replace all data with a backup file" onPress={restore} left={<Icon name="download" color={colors.primary} />} testID="settings-restore" disabled={busy !== null} />
          <OptionRow title="Export statistics (CSV)" subtitle="Career figures for every player" onPress={() => run('csv', async () => { await fileService.exportCareersCsv(); })} left={<Icon name="file" color={colors.primary} />} disabled={busy !== null} />
          <OptionRow title="Rebuild statistics" subtitle="Recalculate every scorecard from its ball-by-ball record" onPress={() => run('rebuild', async () => { const n = await matchService.rebuildAll(); bumpData(); return `Recalculated ${n} matches`; })} left={<Icon name="bolt" color={colors.primary} />} disabled={busy !== null} />
          <OptionRow title="Show introduction again" onPress={() => { s.update({ onboardingDone: false }); navigation.reset({ index: 0, routes: [{ name: 'Onboarding' }] }); }} left={<Icon name="play" color={colors.primary} />} />
          <OptionRow title="Erase all data" subtitle="Cannot be undone" onPress={erase} left={<Icon name="trash" color={colors.danger} />} testID="settings-erase" disabled={busy !== null} />
        </View>

        <SectionHeader title="About" />
        <Card style={styles.about}>
          <BrandMark size={56} />
          <View style={styles.flex}>
            <AppText variant="h3">{BRAND_NAME}</AppText>
            <AppText variant="caption" tone="gold">
              {BRAND_TAGLINE}
            </AppText>
            <AppText variant="caption" tone="secondary">
              Version {VERSION} · database v{SCHEMA_VERSION}
            </AppText>
            <AppText variant="caption" tone="secondary">
              Works 100% offline. No account, no tracking, no servers: your data stays on this phone.
            </AppText>
          </View>
        </Card>
        <Card style={styles.credits}>
          <AppText variant="overline" tone="secondary">
            Credits
          </AppText>
          <AppText variant="caption" tone="secondary">
            Crowd sounds: “Free Crowd Cheering Sounds” by Gregor Quendel (CC BY 4.0). Coin sound by hjm (CC BY 3.0), via OpenGameArt.org. Other sounds CC0 or original. Photography from Unsplash (Unsplash License). Fonts: Outfit, Manrope, Barlow Condensed (SIL OFL).
          </AppText>
        </Card>
      </ScrollView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.md },
  gap: { gap: spacing.sm },
  about: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  disabled: { opacity: 0.4 },
  credits: { marginTop: spacing.sm, gap: 4 },
  volumeHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  previews: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  flex: { flex: 1, gap: 2 },
});
