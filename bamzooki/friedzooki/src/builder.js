// Build drawer — tactile sliders + colour swatches for shaping a Zook. The 3D
// Zook stays centre-stage behind this drawer (it's never hidden), so you watch
// it change as you tune. Structural edits trigger a rebuild via onChange.
import { sfx } from "./sound.js";

const SWATCHES = ["#46c7ff", "#e98aa4", "#e9c64a", "#7fae7a", "#ff7a59", "#9d6bff", "#4a4540"];

const FIELDS = [
  { path: "legCount", label: "Legs", min: 2, max: 8, step: 2, structural: true },
  { path: "body.w", label: "Width", min: 0.6, max: 2.4, step: 0.1, structural: true },
  { path: "body.h", label: "Height", min: 0.3, max: 1.2, step: 0.05, structural: true },
  { path: "body.l", label: "Length", min: 0.8, max: 3.0, step: 0.1, structural: true },
  { path: "body.mass", label: "Mass", min: 2, max: 16, step: 0.5, structural: true },
  { path: "leg.len", label: "Leg length", min: 0.5, max: 1.8, step: 0.05, structural: true },
  { path: "leg.radius", label: "Leg width", min: 0.08, max: 0.3, step: 0.01, structural: true },
  { path: "gait.freq", label: "Step speed", min: 0.5, max: 4.0, step: 0.1 },
  { path: "gait.amplitude", label: "Stride", min: 0.1, max: 1.4, step: 0.05 },
  { path: "gait.drive", label: "Muscle power", min: 0, max: 24, step: 1 },
  { path: "gait.jump", label: "Jump", min: 0, max: 14, step: 0.5 },
  { path: "gait.steer", label: "Steer bias", min: -3, max: 3, step: 0.2 },
];

const get = (o, p) => p.split(".").reduce((a, k) => a[k], o);
const set = (o, p, v) => { const k = p.split("."); const last = k.pop(); k.reduce((a, x) => a[x], o)[last] = v; };

export function renderControls(container, swatchBox, genome, onChange) {
  // colour swatches
  swatchBox.innerHTML = "";
  for (const c of SWATCHES) {
    const b = document.createElement("button");
    b.style.background = c;
    b.onclick = () => { genome.color = c; sfx.pop(); onChange(true); };
    swatchBox.appendChild(b);
  }
  // sliders
  container.innerHTML = "";
  for (const f of FIELDS) {
    const row = document.createElement("div"); row.className = "slider-row";
    const head = document.createElement("div"); head.className = "slider-head";
    const lab = document.createElement("span"); lab.textContent = f.label;
    const val = document.createElement("span"); val.className = "v";
    const input = document.createElement("input");
    input.type = "range"; input.min = f.min; input.max = f.max; input.step = f.step;
    input.value = get(genome, f.path);
    const show = (v) => (val.textContent = (+v).toFixed(f.step < 1 ? 2 : 0));
    show(input.value);
    let last = performance.now();
    input.oninput = () => {
      const v = parseFloat(input.value);
      set(genome, f.path, v); show(v);
      const now = performance.now(); if (now - last > 70) { sfx.slide(); last = now; }
      onChange(!!f.structural);
    };
    head.append(lab, val); row.append(head, input); container.append(row);
  }
}
