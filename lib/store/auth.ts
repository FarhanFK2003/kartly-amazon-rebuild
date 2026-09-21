"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export interface DemoUser {
  name: string;
  /** Email or phone exactly as typed. Never sent anywhere. */
  identifier: string;
  signedInAt: string;
}

interface AuthState {
  user: DemoUser | null;
  signIn: (identifier: string, name?: string) => void;
  signOut: () => void;
}

/**
 * Simulated sign-in.
 *
 * There is no server, no session, no token and no password stored - anywhere.
 * The password field is validated for shape only and then discarded; this store
 * keeps a display name and the identifier the shopper typed, in localStorage, so
 * the header can greet them and sign-out has something to clear.
 *
 * Nothing in the shop requires this. The whole store works signed out, and that
 * stays true: signing in changes the greeting, not the capability.
 */
export const useAuth = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      signIn: (identifier, name) =>
        set({
          user: {
            name: name?.trim() || deriveName(identifier),
            identifier: identifier.trim(),
            signedInAt: new Date().toISOString(),
          },
        }),
      signOut: () => set({ user: null }),
    }),
    {
      name: "kartly.auth",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ user: state.user }),
    }
  )
);

/** Turns "farhan.khan@example.com" into "Farhan" for the header greeting. */
export function deriveName(identifier: string): string {
  const trimmed = identifier.trim();
  if (!trimmed.includes("@")) return "Shopper";
  const local = trimmed.split("@")[0].split(/[._\-+]/)[0];
  if (!local) return "Shopper";
  return local.charAt(0).toUpperCase() + local.slice(1);
}
