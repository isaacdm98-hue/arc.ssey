# FriedZooki

A quirky, hand-drawn creature-builder racer inspired by the CBBC show *BAMZOOKi*.
Build a Zook from primitives, tune how it moves, then race it through the five
trials — solo, head-to-head **Versus** on one device, or in **AR on your desk**.

Original clean-room code + the owner's own hand-drawn UI art. No assets or code
from the original game.

## Features

- **Workshop** — tune legs, body, mass, step speed, stride, muscle power, jump and
  steer. The Zook is **always on stage** behind the drawer, so you watch it change
  as you build.
- **My Zooks** — a roster with each Zook's **Passport** (best result per trial).
- **Trials** — the five events with a 3·2·1·GO countdown, AI rivals, placing and
  results recorded to the Passport: **Sprint, Hurdles, Lap, High Jump, Block Push**.
- **Versus** — local hotseat: pick two saved Zooks and race head-to-head, no AI.
- **AR** — live rear-camera feed with device-orientation tracking; the creature
  stays anchored as you move the phone around it. Tap **Recentre** to re-anchor.
- **Tactile & immersive** — hand-drawn frames (9-slice), blob/bubble buttons,
  squish animations, synthesized sound effects, confetti on a win.
- Installable **PWA**, works offline.

## Hand-drawn UI kit

| Asset | Use |
|-------|-----|
| `frame-green` | modal / card / panel borders |
| `frame-dashed` | the build drawer & name field |
| `blob-yellow` | primary buttons |
| `bubble-pink` | secondary buttons, tags, the HUD |

## Run

```bash
cd friedzooki
python3 -m http.server 8000   # open http://localhost:8000
```

Install from the browser prompt, or on iPhone **Share → Add to Home Screen**.
AR needs **HTTPS** + camera/motion permission, so deploy to Netlify/GitHub Pages
for on-device AR (iOS Safari has no WebXR, so AR here is camera-passthrough with
device-orientation tracking — the path that works on iPhone).

## Tech

Three.js (rendering) · Rapier (physics) · vanilla ES modules · localStorage.
Each Zook is a single driven rigid body with active balance + a speed-targeted
muscle drive and animated legs — reliable, controllable racing across any design.
Locomotion tuned and all five trials verified in a headless Rapier harness.

## A note on "Bluetooth multiplayer"

Versus is **local hotseat** (two players, one device) because **Web Bluetooth is
not supported in iOS Safari** — so true phone-to-phone Bluetooth play isn't
possible in an iPhone PWA. The realistic next step for cross-device local play is
**WebRTC over the same Wi-Fi** (with a QR-code handshake); that's a future mode.
