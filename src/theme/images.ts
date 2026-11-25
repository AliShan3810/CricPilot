/**
 * All photography is bundled locally (no network needed).
 * Sources: Unsplash License photos; see docs/ASSET_CREDITS.md and scripts/process-photos.py.
 */
export const images = {
  splash: require('../assets/images/bg_splash_stadium.webp'),
  homePanorama: require('../assets/images/bg_home_panorama.webp'),
  matchup: require('../assets/images/bg_matchup.webp'),
  aerial: require('../assets/images/bg_aerial_ground.webp'),
  xi: require('../assets/images/bg_xi_gloves.webp'),
  toss: require('../assets/images/bg_toss_ball.webp'),
  pitch: require('../assets/images/bg_pitch.webp'),
  scoring: require('../assets/images/bg_scoring_stadium.webp'),
  teams: require('../assets/images/bg_teams_helmet.webp'),
  player: require('../assets/images/bg_player.webp'),
  trophy: require('../assets/images/bg_tournament_trophy.webp'),
  tournament: require('../assets/images/bg_tournament_stadium.webp'),
  victory: require('../assets/images/bg_victory.webp'),
  history: require('../assets/images/bg_history_batter.webp'),
  stats: require('../assets/images/bg_stats_crowd.webp'),
  settings: require('../assets/images/bg_settings_floodlight.webp'),
  bat: require('../assets/images/bg_bat_wall.webp'),
  onboardBatter: require('../assets/images/onboard_1_batter.webp'),
  onboardStadium: require('../assets/images/onboard_2_stadium.webp'),
  onboardBall: require('../assets/images/onboard_3_ball.webp'),
} as const;

export type ImageKey = keyof typeof images;
