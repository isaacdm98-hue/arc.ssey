# Reconstruction Roadmap

A phased plan to turn BAMZOOKi into a browser-native WebGL game. Phases are
ordered so each one produces something usable on its own.

## Phase 1 — Asset pipeline & viewer ✅ (this commit)
- [x] Unpack the installer (innoextract), confirm engine & tech stack.
- [x] Document the `.sax`/`.ssx` container format (AES-CBC + zlib + XML).
- [x] Extraction tool that sorts plaintext PNG/BMP/font assets out of *your* copy.
- [x] WebGL (Three.js) viewer that loads and displays the real plaintext assets.

## Phase 2 — Decrypt the data files 🔒 (next, the key blocker)
The whole of the game's logic lives in the encrypted `.sax`/`.ssx` files.
- [ ] Disassemble `Bonsai.exe` (Ghidra/IDA). Find the function that reads a
      `.sax` file (search xrefs to the file extension / `expat` entry points).
- [ ] Recover the **AES key** (or the SHA-1-based key-derivation) and confirm the
      cipher variant + CBC + prepended-IV layout.
- [ ] Implement `decrypt_sax()` in `tools/` (AES-CBC → zlib inflate → XML).
- [ ] Dump all 116 agents/scripts to readable XML; document the XML schema.

## Phase 3 — Data model
- [ ] Parse the agent XML into typed structures (creatures, components, joints,
      IK targets, behaviours, contests, physics constants).
- [ ] Recreate the **Zook** model: limbs/components, joints, motors, motion data.
- [ ] Load real teams/contests from `app/Teams`, `app/Contests`.

## Phase 4 — Engine (WebGL + physics)
- [ ] Three.js scene: arena, lighting, cameras (mirror the "Governor" agents).
- [ ] Rigid-body physics (e.g. Rapier/ammo.js) for creature bodies + joints.
- [ ] **Inverse-kinematics** solver to drive limbs (the Builder used IK rigs).
- [ ] Motion playback from the creatures' motion data.

## Phase 5 — Gameplay
- [ ] Builder UI (assemble a Zook from components).
- [ ] Contest runner (race/contest rules from the contest definitions).
- [ ] Save/load creatures locally (browser storage; re-encrypt only if compatibility
      with the original is needed — otherwise store plain JSON).

## Notes
- Keep the original engine reference (`Bonsai.exe`) only for analysis; never ship it.
- Prefer plain JSON for the reconstructed data model; the original's encryption
  was DRM/obfuscation, not something the browser port needs to reproduce.
