// FriedZooki — from-scratch engine app (no three.js, no Rapier). Build a Zook,
// watch it walk, race it through trials. Tiny, dependency-free, instant-loading.
import { Renderer } from "./renderer3.js";
import { Zook3, defaultGenome } from "./zook3.js";
import { Body, pushBody, shove } from "./sim.js";
import { V } from "./math3.js";
import { sfx, toggleMute, primeAudio } from "./sound.js";
import { confetti } from "./fx.js";
import { narrator } from "./narrator.js";

const $ = (s) => document.querySelector(s);
const setStep = (m) => { const e = $("#boot-step"); if (e) e.textContent = m; };

let R, ground, player, genome = defaultGenome();
let mode = "idle", trial = null;
let last = performance.now();

/* ---------------- boot ---------------- */
function boot() {
  setStep("starting renderer…");
  R = new Renderer($("#scene"));
  ground = R.add("plane", "#6f9b6a");
  setStep("ready!");
  $("#loading").classList.remove("show");
  showScreen("title");
  requestAnimationFrame(loop);
}
try { boot(); } catch (e) {
  const el = $("#boot-err"); if (el) { el.style.display = "block"; el.textContent = "⚠ " + (e.message || e); el.onclick = () => location.reload(); }
}

/* ---------------- loop + camera ---------------- */
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  try {
    if (mode === "build" || mode === "test") { if (player) player.update(dt); }
    else if (mode === "trial" && trial) trial.step(dt);
  } catch (e) { console.error(e); }

  // camera
  let eye = [7, 6, 11], tgt = [0, 1, 0];
  if (player) {
    const p = player.position();
    if (mode === "build") { const a = now / 2400; eye = [p[0] + Math.sin(a) * 7, p[1] + 3.5, p[2] + Math.cos(a) * 7]; tgt = [p[0], p[1], p[2]]; }
    else { eye = [p[0], p[1] + 4.5, p[2] - 9]; tgt = [p[0], p[1] + 0.4, p[2]]; }
  }
  if (R) R.render(eye, tgt, false);
}

/* ---------------- screens ---------------- */
function showScreen(name) {
  for (const el of document.querySelectorAll(".screen")) el.classList.remove("show");
  const playing = name === "play";
  $("#play-ui").classList.toggle("hidden", !playing);
  const el = $("#screen-" + name); if (el) el.classList.add("show");
  if (name === "trials") renderTrials();
  if (name !== "play" && name !== "build") { mode = "idle"; }
}

/* ---------------- build ---------------- */
const FIELDS = [
  ["legCount", "Legs", 2, 8, 2], ["body.w", "Width", 0.6, 2.4, 0.1], ["body.l", "Length", 0.8, 3, 0.1],
  ["body.h", "Height", 0.3, 1.2, 0.05], ["leg.len", "Leg length", 0.5, 1.8, 0.05],
  ["body.mass", "Mass", 2, 16, 0.5], ["gait.freq", "Step speed", 0.5, 4, 0.1],
  ["gait.drive", "Muscle power", 4, 24, 1], ["gait.jump", "Jump", 0, 14, 0.5], ["gait.steer", "Steer", -3, 3, 0.2],
];
const SWATCH = ["#46c7ff", "#e98aa4", "#f0c64a", "#7fae7a", "#ff7a59", "#9d6bff", "#3f3a33"];
const get = (o, p) => p.split(".").reduce((a, k) => a[k], o);
const set = (o, p, v) => { const k = p.split("."); const l = k.pop(); k.reduce((a, x) => a[x], o)[l] = v; };

function openBuild() {
  showScreen("build"); mode = "build";
  spawnPlayer();
  $("#build-name").value = genome.name;
  const sw = $("#build-swatches"); sw.innerHTML = "";
  for (const c of SWATCH) { const b = document.createElement("button"); b.style.background = c; b.onclick = () => { genome.color = c; sfx.pop(); spawnPlayer(); }; sw.appendChild(b); }
  const box = $("#build-controls"); box.innerHTML = "";
  for (const [path, label, min, max, step] of FIELDS) {
    const row = document.createElement("div"); row.className = "slider-row";
    const head = document.createElement("div"); head.className = "slider-head";
    const val = document.createElement("span"); val.className = "v";
    const inp = document.createElement("input"); inp.type = "range"; inp.min = min; inp.max = max; inp.step = step; inp.value = get(genome, path);
    val.textContent = (+inp.value).toFixed(step < 1 ? 2 : 0);
    inp.oninput = () => { const v = parseFloat(inp.value); set(genome, path, v); val.textContent = v.toFixed(step < 1 ? 2 : 0); sfx.slide(); rebuildOrTune(path); updateStats(); };
    head.append(Object.assign(document.createElement("span"), { textContent: label }), val);
    row.append(head, inp); box.append(row);
  }
  updateStats();
  maybeCoach();
}
function spawnPlayer() { if (player) player.dispose(); player = new Zook3(genome, R, { x: 0, z: 0 }); }
function rebuildOrTune(path) {
  // structural fields rebuild the model; gait just retunes the existing sim
  if (path.startsWith("gait")) { player.sim.set(genome); }
  else spawnPlayer();
}
function updateStats() {
  $("#build-stats").innerHTML =
    `<span>⚖️ ${genome.body.mass.toFixed(1)}</span><span>🦵 ${genome.legCount}</span>` +
    `<span>💪 ${genome.gait.drive}</span><span>🏃 ${(genome.gait.drive * 0.34).toFixed(1)} m/s</span><span>⬆️ ${genome.gait.jump}</span>`;
}
$("#build-name").oninput = (e) => { genome.name = e.target.value || "Zook"; };
$("#build-new").onclick = () => { sfx.pop(); genome = defaultGenome("Zook"); openBuild(); };
$("#build-test").onclick = () => { sfx.whoosh(); showScreen("play"); mode = "test"; player.sim.reset(0, 0, 0); $("#hud").textContent = "Test run — watch it scamper!"; narrator.say("Here it goes — watch your Zook run!"); };

/* ---------------- coach (onboarding) ---------------- */
const COACH = [
  "Welcome to FriedZooki! Let's build your first creature — a Zook.",
  "This is your Zook, here on stage. It feels every change at once.",
  "Use BODY and LEGS to shape it. More legs make it steadier.",
  "MUSCLE POWER and STEP SPEED set how fast it scampers.",
  "When it looks right, tap TEST to watch it run — then hit the Trials!",
];
let coachI = 0, coachSeen = false;
function maybeCoach() {
  if (coachSeen) return; coachSeen = true;
  try { if (localStorage.getItem("fz.coached") === "1") return; } catch (_) {}
  coachI = 0; $("#coach").classList.remove("hidden"); coachShow();
}
function coachShow() { const t = COACH[coachI]; $("#coach-text").textContent = t; narrator.say(t); }
$("#coach-next").onclick = () => { sfx.tap(); if (++coachI >= COACH.length) { $("#coach").classList.add("hidden"); try { localStorage.setItem("fz.coached", "1"); } catch (_) {} } else coachShow(); };
$("#coach-skip").onclick = () => { sfx.back(); $("#coach").classList.add("hidden"); try { localStorage.setItem("fz.coached", "1"); } catch (_) {} };

/* ---------------- trials ---------------- */
const TRIALS = {
  sprint: { label: "Sprint", icon: "🏃", desc: "First past the line." },
  hurdles: { label: "Hurdles", icon: "🚧", desc: "Bowl through the bars." },
  highjump: { label: "High Jump", icon: "⬆️", desc: "Tune your spring." },
  football: { label: "Football", icon: "⚽", desc: "Dribble into the goal." },
  blockpush: { label: "Block Push", icon: "📦", desc: "Shove the block home." },
  sumo: { label: "Sumo", icon: "🤼", desc: "Shove your rival out." },
};
function renderTrials() {
  const box = $("#trials-list"); box.innerHTML = ""; $("#trials-zook").textContent = "Competing: " + genome.name;
  for (const [k, t] of Object.entries(TRIALS)) {
    const card = document.createElement("div"); card.className = "trial panel";
    card.append(Object.assign(document.createElement("span"), { className: "ic", textContent: t.icon }));
    card.append(Object.assign(document.createElement("span"), { className: "cname", textContent: t.label }));
    const go = document.createElement("button"); go.className = "btn-blob"; go.textContent = "Enter";
    go.onclick = () => { sfx.whoosh(); startTrial(k); };
    card.append(go);
    const d = document.createElement("div"); d.className = "tag small"; d.textContent = t.desc; d.style.gridColumn = "2"; card.append(d);
    box.append(card);
  }
}
function clearArena() { if (player) { player.dispose(); player = null; } if (trial) { trial.dispose(); trial = null; } }
function startTrial(key) {
  clearArena(); showScreen("play"); $("#result").classList.remove("show");
  trial = new Trial(key);
  mode = "idle"; runCountdown(() => { mode = "trial"; });
}
function runCountdown(then) {
  const el = $("#countdown"); el.classList.remove("hidden"); const seq = ["3", "2", "1", "GO!"]; let i = 0;
  const tick = () => { el.innerHTML = `<b>${seq[i]}</b>`; i < 3 ? sfx.beep() : sfx.go(); i++;
    if (i <= seq.length) setTimeout(tick, i === seq.length ? 450 : 650); else { el.classList.add("hidden"); then(); } };
  tick();
}

class Trial {
  constructor(key) {
    this.key = key; this.t = 0; this.done = false; this.extra = []; this.bodies = [];
    const T = TRIALS[key]; narrator.say(`${T.label}! ${T.desc}`);
    player = new Zook3(genome, R, { x: 0, z: 0 });
    this[key]();
  }
  _box(x, y, z, hx, hy, hz, color) { const n = R.add("box", color, [hx, hy, hz]); n.pos = [x, y, z]; this.extra.push(n); return n; }
  _line(z, color) { const n = R.add("box", color, [7, 0.03, 0.25]); n.pos = [0, 0.03, z]; this.extra.push(n); }
  _ai(n) { for (let i = 0; i < n; i++) { const g = structuredClone(genome); g.gait.freq *= 0.85 + Math.random() * 0.3; g.gait.drive *= 0.8 + Math.random() * 0.35; this.rivals = this.rivals || []; this.rivals.push(new Zook3(g, R, { x: (i + 1) * 3 - 1.5, z: 0, tint: ["#ff7a59", "#9d6bff", "#3ddc97"][i % 3] })); } }

  sprint() { this.finishZ = 26; this.limit = 30; this._line(this.finishZ, "#46c7ff"); this._ai(3); }
  hurdles() { this.finishZ = 26; this.limit = 30; this._line(this.finishZ, "#46c7ff"); this._ai(3);
    for (let i = 1; i <= 4; i++) { const b = new Body("bar", [0, 0.35, i * 5], [3.2, 0.35, 0.08], 0.5); this.bodies.push(b); b.node = R.add("box", "#ff5470", b.half); this.extra.push(b.node); } }
  highjump() { this.limit = 16; this.maxH = 0; const g = structuredClone(genome); g.gait.jump = Math.max(g.gait.jump, 7); player.dispose(); player = new Zook3(g, R, { x: 0, z: 0 }); }
  football() { this.limit = 40; this.goalZ = 16; this.goalW = 3; this._line(this.goalZ, "#3ddc97");
    this._box(-3, 0.9, this.goalZ, 0.12, 0.9, 0.12, "#46c7ff"); this._box(3, 0.9, this.goalZ, 0.12, 0.9, 0.12, "#46c7ff");
    this.ball = new Body("ball", [0, 0.6, 6], [0.6, 0.6, 0.6], 1); this.bodies.push(this.ball); this.ball.node = R.add("sphere", "#f2f2f2", [0.6, 0.6, 0.6]); this.extra.push(this.ball.node); }
  blockpush() { this.limit = 30; this.goalZ = 8; this._line(this.goalZ, "#3ddc97");
    this.block = new Body("block", [0, 0.6, 3], [0.6, 0.6, 0.6], 3); this.bodies.push(this.block); this.block.node = R.add("box", "#ffb454", [0.6, 0.6, 0.6]); this.extra.push(this.block.node); }
  sumo() { this.limit = 20; this.Rr = 4; const ring = R.add("box", "#ff7a59", [this.Rr, 0.02, this.Rr]); ring.pos = [0, 0.02, 0]; this.extra.push(ring);
    player.sim.reset(0, -2.4, 0); const g = structuredClone(genome); g.gait.drive *= 0.85; this.rival = new Zook3(g, R, { x: 0, z: 2.4, yaw: Math.PI, tint: "#ff7a59" }); }

  step(dt) {
    if (this.done) return; this.t += dt;
    // AI seek + creature updates
    const race = ["sprint", "hurdles"].includes(this.key);
    if (this.rivals) for (const r of this.rivals) { r.setGoal(r.position()[0], 1000); r.update(dt); }
    if (this.key === "football") { const b = this.ball.pos; let dx = b[0], dz = b[2] - this.goalZ; const m = Math.hypot(dx, dz) || 1; player.setGoal(b[0] + dx / m * 1.3, b[2] + dz / m * 1.3); }
    if (this.key === "sumo") { player.setGoal(this.rival.position()[0], this.rival.position()[2]); this.rival.setGoal(player.position()[0], player.position()[2]); this.rival.update(dt); }
    player.update(dt);
    // body physics + interactions
    for (const b of this.bodies) {
      if (b.kind === "bar" || b.kind === "ball" || b.kind === "block") pushBody(player, b, dt);
      b.step(dt); if (b.node) { b.node.pos = b.pos.slice(); }
    }
    if (this.key === "sumo") shove(player.sim, this.rival.sim, dt);
    this._judge();
    if (!this.done && this.t > this.limit) this.finish(this._timeout());
    $("#hud").textContent = this.hud();
  }
  _judge() {
    const p = player.position();
    if (["sprint", "hurdles"].includes(this.key)) {
      const all = [player, ...(this.rivals || [])].filter((z) => z.position()[2] >= this.finishZ).sort((a, b) => b.position()[2] - a.position()[2]);
      if (p[2] >= this.finishZ) { const place = [player, ...(this.rivals || [])].sort((a, b) => b.position()[2] - a.position()[2]).indexOf(player) + 1; this.finish({ win: place === 1, text: place === 1 ? "1st place — you win!" : `${place}th place`, metric: this.t, unit: "s" }); }
    } else if (this.key === "highjump") { this.maxH = Math.max(this.maxH, p[1]); }
    else if (this.key === "football") { const b = this.ball.pos; if (b[2] >= this.goalZ && Math.abs(b[0]) <= this.goalW) this.finish({ win: true, text: `GOAL in ${this.t.toFixed(1)}s!`, metric: this.t, unit: "s" }); }
    else if (this.key === "blockpush") { if (this.block.pos[2] >= this.goalZ) this.finish({ win: true, text: `Pushed home in ${this.t.toFixed(1)}s!`, metric: this.t, unit: "s" }); }
    else if (this.key === "sumo") { const rr = Math.hypot(this.rival.position()[0], this.rival.position()[2]); const pr = Math.hypot(p[0], p[2]); if (rr > this.Rr) this.finish({ win: true, text: `Out of the ring in ${this.t.toFixed(1)}s!`, metric: this.t, unit: "s" }); else if (pr > this.Rr) this.finish({ win: false, text: "You were shoved out!" }); }
  }
  _timeout() {
    if (this.key === "highjump") { const s = Math.max(0, this.maxH - 0.8); return { win: s > 1.2, text: `Best height ${s.toFixed(2)}m`, metric: s, unit: "m" }; }
    return { win: false, text: "Out of time" };
  }
  finish(r) { this.done = true; this.result = r; showResult(r, this.key); }
  hud() {
    const p = player.position();
    if (["sprint", "hurdles"].includes(this.key)) return `${TRIALS[this.key].label.toUpperCase()} · ${Math.max(0, this.finishZ - p[2]).toFixed(1)}m · ${this.t.toFixed(1)}s`;
    if (this.key === "highjump") return `HIGH JUMP · best ${Math.max(0, this.maxH - 0.8).toFixed(2)}m · ${(this.limit - this.t).toFixed(1)}s`;
    if (this.key === "football") return `FOOTBALL · ${this.t.toFixed(1)}s`;
    if (this.key === "blockpush") return `BLOCK PUSH · ${Math.max(0, this.goalZ - this.block.pos[2]).toFixed(1)}m · ${this.t.toFixed(1)}s`;
    if (this.key === "sumo") return `SUMO · ${this.t.toFixed(1)}s`;
    return "";
  }
  dispose() { if (this.rivals) this.rivals.forEach((r) => r.dispose()); if (this.rival) this.rival.dispose(); for (const n of this.extra) R.remove(n); }
}

function showResult(r, key) {
  if (r.metric != null) { try { genome.records = genome.records || {}; const prev = genome.records[key]; if (prev == null || (r.unit === "m" ? r.metric > prev : r.metric < prev)) genome.records[key] = r.metric; } catch (_) {} }
  $("#result-title").textContent = r.win ? "🏆 Winner!" : "Nice try!";
  $("#result-metric").textContent = r.metric != null ? `${r.metric.toFixed(r.unit === "m" ? 2 : 1)}${r.unit}` : "";
  $("#result-text").textContent = r.text;
  $("#result").classList.add("show");
  if (r.win) { sfx.win(); confetti(); narrator.say("A win! Beautifully done."); } else { sfx.lose(); narrator.say("So close — tweak it and try again."); }
}
$("#result-retry").onclick = () => { sfx.pop(); $("#result").classList.remove("show"); startTrial(trial.key); };
$("#result-trials").onclick = () => { sfx.tap(); $("#result").classList.remove("show"); clearArena(); showScreen("trials"); };

/* ---------------- nav + chrome ---------------- */
for (const b of document.querySelectorAll("[data-go]")) b.onclick = () => { sfx.tap(); const n = b.getAttribute("data-go"); if (n === "build") openBuild(); else { clearArena(); showScreen(n); } };
$("#play-back").onclick = () => { sfx.back(); clearArena(); showScreen("title"); };
$("#mute-btn").onclick = (e) => { e.target.textContent = toggleMute() ? "🔇" : "🔊"; };
$("#narrate-btn").onclick = (e) => { const on = narrator.toggle(); e.target.textContent = on ? "🗣️" : "🔇"; if (on) narrator.say("Narrator on."); };
document.body.addEventListener("pointerdown", () => { primeAudio(); narrator.say("Welcome to FriedZooki! Build a creature, then race it."); }, { once: true });
