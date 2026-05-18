import { create } from "zustand";

type AuthState = {
  role: string | null;
  email: string | null;
  setUserMeta: (meta: { role: string | null; email: string | null }) => void;
  clear: () => void;
};

export const useAuthStore = create<AuthState>()((set) => ({
  role: null,
  email: null,
  setUserMeta: (meta) => set({ role: meta.role, email: meta.email }),
  clear: () => set({ role: null, email: null }),
}));
