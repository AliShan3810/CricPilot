import type { NavigatorScreenParams } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

export type TabParamList = {
  Home: undefined;
  Matches: undefined;
  Teams: undefined;
  Tournaments: undefined;
};

export type RootStackParamList = {
  Splash: undefined;
  Onboarding: undefined;
  Main: NavigatorScreenParams<TabParamList> | undefined;
  TeamDetail: { teamId: string };
  TeamForm: { teamId?: string } | undefined;
  PlayerForm: { playerId?: string; teamId?: string } | undefined;
  PlayerProfile: { playerId: string };
  MatchCreate: { fixtureId?: string; tournamentId?: string } | undefined;
  Toss: { matchId: string };
  LiveScoring: { matchId: string };
  Scorecard: { matchId: string };
  Victory: { matchId: string; celebrate?: boolean };
  TournamentCreate: undefined;
  TournamentDetail: { tournamentId: string };
  Settings: undefined;
  Stats: undefined;
};

export type RootScreenProps<K extends keyof RootStackParamList> = NativeStackScreenProps<RootStackParamList, K>;

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
