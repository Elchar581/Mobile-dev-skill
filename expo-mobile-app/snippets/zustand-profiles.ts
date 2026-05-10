// store/profiles.ts — local profile slots with auto-save
//
// Pattern: up to N saved game profiles, all stored in AsyncStorage via Zustand
// `persist` middleware. State auto-saves on every change. activeId points to
// the currently-open profile.
//
// Replace `PlayerState` and `createInitialPlayer` with your domain types.

import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

// ─── domain types — replace with yours ────────────────────────
type PlayerState = {
  schemaVersion: 1;
  // ... whatever your save data needs ...
};

type ProfileSlot = {
  id: string;
  createdAt: number;
  updatedAt: number;
  player: PlayerState;
};

const MAX_SLOTS = 4;

// ─── helpers ──────────────────────────────────────────────────
function makeId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

function createInitialPlayer(/* args */): PlayerState {
  return { schemaVersion: 1 };
}

// ─── store ────────────────────────────────────────────────────
type StorageState = {
  schemaVersion: 1;
  profiles: ProfileSlot[];
  activeId: string | null;
};

type Actions = {
  createProfile: (/* args */) => ProfileSlot | null;
  deleteProfile: (id: string) => void;
  setActive: (id: string | null) => void;
  updatePlayer: (id: string, updater: (p: PlayerState) => PlayerState) => void;
  resetPlayer: (id: string) => void;
};

type Store = StorageState & { actions: Actions };

export const useProfilesStore = create<Store>()(
  persist(
    (set, get) => ({
      schemaVersion: 1,
      profiles: [],
      activeId: null,
      actions: {
        createProfile: () => {
          if (get().profiles.length >= MAX_SLOTS) return null;
          const now = Date.now();
          const slot: ProfileSlot = {
            id: makeId(),
            createdAt: now,
            updatedAt: now,
            player: createInitialPlayer(),
          };
          set((s) => ({ profiles: [...s.profiles, slot] }));
          return slot;
        },
        deleteProfile: (id) => {
          set((s) => ({
            profiles: s.profiles.filter((p) => p.id !== id),
            activeId: s.activeId === id ? null : s.activeId,
          }));
        },
        setActive: (id) => set({ activeId: id }),
        updatePlayer: (id, updater) => {
          set((s) => ({
            profiles: s.profiles.map((slot) =>
              slot.id === id
                ? { ...slot, player: updater(slot.player), updatedAt: Date.now() }
                : slot,
            ),
          }));
        },
        resetPlayer: (id) => {
          set((s) => ({
            profiles: s.profiles.map((slot) =>
              slot.id === id
                ? {
                    ...slot,
                    player: createInitialPlayer(),
                    updatedAt: Date.now(),
                  }
                : slot,
            ),
          }));
        },
      },
    }),
    {
      name: "<app>:storage",
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
      // CRITICAL: partialize excludes `actions` (functions can't serialize to JSON)
      partialize: (state) => ({
        schemaVersion: state.schemaVersion,
        profiles: state.profiles,
        activeId: state.activeId,
      }),
      // Add a migrate fn when you bump version:
      // migrate: (persisted, fromVersion) => { ... return persisted as Store; }
    },
  ),
);

// ─── selectors / hooks ────────────────────────────────────────
export const useProfilesActions = () => useProfilesStore((s) => s.actions);

export const useActiveProfile = (): ProfileSlot | null =>
  useProfilesStore((s) =>
    s.activeId ? (s.profiles.find((p) => p.id === s.activeId) ?? null) : null,
  );

export const useProfileSlots = () => useProfilesStore((s) => s.profiles);
