import React, { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  FadeInDown,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import { AppHeader } from '../../components/AppHeader';
import { AppText } from '../../components/AppText';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { SplitColors, TeamVersus } from '../../components/TeamVersus';
import { Icon } from '../../components/Icon';
import { FlowSteps } from './MatchCreateScreen';
import { PressableScale } from '../../components/PressableScale';
import { ScreenBackground } from '../../components/ScreenBackground';
import { TeamBadge } from '../../components/TeamBadge';
import { haptic } from '../../services/haptics';
import { SoundManager } from '../../services/sound/SoundManager';
import { useScoring } from '../../stores/scoringStore';
import { toast } from '../../stores/appStore';
import { useMotion } from '../../stores/settingsStore';
import { images, radius, spacing, useTheme, withAlpha } from '../../theme';
import type { RootScreenProps } from '../../app/navigation/types';

const COIN = 150;

export function TossScreen({ navigation, route }: RootScreenProps<'Toss'>) {
  const { matchId } = route.params;
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const m = useMotion();
  const { match, open, setToss, busy } = useScoring();
  const [winner, setWinner] = useState<string | null>(null);
  const [decision, setDecision] = useState<'bat' | 'bowl'>('bat');
  const [flipping, setFlipping] = useState(false);
  const scrollRef = useRef<React.ComponentRef<typeof ScrollView>>(null);

  const spin = useSharedValue(0);
  const lift = useSharedValue(0);

  useEffect(() => {
    open(matchId);
  }, [matchId, open]);

  // bring the bat/bowl decision into view once a winner is known
  useEffect(() => {
    if (winner) {
      const t = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 250);
      return () => clearTimeout(t);
    }
  }, [winner]);

  useEffect(() => {
    // The toss is already done once play has started: go straight to scoring.
    if (match && match.record.id === matchId && match.events.length > 0) {
      navigation.replace('LiveScoring', { matchId });
    } else if (match?.record.tossWinnerId && !winner) {
      setWinner(match.record.tossWinnerId);
      setDecision(match.record.tossDecision ?? 'bat');
    }
  }, [match, matchId, navigation, winner]);

  const front = useAnimatedStyle(() => ({
    transform: [{ perspective: 800 }, { translateY: lift.value }, { rotateY: `${spin.value}deg` }],
  }));
  const back = useAnimatedStyle(() => ({
    transform: [{ perspective: 800 }, { translateY: lift.value }, { rotateY: `${spin.value + 180}deg` }],
  }));
  const shadow = useAnimatedStyle(() => ({
    transform: [{ scaleX: 1 + lift.value / 400 }],
    opacity: 0.5 + lift.value / 500,
  }));

  if (!match || match.record.id !== matchId) {
    return (
      <ScreenBackground source={images.toss}>
        <AppHeader title="Toss" />
      </ScreenBackground>
    );
  }
  const { a, b } = match.teams;

  const land = (w: string) => {
    setWinner(w);
    setFlipping(false);
    haptic('success');
  };

  const flip = () => {
    const w = Math.random() < 0.5 ? a.id : b.id;
    SoundManager.play('coin');
    if (m !== 'full') {
      spin.value = w === a.id ? 0 : 180;
      land(w);
      return;
    }
    setFlipping(true);
    setWinner(null);
    const turns = 6 * 360 + (w === a.id ? 0 : 180);
    spin.value = 0;
    spin.value = withTiming(turns, { duration: 1700, easing: Easing.out(Easing.cubic) }, done => {
      if (done) {
        runOnJS(land)(w);
      }
    });
    lift.value = withSequence(withTiming(-170, { duration: 700, easing: Easing.out(Easing.quad) }), withTiming(0, { duration: 1000, easing: Easing.bounce }));
  };

  const confirm = async () => {
    if (!winner) {
      return;
    }
    const ok = await setToss(winner, decision);
    if (ok) {
      haptic('success');
      navigation.replace('LiveScoring', { matchId });
    } else {
      toast(useScoring.getState().error ?? 'Could not save the toss', 'error');
    }
  };

  const winnerTeam = winner === a.id ? a : winner === b.id ? b : null;

  return (
    <ScreenBackground source={images.toss} dim={0.15} imageOpacity={1}>
      <SplitColors a={a.color} b={b.color} opacity={0.3} />
      <AppHeader title="The toss" subtitle={match.record.title} />
      <View style={styles.flowWrap}>
        <FlowSteps current={3} />
      </View>
      <ScrollView ref={scrollRef} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]}>
        <TeamVersus a={a} b={b} size={64} compact introKey={matchId} />

        <View style={styles.coinArea} accessibilityLabel={winnerTeam ? `${winnerTeam.name} won the toss` : 'Coin'}>
          <Animated.View style={[styles.coinShadow, shadow]} />
          <Animated.View style={[styles.coin, front]}>
            <CoinFace color={a.color} label={a.shortName} name={a.name} />
          </Animated.View>
          <Animated.View style={[styles.coin, back]}>
            <CoinFace color={b.color} label={b.shortName} name={b.name} />
          </Animated.View>
        </View>

        <Button label={flipping ? 'Flipping…' : winner ? 'Flip again' : 'Flip the coin'} onPress={flip} disabled={flipping} variant={winner ? 'secondary' : 'primary'} size="lg" testID="toss-flip" />
        <AppText variant="caption" tone="secondary" align="center">
          Tossed a real coin? Choose the winner below.
        </AppText>

        <View style={styles.choose}>
          {[a, b].map(t => (
            <PressableScale
              key={t.id}
              testID={`toss-winner-${t.shortName}`}
              onPress={() => setWinner(t.id)}
              hapticKind="select"
              accessibilityState={{ selected: winner === t.id }}
              accessibilityLabel={`${t.name} won the toss`}
              style={[styles.option, { backgroundColor: winner === t.id ? withAlpha(t.color, 0.22) : colors.card, borderColor: winner === t.id ? t.color : colors.border }]}>
              <TeamBadge name={t.name} shortName={t.shortName} color={t.color} size={36} />
              <AppText variant="label" numberOfLines={1} style={styles.flex}>
                {t.name}
              </AppText>
            </PressableScale>
          ))}
        </View>

        {winnerTeam ? (
          <Animated.View entering={FadeInDown} style={styles.gap}>
            <Card glass featured>
              <AppText variant="h2" align="center" testID="toss-result">
                {winnerTeam.name} won the toss
              </AppText>
              <AppText variant="body" tone="secondary" align="center">
                and chose to…
              </AppText>
            </Card>
            <View style={styles.choose}>
              {(['bat', 'bowl'] as const).map(d => (
                <PressableScale
                  key={d}
                  testID={`toss-decision-${d}`}
                  onPress={() => setDecision(d)}
                  hapticKind="select"
                  accessibilityState={{ selected: decision === d }}
                  accessibilityLabel={d === 'bat' ? 'Bat first' : 'Bowl first'}
                  style={[styles.decision, { backgroundColor: decision === d ? colors.primary : colors.glass, borderColor: decision === d ? colors.primaryBright : colors.border }]}>
                  <Icon name={d === 'bat' ? 'bat' : 'ball'} size={30} color={decision === d ? colors.onPrimary : colors.text} />
                  <AppText variant="h3" color={decision === d ? colors.onPrimary : colors.text}>
                    {d === 'bat' ? 'Bat first' : 'Bowl first'}
                  </AppText>
                </PressableScale>
              ))}
            </View>
            <Button label="Choose openers & start" size="lg" onPress={confirm} loading={busy} testID="toss-confirm" />
          </Animated.View>
        ) : null}
      </ScrollView>
    </ScreenBackground>
  );
}

function CoinFace({ color, label, name }: { color: string; label: string; name: string }) {
  return (
    <View style={styles.face}>
      <Svg width={COIN} height={COIN} style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id={`coin-${label}`} cx="35%" cy="30%" r="80%">
            <Stop offset="0" stopColor="#FFE0C2" />
            <Stop offset="0.55" stopColor="#FF8C42" />
            <Stop offset="1" stopColor="#C2410C" />
          </RadialGradient>
        </Defs>
        <Circle cx={COIN / 2} cy={COIN / 2} r={COIN / 2 - 2} fill={`url(#coin-${label})`} />
        <Circle cx={COIN / 2} cy={COIN / 2} r={COIN / 2 - 12} fill="none" stroke="#7C2D12" strokeOpacity={0.5} strokeWidth={2} strokeDasharray="4 5" />
      </Svg>
      <TeamBadge name={name} shortName={label} color={color} size={78} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: spacing.md, gap: spacing.md },
  gap: { gap: spacing.md },
  flowWrap: { paddingHorizontal: spacing.md, marginBottom: spacing.xs },
  decision: { flex: 1, alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.lg, borderRadius: radius.lg, borderWidth: 1.5 },
  coinArea: { height: COIN + 140, alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 30 },
  coinShadow: { position: 'absolute', bottom: 18, width: COIN * 0.8, height: 16, borderRadius: 8, backgroundColor: 'rgba(0,0,0,0.45)' },
  coin: { position: 'absolute', bottom: 30, width: COIN, height: COIN, backfaceVisibility: 'hidden' },
  face: { width: COIN, height: COIN, borderRadius: COIN / 2, alignItems: 'center', justifyContent: 'center' },
  choose: { flexDirection: 'row', gap: spacing.sm },
  option: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.xs, padding: spacing.sm, borderRadius: radius.md, borderWidth: 1.5 },
});
