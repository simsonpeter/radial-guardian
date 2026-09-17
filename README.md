# Radial Defense

A neon arcade survival game. A glowing energy core sits at the center of the arena. Enemy projectiles close in from every direction. You control a single shield arc — deflect inbound fire, chain same-color collisions, and keep the core alive.

## Play

Open `index.html` in a modern browser, or serve the folder:

```bash
python3 -m http.server 43127
```

Then visit `http://localhost:43127`.

No build step, backend, or audio files are required.

## Controls

**Desktop**
- Mouse movement aims the shield
- Left / Right arrows (or A / D) rotate
- Space activates Shield Burst
- Esc or P pauses

**Mobile**
- Drag around the core to aim
- BURST button activates the special

## Rules

- Incoming bolts that hit the shield arc bounce outward.
- If a deflected bolt strikes another bolt of the **same color**, you score a chain reaction and raise the combo.
- A **mismatched** color collision damages the shield and breaks the combo.
- Bolts that reach the core also drain shield energy.
- Shield Burst briefly widens the arc and clears nearby inbound fire (cooldown).
- Difficulty steps up every 15 seconds. The run ends when shield energy hits zero.
- On game over, ads are optional. The first continue restores **90%** energy, then **80%**, **70%**, down to **10%**. After that you must restart or quit.

High score is stored in `localStorage`.

## Options

- Mute / volume on the start screen
- Reduced motion (less shake, hit-stop, and particle density)

## Ads

Rewarded ads restore shield energy after a wipe: **90%**, then **80%**, **70%**, … down to **10%** (nine continues). After that the player must restart. Ads are optional. After each continue, inbound fire stays at an easy pace for **10 seconds**, then ramps back to the current stage. Live ads use Google AdSense publisher `ca-pub-4849617394027497` via the [H5 Games Ad Placement API](https://developers.google.com/ad-placement). `ads.txt` must stay at the site root.

## Project layout

```
index.html
style.css
js/config.js      tunables and layout
js/main.js        bootstrap
js/game.js        loop, spawning, collisions, scoring
js/player.js      shield
js/projectile.js  inbound / deflected bolts
js/particles.js   pooled sparks and floating scores
js/audio.js       Web Audio SFX
js/input.js       mouse, keyboard, touch
js/ui.js          HUD and menus
js/ads.js         rewarded continue ads
js/splash.js      boot splash
js/utils.js       math helpers
icons/            app logo sizes
android/          Bubblewrap TWA project
```

## Splash

On launch, a 5-second splash shows the Radial Guardian logo, **by Jayathasoft**, and a neon loading bar from 0% to 100%.

## Android APK (Bubblewrap)

This repo is a PWA. Bubblewrap wraps it as a Trusted Web Activity.

1. The PWA is hosted at [https://radial-guardian.vercel.app/](https://radial-guardian.vercel.app/).
2. Serve locally and regenerate the Android project if icons change:

```bash
python -m http.server 43127
cd android
npm install
node generate.mjs
```

3. Build a debug APK (installable for testing):

```bash
cd android
set ANDROID_HOME=%LOCALAPPDATA%\Android\Sdk
gradlew.bat assembleDebug
```

The APK is written to `android/app/build/outputs/apk/debug/app-debug.apk`.

Play Store upload files (signed with the local upload key):

- `dist/RadialGuardian-release.aab` — upload this in Play Console
- `dist/RadialGuardian-release.apk` — sideload / other stores

Keep `android/upload-keystore.jks` and `android/keystore.properties` backed up. Losing them means you cannot update the app with the same signing key.

Fullscreen (no URL bar) needs Digital Asset Links at `/.well-known/assetlinks.json` on the live site. After Play App Signing is enabled, add Play Console’s **App signing key certificate** SHA-256 to that file and redeploy.

For a Play Store release, create a signing keystore and run `npx bubblewrap build` from `android/` after `sdkmanager` is on your PATH.
