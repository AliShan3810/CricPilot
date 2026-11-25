import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppHeader } from '../../components/AppHeader';
import { AppText } from '../../components/AppText';
import { Card } from '../../components/Card';
import { SectionHeader, SegmentedControl } from '../../components/Controls';
import { EmptyState } from '../../components/EmptyState';
import { Avatar } from '../../components/PlayerCard';
import { ScreenBackground } from '../../components/ScreenBackground';
import { StatTile } from '../../components/StatTile';
import { ROLE_LABELS } from '../../data/repositories/playerRepository';
import { useAsync } from '../../hooks/useAsync';
import { playerService } from '../../services/teamService';
import { fixed } from '../../core/engine/selectors';
import { images, radius, spacing, useTheme } from '../../theme';
import type { RootScreenProps } from '../../app/navigation/types';

export function PlayerProfileScreen({ navigation, route }: RootScreenProps<'PlayerProfile'>) {
  const { playerId } = route.params;
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { data, loading } = useAsync(() => playerService.profile(playerId), [playerId]);
  const [tab, setTab] = React.useState<'bat' | 'bowl' | 'field'>('bat');

  if (!data) {
    return (
      <ScreenBackground source={images.player}>
        <AppHeader title={loading ? 'Loading…' : 'Player not found'} />
      </ScreenBackground>
    );
  }
  const { player, career: c, form, team } = data;
  const color = team?.color ?? colors.primary;
  const maxRuns = Math.max(10, ...form.map(f => f.runs));

  return (
    <ScreenBackground source={images.player}>
      <AppHeader title="" actions={[{ icon: 'edit', label: 'Edit player', onPress: () => navigation.navigate('PlayerForm', { playerId }) }]} />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxl }]}>
        <Animated.View entering={FadeInUp} style={styles.hero}>
          <Avatar name={player.name} color={color} size={96} number={player.jerseyNumber} />
          <AppText variant="h1" align="center" testID="player-profile-name">
            {player.name}
          </AppText>
          <AppText variant="body" tone="secondary" align="center">
            {ROLE_LABELS[player.role]} · {player.battingStyle === 'left' ? 'Left' : 'Right'}-hand bat{player.bowlingStyle ? ` · ${player.bowlingStyle}` : ''}
          </AppText>
          {team ? (
            <AppText variant="label" color={color}>
              {team.name}
            </AppText>
          ) : null}
        </Animated.View>

        {!c ? (
          <Card>
            <EmptyState kind="stats" title="No completed matches yet" message="Career statistics appear here once this player has played a completed match." />
          </Card>
        ) : (
          <>
            <View style={styles.tiles}>
              <StatTile label="Matches" value={c.matches} />
              <StatTile label="Runs" value={c.runs} accent={colors.primary} />
              <StatTile label="Wickets" value={c.wickets} accent={colors.gold} />
            </View>
            <SegmentedControl
              value={tab}
              onChange={setTab}
              options={[
                { value: 'bat', label: 'Batting' },
                { value: 'bowl', label: 'Bowling' },
                { value: 'field', label: 'Fielding' },
              ]}
            />
            {tab === 'bat' ? (
              <Grid
                items={[
                  ['Innings', c.innings],
                  ['Not outs', c.notOuts],
                  ['Highest', `${c.highest}${c.highestNotOut ? '*' : ''}`],
                  ['Average', c.battingAverage !== null ? fixed(c.battingAverage) : '–'],
                  ['Strike rate', c.strikeRate !== null ? fixed(c.strikeRate) : '–'],
                  ['Balls', c.balls],
                  ['50s', c.fifties],
                  ['100s', c.hundreds],
                  ['Fours', c.fours],
                  ['Sixes', c.sixes],
                  ['Ducks', c.ducks],
                ]}
              />
            ) : tab === 'bowl' ? (
              <Grid
                items={[
                  ['Overs', `${Math.floor(c.bowlBalls / 6)}.${c.bowlBalls % 6}`],
                  ['Runs', c.runsConceded],
                  ['Wickets', c.wickets],
                  ['Best', c.bowlBalls > 0 ? `${c.bestWickets}/${c.bestRuns}` : '–'],
                  ['Average', c.bowlingAverage !== null ? fixed(c.bowlingAverage) : '–'],
                  ['Economy', c.economy !== null ? fixed(c.economy) : '–'],
                  ['Strike rate', c.bowlingStrikeRate !== null ? fixed(c.bowlingStrikeRate, 1) : '–'],
                  ['Maidens', c.maidens],
                  ['Dot balls', c.dots],
                  ['Wides', c.wides],
                  ['No-balls', c.noBalls],
                ]}
              />
            ) : (
              <Grid
                items={[
                  ['Catches', c.catches],
                  ['Stumpings', c.stumpings],
                  ['Run outs', c.runOuts],
                ]}
              />
            )}
            {form.length > 0 ? (
              <>
                <SectionHeader title="Recent form (runs)" />
                <Card>
                  <View style={styles.formChart} accessibilityLabel={`Recent scores: ${form.map(f => `${f.runs}${f.out ? '' : ' not out'}`).join(', ')}`}>
                    {[...form].reverse().map(f => (
                      <View key={f.matchId} style={styles.formCol}>
                        <AppText variant="caption" tone="secondary">
                          {f.runs}
                          {f.out ? '' : '*'}
                        </AppText>
                        <View style={[styles.formBar, { height: 8 + (f.runs / maxRuns) * 100, backgroundColor: f.runs >= 50 ? colors.gold : color }]} />
                        <AppText variant="caption" tone="muted">
                          {f.wickets > 0 ? `${f.wickets}w` : ' '}
                        </AppText>
                      </View>
                    ))}
                  </View>
                </Card>
              </>
            ) : null}
          </>
        )}
      </ScrollView>
    </ScreenBackground>
  );
}

function Grid({ items }: { items: Array<[string, string | number]> }) {
  const { colors } = useTheme();
  return (
    <View style={styles.grid}>
      {items.map(([label, value]) => (
        <View key={label} style={[styles.cell, { backgroundColor: colors.card, borderColor: colors.border }]} accessible accessibilityLabel={`${label}: ${value}`}>
          <AppText variant="statSmall">{value}</AppText>
          <AppText variant="caption" tone="secondary">
            {label}
          </AppText>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.md, gap: spacing.md },
  hero: { alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.md },
  tiles: { flexDirection: 'row', gap: spacing.xs },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  cell: { width: '31.8%', padding: spacing.sm, borderRadius: radius.md, borderWidth: 1 },
  formChart: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-around', height: 150 },
  formCol: { alignItems: 'center', gap: 4, flex: 1 },
  formBar: { width: 14, borderRadius: 7 },
});
