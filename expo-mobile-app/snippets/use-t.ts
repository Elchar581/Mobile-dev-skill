// store/locale.ts — reactive locale store + useT hook with defensive sync
//
// Drop this in alongside lib/i18n/index.ts (which exports the i18n instance,
// SUPPORTED_LOCALES, and a setLocale helper).

import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import {
  i18n,
  SUPPORTED_LOCALES,
  setLocale as applyLocale,
  type Locale,
} from "@/lib/i18n";

type LocaleStore = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
};

export const useLocaleStore = create<LocaleStore>()(
  persist(
    (set) => ({
      locale: "ru",
      setLocale: (locale) => {
        applyLocale(locale);
        set({ locale });
      },
    }),
    {
      name: "<app>:locale",
      storage: createJSONStorage(() => AsyncStorage),
      onRehydrateStorage: () => (state) => {
        if (state && SUPPORTED_LOCALES.includes(state.locale)) {
          applyLocale(state.locale);
        }
      },
    },
  ),
);

/**
 * useT — translation hook.
 *
 * - Subscribes to locale via useLocaleStore so the component re-renders
 *   when the user picks a new language.
 * - Defensively syncs i18n.locale to the store value on every render.
 *   This solves the rare case where persist rehydration sets state.locale
 *   but the i18n instance still has the default; without this guard, the
 *   first paint of any screen after cold start can show stale language.
 */
export function useT() {
  const locale = useLocaleStore((s) => s.locale);
  if (i18n.locale !== locale) {
    i18n.locale = locale;
  }
  return (key: string, params?: Record<string, unknown>): string =>
    i18n.t(key, params);
}
