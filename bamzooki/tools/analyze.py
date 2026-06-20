#!/usr/bin/env python3
"""
Analyse an extracted BAMZOOKi / Bonsai install tree.

Reports, for the encrypted .sax/.ssx data files:
  - Shannon entropy (high => encrypted/compressed)
  - block alignment (16 bytes => 128-bit block cipher, i.e. AES/Rijndael)
  - per-file header/IV analysis
and lists plaintext, directly-usable assets (PNG/BMP/fonts).

If you have recovered the AES key (see docs/ROADMAP.md phase 2), pass it with
--key (hex) to attempt a trial decrypt of one file: AES-CBC (prepended IV) then
zlib inflate. Until then the key is unknown and decryption is skipped.

Usage:
    python3 analyze.py /path/to/extracted/app [--key HEX] [--mode cbc|ecb]
"""
import argparse
import collections
import glob
import math
import os
import sys
import zlib


def entropy(data: bytes) -> float:
    if not data:
        return 0.0
    counts = collections.Counter(data)
    n = len(data)
    return -sum((c / n) * math.log2(c / n) for c in counts.values())


def find(root: str, *exts: str):
    out = []
    for ext in exts:
        out += glob.glob(os.path.join(root, "**", f"*{ext}"), recursive=True)
    return sorted(out)


def analyse_encrypted(files):
    if not files:
        print("  (none found)")
        return
    sizes = [os.path.getsize(f) for f in files]
    ents = [entropy(open(f, "rb").read()) for f in files]
    avg_ent = sum(ents) / len(ents)
    print(f"  files            : {len(files)}")
    print(f"  size range       : {min(sizes)} .. {max(sizes)} bytes")
    print(f"  all 16B-aligned  : {all(s % 16 == 0 for s in sizes)}  "
          f"(=> 128-bit block cipher / AES)")
    print(f"  all  8B-aligned  : {all(s % 8 == 0 for s in sizes)}")
    print(f"  avg entropy      : {avg_ent:.3f} bits/byte  "
          f"(plaintext XML ~4-5 => encrypted)")
    # Shared-header test: do any two files share their first 16 bytes?
    heads = [open(f, "rb").read(16) for f in files]
    shared = len(heads) != len(set(heads))
    print(f"  shared 16B head  : {shared}  "
          f"(False => per-file random IV, i.e. CBC with prepended IV)")


def try_decrypt(path: str, key_hex: str, mode: str):
    try:
        from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
    except ImportError:
        print("  ! `cryptography` not installed: pip install cryptography")
        return
    key = bytes.fromhex(key_hex)
    blob = open(path, "rb").read()
    iv, ct = blob[:16], blob[16:]
    if mode == "ecb":
        iv, ct = b"", blob
        algo_mode = modes.ECB()
    else:
        algo_mode = modes.CBC(iv)
    dec = Cipher(algorithms.AES(key), algo_mode).decryptor()
    pt = dec.update(ct) + dec.finalize()
    for label, candidate in (("raw", pt), ("zlib", _maybe_inflate(pt))):
        if candidate and (b"<" in candidate[:64]):
            print(f"  ✓ {mode}/{label}: looks like XML!\n"
                  f"    {candidate[:200]!r}")
            return
    print(f"  ✗ {mode}: no XML recovered with this key "
          f"(wrong key/mode, or IV not prepended). First bytes: {pt[:16].hex(' ')}")


def _maybe_inflate(data: bytes):
    for wbits in (15, -15, 47):
        try:
            return zlib.decompress(data, wbits)
        except Exception:
            continue
    return None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("root", help="path to extracted 'app' directory")
    ap.add_argument("--key", help="AES key in hex (once recovered)")
    ap.add_argument("--mode", default="cbc", choices=["cbc", "ecb"])
    args = ap.parse_args()

    if not os.path.isdir(args.root):
        sys.exit(f"not a directory: {args.root}")

    encrypted = find(args.root, ".sax", ".ssx")
    pngs = find(args.root, ".png")
    bmps = find(args.root, ".bmp")

    print("=== Encrypted data files (.sax / .ssx) ===")
    analyse_encrypted(encrypted)

    print("\n=== Plaintext, directly-usable assets ===")
    print(f"  PNG : {len(pngs)}")
    print(f"  BMP : {len(bmps)}")

    if args.key and encrypted:
        print("\n=== Trial decryption ===")
        try_decrypt(encrypted[0], args.key, args.mode)
    elif encrypted:
        print("\n=== Trial decryption ===")
        print("  key unknown — supply --key HEX once recovered (roadmap phase 2).")


if __name__ == "__main__":
    main()
