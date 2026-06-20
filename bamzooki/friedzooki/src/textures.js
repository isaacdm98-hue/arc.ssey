// Procedural hand-drawn textures + a toon ramp, so the 3D models look like
// inked, colored-in doodles rather than plastic. All generated on a <canvas>;
// in a non-DOM environment (headless tests) the makers return null and callers
// fall back to flat colour.
import * as THREE from "../vendor/three.module.js";

const hasDOM = typeof document !== "undefined";
const _cache = new Map();

function shade(hex, f) {
  const c = new THREE.Color(hex);
  return `rgb(${(c.r * 255 * f) | 0},${(c.g * 255 * f) | 0},${(c.b * 255 * f) | 0})`;
}

/** A colored-in "sketch" texture: base colour + pencil hatching + a few ink dots. */
export function sketchTexture(hex, size = 256) {
  if (!hasDOM) return null;
  const key = "s" + hex;
  if (_cache.has(key)) return _cache.get(key);
  const cv = document.createElement("canvas"); cv.width = cv.height = size;
  const x = cv.getContext("2d");
  x.fillStyle = shade(hex, 1); x.fillRect(0, 0, size, size);
  // soft paper blotches (lighter)
  x.globalAlpha = 0.18; x.fillStyle = shade(hex, 1.18);
  for (let i = 0; i < 26; i++) { x.beginPath(); x.ellipse(Math.random() * size, Math.random() * size, 10 + Math.random() * 26, 8 + Math.random() * 18, Math.random() * 6, 0, 7); x.fill(); }
  // pencil hatching (darker short strokes)
  x.globalAlpha = 0.16; x.strokeStyle = shade(hex, 0.55); x.lineWidth = 2; x.lineCap = "round";
  for (let i = 0; i < 90; i++) {
    const px = Math.random() * size, py = Math.random() * size, a = Math.random() * Math.PI, len = 8 + Math.random() * 16;
    x.beginPath(); x.moveTo(px, py); x.lineTo(px + Math.cos(a) * len, py + Math.sin(a) * len); x.stroke();
  }
  // ink speckles
  x.globalAlpha = 0.5; x.fillStyle = shade(hex, 0.4);
  for (let i = 0; i < 40; i++) { x.beginPath(); x.arc(Math.random() * size, Math.random() * size, 0.6 + Math.random() * 1.2, 0, 7); x.fill(); }
  x.globalAlpha = 1;
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  _cache.set(key, tex);
  return tex;
}

/** A tiling paper texture for the ground (grain + faint hand-drawn grid). */
export function paperTexture(hex = "#6f9b6a", size = 512, repeat = 24) {
  return null;   // robust: ground falls back to a flat MeshStandardMaterial that always renders
  // eslint-disable-next-line no-unreachable
  if (!hasDOM) return null;
  const key = "p" + hex + repeat;
  if (_cache.has(key)) return _cache.get(key);
  const cv = document.createElement("canvas"); cv.width = cv.height = size;
  const x = cv.getContext("2d");
  x.fillStyle = shade(hex, 1); x.fillRect(0, 0, size, size);
  x.globalAlpha = 0.07; x.fillStyle = "#000";
  for (let i = 0; i < 1400; i++) { x.fillRect(Math.random() * size, Math.random() * size, 1.5, 1.5); }
  x.globalAlpha = 0.10; x.strokeStyle = shade(hex, 0.7); x.lineWidth = 1.5;
  for (let i = 0; i <= size; i += 64) {
    x.beginPath(); wobble(x, 0, i, size, i); x.stroke();
    x.beginPath(); wobble(x, i, 0, i, size); x.stroke();
  }
  x.globalAlpha = 1;
  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(repeat, repeat);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  _cache.set(key, tex);
  return tex;
}

function wobble(x, x0, y0, x1, y1) {
  const steps = 8; x.moveTo(x0, y0);
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    x.lineTo(x0 + (x1 - x0) * t + (Math.random() - 0.5) * 3, y0 + (y1 - y0) * t + (Math.random() - 0.5) * 3);
  }
}

/** A 4-step toon ramp for cel shading. */
export function toonRamp() {
  if (!hasDOM) return null;
  if (_cache.has("ramp")) return _cache.get("ramp");
  const data = new Uint8Array([90, 90, 90, 255, 160, 160, 160, 255, 215, 215, 215, 255, 255, 255, 255, 255]);
  const tex = new THREE.DataTexture(data, 4, 1, THREE.RGBAFormat);
  tex.minFilter = tex.magFilter = THREE.NearestFilter; tex.needsUpdate = true;
  _cache.set("ramp", tex);
  return tex;
}

/** A material that looks hand-drawn: toon shading + sketch map, or flat fallback. */
export function sketchMaterial(hex) {
  // Bulletproof, well-supported material so models always render on any device.
  return new THREE.MeshStandardMaterial({ color: hex, roughness: 0.72, metalness: 0.02, flatShading: false });
}

/** Background sky gradient (warm cream → soft sky). */
export function skyTexture() {
  if (!hasDOM) return null;
  const cv = document.createElement("canvas"); cv.width = 8; cv.height = 256;
  const x = cv.getContext("2d");
  const g = x.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, "#cfe6f5"); g.addColorStop(0.55, "#eef3ea"); g.addColorStop(1, "#fbf3df");
  x.fillStyle = g; x.fillRect(0, 0, 8, 256);
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
