# App icons + splash + adaptive icons

## Required assets

For a complete Expo app icon set, you need these PNGs in `assets/images/`:

| File | Size | Purpose |
|---|---|---|
| `icon.png` | 1024×1024 | iOS launcher icon, legacy Android |
| `android-icon-foreground.png` | 1024×1024 | Adaptive icon foreground layer (the rat / logo / etc.) |
| `android-icon-background.png` | 1024×1024 | Adaptive icon background layer (often a solid color) |
| `android-icon-monochrome.png` | 1024×1024 | Themed icons on Android 13+ (single color) |
| `splash-icon.png` | 1024×1024 (or any) | Splash screen image |
| `favicon.png` | 48×48 | Web favicon |

Reference in `app.json`:

```json
{
  "expo": {
    "icon": "./assets/images/icon.png",
    "android": {
      "adaptiveIcon": {
        "foregroundImage": "./assets/images/android-icon-foreground.png",
        "backgroundImage": "./assets/images/android-icon-background.png",
        "monochromeImage": "./assets/images/android-icon-monochrome.png",
        "backgroundColor": "#ffffff"
      }
    },
    "web": { "favicon": "./assets/images/favicon.png" },
    "plugins": [
      ["expo-splash-screen", {
        "image": "./assets/images/splash-icon.png",
        "imageWidth": 200,
        "resizeMode": "contain",
        "backgroundColor": "#ffffff"
      }]
    ]
  }
}
```

## Adaptive icon "safe zone" rule

Android's adaptive icon mask crops the foreground layer aggressively. The launcher may show your icon as a circle, squircle, rounded square — depending on user's device theme.

**Foreground content must fit within the central ~66% of the canvas.** A 1024×1024 foreground image should have its actual logo confined to a ~700×700 box centered.

If you have a single rasterized icon (e.g. 1024×1024 with logo filling the canvas) and use it directly as foreground, the launcher will crop edges. To fix, generate a properly-padded foreground:

```js
// gen-icons.mjs (run via node, requires `sharp`)
import sharp from "sharp";

const SRC = "logo-master.png";
const OUT = "assets/images";
const FG = 1024;       // canvas
const ART = 700;       // safe zone
const offset = Math.round((FG - ART) / 2);

// 1. icon.png — direct copy / resize, no padding (used by iOS/legacy)
await sharp(SRC).resize(FG, FG, { fit: "contain" }).png().toFile(`${OUT}/icon.png`);

// 2. android-icon-foreground.png — logo in safe zone, transparent edges
const artBuf = await sharp(SRC)
  .resize(ART, ART, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .toBuffer();
await sharp({
  create: { width: FG, height: FG, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } }
})
  .composite([{ input: artBuf, top: offset, left: offset }])
  .png()
  .toFile(`${OUT}/android-icon-foreground.png`);

// 3. android-icon-background.png — solid color (or gradient)
await sharp({
  create: { width: FG, height: FG, channels: 4, background: "#ffffff" }
}).png().toFile(`${OUT}/android-icon-background.png`);

// 4. android-icon-monochrome.png — grayscale logo in safe zone, transparent
const monoArt = await sharp(SRC)
  .grayscale()
  .resize(ART, ART, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .toBuffer();
await sharp({
  create: { width: FG, height: FG, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } }
})
  .composite([{ input: monoArt, top: offset, left: offset }])
  .png()
  .toFile(`${OUT}/android-icon-monochrome.png`);

// 5. favicon.png — small web icon
await sharp(SRC).resize(48, 48, { fit: "contain", background: "#ffffff" })
  .png().toFile(`${OUT}/favicon.png`);
```

`sharp` is a great npm CLI image processor; install ad-hoc:

```bash
mkdir -p /tmp/icon-gen && cd /tmp/icon-gen
npm init -y && npm install sharp --no-save
node /path/to/gen-icons.mjs
```

## SVG → PNG rendering

If your logo master is SVG, use `sharp-cli`:

```bash
npx --yes sharp-cli@latest --input logo.svg --output icon.png resize 1024 1024
```

`sharp` can render SVG natively, no Inkscape / ImageMagick needed.

## Generating from a single source image

If you don't have time to design separate assets:

1. Get one square 1024×1024 PNG with your logo
2. Use it as `icon.png` directly (works for iOS / legacy Android)
3. For adaptive: use the script above to create a padded foreground + solid bg

## Splash screen

`expo-splash-screen` plugin with a single `image`. Tips:
- Keep `imageWidth` modest (e.g. 200) so it scales nicely on tablets
- `resizeMode: "contain"` so it doesn't stretch
- Provide separate `dark` config for dark mode if your image needs it:

```json
{
  "image": "./assets/images/splash-icon.png",
  "imageWidth": 200,
  "resizeMode": "contain",
  "backgroundColor": "#ffffff",
  "dark": {
    "image": "./assets/images/splash-icon-dark.png",
    "backgroundColor": "#000000"
  }
}
```

## Skipping iOS-specific icons

Apple no longer requires multiple resolutions in `Contents.json` — Expo handles this. Just provide `icon.png` 1024×1024 and `ios.bundleIdentifier` and you're done.

## Icon previews

Quick local check before pushing:
- Open the generated PNG in any image viewer
- For adaptive icon: imagine a circle / squircle mask cropping it — the logo should look fine in any of those crops

For thorough testing, install the app on a device and try different launchers / Pixel "Themed icons" toggle.
