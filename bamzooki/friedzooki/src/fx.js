// Lightweight DOM confetti for wins — paper-scrap squares in the FriedZooki
// palette. No libraries.
const COLORS = ["#f2cd49", "#e98aa4", "#7fae7a", "#8fb0c9", "#ff7a59"];

export function confetti(n = 90) {
  const layer = document.createElement("div");
  layer.className = "confetti-layer";
  document.body.appendChild(layer);
  for (let i = 0; i < n; i++) {
    const s = document.createElement("i");
    const size = 7 + Math.random() * 9;
    s.style.cssText =
      `left:${Math.random() * 100}vw;width:${size}px;height:${size * 0.6}px;` +
      `background:${COLORS[(Math.random() * COLORS.length) | 0]};` +
      `--rot:${(Math.random() * 720 - 360) | 0}deg;` +
      `--dx:${(Math.random() * 200 - 100) | 0}px;` +
      `animation-delay:${(Math.random() * 0.3).toFixed(2)}s;` +
      `animation-duration:${(1.6 + Math.random() * 1.2).toFixed(2)}s;`;
    layer.appendChild(s);
  }
  setTimeout(() => layer.remove(), 3200);
}
