import { create } from 'zustand';
import { loadPreferences, savePreferences, type Preferences } from '../data/storage/preferences';

interface SettingsState extends Preferences {
  /** system "reduce motion" accessibility setting, kept in sync by ThemeProvider */
  systemReduceMotion: boolean;
  update: (patch: Partial<Preferences>) => void;
  setSystemReduceMotion: (v: boolean) => void;
}

export const useSettings = create<SettingsState>((set, get) => ({
  ...loadPreferences(),
  systemReduceMotion: false,
  update: patch => {
    set(patch);
    const next = { ...get(), ...patch };
    const prefs: Preferences = {
      onboardingDone: next.onboardingDone,
      userName: next.userName,
      themeMode: next.themeMode,
      motion: next.motion,
      followSystemMotion: next.followSystemMotion,
      haptics: next.haptics,
      recordShots: next.recordShots,
      sound: next.sound,
      soundCrowd: next.soundCrowd,
      soundScoring: next.soundScoring,
      soundCelebration: next.soundCelebration,
      soundVolume: Math.max(0, Math.min(1, next.soundVolume)),
    };
    savePreferences(prefs);
  },
  setSystemReduceMotion: v => set({ systemReduceMotion: v }),
}));

/** 'full' | 'reduced' | 'off' after applying the system setting. */
export function effectiveMotion(s: Pick<SettingsState, 'motion' | 'followSystemMotion' | 'systemReduceMotion'>): 'full' | 'reduced' | 'off' {
  if (s.motion === 'off') {
    return 'off';
  }
  if (s.motion === 'reduced' || (s.followSystemMotion && s.systemReduceMotion)) {
    return 'reduced';
  }
  return 'full';
}

export function useMotion(): 'full' | 'reduced' | 'off' {
  return useSettings(s => effectiveMotion(s));
}
