#!/usr/bin/env bash
#
# Unpack a BAMZOOKi (Bonsai engine) Inno Setup installer and copy the plaintext,
# directly-usable assets (PNG/BMP) into the viewer so the WebGL viewer can load
# them. Operates on YOUR OWN copy of the installer.
#
# The extracted/ and viewer/assets/ folders are git-ignored: no copyrighted game
# assets are committed to the repository.
#
# Usage:  ./tools/extract_assets.sh /path/to/bamzooki_setup.exe
#
set -euo pipefail

HERE="$(cd "$(dirname "$0")/.." && pwd)"          # bamzooki/
INSTALLER="${1:-}"
OUT="$HERE/extracted"
ASSETS="$HERE/viewer/assets"

if [[ -z "$INSTALLER" || ! -f "$INSTALLER" ]]; then
  echo "usage: $0 /path/to/bamzooki_setup.exe" >&2
  exit 1
fi
if ! command -v innoextract >/dev/null; then
  echo "innoextract not found. Install it, e.g.:" >&2
  echo "  Debian/Ubuntu: sudo apt-get install innoextract" >&2
  echo "  macOS (brew) : brew install innoextract" >&2
  exit 1
fi

echo ">> Unpacking installer (read-only; the .exe is never executed)…"
rm -rf "$OUT"
mkdir -p "$OUT"
innoextract -s -d "$OUT" "$INSTALLER"

APP="$OUT/app"
[[ -d "$APP" ]] || APP="$OUT"

echo ">> Copying plaintext PNG/BMP assets into viewer/assets/ …"
rm -rf "$ASSETS"
mkdir -p "$ASSETS"
# Preserve the relative directory structure under app/.
( cd "$APP" && find . \( -iname '*.png' -o -iname '*.bmp' \) -print0 ) \
  | while IFS= read -r -d '' f; do
      dest="$ASSETS/${f#./}"
      mkdir -p "$(dirname "$dest")"
      cp "$APP/${f#./}" "$dest"
    done

echo ">> Writing asset manifest (viewer/assets/manifest.json) …"
python3 - "$ASSETS" <<'PY'
import json, os, sys
root = sys.argv[1]
items = []
for dirpath, _, files in os.walk(root):
    for name in files:
        if name.lower().endswith((".png", ".bmp")):
            rel = os.path.relpath(os.path.join(dirpath, name), root)
            items.append(rel.replace(os.sep, "/"))
items.sort()
with open(os.path.join(root, "manifest.json"), "w") as fh:
    json.dump({"assets": items}, fh, indent=2)
print(f"   {len(items)} assets indexed")
PY

echo ">> Done. Start the viewer:"
echo "     cd '$HERE/viewer' && python3 -m http.server 8000"
echo "   then open http://localhost:8000"
