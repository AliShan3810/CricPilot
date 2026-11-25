import React from 'react';
import { StatusBar } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useMotion } from '../../stores/settingsStore';
import { SplashScreen } from '../../features/splash/SplashScreen';
import { OnboardingScreen } from '../../features/onboarding/OnboardingScreen';
import { HomeScreen } from '../../features/home/HomeScreen';
import { MatchesScreen } from '../../features/matches/MatchesScreen';
import { MatchCreateScreen } from '../../features/matches/MatchCreateScreen';
import { TossScreen } from '../../features/matches/TossScreen';
import { LiveScoringScreen } from '../../features/scoring/LiveScoringScreen';
import { ScorecardScreen } from '../../features/scorecard/ScorecardScreen';
import { VictoryScreen } from '../../features/scorecard/VictoryScreen';
import { TeamsScreen } from '../../features/teams/TeamsScreen';
import { TeamDetailScreen } from '../../features/teams/TeamDetailScreen';
import { TeamFormScreen } from '../../features/teams/TeamFormScreen';
import { PlayerFormScreen } from '../../features/players/PlayerFormScreen';
import { PlayerProfileScreen } from '../../features/players/PlayerProfileScreen';
import { TournamentsScreen } from '../../features/tournaments/TournamentsScreen';
import { TournamentCreateScreen } from '../../features/tournaments/TournamentCreateScreen';
import { TournamentDetailScreen } from '../../features/tournaments/TournamentDetailScreen';
import { StatsScreen } from '../../features/stats/StatsScreen';
import { SettingsScreen } from '../../features/settings/SettingsScreen';
import { TabBar } from './TabBar';
import { ThemeOverride } from '../../theme';
import type { RootStackParamList, TabParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

/** Immersive, photo-led screens keep the dark broadcast look in both themes. */
function withDark<P extends object>(Screen: React.ComponentType<P>) {
  function Dark(props: P) {
    return (
      <ThemeOverride mode="dark">
        <StatusBar barStyle="light-content" />
        <Screen {...props} />
      </ThemeOverride>
    );
  }
  Dark.displayName = `Dark(${Screen.displayName ?? Screen.name})`;
  return Dark;
}
const DarkOnboarding = withDark(OnboardingScreen);
const DarkMatchCreate = withDark(MatchCreateScreen);
const DarkToss = withDark(TossScreen);
const DarkLiveScoring = withDark(LiveScoringScreen);
const DarkVictory = withDark(VictoryScreen);
const Tabs = createBottomTabNavigator<TabParamList>();

function MainTabs() {
  const m = useMotion();
  return (
    <Tabs.Navigator
      tabBar={p => <TabBar {...p} />}
      screenOptions={{ headerShown: false, animation: m === 'full' ? 'shift' : 'none', lazy: true }}>
      <Tabs.Screen name="Home" component={HomeScreen} options={{ title: 'Home' }} />
      <Tabs.Screen name="Matches" component={MatchesScreen} options={{ title: 'Matches' }} />
      <Tabs.Screen name="Teams" component={TeamsScreen} options={{ title: 'Teams' }} />
      <Tabs.Screen name="Tournaments" component={TournamentsScreen} options={{ title: 'Cups' }} />
    </Tabs.Navigator>
  );
}

export function RootNavigator() {
  const m = useMotion();
  const anim = m === 'full' ? 'slide_from_right' : m === 'reduced' ? 'fade' : 'none';
  return (
    <Stack.Navigator initialRouteName="Splash" screenOptions={{ headerShown: false, animation: anim, contentStyle: { backgroundColor: 'transparent' } }}>
      <Stack.Screen name="Splash" component={SplashScreen} options={{ animation: 'none' }} />
      <Stack.Screen name="Onboarding" component={DarkOnboarding} options={{ animation: m === 'off' ? 'none' : 'fade' }} />
      <Stack.Screen name="Main" component={MainTabs} options={{ animation: m === 'off' ? 'none' : 'fade' }} />
      <Stack.Screen name="TeamDetail" component={TeamDetailScreen} />
      <Stack.Screen name="TeamForm" component={TeamFormScreen} options={{ presentation: 'modal', animation: m === 'full' ? 'slide_from_bottom' : anim }} />
      <Stack.Screen name="PlayerForm" component={PlayerFormScreen} options={{ presentation: 'modal', animation: m === 'full' ? 'slide_from_bottom' : anim }} />
      <Stack.Screen name="PlayerProfile" component={PlayerProfileScreen} />
      <Stack.Screen name="MatchCreate" component={DarkMatchCreate} />
      <Stack.Screen name="Toss" component={DarkToss} />
      <Stack.Screen name="LiveScoring" component={DarkLiveScoring} options={{ gestureEnabled: false }} />
      <Stack.Screen name="Scorecard" component={ScorecardScreen} />
      <Stack.Screen name="Victory" component={DarkVictory} options={{ animation: m === 'off' ? 'none' : 'fade' }} />
      <Stack.Screen name="TournamentCreate" component={TournamentCreateScreen} />
      <Stack.Screen name="TournamentDetail" component={TournamentDetailScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
      <Stack.Screen name="Stats" component={StatsScreen} />
    </Stack.Navigator>
  );
}
