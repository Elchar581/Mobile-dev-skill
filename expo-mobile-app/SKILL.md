---
name: expo-mobile-app
description: Use this skill when the user wants to build, scaffold, configure, or release a mobile app with Expo + React Native + TypeScript. Triggers on requests to set up EAS Build, ship an APK, configure i18n, persist state, design a profile-slot save system, integrate Zustand stores, validate JSON configs with Zod, replace React Native's Alert with a custom modal, configure adaptive icons, push iOS simulator builds, or publish to GitHub Releases. Reflects a battle-tested workflow that produced a real shipped app (CashFlow 101).
---

# Expo Mobile App Development

Battle-tested patterns and commands for building a production-quality mobile app with **Expo SDK 54+ / React Native 0.81+ / TypeScript**, deployable as Android `.apk` and iOS Simulator `.app` via **EAS Build**, with Zustand persistence, Zod-validated configs, i18n-js multilingual UI, and a clean GitHub Release pipeline.

Source of truth: this skill was distilled from shipping a real app end-to-end (Welcome → profile slots → tabbed gameplay → 18 form sub-screens → 4 languages → 12 EAS builds → published v1.0.0 with APK on GitHub Releases).

## Stack — opinionated defaults

| Layer | Pick | Why |
|---|---|---|
| Framework | **Expo SDK 54** + React Native + TypeScript | One codebase → Android, iOS, Web. Cloud builds via EAS. |
| Routing | **Expo Router v6** (file-based) | `app/` directory becomes routes. Tabs, stack, modals built in. |
| State | **Zustand 5** + `persist` middleware | Lightweight, no boilerplate, plays nicely with AsyncStorage. |
| Storage | `@react-native-async-storage/async-storage` | Standard for React Native persistence. |
| Validation | **Zod 4** | Validates JSON configs at module load → fail loud, not silent. Infer TS types from schemas (single source of truth). |
| i18n | **i18n-js v4** + `expo-localization` | Default `{{var}}` placeholder syntax. Light, no React context plumbing needed. |
| UI primitives | Template's `ThemedText` / `ThemedView` | Light/dark theming out of the box; build your own only if needed. |
| Build | **EAS Build** | `npx eas-cli build --platform <p> --profile <p>` is the entire pipeline. |

Skip until you actually need them: Redux, MobX, Tamagui/Paper, React Query (most apps don't need server-state lib), navigation libs other than Expo Router.

## Initial setup (commands)

```bash
# Scaffold (creates a new directory with default template — Expo Router + tabs + TS)
npx create-expo-app@latest <app-name> --template default --no-install
cd <app-name>

# Install
npm install

# App-specific extra deps via expo install (gets compatible versions)
npx expo install zustand @react-native-async-storage/async-storage zod \
  i18n-js expo-localization

# First sanity check — must pass
npx tsc --noEmit
npx expo-doctor
```

After scaffold, **edit `app.json`**:
- `expo.name` → display label (any string, can be localized later)
- `expo.slug` → kebab-case URL identifier
- `expo.android.package` → `com.your.appid` (REQUIRED for Android builds)
- `expo.ios.bundleIdentifier` → same id, e.g. `com.your.appid` (REQUIRED for iOS)

## Recommended project structure

```
<app>/
├── app/                       # Expo Router routes
│   ├── index.tsx              # entry / welcome
│   ├── (tabs)/                # tab group
│   │   ├── _layout.tsx
│   │   ├── tab-a.tsx
│   │   └── tab-b.tsx
│   ├── modals/                # modal sub-routes (optional)
│   ├── _layout.tsx            # root Stack + global modals
│   └── ...
├── components/                # reusable UI (alert-modal, form-scroll, themed-input, ...)
├── config/                    # JSON game data / static config
│   └── README.md              # explains each file, edit conventions
├── lib/
│   ├── schema.ts              # Zod schemas → infer types
│   ├── types.ts               # PlayerState/runtime types not loaded from JSON
│   ├── configs.ts             # imports + validates all JSON
│   ├── calculations.ts        # pure functions — single render-time arithmetic
│   ├── events.ts              # pure mutators returning new state
│   └── i18n/
│       ├── index.ts           # i18n initialization
│       └── locales/{ru,en,...}.ts
├── store/
│   ├── <domain>.ts            # Zustand stores
│   ├── locale.ts              # language selection + useT hook
│   └── alert.ts               # global alert state
├── assets/images/             # icons (1024×1024) + splash
├── app.json
├── eas.json
├── package.json
└── tsconfig.json
```

Path alias `@/*` → project root is set up by default in template.

## EAS Build (Android `.apk` + iOS Simulator)

### 1. One-time setup

```bash
# Install CLI globally so it's on PATH
npm install -g eas-cli

# Authenticate (opens browser, OR set EXPO_TOKEN env var for headless)
eas login
# OR
export EXPO_TOKEN="<personal-access-token-from-expo.dev/settings/access-tokens>"

# Link project to your Expo account (writes extra.eas.projectId to app.json)
eas init --non-interactive --force
```

### 2. eas.json — profiles that produce installable artifacts

See `snippets/eas.json` for a complete file. Highlights:
- `preview` and `production` profiles
- `android.buildType: "apk"` → outputs `.apk` (NOT `.aab` Play Store bundle) — directly installable
- `distribution: "internal"` → no Play Store gating
- `ios.simulator: true` → builds `.tar.gz` containing `.app` for iOS Simulator on macOS, **no Apple Developer account needed**

### 3. Build commands

```bash
# Android APK — production
eas build --platform android --profile production --non-interactive --no-wait

# iOS Simulator build — no Apple account
eas build --platform ios --profile production --non-interactive --no-wait

# Returns a build URL like:
# https://expo.dev/accounts/<user>/projects/<slug>/builds/<id>
```

### 4. Polling pattern for headless / agent flows

Don't wait blocking — use `--no-wait`, then poll:

```bash
BUILD_ID="<from previous output>"
while true; do
  STATUS=$(eas build:view "$BUILD_ID" --json | grep -oE '"status":[[:space:]]*"[^"]*"' | sed 's/.*"\([^"]*\)"$/\1/')
  case "$STATUS" in
    FINISHED|ERRORED|CANCELED) break ;;
  esac
  sleep 60
done
echo "$STATUS"
eas build:view "$BUILD_ID" --json | grep '"buildUrl"'
```

Realistic times (free tier): Android APK **~13 min** (10 build + queue), iOS Simulator **~5 min**. Free tier limit: **30 builds/month**.

### 5. Download the APK

The `buildUrl` field in `eas build:view --json` points to the artifact. `curl -L -o app.apk <buildUrl>`.

## Battle-tested patterns

### A. Profile slots with Zustand persist

Local-first, multiple saves, works offline. Pattern in `snippets/zustand-profiles.ts`:

```ts
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";

type ProfileSlot = { id: string; createdAt: number; updatedAt: number; data: T };
type State = { profiles: ProfileSlot[]; activeId: string | null; ... };

export const useProfilesStore = create<State>()(
  persist(/* state + actions */, {
    name: "<app>:storage",
    storage: createJSONStorage(() => AsyncStorage),
    version: 1,
    partialize: (s) => ({ profiles: s.profiles, activeId: s.activeId }),
  }),
);
```

Always `partialize` to exclude functions (actions) — they shouldn't go into AsyncStorage. Set `version` and add a `migrate` callback when state shape changes.

### B. Custom Alert modal (replaces RN `Alert.alert`)

React Native's `Alert.alert` has limits on iOS (max 3 buttons), inconsistent visuals across platforms, and can't be styled. Replace once with a global Zustand-driven `<AlertModal />` mounted in root layout. Imperative API matches RN's signature so refactor is mechanical:

```ts
alertModal("Title", "Message", [
  { text: "Cancel", style: "cancel" },
  { text: "Delete", style: "destructive", onPress: () => doDelete() },
]);
```

See `snippets/alert-modal.tsx` and `snippets/alert-store.ts`.

### C. i18n-js with reactive locale store + defensive sync

```ts
import { I18n } from "i18n-js";
import en from "./locales/en"; import ru from "./locales/ru"; // etc.

const i18n = new I18n({ ru, en });
i18n.defaultLocale = "ru"; i18n.enableFallback = true; i18n.locale = "ru";

export function useT() {
  const locale = useLocaleStore((s) => s.locale);  // subscribe → re-render on change
  if (i18n.locale !== locale) i18n.locale = locale;  // defensive sync — covers persist rehydration races
  return (key: string, params?: Record<string, unknown>) => i18n.t(key, params);
}
```

The defensive `i18n.locale = locale` line solves the bug where `persist` rehydration sets state.locale but i18n's internal locale lags behind, causing translations to render in stale language.

For dynamic content (profession names, deal names), key by ID and fall back to the JSON name:
```ts
t(`professions.${prof.id}`, { defaultValue: prof.name })
```

### D. Per-screen Stack.Screen options for live title updates

If you only set Stack screen titles in the root `_layout.tsx`, they're frozen at first render. When user switches language, already-mounted screens keep their old title.

**Fix:** in each screen file, render `<Stack.Screen options={{ title: t("...") }} />` inside the JSX. The screen re-renders on locale change → title updates immediately.

```tsx
return (
  <>
    <Stack.Screen options={{ title: t("actions.bankLoan") }} />
    <FormScroll>...</FormScroll>
  </>
);
```

### E. Schema-validated JSON configs

Use Zod schemas as the single source of truth — TS types come from `z.infer<>`, runtime validation happens at module load:

```ts
// lib/schema.ts
export const ProfessionSchema = z.object({ id: z.string(), salary: z.number().nonnegative(), ... });
export type Profession = z.infer<typeof ProfessionSchema>;
export const ProfessionListSchema = z.array(ProfessionSchema).nonempty();

// lib/configs.ts
import data from "@/config/professions.json";
export const PROFESSIONS = ProfessionListSchema.parse(data);
```

If JSON is broken, the app crashes immediately at startup with a Zod error pointing to the bad field. Way better than silently using `undefined`.

### F. FormScroll — safe-area aware ScrollView

System nav bar (Android 3-button nav, iOS home indicator) overlaps the bottom of plain ScrollView content. Standard fix: a wrapper that adds `useSafeAreaInsets().bottom + 24` to `paddingBottom`. Use it for every form/sub-route ScrollView outside of tab content. See `snippets/form-scroll.tsx`.

### G. Pure mutators in `events.ts`

Keep state changes as pure functions returning a new `PlayerState`:

```ts
export function buyStock(p: PlayerState, templateId: string, shares: number, pricePerShare: number): PlayerState {
  if (shares <= 0 || pricePerShare < 0) return p;
  const cost = shares * pricePerShare;
  if (cost > p.cash) return p;
  // ... compute new stocks array ...
  return { ...p, cash: p.cash - cost, stocks: newStocks, history: [...p.history, evt] };
}
```

Easy to test, easy to compose, every action also appends to a `history: GameEvent[]` array — sets up undo/replay later.

### H. Adaptive icon assets for Android

Android 8+ uses adaptive icons with foreground + background layers. Set in `app.json`:
```json
"android": {
  "adaptiveIcon": {
    "foregroundImage": "./assets/images/android-icon-foreground.png",
    "backgroundImage": "./assets/images/android-icon-background.png",
    "monochromeImage": "./assets/images/android-icon-monochrome.png"
  }
}
```
Foreground must fit within the **safe zone (~66% of canvas)** — Android's mask crops aggressively. Generate via `sharp` from a single 1024×1024 master.

## Common gotchas (from real shipping)

| Symptom | Cause | Fix |
|---|---|---|
| `tsc` complains: `'/foo'` not assignable to route type | Stale `.expo/types/router.d.ts` from `typedRoutes: true` | Either disable typedRoutes in app.json **and delete `.expo/types/router.d.ts`**, or run `npx expo start` once to regenerate |
| Persist rehydration uses stale i18n.locale | Race between `set({locale})` and `applyLocale()` callback | Defensive `i18n.locale = locale` inside `useT()` (pattern C) |
| iOS Alert with 4+ buttons silently shows 3 | RN platform constraint | Use custom modal (pattern B) |
| Header title not updating on language switch | `Stack.Screen options` cached at mount | Set options inside the screen, not only in `_layout.tsx` (pattern D) |
| `Alert.alert("Ошибка", "...")` shows in old language after locale switch | Hardcoded strings | Wrap in `t()` and pass `t("common.error")` |
| `eas build` fails with "Resource not accessible by personal access token" | Fine-grained PAT missing **Contents: Read and write** | Regenerate token with proper scope (see GitHub release section below) |
| `eas build --platform ios` fails on signing | No Apple Developer account | Set `ios.simulator: true` in eas.json profile — produces `.app` for Xcode Simulator, no signing needed |
| `useT` returned function never updates | Selector not subscribing | Call `useLocaleStore((s) => s.locale)` (returns the value, even if discarded) — that's the subscription |
| Empty playerName shows blank big title | No fallback | `<Title>{player.playerName \|\| professionName}</Title>` — same fallback in muted subtitle and balance |

## GitHub Release flow (publish APK to a tag)

```bash
# 1. Configure
git config user.name "<you>"
git config user.email "<email>@users.noreply.github.com"

# 2. Remote — embed PAT in URL once for push, then strip
GH_TOKEN="<fine-grained-pat-with-Contents:write>"
git remote add origin "https://${GH_TOKEN}@github.com/<owner>/<repo>.git"
git push -u origin main
git remote set-url origin "https://github.com/<owner>/<repo>.git"  # remove token

# 3. Tag + push
git tag -a v1.0.0 -m "Release notes summary..."
git push origin v1.0.0

# 4. Create release via REST API (no gh CLI needed)
RELEASE_ID=$(curl -s -X POST \
  -H "Authorization: Bearer $GH_TOKEN" \
  -H "Accept: application/vnd.github+json" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  https://api.github.com/repos/<owner>/<repo>/releases \
  -d '{"tag_name":"v1.0.0","name":"v1.0.0","body":"...","draft":false,"prerelease":false}' \
  | grep -oE '"id":[[:space:]]*[0-9]+' | head -1 | grep -oE '[0-9]+')

# 5. Upload APK as asset
curl -X POST \
  -H "Authorization: Bearer $GH_TOKEN" \
  -H "Accept: application/vnd.github+json" \
  -H "Content-Type: application/vnd.android.package-archive" \
  --data-binary @app.apk \
  "https://uploads.github.com/repos/<owner>/<repo>/releases/${RELEASE_ID}/assets?name=app.apk"
```

### Required PAT permissions (fine-grained PAT)

- **Contents**: Read and write *(required for push, tag, release create, asset upload)*
- **Metadata**: Read *(auto-included)*
- **Workflows**: Read and write *(only if you commit `.github/workflows/*.yml`)*

If permissions are wrong, you get HTTP 403 `Resource not accessible by personal access token` on every write. Don't try to debug — regenerate the token.

### Token hygiene

- Never commit a token. Use env (`export GH_TOKEN=...`) or a secret manager.
- After embedding in `git remote add` URL, strip it via `git remote set-url` once push completes.
- Rotate after sharing in any chat / log / CI artifact.

## Files in this skill

- `SKILL.md` — this file (quick reference + all patterns)
- `reference/` — deeper dives into specific topics (read on demand)
- `snippets/` — copy-pasteable code & config

## Decision tree: should I follow this skill?

**Yes** — if user wants a cross-platform mobile app, has Node, can use cloud build, doesn't need offline native debugging, ships as APK + optional iOS sim.

**No, look elsewhere** — if user needs:
- iOS App Store submission (this stops at simulator builds; needs Apple Developer + extra config)
- React Native bare workflow (no Expo Router) — different setup
- Server backend / authentication / sync — out of scope here
- 3D / heavy graphics — different toolkit
