import { create } from 'zustand';

export type ToastTone = 'info' | 'success' | 'error';

interface Toast {
  id: number;
  message: string;
  tone: ToastTone;
}

interface AppState {
  /** bumped after every data change so lists reload */
  dataVersion: number;
  toast: Toast | null;
  bump: () => void;
  showToast: (message: string, tone?: ToastTone) => void;
  hideToast: () => void;
}

let nextToast = 1;

export const useApp = create<AppState>(set => ({
  dataVersion: 0,
  toast: null,
  bump: () => set(s => ({ dataVersion: s.dataVersion + 1 })),
  showToast: (message, tone = 'info') => set({ toast: { id: nextToast++, message, tone } }),
  hideToast: () => set({ toast: null }),
}));

export const toast = (message: string, tone: ToastTone = 'info') => useApp.getState().showToast(message, tone);
export const bumpData = () => useApp.getState().bump();

export function errorMessage(e: unknown): string {
  if (e instanceof Error) {
    return e.message;
  }
  return 'Something went wrong. Please try again.';
}
