import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppHeader } from '../../components/AppHeader';
import { AppText } from '../../components/AppText';
import type { SheetRef } from '../../components/AppBottomSheet';
import { Button } from '../../components/Button';
import { OptionRow } from '../../components/Controls';
import { AppBottomSheet } from '../../components/AppBottomSheet';
import { ScreenBackground } from '../../components/ScreenBackground';
import { availableBatters, bowlerEligibility, describeAwaiting } from '../../core/engine/engine';
import { fixed, economy } from '../../core/engine/selectors';
import type { DeliveryKind, DeliveryPayload, MatchEvent, ShotInfo } from '../../core/engine/types';
import type { Team } from '../../data/models';
import { haptic } from '../../services/haptics';
import { toast } from '../../stores/appStore';
import { useScoring } from '../../stores/scoringStore';
import { useMotion, useSettings } from '../../stores/settingsStore';
import type { ScoringEffect } from './effects';
import { images, radius, spacing, useTheme, withAlpha } from '../../theme';
import type { RootScreenProps } from '../../app/navigation/types';
import { CelebrationLayer } from './celebrations/CelebrationLayer';
import { CreasePanel, OverTimeline, Scoreboard } from './Scoreboard';
import { ScoringPad, type PadAction } from './ScoringPad';
import { CorrectionSheet } from './sheets/CorrectionSheet';
import { ExtrasSheet, type ExtraKind } from './sheets/ExtrasSheet';
import { MoreSheet } from './sheets/MoreSheet';
import { PlayerPickSheet } from './sheets/PlayerPickSheet';
import { ShotSheet } from './sheets/ShotSheet';
import { StartInningsSheet } from './sheets/StartInningsSheet';
import { WicketSheet } from './sheets/WicketSheet';

/**
 * How long to wait before a required sheet (next batter, bowler, innings) appears, so it does not
 * cover the celebration that is playing. The gold prompt button opens it straight away if tapped.
 */
export function promptDelay(effects: ScoringEffect[], motion: 'full' | 'reduced' | 'off'): number {
  if (motion === 'off') {
    return 250;
  }
  const kinds = new Set(effects.map(e => e.kind));
  if (motion === 'reduced') {
    return kinds.has('wicket') || kinds.has('milestone') ? 1200 : 600;
  }
  if (kinds.has('duck')) {
    return 3900;
  }
  if (kinds.has('hatTrick')) {
    return 3400;
  }
  if (kinds.has('milestone')) {
    return 2700;
  }
  if (kinds.has('wicket')) {
    return 1900;
  }
  return 900;
}

const BLANK: DeliveryPayload = { kind: 'legal', batRuns: 0, byes: 0, legByes: 0, wideRuns: 0, boundary: null, wicket: null };

export function LiveScoringScreen({ navigation, route }: RootScreenProps<'LiveScoring'>) {
  const { matchId } = route.params;
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { match, open, record, undo, redo, correct, busy, error, clearError, effects, loading } = useScoring();
  const recordShots = useSettings(s => s.recordShots);
  const motion = useMotion();

  const startRef = useRef<SheetRef>(null);
  const batterRef = useRef<SheetRef>(null);
  const bowlerRef = useRef<SheetRef>(null);
  const wicketRef = useRef<SheetRef>(null);
  const extrasRef = useRef<SheetRef>(null);
  const moreRef = useRef<SheetRef>(null);
  const correctRef = useRef<SheetRef>(null);
  const shotRef = useRef<SheetRef>(null);
  const superRef = useRef<SheetRef>(null);
  const [extraKind, setExtraKind] = useState<ExtraKind>('wide');
  const [wicketKind, setWicketKind] = useState<DeliveryKind>('legal');
  const [pendingRuns, setPendingRuns] = useState<number | null>(null);

  useEffect(() => {
    open(matchId);
  }, [matchId, open]);

  useEffect(() => {
    if (error) {
      haptic('error');
      toast(error, 'error');
      clearError();
    }
  }, [error, clearError]);

  const ready = match && match.record.id === matchId;
  const state = ready ? match.state : null;
  const inn = state ? state.innings[state.currentInningsIndex] ?? null : null;
  const names = useMemo(() => {
    const out: Record<string, string> = {};
    if (ready) {
      for (const p of Object.values(match.players)) {
        out[p.id] = p.name;
      }
    }
    return out;
  }, [ready, match]);
  const teams = useMemo<Record<string, Team>>(() => (ready ? { [match.teams.a.id]: match.teams.a, [match.teams.b.id]: match.teams.b } : {}), [ready, match]);

  // Present the sheet the engine is waiting for (openers, next batter, next bowler, super over).
  const awaitingKey = state ? `${state.awaiting.kind}-${state.innings.length}-${inn?.wickets ?? 0}-${inn?.legalBalls ?? 0}-${state.eventCount}` : '';
  useEffect(() => {
    if (!state || busy) {
      return;
    }
    const t = setTimeout(() => {
      switch (state.awaiting.kind) {
        case 'startInnings':
          startRef.current?.present();
          break;
        case 'newBatter':
          batterRef.current?.present();
          break;
        case 'newBowler':
          bowlerRef.current?.present();
          break;
        case 'superOverDecision':
          superRef.current?.present();
          break;
      }
    }, state.eventCount === 0 ? 300 : promptDelay(effects.list, motion)); // let the celebration finish before a sheet covers it
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [awaitingKey, busy]);

  // Finished: go to the result screen after the final celebration.
  // Finished: go to the result. It only celebrates (sound, confetti) when the winning ball was
  // just recorded here, not when a completed match is reopened.
  const justFinished = effects.list.some(e => e.kind === 'victory');
  useEffect(() => {
    if (state?.completed) {
      const t = setTimeout(() => navigation.replace('Victory', { matchId, celebrate: justFinished }), justFinished ? 1600 : 300);
      return () => clearTimeout(t);
    }
  }, [state?.completed, matchId, navigation, justFinished]);

  const submit = useCallback(
    async (e: MatchEvent) => {
      return record(e);
    },
    [record],
  );
  const deliver = useCallback((d: DeliveryPayload) => submit({ type: 'DELIVERY', ...d }), [submit]);

  const onPad = (a: PadAction) => {
    if (!state) {
      return;
    }
    if (a.type === 'undo') {
      undo().then(ok => ok && toast('Undone', 'info'));
      return;
    }
    if (a.type === 'redo') {
      redo().then(ok => ok && toast('Redone', 'info'));
      return;
    }
    if (a.type === 'more') {
      moreRef.current?.present();
      return;
    }
    if (state.awaiting.kind !== 'delivery') {
      toast(describeAwaiting(state.awaiting));
      return;
    }
    switch (a.type) {
      case 'runs': {
        if (recordShots && a.runs > 0) {
          setPendingRuns(a.runs);
          shotRef.current?.present();
          return;
        }
        deliver({ ...BLANK, batRuns: a.runs, boundary: a.runs === 4 ? 4 : a.runs === 6 ? 6 : null });
        return;
      }
      case 'wicket':
        setWicketKind('legal');
        wicketRef.current?.present();
        return;
      case 'wide':
      case 'noBall':
      case 'bye':
      case 'legBye':
        setExtraKind(a.type);
        extrasRef.current?.present();
        return;
    }
  };

  const onShot = (shot: ShotInfo | null) => {
    shotRef.current?.dismiss();
    if (pendingRuns === null) {
      return;
    }
    const r = pendingRuns;
    setPendingRuns(null);
    deliver({ ...BLANK, batRuns: r, boundary: r === 4 ? 4 : r === 6 ? 6 : null, shot });
  };

  if (!ready || !state) {
    return (
      <ScreenBackground source={images.scoring}>
        <AppHeader title="Loading match…" />
        <View style={styles.loading}>{loading ? <ActivityIndicator color={colors.primary} /> : null}</View>
      </ScreenBackground>
    );
  }

  const awaiting = state.awaiting;
  const canUndo = match.events.length > 0;
  const canRedo = match.redo.length > 0;
  const prompt =
    awaiting.kind === 'newBatter'
      ? { label: 'Select next batter', open: () => batterRef.current?.present() }
      : awaiting.kind === 'newBowler'
        ? { label: 'Select bowler for next over', open: () => bowlerRef.current?.present() }
        : awaiting.kind === 'startInnings'
          ? { label: state.innings.length === 0 ? 'Choose openers to start' : 'Start next innings', open: () => startRef.current?.present() }
          : awaiting.kind === 'superOverDecision'
            ? { label: 'Scores level: super over?', open: () => superRef.current?.present() }
            : null;

  const bowlerOptions = inn
    ? bowlerEligibility(state, inn).map(b => {
        const bw = inn.bowlers.find(x => x.playerId === b.playerId);
        const figs = bw ? `${Math.floor(bw.legalBalls / state.setup.rules.ballsPerOver)}.${bw.legalBalls % state.setup.rules.ballsPerOver}-${bw.maidens}-${bw.runs}-${bw.wickets} · econ ${fixed(economy(bw.runs, bw.legalBalls, state.setup.rules.ballsPerOver))}` : 'Yet to bowl';
        return { id: b.playerId, title: names[b.playerId] ?? b.playerId, subtitle: b.reason ?? figs, disabled: !b.eligible };
      })
    : [];
  const batterOptions = inn
    ? availableBatters(state, inn).map(id => {
        const b = inn.batters.find(x => x.playerId === id);
        return { id, title: names[id] ?? id, subtitle: b?.retiredHurt ? `Retired hurt on ${b.runs} (${b.balls}) · can return` : 'Yet to bat' };
      })
    : [];

  return (
    <ScreenBackground source={images.scoring} dim={0.55} imageOpacity={1}>
      <AppHeader
        title={match.record.title}
        subtitle={state.completed ? 'Result' : '● Live scoring'}
        onBack={() => navigation.navigate('Main', { screen: 'Home' })}
        actions={[{ icon: 'list', label: 'Scorecard', onPress: () => navigation.navigate('Scorecard', { matchId }), testID: 'live-scorecard' }]}
      />
      <ScrollView style={styles.flex} contentContainerStyle={styles.top} showsVerticalScrollIndicator={false}>
        {inn ? (
          <>
            <Scoreboard state={state} teams={teams} />
            <CreasePanel state={state} inn={inn} names={names} />
            <OverTimeline state={state} inn={inn} />
          </>
        ) : (
          <Animated.View entering={FadeIn} style={[styles.preMatch, { backgroundColor: colors.glass, borderColor: colors.border }]}>
            <AppText variant="h2" align="center">
              {match.teams.a.name} vs {match.teams.b.name}
            </AppText>
            <AppText variant="body" tone="secondary" align="center">
              {match.record.tossWinnerId ? `${teams[match.record.tossWinnerId]?.name} won the toss and chose to ${match.record.tossDecision}.` : 'Choose who bats first and the openers.'}
            </AppText>
          </Animated.View>
        )}
      </ScrollView>

      <View style={[styles.padWrap, { paddingBottom: insets.bottom + spacing.xs, backgroundColor: withAlpha(colors.background, 0.92), borderColor: colors.border }]}>
        {prompt ? (
          <Button label={prompt.label} onPress={prompt.open} testID="live-prompt" style={styles.prompt} />
        ) : inn?.freeHitNext ? (
          <View style={[styles.freeHitBar, { backgroundColor: withAlpha(colors.gold, 0.18) }]}>
            <AppText variant="overline" tone="gold" align="center">
              Free hit: only run out, obstructing or hit-the-ball-twice dismissals count
            </AppText>
          </View>
        ) : null}
        <ScoringPad onAction={onPad} disabled={busy || state.completed} canUndo={canUndo} canRedo={canRedo} legByesAllowed={state.setup.rules.legByesAllowed} />
      </View>

      <CelebrationLayer effects={effects} names={names} />

      <StartInningsSheet ref={startRef} state={state} teams={teams} names={names} onSubmit={async e => { if (await submit(e)) { startRef.current?.dismiss(); } }} />
      <PlayerPickSheet
        ref={batterRef}
        title="Next batter"
        subtitle={awaiting.kind === 'newBatter' ? `Coming in at the ${awaiting.end === 'striker' ? "striker's" : "non-striker's"} end` : undefined}
        options={batterOptions}
        required
        testID="sheet-batter"
        onPick={async id => {
          if (await submit({ type: 'NEW_BATTER', batterId: id })) {
            batterRef.current?.dismiss();
          }
        }}
      />
      <PlayerPickSheet
        ref={bowlerRef}
        title="Next over"
        subtitle={inn ? `Over ${Math.floor(inn.legalBalls / state.setup.rules.ballsPerOver) + 1} · choose the bowler` : undefined}
        options={bowlerOptions}
        required
        testID="sheet-bowler"
        onPick={async id => {
          if (await submit({ type: 'SET_BOWLER', bowlerId: id })) {
            bowlerRef.current?.dismiss();
          }
        }}
      />
      {inn ? (
        <WicketSheet
          ref={wicketRef}
          state={state}
          inn={inn}
          names={names}
          kind={wicketKind}
          onSubmit={async d => {
            wicketRef.current?.dismiss();
            await deliver(d);
          }}
        />
      ) : null}
      <ExtrasSheet
        ref={extrasRef}
        kind={extraKind}
        rules={state.setup.rules}
        onSubmit={async d => {
          extrasRef.current?.dismiss();
          await deliver(d);
        }}
        onWicket={k => {
          extrasRef.current?.dismiss();
          setWicketKind(k);
          setTimeout(() => wicketRef.current?.present(), 250);
        }}
      />
      <ShotSheet ref={shotRef} runs={pendingRuns ?? 0} onSubmit={onShot} />
      <MoreSheet
        ref={moreRef}
        state={state}
        inn={inn}
        teams={teams}
        names={names}
        onEvent={async e => {
          moreRef.current?.dismiss();
          await submit(e);
        }}
        onDelivery={async d => {
          moreRef.current?.dismiss();
          await deliver(d);
        }}
        onCorrect={() => {
          moreRef.current?.dismiss();
          setTimeout(() => correctRef.current?.present(), 250);
        }}
        onScorecard={() => {
          moreRef.current?.dismiss();
          navigation.navigate('Scorecard', { matchId });
        }}
      />
      <CorrectionSheet
        ref={correctRef}
        state={state}
        events={match.events}
        names={names}
        onSubmit={async (eventId, d) => {
          const ok = await correct(eventId, { type: 'DELIVERY', ...d });
          if (ok) {
            haptic('success');
            toast('Ball corrected. The match was recalculated.', 'success');
            correctRef.current?.dismiss();
          }
          return ok;
        }}
      />
      <AppBottomSheet ref={superRef} title="Scores are level!" subtitle="Play a super over to decide the match, or end it as a tie." required testID="sheet-super">
        <OptionRow title="Play a super over" subtitle="1 over per side, 2 wickets" onPress={async () => { if (await submit({ type: 'START_SUPER_OVER' })) { superRef.current?.dismiss(); } }} testID="super-start" />
        <OptionRow title="End as a tie" onPress={async () => { if (await submit({ type: 'END_MATCH', result: 'draw' })) { superRef.current?.dismiss(); } }} testID="super-tie" />
      </AppBottomSheet>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  top: { paddingHorizontal: spacing.md, gap: spacing.sm, paddingBottom: spacing.md },
  preMatch: { padding: spacing.lg, borderRadius: radius.lg, borderWidth: 1, gap: spacing.xs, marginTop: spacing.xl },
  padWrap: { paddingHorizontal: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, gap: spacing.xs },
  prompt: { marginBottom: 2 },
  freeHitBar: { paddingVertical: 6, borderRadius: radius.sm },
});
