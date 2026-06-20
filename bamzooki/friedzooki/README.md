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
- **Online** — real cross-device multiplayer over **WebRTC**, serverless: connect
  two phones by exchanging an invite/reply code (copy-paste or QR). The host
  simulates the race and streams it (~20 Hz, ~370 bytes/frame); both watch the
  same head-to-head.
- **Free Roam** — drive your Zook yourself with an on-screen **joystick** + JUMP,
  among scattered props. A proper toy.
- **AR** — live rear-camera feed with device-orientation tracking; the creature
  stays anchored as you move the phone around it. Tap **Recentre** to re-anchor.
  Works in solo, Versus and Online — point two phones at the same desk for a
  shared-table feel (see the note below).
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

## Multiplayer & AR — what's possible on iPhone

- **Bluetooth** isn't an option: Web Bluetooth is unsupported in iOS Safari. So
  cross-device play uses **WebRTC** instead (the `Online` mode) — peer-to-peer,
  no server. Connect by exchanging one invite code + one reply code. On the same
  Wi-Fi it connects with local ICE candidates; a public STUN server helps across
  networks. It's **host-authoritative**: the host runs the physics and streams
  transforms, so there's nothing to desync.
- **Shared AR plane**: iOS Safari has no WebXR/cloud-anchors, so a *true* shared
  physical anchor between two phones isn't possible in a PWA. What works: both
  players run the same synced race and each anchors it on their own desk via
  device-orientation + **Recentre** — point both phones at the same surface for a
  shared-table effect.

### Tested vs needs two real devices
The physics, the five trials, Versus, and the **network serialize/replay sync**
are verified in a headless Rapier harness. The live **WebRTC handshake, camera AR
and the joystick feel** can only be confirmed on real phones — they're built to
spec and syntax-clean, but I couldn't pair two devices or open a camera in the
build sandbox.
