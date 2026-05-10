# EAS Build — full workflow reference

## Authentication options

### Interactive
```bash
eas login
# opens browser, caches in ~/.expo/state.json
```

### Headless (CI / agent)
```bash
export EXPO_TOKEN="<personal-access-token>"
# from https://expo.dev/settings/access-tokens
```

`eas-cli` checks `EXPO_TOKEN` env first; falls back to cached creds in `~/.expo/state.json`. With a token in env you can run any `eas` command non-interactively.

## Project linking

```bash
eas init --non-interactive --force
```

What it does:
- Creates a project on Expo backend (e.g. `@<account>/<slug>`)
- Writes `extra.eas.projectId` and `owner` to `app.json`
- Idempotent — `--force` makes it skip "project already exists" prompts

## Profile configuration (`eas.json`)

Minimum profile that produces an installable APK + iOS Simulator app:

```json
{
  "cli": {
    "version": ">= 18.0.0",
    "appVersionSource": "remote"
  },
  "build": {
    "preview": {
      "distribution": "internal",
      "android": { "buildType": "apk" },
      "ios": { "simulator": true }
    },
    "production": {
      "distribution": "internal",
      "android": { "buildType": "apk" },
      "ios": { "simulator": true }
    }
  }
}
```

Key knobs:

| Field | Effect |
|---|---|
| `distribution: "internal"` | Build is for internal/sideload distribution, not Play Store / App Store. URLs work for direct download. |
| `android.buildType: "apk"` | Output is `.apk` (vs default `.aab` Play Store bundle). Directly installable. |
| `ios.simulator: true` | Output is `.tar.gz` containing `.app` for iOS Simulator on macOS. **No Apple Developer account needed.** Cannot install on real device. |

## Building — what to expect

```bash
eas build --platform android --profile production --non-interactive --no-wait
```

Flags:
- `--non-interactive` — never prompt; defaults are used or build fails
- `--no-wait` — return immediately with build URL; don't stream the build log

Returns a URL like:
```
https://expo.dev/accounts/<user>/projects/<slug>/builds/<build-id>
```

### Realistic times (free tier, 2026)

| Build | First (with keystore gen) | Subsequent |
|---|---|---|
| Android APK production | ~18 min | ~13 min |
| iOS Simulator | n/a | ~5 min |

Queue time on free tier: 0–10 min depending on load. Pay tiers get priority queue.

### Free tier limits

- **30 builds/month** total (Android + iOS combined)
- Reset on the 1st of each month
- Builds expire after 14 days (artifact deleted; rebuild to get a new download URL)

## Polling for completion

JSON shape from `eas build:view <id> --json`:

```jsonc
{
  "id": "<uuid>",
  "status": "IN_QUEUE" | "IN_PROGRESS" | "FINISHED" | "ERRORED" | "CANCELED",
  "platform": "ANDROID" | "IOS",
  "artifacts": {
    "buildUrl": "https://expo.dev/artifacts/eas/<hash>.apk",
    "applicationArchiveUrl": "<same>"
  },
  "buildDuration": 800000  // ms
}
```

Polling pattern (run in background to avoid blocking):

```bash
BUILD_ID="<id>"
while true; do
  JSON=$(eas build:view "$BUILD_ID" --json 2>/dev/null)
  STATUS=$(echo "$JSON" | grep -oE '"status":[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"\([^"]*\)"$/\1/')
  case "$STATUS" in
    FINISHED|ERRORED|CANCELED) break ;;
  esac
  sleep 60
done
```

## Downloading the artifact

```bash
APK_URL=$(eas build:view "$BUILD_ID" --json | grep -oE '"buildUrl":[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"\([^"]*\)"$/\1/')
curl -sL -o app.apk "$APK_URL"
```

Or just visit the build URL in browser → Download artifact.

## iOS device build (with Apple Developer)

If user has Apple Developer Program ($99/year), drop `simulator: true` and EAS will:
1. Prompt for Apple ID / app-specific password (or reuse if cached)
2. Generate signing certificate, provisioning profile (managed credentials)
3. Output `.ipa` for ad-hoc / TestFlight / App Store

Profile snippet:
```json
"production-ios-device": {
  "distribution": "internal",
  "ios": { "resourceClass": "m-medium" }
}
```

`distribution: "internal"` for ad-hoc; `distribution: "store"` for App Store submission.

## Common errors

### "Project not configured"
Run `eas init --non-interactive --force`.

### "fingerprint computation taking longer than expected"
First build calculates a project fingerprint (used for OTA update compatibility). Add `EAS_SKIP_AUTO_FINGERPRINT=1` to skip if it stalls.

### "keystore generation failed"
EAS auto-generates keystore for first Android build. If it fails, `eas credentials` interactively walks you through.

### "Build timed out"
Free tier builds have ~2h max. Usually fine; if hit, reduce native module count or check for infinite loops in `expo prebuild` config.
