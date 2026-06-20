# FriedZooki — AAA Development Plan

A spiritual successor to BAMZOOKi: design a creature, tune how it moves, race it
through trials — solo, head-to-head, or in AR on your desk. Hand-drawn, tactile,
mystical. This is the long-form roadmap; the shipping build implements Phase 0–2.

## Pillars
1. **Make a creature that's *yours*.** Deep but friendly building & tuning.
2. **Watch it come alive.** Believable, charming physical motion.
3. **Mixed reality is the magic.** AR isn't a toggle — it's the headline.
4. **Cosy, hand-drawn, mystical.** Paper, doodles, gibberish voice, soft tones.
5. **Always loads, always smooth.** Reliability is a feature.

---

## Phase 0 — Rock-solid foundation ✅ (shipping)
- Self-contained build: three.js + Rapier physics **vendored**, whole app **bundled
  into one classic script** (no ES modules / import map / CDN), **no service worker**
  cache trap. Boot surfaces any error instead of hanging; 20s physics watchdog.
- Hand-drawn toon look; simple flat background tones.
- Gibberish voice + mystical captions (pure Web Audio, no network).

## Phase 1 — The five trials ✅ (shipping)
Sprint · Hurdles · Lap · High Jump · Block Push — countdown, AI rivals, placings,
and per-Zook **Passport** records.

## Phase 2 — Modes ✅ (shipping)
- **Versus** (local hotseat), **Online** (serverless WebRTC), **Free Roam** (joystick).

---

## Phase 3 — Deep Creature Workshop (next)
- **Part-based builder**: drag/snap body blocks, limbs, joints, heads, tails;
  scale & rotate parts; mirror mode; symmetry.
- **IK behaviours**: place targets the way the show did; per-limb gait phase,
  reach, and "muscle" strength.
- **Skins**: hand-drawn texture stamps, patterns, eyes, googly bits; colour palettes.
- **Stats readout**: weight, balance, top speed estimate, jump — live as you build.
- **Zook Passport v2**: portrait, medals, history graph, shareable code.

## Phase 4 — More gameplay ("all of it, and more")
- **New events**: Football (score in a goal), Sumo (push rival out of the ring),
  Assault Course (obstacles + ramps + gaps), Mountain Climb (incline), Tug of War,
  Strongest Zook (lift/drag), Maze (navigation).
- **Championship / career**: a ladder of cups; earn parts & skins; rival roster
  with personalities; difficulty tiers.
- **Daily Challenge**: one seeded trial a day, local leaderboard.
- **Replay theatre** (the show's SuperCam): cinematic multi-angle replays, slow-mo,
  photo mode, export a clip.

## Phase 5 — AR as the headline
- **Tabletop mode**: tap to place the whole arena on a real surface, scaled to desk
  size; walk around it.
- **Shared local AR**: two phones anchor to the same printed/marker image so both
  see the race in the *same* physical spot (works around iOS's lack of WebXR).
- **Life-size mode**: drop a single Zook at real scale and let it wander your floor.
- **AR photo/sticker capture.**

## Phase 6 — Feel & polish
- **Audio**: layered gibberish voices per creature, adaptive musical stings, crowd,
  surface-aware footsteps; a cosy banjo-ish soundtrack.
- **Juice**: squash/stretch, dust puffs, finish-line tape, confetti, screen-shake.
- **Accessibility**: captions (done), colour-blind palettes, reduced-motion, haptics.
- **Onboarding**: a guided first creature with the narrator.

## Phase 7 — Platform & community
- **Cloud sync & accounts** (optional), **global leaderboards**, **Zook sharing**
  via codes/QR and a gallery (the show had monthly galleries).
- **Online matchmaking** (lightweight signalling server) on top of the current
  serverless WebRTC.
- **Mod-friendly part packs.**

---

## Tech roadmap
- **Rendering**: three.js, toon + procedural hand-drawn textures; instancing for
  crowds; post FX (soft outline, paper grain) behind a quality toggle.
- **Physics**: Rapier; move creatures from "single driven body" toward
  **articulated multi-body** rigs with motorised joints as the builder deepens,
  keeping the reliable driver as a fallback.
- **Architecture**: keep the one-bundle output for delivery; add a dev module
  build; data-driven trials & parts (JSON) for fast content authoring.
- **Netcode**: host-authoritative state stream (done); add input prediction only
  if interactive control is added.
- **AR**: camera passthrough + device orientation now; image-marker anchoring for
  shared/stable placement next.

## Definition of done (per feature)
Loads on a cold iPhone Safari in < 3s · no uncaught errors · works offline-capable
once SW returns · 60fps on a mid iPhone · narrator + captions for key moments.
