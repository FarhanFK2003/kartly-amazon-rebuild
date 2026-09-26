"use client";

import { create } from "zustand";

export interface AuthUser {
  id: string;
  email: string;
  createdAt: string;
}

interface AuthState {
  user: AuthUser | null;
  /** True once the first /api/auth/me has answered. */
  ready: boolean;
  hydrate: () => Promise<void>;
  setUser: (user: AuthUser | null) => void;
  signOut: () => Promise<void>;
}

/*
  Who is signed in, according to the server.

  This used to be a simulated identity kept in localStorage. It is now a mirror
  of a real session: the source of truth is an httpOnly cookie the page cannot
  read, checked against PostgreSQL. Nothing about authentication is persisted in
  the browser any more - there is no localStorage key here at all, because
  anything stored client-side would be a claim the server never made.
*/
export const useAuth = create<AuthState>()((set) => ({
  user: null,
  ready: false,

  hydrate: async () => {
    try {
      const res = await fetch("/api/auth/me", { headers: { Accept: "application/json" } });
      // 401 is the normal signed-out answer, not an error.
      set({ user: res.ok ? ((await res.json()).user as AuthUser) : null, ready: true });
    } catch {
      set({ user: null, ready: true });
    }
  },

  setUser: (user) => set({ user, ready: true }),

  signOut: async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      set({ user: null, ready: true });
    }
  },
}));
