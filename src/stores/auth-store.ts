import type { Session, User } from '@supabase/supabase-js';
import { create } from 'zustand';

type AuthState = {
  session: Session | null;
  user: User | null;
  isLoading: boolean;
  isPasswordRecovery: boolean;
  clearPasswordRecovery: () => void;
  setPasswordRecovery: (isPasswordRecovery: boolean) => void;
  setSession: (session: Session | null) => void;
  setLoading: (isLoading: boolean) => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  user: null,
  isLoading: true,
  isPasswordRecovery: false,
  clearPasswordRecovery: () => set({ isPasswordRecovery: false }),
  setPasswordRecovery: (isPasswordRecovery) => set({ isPasswordRecovery }),
  setSession: (session) =>
    set({
      session,
      user: session?.user ?? null,
    }),
  setLoading: (isLoading) => set({ isLoading }),
}));
