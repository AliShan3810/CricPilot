import { useSettings } from '../stores/settingsStore';

type Kind = 'tap' | 'select' | 'run' | 'boundary' | 'six' | 'wicket' | 'success' | 'warning' | 'error';

const MAP: Record<Kind, string> = {
  tap: 'impactLight',
  select: 'selection',
  run: 'impactLight',
  boundary: 'impactMedium',
  six: 'impactHeavy',
  wicket: 'notificationWarning',
  success: 'notificationSuccess',
  warning: 'notificationWarning',
  error: 'notificationError',
};

let mod: { trigger: (t: string, o?: object) => void } | null | undefined;

function native() {
  if (mod === undefined) {
    try {
      mod = require('react-native-haptic-feedback').default;
    } catch {
      mod = null;
    }
  }
  return mod;
}

/** Contextual haptic feedback; respects the in-app haptics setting. */
export function haptic(kind: Kind): void {
  if (!useSettings.getState().haptics) {
    return;
  }
  try {
    native()?.trigger(MAP[kind], { enableVibrateFallback: false, ignoreAndroidSystemSettings: false });
  } catch {
    // haptics are never critical
  }
}
