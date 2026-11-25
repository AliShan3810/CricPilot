import React, { createContext, useContext, useEffect, useMemo } from 'react';
import { AccessibilityInfo, useColorScheme } from 'react-native';
import { useSettings } from '../stores/settingsStore';
import { dark, light, type Palette } from './colors';

interface ThemeValue {
  colors: Palette;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeValue>({ colors: dark, isDark: true });

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const scheme = useColorScheme();
  const mode = useSettings(s => s.themeMode);
  const setSystemReduceMotion = useSettings(s => s.setSystemReduceMotion);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setSystemReduceMotion).catch(() => undefined);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setSystemReduceMotion);
    return () => sub.remove();
  }, [setSystemReduceMotion]);

  const value = useMemo<ThemeValue>(() => {
    // The app is designed dark-first; "system" follows the device.
    const isDark = mode === 'dark' || (mode === 'system' && scheme !== 'light');
    return { colors: isDark ? dark : light, isDark };
  }, [mode, scheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeValue {
  return useContext(ThemeContext);
}

/**
 * Forces a palette for a subtree. Immersive, photo-led screens (splash, onboarding,
 * head-to-head, toss, live scoring, result) always use the dark broadcast look.
 */
export function ThemeOverride({ mode, children }: { mode: 'dark' | 'light'; children: React.ReactNode }) {
  const value = useMemo<ThemeValue>(() => ({ colors: mode === 'dark' ? dark : light, isDark: mode === 'dark' }), [mode]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
