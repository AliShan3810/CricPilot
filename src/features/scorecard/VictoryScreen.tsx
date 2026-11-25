import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, ZoomIn, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { captureRef } from 'react-native-view-shot';
import { AppHeader } from '../../components/AppHeader';
import { AppText } from '../../components/AppText';
import { BrandMark } from '../../components/BrandMark';
import { Button } from '../../components/Button';
import { Gradient } from '../../components/Gradient';
import { Icon } from '../../components/Icon';
import { ScreenBackground } from '../../components/ScreenBackground';
import { TeamBadge } from '../../components/TeamBadge';
import { formatOvers } from '../../core/engine/engine';
import { playerMatchStats, type PlayerMatchStats } from '../../core/engine/stats';
import { useAsync } from '../../hooks/useAsync';
import { fileService } from '../../services/fileService';
import { haptic } from '../../services/haptics';
import { SoundManager } from '../../services/sound/SoundManager';
import { tournamentRepository } from '../../data/repositories/tournamentRepository';
import { getDb } from '../../data/db/database';
import { matchService } from '../../services/matchService';
import { errorMessage, toast } from '../../stores/appStore';
import { useMotion } from '../../stores/settingsStore';
import { BRAND_NAME, BRAND_TAGLINE, images, radius, spacing, useTheme, withAlpha } from '../../theme';
import type { RootScreenProps } from '../../app/navigation/types';
import { Confetti } from '../scoring/celebrations/Confetti';

/** Simple, transparent impact score for the "Top performer" badge (not an official award). */
export function impactScore(s: PlayerMatchStats): number {
  return s.runs + s.fours + s.sixes * 2 + s.wickets * 20 + s.maidens * 5 + (s.catches + s.stumpings + s.runOuts) * 8;
}

export function VictoryScreen({ navigation, route }: RootScreenProps<'Victory'>) {
  const { matchId, celebrate } = route.params;
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const m = useMotion();
  const { data } = useAsync(() => matchService.load(matchId), [matchId]);
  const cardRef = useRef<React.ComponentRef<typeof View>>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const [champions, setChampions] = useState(false);
  const played = useRef(false);
  // the celebration (sound, haptics) plays once, only when arriving from the winning ball
  useEffect(() => {
    if (!celebrate || !data || played.current) {
      return;
    }
    played.current = true;
    (async () => {
      let tournamentWon = false;
      if (data.record.tournamentId) {
        const t = await tournamentRepository.get(await getDb(), data.record.tournamentId).catch(() => null);
        tournamentWon = !!t && t.status === 'completed' && t.winnerTeamId === data.state.result?.winnerTeamId;
      }
      setChampions(tournamentWon);
      SoundManager.play(tournamentWon ? 'tournament' : 'victory');
    })();
  }, [celebrate, data]);

  const top = useMemo(() => {
    if (!data) {
      return null;
    }
    const stats = playerMatchStats(data.state);
    const best = [...stats].sort((a, b) => impactScore(b) - impactScore(a))[0];
    return best && impactScore(best) > 0 ? best : null;
  }, [data]);

  if (!data) {
    return (
      <ScreenBackground source={images.victory}>
        <AppHeader title="Result" />
      </ScreenBackground>
    );
  }
  const { state, teams } = data;
  const result = state.result;
  const winner = result?.winnerTeamId ? (result.winnerTeamId === teams.a.id ? teams.a : teams.b) : null;
  const bpo = state.setup.rules.ballsPerOver;
  const topPlayer = top ? data.players[top.playerId] : null;

  const shareImage = async () => {
    setBusy('img');
    try {
      // view-shot types predate RN 0.88's element refs; the ref is a host view
      const uri = await captureRef(cardRef as unknown as Parameters<typeof captureRef>[0], { format: 'png', quality: 1, result: 'tmpfile' });
      await fileService.shareImage(uri, `${result?.summary ?? ''} · scored with ${BRAND_NAME}`);
      haptic('success');
    } catch (e) {
      toast(errorMessage(e), 'error');
    } finally {
      setBusy(null);
    }
  };

  return (
    <ScreenBackground source={images.victory} variant="hero">
      {m !== 'off' && winner ? <Confetti count={m === 'full' ? 90 : 30} duration={m === 'full' ? 3600 : 2000} /> : null}
      <AppHeader title="" onBack={() => navigation.navigate('Main', { screen: 'Home' })} />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]}>
        <Animated.View entering={m === 'full' ? ZoomIn.springify().damping(12) : undefined}>
          {/* The shareable card */}
          <View ref={cardRef} collapsable={false} style={[styles.card, { borderColor: withAlpha(colors.gold, 0.6) }]} testID="victory-card">
            <Gradient colors={['#222B3A', '#0D1117', '#2A1200']} direction="diagonal" />
            <View style={styles.cardTop}>
              <BrandMark size={28} />
              <AppText variant="overline" color="#FF8C42">
                {champions ? 'Champions' : result?.type === 'win' ? 'Victory' : 'Full time'}
              </AppText>
            </View>
            {winner ? (
              <View style={styles.center}>
                <View style={[styles.glow, { backgroundColor: withAlpha(winner.color, 0.4) }]} />
                <TeamBadge name={winner.name} shortName={winner.shortName} color={winner.color} size={104} />
                <TrophyReveal animate={m !== 'off'} />
              </View>
            ) : null}
            <AppText variant="h1" align="center" color="#F8FAFC" testID="victory-result">
              {result?.summary ?? 'Match finished'}
            </AppText>
            <View style={styles.scores}>
              {[teams.a, teams.b].map(t => (
                <View key={t.id} style={styles.scoreCol}>
                  <AppText variant="label" color="#CBD5E1" numberOfLines={1}>
                    {t.name}
                  </AppText>
                  <AppText variant="stat" color={winner?.id === t.id ? '#FF8C42' : '#F8FAFC'}>
                    {state.innings
                      .filter(i => i.battingTeamId === t.id && !i.isSuperOver)
                      .map(i => `${i.runs}/${i.wickets}`)
                      .join(' & ') || '–'}
                  </AppText>
                  <AppText variant="caption" color="#94A3B8">
                    {state.innings
                      .filter(i => i.battingTeamId === t.id && !i.isSuperOver)
                      .map(i => `${formatOvers(i.legalBalls, bpo)} ov`)
                      .join(' & ')}
                  </AppText>
                </View>
              ))}
            </View>
            {topPlayer && top ? (
              <View style={[styles.top, { backgroundColor: 'rgba(255,107,0,0.14)' }]}>
                <AppText variant="overline" color="#FF8C42">
                  Top performer
                </AppText>
                <AppText variant="h3" color="#F8FAFC">
                  {topPlayer.name}
                </AppText>
                <AppText variant="caption" color="#CBD5E1">
                  {[top.batInnings ? `${top.runs} (${top.balls})` : null, top.bowlBalls ? `${top.wickets}/${top.runsConceded}` : null, top.catches ? `${top.catches} ct` : null].filter(Boolean).join(' · ')}
                </AppText>
              </View>
            ) : null}
            <AppText variant="caption" color="#64748B" align="center">
              {data.record.title} · {BRAND_TAGLINE}
            </AppText>
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(300)} style={styles.actions}>
          <Button label="Share result image" size="lg" onPress={shareImage} loading={busy === 'img'} testID="victory-share" />
          <Button label="Full scorecard" variant="secondary" onPress={() => navigation.replace('Scorecard', { matchId })} testID="victory-scorecard" />
          <View style={styles.row}>
            <Button label="PDF" variant="secondary" style={styles.flex} loading={busy === 'pdf'} onPress={async () => { setBusy('pdf'); try { await fileService.exportScorecardPdf(data); } catch (e) { toast(errorMessage(e), 'error'); } finally { setBusy(null); } }} />
            <Button label="Home" variant="secondary" style={styles.flex} onPress={() => navigation.navigate('Main', { screen: 'Home' })} testID="victory-home" />
          </View>
          {data.record.tournamentId ? <Button label="Back to tournament" variant="ghost" onPress={() => navigation.replace('TournamentDetail', { tournamentId: data.record.tournamentId! })} /> : null}
        </Animated.View>
      </ScrollView>
    </ScreenBackground>
  );
}

/** Trophy springs up, then glows gently. */
function TrophyReveal({ animate }: { animate: boolean }) {
  const scale = useSharedValue(animate ? 0 : 1);
  const glow = useSharedValue(0);
  useEffect(() => {
    if (!animate) {
      return;
    }
    scale.value = withDelay(350, withSpring(1, { damping: 8, stiffness: 140 }));
    glow.value = withDelay(900, withRepeat(withSequence(withTiming(1, { duration: 900 }), withTiming(0.3, { duration: 900 })), -1));
  }, [animate, scale, glow]);
  const s = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }, { rotate: `${(1 - scale.value) * -25}deg` }] }));
  const g = useAnimatedStyle(() => ({ opacity: glow.value * 0.6, transform: [{ scale: 1 + glow.value * 0.3 }] }));
  return (
    <View style={styles.trophyWrap}>
      <Animated.View style={[styles.trophyGlow, g]} />
      <Animated.View style={s}>
        <Icon name="trophy" size={42} color="#FBBF24" strokeWidth={2.2} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  trophyWrap: { alignItems: 'center', justifyContent: 'center', width: 70, height: 60 },
  trophyGlow: { position: 'absolute', width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(251,191,36,0.35)' },
  content: { paddingHorizontal: spacing.md, gap: spacing.lg },
  card: { borderRadius: radius.xl, borderWidth: 1.5, padding: spacing.lg, gap: spacing.md, overflow: 'hidden' },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  center: { alignItems: 'center', gap: spacing.xs },
  glow: { position: 'absolute', width: 180, height: 180, borderRadius: 90, top: -30 },
  scores: { flexDirection: 'row', gap: spacing.sm },
  scoreCol: { flex: 1, alignItems: 'center' },
  top: { alignItems: 'center', padding: spacing.sm, borderRadius: radius.md, gap: 2 },
  actions: { gap: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.sm },
  flex: { flex: 1 },
});
