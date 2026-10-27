import { create } from 'zustand';
import { ApiError } from '@/shared/api/client';
import { createId } from '@/shared/lib/misc';

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return 'Something went wrong. Try again.';
}

/** Short-lived notifications. */
interface ToastItem {
  id: string;
  message: string;
  tone: 'default' | 'error';
}
interface ToastState {
  items: ToastItem[];
  push: (message: string, tone?: ToastItem['tone']) => void;
  dismiss: (id: string) => void;
}

export const useToasts = create<ToastState>((set, get) => ({
  items: [],
  push: (message, tone = 'default') => {
    const id = createId();
    set({ items: [...get().items.slice(-2), { id, message, tone }] });
    window.setTimeout(() => get().dismiss(id), 3200);
  },
  dismiss: (id) => set({ items: get().items.filter((t) => t.id !== id) }),
}));

/** Fire-and-forget notification, callable from anywhere. */
export const toast = (message: string, tone?: ToastItem['tone']) => useToasts.getState().push(message, tone);
