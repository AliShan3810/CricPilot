import { create } from 'zustand';
import type { MatchEvent } from '../core/engine/types';
import { matchService, type LoadedMatch } from '../services/matchService';
import { detectEffects, type ScoringEffect } from '../features/scoring/effects';
import { bumpData, errorMessage } from './appStore';
import { setLastMatch } from '../data/storage/preferences';
import { SoundManager } from '../services/sound/SoundManager';

interface ScoringState {
  matchId: string | null;
  match: LoadedMatch | null;
  loading: boolean;
  /** true while a write is in flight (taps are queued, never dropped) */
  busy: boolean;
  error: string | null;
  /** last celebration effects, with an id so the UI can react once per change */
  effects: { id: number; list: ScoringEffect[] };
  open: (matchId: string) => Promise<void>;
  close: () => void;
  record: (event: MatchEvent) => Promise<boolean>;
  undo: () => Promise<boolean>;
  redo: () => Promise<boolean>;
  correct: (eventId: string, event: MatchEvent) => Promise<boolean>;
  setToss: (winnerId: string, decision: 'bat' | 'bowl') => Promise<boolean>;
  clearError: () => void;
}

let queue: Promise<unknown> = Promise.resolve();
let effectId = 0;

/** Serialises writes so rapid taps are applied in order. */
function enqueue<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(fn, fn);
  queue = run.catch(() => undefined);
  return run;
}

export const useScoring = create<ScoringState>((set, get) => {
  async function mutate(fn: () => Promise<LoadedMatch>, event?: MatchEvent): Promise<boolean> {
    return enqueue(async () => {
      const before = get().match;
      set({ busy: true });
      try {
        const after = await fn();
        const list = event && before ? detectEffects(before.state, after.state, event) : [];
        set({ match: after, busy: false, error: null, effects: list.length ? { id: ++effectId, list } : get().effects });
        // sound + haptics only for a freshly recorded ball (undo / redo / corrections pass no event)
        if (list.length) {
          SoundManager.celebrate(list);
        }
        bumpData();
        return true;
      } catch (e) {
        set({ busy: false, error: errorMessage(e) });
        return false;
      }
    });
  }

  return {
    matchId: null,
    match: null,
    loading: false,
    busy: false,
    error: null,
    effects: { id: 0, list: [] },
    async open(matchId) {
      set({ matchId, loading: true, error: null, effects: { id: 0, list: [] } });
      try {
        const match = await matchService.load(matchId);
        if (get().matchId === matchId) {
          set({ match, loading: false });
          setLastMatch(match.record.status === 'completed' ? null : matchId);
        }
      } catch (e) {
        set({ loading: false, error: errorMessage(e) });
      }
    },
    close() {
      set({ matchId: null, match: null, error: null, effects: { id: 0, list: [] } });
    },
    record(event) {
      const id = get().matchId;
      if (!id) {
        return Promise.resolve(false);
      }
      return mutate(() => matchService.record(id, event), event);
    },
    undo() {
      const id = get().matchId;
      return id ? mutate(() => matchService.undo(id)) : Promise.resolve(false);
    },
    redo() {
      const id = get().matchId;
      return id ? mutate(() => matchService.redo(id)) : Promise.resolve(false);
    },
    correct(eventId, event) {
      const id = get().matchId;
      return id ? mutate(() => matchService.correct(id, eventId, event)) : Promise.resolve(false);
    },
    setToss(winnerId, decision) {
      const id = get().matchId;
      return id ? mutate(() => matchService.setToss(id, winnerId, decision)) : Promise.resolve(false);
    },
    clearError() {
      set({ error: null });
    },
  };
});
