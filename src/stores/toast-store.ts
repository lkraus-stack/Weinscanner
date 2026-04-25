import { create } from 'zustand';

type ToastState = {
  message: string | null;
  visible: boolean;
  showToast: (message: string) => void;
  hideToast: () => void;
};

export const useToastStore = create<ToastState>((set) => ({
  message: null,
  visible: false,
  showToast: (message) => set({ message, visible: true }),
  hideToast: () => set({ visible: false }),
}));
