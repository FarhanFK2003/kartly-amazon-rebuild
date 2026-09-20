"use client";

import { create } from "zustand";

interface NavDrawerState {
  open: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
}

/**
 * Open state for the department drawer.
 *
 * The drawer has two triggers - the mobile hamburger and the desktop "All"
 * button - but must exist only once in the DOM, or the page ships two dialogs
 * and two scrims to the accessibility tree. A tiny shared store lets both
 * triggers drive a single instance without threading props through the header.
 */
export const useNavDrawer = create<NavDrawerState>((set) => ({
  open: false,
  openDrawer: () => set({ open: true }),
  closeDrawer: () => set({ open: false }),
}));
