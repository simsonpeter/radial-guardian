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

Rewarded ads restore shield energy after a wipe: **90%**, then **80%**, **70%**, … down to **10%** (nine continues). After that the player must restart. Ads are optional. With `ADS.client` empty in `js/config.js`, the game uses a local preview overlay. Set it to your Google AdSense publisher ID (`ca-pub-…`) to serve live [H5 Games ads](https://developers.google.com/ad-placement).

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
js/utils.js       math helpers
```
