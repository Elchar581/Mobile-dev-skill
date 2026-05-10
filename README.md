# Mobile Dev Skill

Knowledge base distilled from shipping a real mobile app end-to-end with Expo + React Native + TypeScript. Packaged as a **Claude Code skill** that future Claude sessions can load when the user wants to build a similar mobile app.

## What's inside

```
mobile-dev-skill/
├── expo-mobile-app/
│   ├── SKILL.md                       # main skill file (frontmatter + body)
│   ├── reference/
│   │   ├── eas-build.md               # EAS Build deep dive
│   │   ├── i18n-pattern.md            # i18n-js + Zustand pattern
│   │   ├── github-release.md          # publish APK to GitHub Releases via REST API
│   │   └── icons-and-assets.md        # adaptive icon, splash, favicon generation
│   └── snippets/
│       ├── eas.json                   # ready-to-use Android APK + iOS Simulator profiles
│       ├── use-t.ts                   # reactive useT hook with defensive locale sync
│       ├── alert-modal.tsx            # custom Modal-based Alert (replaces RN Alert.alert)
│       ├── form-scroll.tsx            # ScrollView with safe-area bottom inset
│       ├── zustand-profiles.ts        # 4-slot save profile pattern
│       └── zod-config.ts              # schema-first JSON config validation
└── README.md                          # this file
```

## How to use this skill in Claude Code

1. Place the `expo-mobile-app/` directory inside your Claude Code skills directory:
   - **macOS / Linux**: `~/.claude/skills/expo-mobile-app/`
   - **Windows**: `%USERPROFILE%\.claude\skills\expo-mobile-app\`
2. Or install as a plugin via the marketplace if you publish it
3. Future Claude sessions will see "expo-mobile-app" in their available skills list and load it automatically when the user asks about Expo / React Native / EAS Build / etc.

## What problems this skill solves

Prevents the common dead-ends you'd hit if you started from a blank slate:

- ✅ **EAS profiles for `.apk` (not `.aab`)** — Play Store bundles aren't installable directly; users want to sideload
- ✅ **iOS Simulator builds without Apple Developer ($99/yr)** — `simulator: true` in eas.json
- ✅ **i18n that actually re-renders on language switch** — defensive `i18n.locale = locale` sync inside `useT`
- ✅ **Stack header titles that follow the language** — set `<Stack.Screen options>` inside the screen, not in root layout
- ✅ **Custom Alert modal** — RN's `Alert.alert` shows max 3 buttons on iOS, can't be styled
- ✅ **Profile slots with auto-save** — Zustand `persist` + `partialize` to exclude functions
- ✅ **Adaptive icon safe-zone** — Android crops 33% of foreground, must pad
- ✅ **GitHub release via curl** — no `gh` CLI needed, REST API does it all
- ✅ **Fine-grained PAT scopes** — Contents: Read and write is required for push (the obscure 403)

Each snippet was tested in production. The reference docs include the actual error messages you get when things go wrong.

## Source

Distilled from the **CashFlow 101** project — an electronic replacement for the paper form of Robert Kiyosaki's CashFlow 101 board game.

- Repo: https://github.com/Elchar581/AppForm-CashFlow-101
- v1.0.0 release: https://github.com/Elchar581/AppForm-CashFlow-101/releases/tag/v1.0.0

12 EAS builds shipped. 4 languages. Production APK published.

## License

MIT — same as the source project.
