# i18n with i18n-js + Zustand

## Setup

```bash
npx expo install i18n-js expo-localization
```

`expo-localization` auto-installs as Expo plugin, gives device locale via `Localization.getLocales()`.

## File layout

```
lib/i18n/
├── index.ts           # i18n object initialization, t function, locale helpers
└── locales/
    ├── ru.ts          # default
    ├── en.ts
    ├── es.ts
    └── zh.ts          # Chinese works out of the box; RN handles CJK fonts
```

## i18n init (`lib/i18n/index.ts`)

```ts
import { I18n } from "i18n-js";
import en from "./locales/en";
import es from "./locales/es";
import ru from "./locales/ru";
import zh from "./locales/zh";

export const SUPPORTED_LOCALES = ["ru", "en", "es", "zh"] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];

export const LOCALE_LABELS: Record<Locale, string> = {
  ru: "Русский",
  en: "English",
  es: "Español",
  zh: "中文",
};

const i18n = new I18n({ ru, en, es, zh });
i18n.defaultLocale = "ru";
i18n.enableFallback = true;
i18n.locale = "ru";

export function setLocale(locale: Locale): void {
  i18n.locale = locale;
}

export function t(key: string, params?: Record<string, unknown>): string {
  return i18n.t(key, params);
}

export { i18n };
```

## Locale store + reactive hook (`store/locale.ts`)

```ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { i18n, SUPPORTED_LOCALES, setLocale, type Locale } from "@/lib/i18n";

type LocaleStore = { locale: Locale; setLocale: (l: Locale) => void };

export const useLocaleStore = create<LocaleStore>()(
  persist(
    (set) => ({
      locale: "ru",
      setLocale: (locale) => {
        setLocale(locale);
        set({ locale });
      },
    }),
    {
      name: "<app>:locale",
      storage: createJSONStorage(() => AsyncStorage),
      onRehydrateStorage: () => (state) => {
        if (state && SUPPORTED_LOCALES.includes(state.locale)) {
          setLocale(state.locale);
        }
      },
    },
  ),
);

export function useT() {
  const locale = useLocaleStore((s) => s.locale);
  // Defensive: keep i18n.locale aligned with the store on every render.
  // Covers persist rehydration races where state.locale and i18n.locale drift.
  if (i18n.locale !== locale) i18n.locale = locale;
  return (key: string, params?: Record<string, unknown>) => i18n.t(key, params);
}
```

## Locale file shape (`lib/i18n/locales/ru.ts`)

```ts
export default {
  app: { name: "MyApp" },
  common: { cancel: "Отмена", delete: "Удалить", error: "Ошибка", ok: "OK" },
  menu: { subtitle: "Выберите партию", create: "+ Создать" },
  // ... namespaces per screen
  professions: { teacher: "Учитель", engineer: "Инженер" },  // dynamic content
};
```

Same shape across all locales — TypeScript will surface missing keys if you derive types from the default locale.

## Using `useT` in components

```tsx
import { useT } from "@/store/locale";

export default function MyScreen() {
  const t = useT();
  return <Text>{t("menu.subtitle")}</Text>;
}
```

Component re-renders automatically when locale changes (because `useLocaleStore` selector changes).

## Translation with interpolation

i18n-js v4 uses `{{var}}` placeholder syntax by default:

```ts
// locale file
greetings: { hello: "Привет, {{name}}!" }

// component
t("greetings.hello", { name: "Маша" })
// → "Привет, Маша!"
```

For pluralization, use ICU-style or just write per-locale logic — i18n-js has built-in plurals but they're fragile across languages; manual is cleaner.

## Dynamic content (catalog names)

For names that come from JSON config (e.g. profession names, deal names), key them by the same `id` as in the config and provide a fallback:

```ts
// locale ru.ts
professions: { teacher: "Учитель" }

// usage
t(`professions.${prof.id}`, { defaultValue: prof.name })
// → translated if locale has it, otherwise the JSON `name` field
```

This means:
- Adding a new profession to JSON works without locale updates (falls back to JSON name)
- Adding a translation for an existing profession works without touching code
- Russian original lives in JSON; other languages live in locale files

## Language picker UI

Avoid `Alert.alert` for picking — iOS truncates to 3 buttons. Use a custom Modal with full list:

```tsx
function LanguagePicker({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const t = useT();
  const currentLocale = useLocaleStore((s) => s.locale);
  const setLocale = useLocaleStore((s) => s.setLocale);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={overlay} onPress={onClose}>
        <ThemedView style={card}>
          <ThemedText type="subtitle">{t("menu.language")}</ThemedText>
          {SUPPORTED_LOCALES.map((loc) => (
            <TouchableOpacity key={loc} onPress={() => { setLocale(loc); onClose(); }}>
              <ThemedText>
                {LOCALE_LABELS[loc]} {loc === currentLocale ? "✓" : ""}
              </ThemedText>
            </TouchableOpacity>
          ))}
        </ThemedView>
      </Pressable>
    </Modal>
  );
}
```

## Stack header titles that update on locale change

Headers set in `_layout.tsx` are cached at first mount. To make them follow locale, use `<Stack.Screen options={{ title: t("...") }} />` inside each screen file:

```tsx
export default function Screen() {
  const t = useT();
  return (
    <>
      <Stack.Screen options={{ title: t("actions.bankLoan") }} />
      <FormScroll>...</FormScroll>
    </>
  );
}
```

When locale changes, screen re-renders, options re-evaluate, header title updates.

## Bulk-translation script (for large refactors)

When migrating from hardcoded strings to `t()` calls, use a node script with a per-file edit list (regex or string replace). Process files via `fs.readFileSync` → apply edits → `fs.writeFileSync`. Faster than 100 manual Edit tool calls.

## Pitfalls

| Symptom | Cause | Fix |
|---|---|---|
| Translation key shows as literal string `"menu.title"` in UI | Key not in any locale | Add to all 4 locale files; check with `t(key, {defaultValue})` |
| New language has Russian leak | Some `t()` calls missing | Grep for hardcoded Cyrillic: `grep -r "[А-я]" app/ components/` |
| Variable name not interpolated, shown as `{{name}}` | Wrong syntax (e.g. used `%{name}`) | i18n-js v4 default is `{{...}}` — verify locale string |
| Picker shows old locale label | Subscription not active | Selector must call `useLocaleStore((s) => s.locale)` (returns the value, even if unused) |
