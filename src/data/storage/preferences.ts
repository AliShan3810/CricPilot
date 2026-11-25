/**
 * Lightweight preferences in MMKV. Match data never lives here (it is in SQLite).
 */
import type { MMKV } from 'react-native-mmkv';

export type ThemeMode = 'system' | 'dark' | 'light';
export type MotionMode = 'full' | 'reduced' | 'off';

export interface Preferences {
  onboardingDone: boolean;
  userName: string;
  themeMode: ThemeMode;
  motion: MotionMode;
  followSystemMotion: boolean;
  haptics: boolean;
  recordShots: boolean;
  /** master switch for all sound effects */
  sound: boolean;
  soundCrowd: boolean;
  soundScoring: boolean;
  soundCelebration: boolean;
  /** 0..1 */
  soundVolume: number;
}

export const DEFAULT_PREFERENCES: Preferences = {
  onboardingDone: false,
  userName: '',
  themeMode: 'system',
  motion: 'full',
  followSystemMotion: true,
  haptics: true,
  recordShots: false,
  sound: true,
  soundCrowd: true,
  soundScoring: true,
  soundCelebration: true,
  soundVolume: 0.8,
};

const KEY = 'prefs.v1';

let storage: Pick<MMKV, 'getString' | 'set' | 'remove'> | null = null;
const memory = new Map<string, string>();

function store() {
  if (storage) {
    return storage;
  }
  try {
    const { createMMKV } = require('react-native-mmkv') as typeof import('react-native-mmkv');
    storage = createMMKV({ id: 'cricpilot.preferences' });
  } catch {
    // Fallback used in unit tests and if the native module is unavailable.
    storage = {
      getString: (k: string) => memory.get(k),
      set: (k: string, v: boolean | string | number | ArrayBuffer) => {
        memory.set(k, String(v));
      },
      remove: (k: string) => memory.delete(k),
    };
  }
  return storage;
}

export function loadPreferences(): Preferences {
  try {
    const raw = store().getString(KEY);
    if (!raw) {
      return { ...DEFAULT_PREFERENCES };
    }
    const parsed = JSON.parse(raw) as Partial<Preferences>;
    return { ...DEFAULT_PREFERENCES, ...parsed };
  } catch {
    return { ...DEFAULT_PREFERENCES };
  }
}

export function savePreferences(p: Preferences): void {
  store().set(KEY, JSON.stringify(p));
}

/** Last opened live match, so the dashboard can offer "Resume". */
export function setLastMatch(id: string | null): void {
  if (id) {
    store().set('lastMatch', id);
  } else {
    store().remove('lastMatch');
  }
}

export function getLastMatch(): string | null {
  return store().getString('lastMatch') ?? null;
}
