"use client";

import { create } from "zustand";

interface SearchOverlayState {
  open: boolean;
  openSearch: () => void;
  closeSearch: () => void;
}

/**
 * Open state for the search overlay.
 *
 * The overlay is rendered once, at the app shell, but it is opened from three
 * places: the desktop app-bar trigger, the mobile app-bar icon, and the mobile
 * bottom tab. A small shared store lets all three drive one instance rather
 * than threading a callback through a server component that has no business
 * knowing about an overlay - the same arrangement the mini-cart uses.
 */
export const useSearchOverlay = create<SearchOverlayState>((set) => ({
  open: false,
  openSearch: () => set({ open: true }),
  closeSearch: () => set({ open: false }),
}));
