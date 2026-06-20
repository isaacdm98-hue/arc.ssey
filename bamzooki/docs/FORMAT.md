# BAMZOOKi / Bonsai Engine — Reverse-Engineering Notes

All findings below come from **static, read-only** inspection of the original
Inno Setup installer. The `.exe` files were never executed.

## 1. Engine identity

- **Name:** Bonsai Engine, Build 158, dated `Thu May 4 14:38:58 2006` (`app/Build.txt`).
- **Product:** "BAMZOOKi v3.1 (build 115.158)" — three sub-apps share the engine:
  Simulator, Motion Player, Zook Kit (see the `*Splash.png` files).
- **Main binary:** `app/Bonsai.exe` — PE32 GUI executable, Intel 80386 (32-bit x86),
  ~6.5 MB. Built with **Visual C++ 6** (`MSVCP60.DLL` shipped alongside).
- **Graphics:** DirectX (DirectX setup helper `dsetup.dll` is bundled). The game
  is real-time **3D**, with cameras, lighting managers, and inverse-kinematics
  rigs for the creatures.

## 2. Third-party libraries detected (via strings in `Bonsai.exe`)

| Library | Evidence | Use |
|---------|----------|-----|
| **Crypto++** | `...@CryptoPP@@` RTTI names, `InvalidKeyLength`, `InvalidRounds`, `InvalidCiphertext`, RSA/ASN.1/BER classes | Encrypt data files; verify the installer signature (RSA) |
| **zlib** | `inflate 1.1.4 / 1.2.1 Copyright ... Mark Adler` | Compress data files before encryption |
| **expat** | `expat.dll` | Parse the decrypted XML |

## 3. The `.sax` / `.ssx` container format

`.sax` = "agents" (UI widgets, world objects, creatures, governors).
`.ssx` = scripts / configuration (e.g. `PhysicsConstants.ssx`, boot scripts).

Both are the **same encrypted container**. Measured properties (116 files):

- **Entropy ≈ 7.9 bits/byte** across the whole file (plaintext XML would be ~4–5).
  → the payload is compressed and/or encrypted.
- **Every file size is a multiple of 16 bytes** (range 384 B … 46,912 B).
  → a **128-bit block cipher** (AES/Rijndael block size = 16).
- **No shared header or magic** — the first 16 bytes of every file are fully
  random and differ between files.
  → a **per-file random IV prepended to the ciphertext** (the standard
  Crypto++ CBC idiom).
- No `78 9c`/`78 da` zlib magic in the raw file → zlib stream is *inside* the
  encryption, not outside.

### Inferred pipeline

```
load:   read file → split [IV (16B)] [ciphertext] → AES-CBC decrypt → zlib inflate → XML → expat
save:   XML → zlib deflate → AES-CBC encrypt (random IV) → write [IV][ciphertext]
```

### What is still unknown (the blocker)

- **The AES key.** It is embedded in / derived inside `Bonsai.exe`. Recovering it
  needs static disassembly (Ghidra/IDA) to find the `.sax` loader, the key bytes
  (or the SHA-1-based key derivation — `SHA-1` is referenced in the binary), and
  the exact cipher variant (AES-128 vs -256; confirm CBC).
- Whether an IV is truly prepended vs. derived. The "random first 16 bytes +
  16-byte alignment" strongly implies prepended-IV CBC, but disassembly should
  confirm.

Once the key is known, decryption is a few lines of `cryptography` + `zlib` in
Python — see the stub in `tools/analyze.py`.

## 4. Plaintext assets (usable today)

These are **not** encrypted and can be loaded directly in the browser:

- **254 × PNG** — splash screens (512×512 RGBA), UI textures, sprites, help art.
- **110 × BMP** — additional UI/texture bitmaps.
- **Fonts** in `app/Fonts/`.
- Icons (`app/icons/`, `.ico`).

## 5. Directory map of the installed game

| Path | Contents |
|------|----------|
| `app/Bonsai.exe` | the engine |
| `app/Agents/` | encrypted agent definitions (Governor UI, World objects, creatures) |
| `app/Scripts/` | encrypted `.ssx` config & boot scripts (physics, product config) |
| `app/Teams/`, `app/NewTeam/` | encrypted creature/team definitions (`.zook`, components) |
| `app/Contests/`, `app/ContestPacks/` | encrypted contest definitions |
| `app/UI/` | UI agents + plaintext textures |
| `app/Fonts/`, `app/icons/` | fonts and icons |
| `app/Tools/` | helper exes (`VideoConfig.exe`, `PurgeUserData.exe`) |

## 6. Reproducing this analysis

```bash
python3 tools/analyze.py /path/to/extracted/app
```

The script reports entropy, block alignment, IV/header analysis, a plaintext vs.
encrypted manifest, and (once a key is supplied) attempts a trial decryption.
