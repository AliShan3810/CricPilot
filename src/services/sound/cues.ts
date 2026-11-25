/**
 * Pure sound design: which sound files make up each cue, and how a ball's effects become one
 * coordinated sequence. No audio code here, so it is fully unit-testable.
 */
import type { ScoringEffect } from '../../features/scoring/effects';

export type SoundId =
  | 'bat_four'
  | 'bat_six'
  | 'ball_whoosh'
  | 'stumps'
  | 'coin_toss'
  | 'crowd_cheer'
  | 'crowd_roar'
  | 'crowd_wicket'
  | 'crowd_groan'
  | 'applause'
  | 'sting_milestone'
  | 'sting_century'
  | 'sting_victory'
  | 'sting_hattrick'
  | 'sting_innings'
  | 'sting_duck'
  | 'sting_tournament';

export type SoundCategory = 'scoring' | 'crowd' | 'celebration';

export const SOUND_CATEGORY: Record<SoundId, SoundCategory> = {
  bat_four: 'scoring',
  bat_six: 'scoring',
  ball_whoosh: 'scoring',
  stumps: 'scoring',
  coin_toss: 'scoring',
  crowd_cheer: 'crowd',
  crowd_roar: 'crowd',
  crowd_wicket: 'crowd',
  crowd_groan: 'crowd',
  applause: 'crowd',
  sting_milestone: 'celebration',
  sting_century: 'celebration',
  sting_victory: 'celebration',
  sting_hattrick: 'celebration',
  sting_innings: 'celebration',
  sting_duck: 'celebration',
  sting_tournament: 'celebration',
};

export type CueName = 'four' | 'six' | 'wicket' | 'duck' | 'hatTrick' | 'fifty' | 'century' | 'innings' | 'victory' | 'tournament' | 'coin';

export type HapticKind = 'tap' | 'select' | 'run' | 'boundary' | 'six' | 'wicket' | 'success' | 'warning' | 'error';

export interface Layer {
  sound: SoundId;
  /** milliseconds after the cue starts */
  at: number;
  gain: number;
}

export interface CueDef {
  layers: Layer[];
  haptics: Array<{ at: number; kind: HapticKind }>;
  /** roughly how long the cue's foreground lasts; used to space follow-up cues */
  length: number;
}

/** Each event has its own recognisable identity. */
export const CUES: Record<CueName, CueDef> = {
  four: {
    layers: [
      { sound: 'bat_four', at: 0, gain: 1 },
      { sound: 'crowd_cheer', at: 140, gain: 0.85 },
    ],
    haptics: [{ at: 160, kind: 'boundary' }],
    length: 1100,
  },
  six: {
    layers: [
      { sound: 'bat_six', at: 0, gain: 1 },
      { sound: 'ball_whoosh', at: 70, gain: 0.55 },
      { sound: 'crowd_roar', at: 220, gain: 1 },
    ],
    haptics: [{ at: 240, kind: 'six' }, { at: 520, kind: 'success' }],
    length: 1400,
  },
  wicket: {
    layers: [
      { sound: 'stumps', at: 0, gain: 1 },
      { sound: 'crowd_wicket', at: 230, gain: 0.95 },
    ],
    haptics: [{ at: 0, kind: 'wicket' }],
    length: 1300,
  },
  duck: {
    layers: [
      { sound: 'stumps', at: 0, gain: 1 },
      { sound: 'crowd_groan', at: 220, gain: 0.85 },
      { sound: 'sting_duck', at: 480, gain: 0.9 },
    ],
    haptics: [{ at: 0, kind: 'wicket' }, { at: 500, kind: 'error' }],
    length: 2400,
  },
  hatTrick: {
    layers: [
      { sound: 'stumps', at: 0, gain: 1 },
      { sound: 'sting_hattrick', at: 220, gain: 1 },
      { sound: 'crowd_roar', at: 900, gain: 1 },
    ],
    haptics: [{ at: 0, kind: 'wicket' }, { at: 240, kind: 'boundary' }, { at: 520, kind: 'boundary' }, { at: 800, kind: 'success' }],
    length: 3000,
  },
  fifty: {
    layers: [
      { sound: 'sting_milestone', at: 0, gain: 0.95 },
      { sound: 'applause', at: 400, gain: 0.8 },
    ],
    haptics: [{ at: 0, kind: 'success' }],
    length: 2400,
  },
  century: {
    layers: [
      { sound: 'sting_century', at: 0, gain: 1 },
      { sound: 'crowd_roar', at: 900, gain: 0.95 },
    ],
    haptics: [{ at: 0, kind: 'success' }, { at: 900, kind: 'success' }],
    length: 3200,
  },
  innings: {
    layers: [
      { sound: 'sting_innings', at: 0, gain: 0.85 },
      { sound: 'applause', at: 250, gain: 0.7 },
    ],
    haptics: [{ at: 0, kind: 'success' }],
    length: 2200,
  },
  victory: {
    layers: [
      { sound: 'sting_victory', at: 0, gain: 1 },
      { sound: 'crowd_roar', at: 400, gain: 0.9 },
      { sound: 'applause', at: 2200, gain: 0.8 },
    ],
    haptics: [{ at: 0, kind: 'success' }, { at: 1300, kind: 'boundary' }, { at: 2300, kind: 'success' }],
    length: 4500,
  },
  tournament: {
    layers: [
      { sound: 'sting_tournament', at: 0, gain: 1 },
      { sound: 'crowd_roar', at: 600, gain: 0.9 },
      { sound: 'applause', at: 2600, gain: 0.8 },
    ],
    haptics: [{ at: 0, kind: 'success' }, { at: 600, kind: 'six' }, { at: 1200, kind: 'six' }, { at: 2600, kind: 'success' }],
    length: 5500,
  },
  coin: {
    layers: [{ sound: 'coin_toss', at: 0, gain: 0.9 }],
    haptics: [{ at: 0, kind: 'tap' }, { at: 900, kind: 'select' }],
    length: 1600,
  },
};

export interface PlannedCue {
  cue: CueName;
  at: number;
}

/**
 * Turns the effects of one recorded ball into a single, non-overlapping sequence:
 * - the ball cue: hat-trick > duck > wicket > six > four (a duck replaces the plain wicket cue);
 * - then a milestone (fifty / century);
 * - then the innings or match cue, after the earlier cues have had their moment.
 * The victory screen plays the victory cue itself, so the match end here only adds the ball cue.
 */
export function planCues(effects: ScoringEffect[]): PlannedCue[] {
  const has = (k: ScoringEffect['kind']) => effects.some(e => e.kind === k);
  const plan: PlannedCue[] = [];
  let t = 0;
  const push = (cue: CueName) => {
    plan.push({ cue, at: t });
    t += CUES[cue].length;
  };
  if (has('hatTrick')) {
    push('hatTrick');
  } else if (has('duck')) {
    push('duck');
  } else if (has('wicket')) {
    push('wicket');
  } else if (has('six')) {
    push('six');
  } else if (has('four')) {
    push('four');
  }
  const milestone = effects.find((e): e is Extract<ScoringEffect, { kind: 'milestone' }> => e.kind === 'milestone');
  if (milestone) {
    // a milestone reached with a boundary starts once the bat sound has landed
    if (plan.length) {
      t = Math.min(t, 700);
    }
    push(milestone.runs >= 100 ? 'century' : 'fifty');
  }
  if (has('inningsComplete') && !has('victory')) {
    push('innings');
  }
  return plan;
}
