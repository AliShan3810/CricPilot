import React, { useMemo, useState } from 'react';
import { confirmAlert } from '../../components/ConfirmDialog';
import { FlatList, StyleSheet, TextInput, View } from 'react-native';
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';
import Swipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GapSm } from '../../components/Separator';
import { AppHeader } from '../../components/AppHeader';
import { Chip } from '../../components/Controls';
import { EmptyState } from '../../components/EmptyState';
import { Icon } from '../../components/Icon';
import { MatchCard } from '../../components/MatchCard';
import { PressableScale } from '../../components/PressableScale';
import { ScreenBackground } from '../../components/ScreenBackground';
import { AppText } from '../../components/AppText';
import type { MatchRecord, MatchStatus } from '../../data/models';
import { useAsync } from '../../hooks/useAsync';
import { matchService } from '../../services/matchService';
import { teamService } from '../../services/teamService';
import { bumpData, errorMessage, toast } from '../../stores/appStore';
import { fonts, images, radius, spacing, useTheme } from '../../theme';
import { TAB_BAR_SPACE } from '../../app/navigation/TabBar';

type Filter = 'all' | MatchStatus;

export function MatchesScreen() {
  const nav = useNavigation();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const matches = useAsync(() => matchService.list());
  const teams = useAsync(() => teamService.all());
  const teamMap = useMemo(() => Object.fromEntries((teams.data ?? []).map(t => [t.id, t])), [teams.data]);
  const q = query.trim().toLowerCase();
  const list = (matches.data ?? []).filter(m => {
    if (filter !== 'all' && m.status !== filter) {
      return false;
    }
    if (!q) {
      return true;
    }
    const a = teamMap[m.teamAId]?.name.toLowerCase() ?? '';
    const b = teamMap[m.teamBId]?.name.toLowerCase() ?? '';
    return m.title.toLowerCase().includes(q) || a.includes(q) || b.includes(q) || (m.venue ?? '').toLowerCase().includes(q);
  });
  const counts = (s: MatchStatus) => (matches.data ?? []).filter(m => m.status === s).length;

  const open = (m: MatchRecord) => {
    if (m.status === 'completed') {
      nav.navigate('Scorecard', { matchId: m.id });
    } else if (m.status === 'live') {
      nav.navigate('LiveScoring', { matchId: m.id });
    } else {
      nav.navigate('Toss', { matchId: m.id });
    }
  };

  const remove = (m: MatchRecord) => {
    confirmAlert('Delete match?', `${m.title} and all its balls will be deleted. Career statistics are updated.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await matchService.remove(m.id);
            bumpData();
            toast('Match deleted', 'success');
          } catch (e) {
            toast(errorMessage(e), 'error');
          }
        },
      },
    ]);
  };

  return (
    <ScreenBackground source={images.history} dim={0.45}>
      <AppHeader title="Matches" subtitle="History & live" back={false} large actions={[{ icon: 'plus', label: 'New match', onPress: () => nav.navigate('MatchCreate'), testID: 'matches-new' }]} />
      <View style={styles.controls}>
        <View style={[styles.search, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Icon name="search" size={18} color={colors.textMuted} />
          <TextInput value={query} onChangeText={setQuery} placeholder="Search teams, titles, venues" placeholderTextColor={colors.textMuted} style={[styles.input, { color: colors.text }]} accessibilityLabel="Search matches" />
        </View>
        <View style={styles.chips}>
          <Chip label={`All ${matches.data?.length ?? 0}`} selected={filter === 'all'} onPress={() => setFilter('all')} />
          <Chip label={`Live ${counts('live')}`} selected={filter === 'live'} color={colors.danger} onPress={() => setFilter('live')} testID="filter-live" />
          <Chip label={`Results ${counts('completed')}`} selected={filter === 'completed'} onPress={() => setFilter('completed')} testID="filter-completed" />
          <Chip label={`Upcoming ${counts('scheduled')}`} selected={filter === 'scheduled'} onPress={() => setFilter('scheduled')} />
        </View>
      </View>
      <FlatList
        data={list}
        keyExtractor={m => m.id}
        contentContainerStyle={[styles.list, { paddingBottom: TAB_BAR_SPACE + insets.bottom }]}
        initialNumToRender={8}
        windowSize={7}
        removeClippedSubviews
        ItemSeparatorComponent={GapSm}
        ListEmptyComponent={
          matches.loading ? undefined : (
            <EmptyState kind="matches" title={q || filter !== 'all' ? 'Nothing here' : 'No matches yet'} message={q || filter !== 'all' ? 'Try another filter or search.' : 'Start your first match: pick two teams, set the rules and toss the coin.'} action={q || filter !== 'all' ? undefined : 'Start a match'} onAction={() => nav.navigate('MatchCreate')} testID="matches-empty" />
          )
        }
        renderItem={({ item, index }) => (
          <Animated.View entering={FadeInDown.delay(Math.min(index, 6) * 40)} layout={LinearTransition}>
            <Swipeable
              friction={2}
              rightThreshold={60}
              renderRightActions={() => (
                <PressableScale onPress={() => remove(item)} style={[styles.del, { backgroundColor: colors.danger }]} accessibilityLabel={`Delete ${item.title}`}>
                  <Icon name="trash" color="#FFFFFF" />
                  <AppText variant="caption" color="#FFFFFF">
                    Delete
                  </AppText>
                </PressableScale>
              )}>
              <MatchCard match={item} teams={teamMap} onPress={() => open(item)} testID={`match-card-${index}`} />
            </Swipeable>
          </Animated.View>
        )}
      />
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  controls: { paddingHorizontal: spacing.md, gap: spacing.sm, marginBottom: spacing.sm },
  search: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, height: 46, borderRadius: radius.md, borderWidth: 1, paddingHorizontal: spacing.sm },
  input: { flex: 1, fontFamily: fonts.semibold, fontSize: 15 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  list: { paddingHorizontal: spacing.md },
  del: { width: 90, marginLeft: spacing.xs, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center', gap: 4 },
});
