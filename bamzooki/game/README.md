# BAMZOOKi — WebGL game

An original, browser-native creature-builder racer inspired by the CBBC show
*BAMZOOKi*: build a creature ("Zook") from 3D primitives, tune how it moves, then
race it through the show's events — including in **AR on your real floor**.

This is a clean-room reimplementation. It contains **no assets or code from the
original game** — every creature and arena is built from procedural primitives,
so it's free to share. (The separate `../viewer` project is where the original
personal-copy assets live.)

## The loop

1. **Build & Tune** — adjust legs, body, leg length, mass, step speed, stride,
   muscle power, jump and steer. A live physics preview trots as you tweak.
2. **Save** your Zook to the roster (stored locally in your browser).
3. **Compete** in the five events:
   - **Sprint** — first past the line.
   - **Lap** — a full circuit around the gates.
   - **Hurdles** — sprint while bowling through knock-down bars.
   - **High Jump** — tune your jump for maximum height.
   - **Block Push** — shove the heavy block over the line.
4. **AR mode** — tap **AR** during any run to place the arena on your floor via
   the iPhone camera.

## Running it

```bash
cd game
python3 -m http.server 8000        # then open http://localhost:8000
```

Install as an app from the browser's "Install" prompt (desktop/Android) or, on
iPhone, **Share → Add to Home Screen**. After the first online run it works
offline (service worker caches the app, Three.js and the physics WASM).

> AR needs **HTTPS** + camera permission, so deploy to Netlify/GitHub Pages for
> on-device AR. iOS Safari doesn't support WebXR, so AR here is **camera
> passthrough** (live feed + device orientation), which is the path that works
> on iPhone.

## How it works

- **Rendering:** Three.js. **Physics:** Rapier (rigid bodies, real collisions).
- **Zook locomotion (design note):** each Zook is a single driven rigid body
  with an active-balance controller (keeps it upright) and a speed-targeted
  "muscle" drive, with legs animated over the top. This makes racing reliable
  and controllable across any design, while size/mass/power/jump still decide
  who wins. *Fully emergent leg-by-leg gait physics (where a bad design can't
  walk at all) is a deliberate non-goal here — it's a research-grade tuning
  problem; this favours a fun, robust racer.* The locomotion constants live in
  `TUNE` in `src/zook.js` and were chosen with a headless physics sweep.

## Layout

```
game/
├── index.html, styles.css      shell + UI
├── manifest.webmanifest, sw.js  PWA
├── icons/                       original generated icons
└── src/
    ├── main.js        screen flow, session management
    ├── engine.js      Three.js scene, camera (orbit/follow), AR background
    ├── physics.js     Rapier world wrapper
    ├── zook.js        the creature (body, legs, balance, drive, jump)
    ├── arena.js       ground + obstacles (static & dynamic)
    ├── contests.js    the five events + AI opponents + scoring
    ├── builder.js     the tuning control panel
    ├── storage.js     roster persistence (localStorage)
    └── ar.js          iPhone camera-passthrough AR
```
