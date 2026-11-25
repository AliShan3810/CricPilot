import type { MatchEvent, MatchFormat, MatchRules } from '../core/engine/types';
import type { FixtureStage, TournamentFormat } from '../core/tournament/tournament';

export type PlayerRole = 'batter' | 'bowler' | 'allRounder' | 'wicketKeeper';

export interface Team {
  id: string;
  name: string;
  shortName: string;
  color: string;
  homeGround: string | null;
  createdAt: number;
  playerCount?: number;
  /** created for a single quick match; hidden from team lists */
  isTemporary?: boolean;
}

export interface Player {
  id: string;
  name: string;
  teamId: string | null;
  role: PlayerRole;
  battingStyle: 'right' | 'left';
  bowlingStyle: string | null;
  jerseyNumber: number | null;
  createdAt: number;
}

export type MatchStatus = 'scheduled' | 'live' | 'completed';

export interface InningsSummary {
  teamId: string;
  runs: number;
  wickets: number;
  balls: number;
  allOut: boolean;
  declared: boolean;
  isSuperOver: boolean;
  completed: boolean;
}

/** Denormalised summary stored with the match so lists load without replaying events. */
export interface MatchSummary {
  innings: InningsSummary[];
  situation: string;
  battingTeamId: string | null;
  strikerName: string | null;
  bowlerName: string | null;
  resultType: 'win' | 'tie' | 'draw' | 'noResult' | null;
  ballsPerOver: number;
  quotaBalls: number | null;
}

export interface MatchRecord {
  id: string;
  title: string;
  format: MatchFormat;
  rules: MatchRules;
  teamAId: string;
  teamBId: string;
  venue: string | null;
  scheduledAt: number | null;
  tossWinnerId: string | null;
  tossDecision: 'bat' | 'bowl' | null;
  status: MatchStatus;
  tournamentId: string | null;
  fixtureId: string | null;
  summary: MatchSummary | null;
  resultText: string | null;
  winnerTeamId: string | null;
  createdAt: number;
  updatedAt: number;
  completedAt: number | null;
}

export interface MatchPlayer {
  matchId: string;
  teamId: string;
  playerId: string;
  battingOrder: number;
  isCaptain: boolean;
  isKeeper: boolean;
}

export interface StoredEvent {
  id: string;
  matchId: string;
  seq: number;
  event: MatchEvent;
  status: 'active' | 'undone';
  createdAt: number;
}

export interface Tournament {
  id: string;
  name: string;
  format: TournamentFormat;
  rules: MatchRules;
  pointsWin: number;
  pointsTie: number;
  pointsNoResult: number;
  doubleRoundRobin: boolean;
  qualifiers: number;
  status: 'active' | 'completed';
  winnerTeamId: string | null;
  createdAt: number;
}

export interface Fixture {
  id: string;
  tournamentId: string;
  stage: FixtureStage;
  round: number;
  slot: number;
  teamAId: string | null;
  teamBId: string | null;
  labelA: string | null;
  labelB: string | null;
  matchId: string | null;
  nextFixtureId: string | null;
  nextSlot: 'a' | 'b' | null;
  winnerTeamId: string | null;
  scheduledAt: number | null;
  venue: string | null;
}
