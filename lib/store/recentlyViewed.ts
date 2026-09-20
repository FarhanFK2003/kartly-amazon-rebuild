"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

const MAX = 20;

interface RecentlyViewedState {
  ids: string[];
  record: (productId: string) => void;
  clear: () => void;
}

/**
 * Product ids the shopper has opened, newest first. Ids only - the homepage
 * joins them against the catalogue at render time, so nothing goes stale if a
 * product's price or title changes.
 */
export const useRecentlyViewed = create<RecentlyViewedState>()(
  persist(
    (set) => ({
      ids: [],
      record: (productId) =>
        set((state) => ({ ids: [productId, ...state.ids.filter((id) => id !== productId)].slice(0, MAX) })),
      clear: () => set({ ids: [] }),
    }),
    {
      name: "kartly.recentlyViewed",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ ids: state.ids }),
    }
  )
);
