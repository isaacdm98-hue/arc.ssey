// FriedZooki — game flow: Title → Workshop (build) → My Zooks → Trials → Run.
// Hand-drawn, tactile UI. The Zook is always on stage while building. Trials run
// with a countdown, record results to each Zook's Passport, and can be played in
// AR on your desk.
import * as THREE from "three";
import { Engine } from "./engine.js";
import { initPhysics, createWorld } from "./physics.js";
import { Zook, defaultGenome } from "./zook.js";
import { Arena } from "./arena.js";
import { CONTESTS, makeContest } from "./contests.js";
import { renderControls } from "./builder.js";
import { loadRoster, upsert, remove, recordResult } from "./storage.js";
import { ARSession } from "./ar.js";
import { sfx, toggleMute, primeAudio } from "./sound.js";
import { confetti } from "./fx.js";

const $ = (s) => document.querySelector(s);
const canvas = $("#scene");
const engine = new Engine(canvas);
const ar = new ARSession(engine, $("#cam"));

let genome = defaultGenome("My First Zook");
let mode = "idle";          // idle | sandbox | countdown | contest
let world = null, arena = null, player = null, contest = null;
let trialKey = null;
let versusPair = null;      // { a, b } genomes when in hotseat Versus

/* ----------------------------------------------------------- session mgmt -- */
function teardown() {
  if (ar.active) toggleAR(false);
  if (contest) { contest.dispose(); contest = null; }
  if (player) { player.dispose(); player = null; }
  if (arena) { arena.dispose(); arena = null; }
  world = null; mode = "idle";
}

function startSandbox() {
  teardown();
  world = createWorld();
  arena = new Arena(world, engine.scene);
  arena.ground(0x6f9b6a);
  player = new Zook(genome, world, engine.scene, { x: 0, z: 0 });
  engine.setFollow(player.object, new THREE.Vector3(0, 4.5, -8));
  mode = "sandbox";
}
function rebuildPlayer() {
  if (mode !== "sandbox" || !world) return;
  if (player) player.dispose();
  player = new Zook(genome, world, engine.scene, { x: 0, z: 0 });
  engine.setFollow(player.object, new THREE.Vector3(0, 4.5, -8));
}

function startContest(key) {
  teardown();
  trialKey = key; versusPair = null;
  world = createWorld();
  contest = makeContest(key, genome, world, engine.scene, engine);
  mode = "countdown";
  $("#result").classList.remove("show");
  runCountdown();
}

function startVersus(key, gA, gB) {
  teardown();
  trialKey = key; versusPair = { a: gA, b: gB };
  world = createWorld();
  contest = makeContest(key, gA, world, engine.scene, engine, { opponents: [gB] });
  mode = "countdown";
  $("#result").classList.remove("show");
  runCountdown();
}

/* --------------------------------------------------------------- loop ----- */
engine.onFrame((dt, t) => {
  if (mode === "sandbox" && player) { player.update(t); world.step(); player.sync(); }
  else if (mode === "contest" && contest) {
    contest.step(dt);
    $("#hud").textContent = contest.hud();
    if (contest.done) finishContest();
  }
});

/* --------------------------------------------------------- countdown ------ */
function runCountdown() {
  const el = $("#countdown");
  const seq = ["3", "2", "1", "GO!"];
  let i = 0;
  el.classList.remove("hidden");
  const tick = () => {
    el.innerHTML = `<b>${seq[i]}</b>`;
    i < 3 ? sfx.beep() : sfx.go();
    i++;
    if (i <= seq.length) setTimeout(tick, i === seq.length ? 450 : 700);
    else { el.classList.add("hidden"); if (mode === "countdown") mode = "contest"; }
  };
  tick();
}

/* ------------------------------------------------------------ results ----- */
function finishContest() {
  if ($("#result").classList.contains("show")) return;
  const r = contest.result || { win: false, text: "" };
  if (versusPair) {
    const winner = r.win ? versusPair.a.name : versusPair.b.name;
    $("#result-title").textContent = `🏆 ${winner} wins!`;
    $("#result-metric").textContent = "";
    $("#result-text").textContent = `${CONTESTS[trialKey].label} · ${versusPair.a.name} vs ${versusPair.b.name}`;
    $("#result").classList.add("show");
    sfx.win(); confetti();
    return;
  }
  const c = CONTESTS[trialKey];
  let rec = { improved: false };
  if (r.metric != null) rec = recordResult(player.name, trialKey, r.metric, r.better);
  $("#result-title").textContent = r.win ? "🏆 Winner!" : "Nice try!";
  $("#result-metric").textContent = r.metric != null
    ? `${r.metric.toFixed(r.unit === "m" ? 2 : 1)}${r.unit}` + (rec.improved ? "  ⭐ new best!" : "")
    : "";
  $("#result-text").textContent = r.text;
  $("#result").classList.add("show");
  if (r.win) { sfx.win(); confetti(); } else { sfx.lose(); }
}

/* --------------------------------------------------------------- screens -- */
function showScreen(name) {
  for (const el of document.querySelectorAll(".screen")) el.classList.remove("show");
  const playing = name === "play";
  $("#play-ui").classList.toggle("hidden", !playing);
  if (!playing) { teardown(); engine.setOrbit(); }
  const el = $("#screen-" + name); if (el) el.classList.add("show");
  if (name === "roster") renderRoster();
  if (name === "trials") renderTrials();
  if (name === "versus") renderVersus();
}

/* ---- Versus (local hotseat) ---- */
function renderVersus() {
  const list = loadRoster();
  const selA = $("#vs-a"), selB = $("#vs-b"), warn = $("#vs-warn"), box = $("#vs-trials");
  if (list.length < 2) {
    warn.textContent = "Build & save at least 2 Zooks to play Versus.";
    selA.innerHTML = selB.innerHTML = ""; box.innerHTML = ""; return;
  }
  warn.textContent = "";
  const opts = list.map((g) => `<option value="${g.name}">${g.name}</option>`).join("");
  selA.innerHTML = opts; selB.innerHTML = opts; selB.selectedIndex = 1;
  box.innerHTML = "";
  for (const key of ["sprint", "hurdles", "lap"]) {
    const c = CONTESTS[key];
    box.appendChild(mkbtn(`${c.icon} ${c.label}`, "btn-blob", () => {
      const a = list.find((g) => g.name === selA.value), b = list.find((g) => g.name === selB.value);
      if (a.name === b.name) { warn.textContent = "Pick two different Zooks!"; return; }
      sfx.whoosh(); showScreen("play"); startVersus(key, structuredClone(a), structuredClone(b));
    }));
  }
}

/* ---- Build / Workshop ---- */
function openBuild() {
  showScreen("build");
  startSandbox();
  $("#build-name").value = genome.name;
  renderControls($("#build-controls"), $("#build-swatches"), genome, (structural) => {
    if (structural) rebuildPlayer();
  });
}
$("#build-name").oninput = (e) => { genome.name = e.target.value || "Zook"; };
$("#build-new").onclick = () => { sfx.pop(); genome = defaultGenome("Zook " + (loadRoster().length + 1)); openBuild(); };
$("#build-save").onclick = () => { sfx.save(); upsert(structuredClone(genome)); flash($("#build-save"), "Saved!"); };
$("#build-test").onclick = () => { sfx.whoosh(); showScreen("play"); startSandbox(); $("#hud").textContent = "Free run — tune & watch!"; };

/* ---- Roster / My Zooks ---- */
function renderRoster() {
  const list = loadRoster(); const box = $("#roster-list"); box.innerHTML = "";
  if (!list.length) { box.innerHTML = '<p class="muted center">No Zooks yet — build one in the Workshop!</p>'; return; }
  for (const g of list) {
    const card = el("div", "card panel");
    const sw = el("span", "swatch"); sw.style.background = g.color;
    const nm = el("span", "cname"); nm.textContent = g.name;
    const recs = el("div", "records");
    const r = g.records || {};
    let any = false;
    for (const [k, c] of Object.entries(CONTESTS)) {
      if (r[k] != null) { any = true; const chip = el("span", "chip");
        chip.textContent = `${c.icon} ${fmt(k, r[k])}`; recs.appendChild(chip); }
    }
    if (!any) { const chip = el("span", "chip muted"); chip.textContent = "no results yet"; recs.appendChild(chip); }
    const actions = el("div", "actions");
    actions.append(
      mkbtn("Edit", "btn-plain", () => { genome = structuredClone(g); openBuild(); }),
      mkbtn("Compete →", "btn-bubble", () => { genome = structuredClone(g); showScreen("trials"); }),
      mkbtn("Delete", "btn-plain danger", () => { sfx.back(); remove(g.name); renderRoster(); }),
    );
    card.append(sw, nm, el("span"), recs, actions);
    box.appendChild(card);
  }
}

/* ---- Trials ---- */
function renderTrials() {
  $("#trials-zook").textContent = `Competing: ${genome.name}`;
  const box = $("#trials-list"); box.innerHTML = "";
  const recs = (loadRoster().find((z) => z.name === genome.name) || {}).records || genome.records || {};
  for (const [key, c] of Object.entries(CONTESTS)) {
    const card = el("div", "trial panel");
    const ic = el("span", "ic"); ic.textContent = c.icon;
    const name = el("span", "cname"); name.textContent = c.label;
    const desc = el("div", "tag small"); desc.textContent = c.desc; desc.style.gridColumn = "2";
    const go = mkbtn("Enter", "btn-blob", () => { sfx.whoosh(); showScreen("play"); startContest(key); });
    card.append(ic, name, go, desc);
    if (recs[key] != null) { const b = el("div", "best"); b.textContent = `your best: ${fmt(key, recs[key])}`; card.append(b); }
    box.appendChild(card);
  }
}

/* ---- Play controls ---- */
async function toggleAR(force) {
  const want = force === undefined ? !ar.active : force;
  const b = $("#ar-btn");
  if (want && ARSession.supported) {
    try {
      const target = (contest ? contest.player : player)?.object;
      await ar.start(target);
      b.textContent = "Exit AR"; $("#recenter-btn").classList.remove("hidden");
    } catch (e) { alert("Couldn't start camera AR: " + e.message + "\n(Needs HTTPS + camera permission.)"); }
  } else {
    ar.stop(); b.textContent = "📷 AR"; $("#recenter-btn").classList.add("hidden");
  }
}
$("#ar-btn").onclick = () => { sfx.tap(); toggleAR(); };
$("#recenter-btn").onclick = () => { sfx.tap(); ar.recenter(); };
$("#play-back").onclick = () => { sfx.back(); showScreen("title"); };
$("#result-retry").onclick = () => {
  sfx.pop(); $("#result").classList.remove("show");
  if (versusPair) startVersus(trialKey, versusPair.a, versusPair.b); else startContest(trialKey);
};
$("#result-trials").onclick = () => {
  sfx.tap(); const back = versusPair ? "versus" : "trials";
  $("#result").classList.remove("show"); showScreen(back);
};

/* ---- nav + chrome ---- */
for (const b of document.querySelectorAll("[data-go]")) {
  b.onclick = () => { sfx.tap(); const n = b.getAttribute("data-go"); n === "build" ? openBuild() : showScreen(n); };
}
$("#mute-btn").onclick = (e) => { const m = toggleMute(); e.target.textContent = m ? "🔇" : "🔊"; };
document.body.addEventListener("pointerdown", () => primeAudio(), { once: true });

/* ------------------------------------------------------------- helpers ---- */
function el(tag, cls) { const e = document.createElement(tag); if (cls) e.className = cls; return e; }
function mkbtn(text, cls, fn) { const b = el("button", cls); b.textContent = text; b.onclick = () => { sfx.tap(); fn(); }; return b; }
function flash(b, t) { const o = b.textContent; b.textContent = t; setTimeout(() => (b.textContent = o), 1100); }
function fmt(key, v) { return CONTESTS[key].cls.name === "HighJump" || key === "highjump" ? `${v.toFixed(2)}m` : `${v.toFixed(1)}s`; }

/* ------------------------------------------------------------- startup ---- */
(async () => { await initPhysics(); $("#loading").classList.remove("show"); showScreen("title"); })();

/* ---- PWA ---- */
if ("serviceWorker" in navigator)
  window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(() => {}));
let deferred = null;
window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); deferred = e; $("#install").style.display = "inline-block"; });
$("#install").onclick = async () => { sfx.pop(); if (deferred) { deferred.prompt(); deferred = null; $("#install").style.display = "none"; } };
const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
if (isIOS && !(window.navigator.standalone || matchMedia("(display-mode: standalone)").matches)) $("#ios-hint").style.display = "block";
