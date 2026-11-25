/**
 * Central sound engine (react-native-audio-api, Web Audio model).
 *
 * - All sounds are bundled and decoded once at start-up (no playback delay).
 * - Layers are scheduled on the audio clock, so bat / crowd / sting stay in sync.
 * - A new sequence cancels the previous one's pending layers and fades its crowd and
 *   celebration layers, so sounds never pile up; identical requests within 300 ms are ignored.
 * - Category toggles and master volume come from the persisted settings.
 * - iOS uses the "ambient" session: it respects the silent switch and mixes with other audio.
 * - The audio context is suspended in the background and resumed in the foreground.
 */
import { AppState, Platform, type AppStateStatus, type NativeEventSubscription } from 'react-native';
import { useSettings } from '../../stores/settingsStore';
import { haptic } from '../haptics';
import { CUES, SOUND_CATEGORY, planCues, type CueName, type PlannedCue, type SoundCategory, type SoundId } from './cues';
import type { ScoringEffect } from '../../features/scoring/effects';

const SOURCES: Record<SoundId, number> = {
  bat_four: require('../../assets/sounds/bat_four.mp3'),
  bat_six: require('../../assets/sounds/bat_six.mp3'),
  ball_whoosh: require('../../assets/sounds/ball_whoosh.mp3'),
  stumps: require('../../assets/sounds/stumps.mp3'),
  coin_toss: require('../../assets/sounds/coin_toss.mp3'),
  crowd_cheer: require('../../assets/sounds/crowd_cheer.mp3'),
  crowd_roar: require('../../assets/sounds/crowd_roar.mp3'),
  crowd_wicket: require('../../assets/sounds/crowd_wicket.mp3'),
  crowd_groan: require('../../assets/sounds/crowd_groan.mp3'),
  applause: require('../../assets/sounds/applause.mp3'),
  sting_milestone: require('../../assets/sounds/sting_milestone.mp3'),
  sting_century: require('../../assets/sounds/sting_century.mp3'),
  sting_victory: require('../../assets/sounds/sting_victory.mp3'),
  sting_hattrick: require('../../assets/sounds/sting_hattrick.mp3'),
  sting_innings: require('../../assets/sounds/sting_innings.mp3'),
  sting_duck: require('../../assets/sounds/sting_duck.mp3'),
  sting_tournament: require('../../assets/sounds/sting_tournament.mp3'),
};

type Api = typeof import('react-native-audio-api');
type Ctx = InstanceType<Api['AudioContext']>;
type Buffer = Awaited<ReturnType<Ctx['decodeAudioData']>>;
type Source = ReturnType<Ctx['createBufferSource']>;
type Gain = ReturnType<Ctx['createGain']>;

interface Playing {
  source: Source;
  gain: Gain;
  category: SoundCategory;
}

function categoryEnabled(c: SoundCategory): boolean {
  const s = useSettings.getState();
  if (!s.sound) {
    return false;
  }
  return c === 'crowd' ? s.soundCrowd : c === 'scoring' ? s.soundScoring : s.soundCelebration;
}

class SoundManagerImpl {
  private api: Api | null = null;
  private ctx: Ctx | null = null;
  private master: Gain | null = null;
  private buffers = new Map<SoundId, Buffer>();
  private loading: Promise<void> | null = null;
  private playing: Playing[] = [];
  private timers: Array<ReturnType<typeof setTimeout>> = [];
  private lastSignature = '';
  private lastAt = 0;
  private appState: NativeEventSubscription | null = null;
  private unsubscribeSettings: (() => void) | null = null;
  ready = false;

  /** Loads and decodes every sound once. Safe to call many times. */
  init(): Promise<void> {
    if (this.loading) {
      return this.loading;
    }
    this.loading = (async () => {
      try {
        this.api = require('react-native-audio-api') as Api;
        if (Platform.OS === 'ios') {
          // ambient: respects the silent switch and mixes with the user's music
          this.api.AudioManager.setSystemOptions({ ios: { category: 'ambient', mode: 'default', options: ['mixWithOthers'] } });
        }
        this.ctx = new this.api.AudioContext();
        this.master = this.ctx.createGain();
        this.master.gain.value = useSettings.getState().soundVolume;
        this.master.connect(this.ctx.destination);
        await Promise.all(
          (Object.keys(SOURCES) as SoundId[]).map(async id => {
            try {
              this.buffers.set(id, await this.ctx!.decodeAudioData(SOURCES[id]));
            } catch {
              // a missing sound must never break scoring
            }
          }),
        );
        this.ready = this.buffers.size > 0;
        this.appState = AppState.addEventListener('change', this.onAppState);
        this.unsubscribeSettings = useSettings.subscribe(s => {
          if (this.master && this.ctx) {
            this.master.gain.setValueAtTime(s.sound ? s.soundVolume : 0, this.ctx.currentTime);
          }
        });
        // the context starts suspended on some platforms until something plays
        await this.ctx.suspend().catch(() => undefined);
      } catch {
        this.ready = false;
      }
    })();
    return this.loading;
  }

  private onAppState = (state: AppStateStatus) => {
    if (!this.ctx) {
      return;
    }
    if (state === 'active') {
      // stays suspended until the next sound (saves battery)
    } else {
      this.stopAll(0);
      this.ctx.suspend().catch(() => undefined);
    }
  };

  /** Stops every scheduled and playing layer (optionally with a short fade). */
  stopAll(fadeMs = 120) {
    this.timers.forEach(clearTimeout);
    this.timers = [];
    const ctx = this.ctx;
    for (const p of this.playing) {
      try {
        if (ctx && fadeMs > 0) {
          const now = ctx.currentTime;
          p.gain.gain.setValueAtTime(p.gain.gain.value, now);
          p.gain.gain.linearRampToValueAtTime(0, now + fadeMs / 1000);
          p.source.stop(now + fadeMs / 1000 + 0.02);
        } else {
          p.source.stop();
        }
      } catch {
        // already stopped
      }
    }
    this.playing = [];
  }

  private async ensureRunning(): Promise<boolean> {
    if (!this.ready || !this.ctx) {
      await this.init();
    }
    if (!this.ready || !this.ctx) {
      return false;
    }
    if (this.ctx.state !== 'running') {
      await this.ctx.resume().catch(() => undefined);
    }
    return true;
  }

  private playLayer(sound: SoundId, delayMs: number, gainValue: number) {
    const ctx = this.ctx;
    const buffer = this.buffers.get(sound);
    const category = SOUND_CATEGORY[sound];
    if (!ctx || !buffer || !this.master || !categoryEnabled(category)) {
      return;
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.value = gainValue;
    source.connect(gain);
    gain.connect(this.master);
    const entry: Playing = { source, gain, category };
    this.playing.push(entry);
    source.onended = () => {
      this.playing = this.playing.filter(p => p !== entry);
    };
    source.start(ctx.currentTime + delayMs / 1000);
  }

  /** Plays a planned sequence of cues (sounds + haptics) as one coordinated moment. */
  async playPlan(plan: PlannedCue[]) {
    if (plan.length === 0) {
      return;
    }
    const signature = plan.map(p => p.cue).join('+');
    const now = Date.now();
    if (signature === this.lastSignature && now - this.lastAt < 300) {
      return; // duplicate request
    }
    this.lastSignature = signature;
    this.lastAt = now;
    // a new moment replaces whatever was still playing (bat sounds are short and simply end)
    this.stopAll(140);
    for (const p of plan) {
      for (const h of CUES[p.cue].haptics) {
        this.timers.push(setTimeout(() => haptic(h.kind), p.at + h.at));
      }
    }
    if (!useSettings.getState().sound) {
      return;
    }
    const ok = await this.ensureRunning();
    if (!ok) {
      return;
    }
    for (const p of plan) {
      for (const layer of CUES[p.cue].layers) {
        this.playLayer(layer.sound, p.at + layer.at, layer.gain);
      }
    }
  }

  /** Celebrates a freshly recorded ball. Never called for undo, redo, corrections or recovery. */
  celebrate(effects: ScoringEffect[]) {
    this.playPlan(planCues(effects)).catch(() => undefined);
  }

  play(cue: CueName) {
    this.playPlan([{ cue, at: 0 }]).catch(() => undefined);
  }

  /** Releases native audio resources (used on app shutdown and in tests). */
  async dispose() {
    this.stopAll(0);
    this.appState?.remove();
    this.unsubscribeSettings?.();
    await this.ctx?.close().catch(() => undefined);
    this.ctx = null;
    this.master = null;
    this.buffers.clear();
    this.loading = null;
    this.ready = false;
  }
}

export const SoundManager = new SoundManagerImpl();
