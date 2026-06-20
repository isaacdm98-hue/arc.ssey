# BAMZOOKi → HTML/WebGL Reconstruction

A long-term project to re-create the CBBC game **BAMZOOKi** (Bonsai Engine,
build 158, May 2006) as a browser-native HTML/WebGL application, so it can be
played on modern devices without the original Windows binary.

This is **Option C**: a ground-up reimplementation, not an automated "exe → html"
conversion (no such conversion is technically possible — see
[`docs/FORMAT.md`](docs/FORMAT.md) for why). The original game is a compiled
native Windows/DirectX C++ program; reconstructing it means rebuilding the engine
in JavaScript/WebGL.

## ⚖️ Copyright & scope

The original game art, data, and code are © BBC / the original developers. This
repository contains **only** original reconstruction code, tooling, and
reverse-engineering documentation. **No copyrighted game assets are committed
here.** The extraction tooling runs against *your own* copy of the installer and
writes assets into a git-ignored folder on your machine. Keep your reconstruction
for personal use unless you have the rights to do otherwise.

## What we know so far

The original installer was unpacked and analysed (read-only — the `.exe` is never
executed). Findings:

| Component | Status |
|-----------|--------|
| Engine | "Bonsai", native Win32 + **DirectX** C++ (`Bonsai.exe`, ~6.5 MB, PE32 x86) |
| Crypto | **Crypto++** library; data files are **AES-CBC encrypted** (16-byte aligned, per-file IV) |
| Compression | **zlib** (`inflate`) — plaintext is `XML → deflate → encrypt` |
| XML parser | `expat.dll` — confirms decrypted payloads are XML |
| `.sax` files | Encrypted "agents" (UI widgets, world objects, creatures) — 116 files |
| `.ssx` files | Encrypted scripts/config (physics constants, boot scripts) |
| Textures/UI | **Plaintext PNG (254) and BMP (110)** — directly usable |
| Fonts | In `app/Fonts/` |

See [`docs/FORMAT.md`](docs/FORMAT.md) for the full breakdown and
[`docs/ROADMAP.md`](docs/ROADMAP.md) for the plan.

## Quick start

```bash
# 1. Install innoextract (Debian/Ubuntu: sudo apt-get install innoextract)
# 2. Unpack YOUR installer + sort the plaintext assets into the viewer
./tools/extract_assets.sh /path/to/bamzooki_setup.exe

# 3. Re-run the format analysis on the extracted files (optional)
python3 tools/analyze.py bamzooki/app

# 4. Open the asset viewer (the current reconstruction seed)
cd viewer && python3 -m http.server 8000   # then open http://localhost:8000
```

## Project layout

```
bamzooki/
├── docs/
│   ├── FORMAT.md      # reverse-engineering findings (engine, crypto, file formats)
│   └── ROADMAP.md     # phased plan toward a playable browser version
├── tools/
│   ├── analyze.py         # reproduces the format analysis on extracted files
│   └── extract_assets.sh  # innoextract + organise plaintext assets (-> viewer/assets)
└── viewer/
    ├── index.html     # WebGL asset viewer / engine seed (Three.js)
    └── main.js
```

## Honest status

This is **phase 1**: the asset pipeline and a WebGL viewer that displays the
real, decrypted-by-design plaintext assets. The encrypted `.sax`/`.ssx` game
logic is **not yet decryptable** — recovering the AES key requires static
analysis of `Bonsai.exe` (Ghidra/IDA) to locate the `.sax` loader. That is the
next milestone; until it lands, creature/contest definitions can't be read. See
the roadmap.
