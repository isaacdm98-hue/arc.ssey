#!/usr/bin/env python3
"""
Generate original PWA icons for the BAMZOOKi reconstruction (no external libs,
no copyrighted material). Draws a stylised creature on a dark arena disc in the
viewer's cyan palette, and writes maskable PNG icons.

Usage:  python3 tools/make_icons.py
Writes: viewer/icons/icon-192.png, icon-512.png, icon-maskable-512.png
"""
import os
import struct
import zlib

OUT = os.path.join(os.path.dirname(__file__), "..", "viewer", "icons")

BG = (11, 14, 20)        # --bg
PANEL = (32, 48, 68)     # arena
ACC = (70, 199, 255)     # --acc cyan
INK = (230, 237, 243)


def blend(dst, src, a):
    return tuple(int(dst[i] * (1 - a) + src[i] * a) for i in range(3))


class Canvas:
    def __init__(self, size, bg):
        self.s = size
        self.px = [list(bg) for _ in range(size * size)]

    def _aa(self, x, y, color, cov):
        if 0 <= x < self.s and 0 <= y < self.s and cov > 0:
            i = y * self.s + x
            self.px[i] = list(blend(self.px[i], color, min(1.0, cov)))

    def disc(self, cx, cy, r, color):
        for y in range(int(cy - r - 1), int(cy + r + 2)):
            for x in range(int(cx - r - 1), int(cx + r + 2)):
                d = ((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2) ** 0.5
                self._aa(x, y, color, max(0.0, min(1.0, r - d + 0.5)))

    def rrect(self, x0, y0, x1, y1, rad, color):
        for y in range(int(y0), int(y1)):
            for x in range(int(x0), int(x1)):
                dx = max(x0 + rad - x, 0, x - (x1 - rad))
                dy = max(y0 + rad - y, 0, y - (y1 - rad))
                d = (dx * dx + dy * dy) ** 0.5
                self._aa(x, y, color, max(0.0, min(1.0, rad - d + 0.5)) if (dx or dy) else 1.0)

    def write(self, path):
        raw = bytearray()
        for y in range(self.s):
            raw.append(0)
            for x in range(self.s):
                raw += bytes(self.px[y * self.s + x])
        comp = zlib.compress(bytes(raw), 9)

        def chunk(tag, data):
            return (struct.pack(">I", len(data)) + tag + data +
                    struct.pack(">I", zlib.crc32(tag + data) & 0xffffffff))

        ihdr = struct.pack(">IIBBBBB", self.s, self.s, 8, 2, 0, 0, 0)
        with open(path, "wb") as f:
            f.write(b"\x89PNG\r\n\x1a\n")
            f.write(chunk(b"IHDR", ihdr))
            f.write(chunk(b"IDAT", comp))
            f.write(chunk(b"IEND", b""))


def draw(size, maskable=False):
    c = Canvas(size, BG)
    u = size / 100.0           # 0..100 design units
    pad = 14 if maskable else 6   # maskable keeps art inside the safe zone
    cx, cy = 50 * u, 54 * u
    # arena disc
    c.disc(cx, cy, (44 - pad * 0.4) * u, PANEL)
    # creature: body + four legs (mirrors the viewer placeholder Zook)
    bw, bh = 30 * u, 16 * u
    c.rrect(cx - bw / 2, cy - bh / 2 - 6 * u, cx + bw / 2, cy + bh / 2 - 6 * u, 5 * u, ACC)
    leg_w, leg_h = 6 * u, 18 * u
    for lx in (-12 * u, -3 * u, 6 * u, 15 * u):
        x = cx + lx
        c.rrect(x, cy - 2 * u, x + leg_w, cy - 2 * u + leg_h, 3 * u, ACC)
    # eye dot
    c.disc(cx + 10 * u, cy - 9 * u, 2.6 * u, INK)
    return c


def main():
    os.makedirs(OUT, exist_ok=True)
    draw(192).write(os.path.join(OUT, "icon-192.png"))
    draw(512).write(os.path.join(OUT, "icon-512.png"))
    draw(512, maskable=True).write(os.path.join(OUT, "icon-maskable-512.png"))
    # Apple touch icon: iOS rounds the corners itself, so use a non-maskable,
    # opaque 180x180 with the art comfortably inside.
    draw(180).write(os.path.join(OUT, "apple-touch-icon.png"))
    print("wrote icons to", os.path.abspath(OUT))


if __name__ == "__main__":
    main()
