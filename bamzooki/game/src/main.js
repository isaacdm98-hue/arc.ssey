// BAMZOOKi — game bootstrap and screen flow.
// Build -> Tune -> Test -> Contest, with an iPhone camera-passthrough AR mode.
import * as THREE from "three";
import { Engine } from "./engine.js";
import { initPhysics, createWorld } from "./physics.js";
import { Zook, defaultGenome } from "./zook.js";
import { Arena } from "./arena.js";
import { CONTESTS, makeContest } from "./contests.js";
import { renderBuilder } from "./builder.js";
import { loadRoster, upsert, remove } from "./storage.js";
import { ARSession } from "./ar.js";

const $ = (s) => document.querySelector(s);
const canvas = $("#scene");
const engine = new Engine(canvas);
const ar = new ARSession(engine, $("#cam"));

let genome = defaultGenome("My First Zook");
let mode = "idle";     // idle | sandbox | contest
let world = null;
let arena = null;
let player = null;     // Zook in sandbox
let contest = null;

/* ----------------------------------------------------------- session mgmt -- */
function teardown() {
  if (ar.active) toggleAR(false);
  if (contest) { contest.dispose(); contest = null; }
  if (player) { player.dispose(); player = null; }
  if (arena) { arena.dispose(); arena = null; }
  world = null;
  mode = "idle";
}

function startSandbox() {
  teardown();
  world = createWorld();
  arena = new Arena(world, engine.scene);
  arena.ground();
  arena.line(8, 0x46c7ff);
  player = new Zook(genome, world, engine.scene, { x: 0, z: 0 });
  engine.setFollow(player.object);   // keep the creature in view as it trots
  mode = "sandbox";
}

function rebuildPlayer() {
  if (mode !== "sandbox" || !world) return;
  if (player) player.dispose();
  player = new Zook(genome, world, engine.scene, { x: 0, z: 0 });
  engine.setFollow(player.object);
}

function startContest(key) {
  teardown();
  world = createWorld();
  contest = makeContest(key, genome, world, engine.scene, engine);
  mode = "contest";
  $("#result").classList.add("hidden");
  $("#hud").classList.remove("hidden");
}

/* ------------------------------------------------------------- main loop -- */
engine.onFrame((dt, t) => {
  if (mode === "sandbox" && player && world) {
    player.update(t);
    world.step();
    player.sync();
  } else if (mode === "contest" && contest) {
    contest.step(dt);
    $("#hud").textContent = contest.hud();
    if (contest.done && $("#result").classList.contains("hidden")) {
      const r = contest.result || { win: false, text: "" };
      $("#result-title").textContent = r.win ? "🏆 Winner!" : "Race over";
      $("#result-text").textContent = r.text;
      $("#result").classList.remove("hidden");
      $("#hud").classList.add("hidden");
    }
  }
});

/* --------------------------------------------------------------- screens -- */
function showScreen(name) {
  for (const el of document.querySelectorAll(".screen")) el.classList.add("hidden");
  const playUI = name === "play";
  $("#play-ui").classList.toggle("hidden", !playUI);
  if (!playUI) { teardown(); engine.setOrbit(); }
  if (name) { const el = $("#screen-" + name); if (el) el.classList.remove("hidden"); }
  if (name === "roster") renderRoster();
  if (name === "events") renderEvents();
}

/* ---- Builder ---- */
function openBuilder() {
  showScreen("builder");
  startSandbox();
  renderBuilder($("#builder-controls"), genome, (g, structural) => {
    if (structural) rebuildPlayer();
  });
}

$("#builder-test").onclick = () => { showScreen("play"); startSandbox(); $("#hud").classList.add("hidden"); };
$("#builder-save").onclick = () => {
  upsert(structuredClone(genome));
  flash($("#builder-save"), "Saved ✓");
};
$("#builder-new").onclick = () => { genome = defaultGenome("Zook " + (loadRoster().length + 1)); openBuilder(); };

/* ---- Roster ---- */
function renderRoster() {
  const list = loadRoster();
  const box = $("#roster-list");
  box.innerHTML = "";
  if (!list.length) { box.innerHTML = '<p class="muted">No Zooks yet. Build one!</p>'; return; }
  for (const g of list) {
    const card = document.createElement("div"); card.className = "card";
    const sw = document.createElement("span"); sw.className = "swatch"; sw.style.background = g.color;
    const nm = document.createElement("b"); nm.textContent = g.name;
    const meta = document.createElement("span"); meta.className = "muted";
    meta.textContent = `${g.legCount} legs · power ${g.gait.drive}`;
    const edit = btn("Edit", () => { genome = structuredClone(g); openBuilder(); });
    const del = btn("Delete", () => { remove(g.name); renderRoster(); });
    del.classList.add("danger");
    const use = btn("Use →", () => { genome = structuredClone(g); showScreen("events"); });
    use.classList.add("primary");
    card.append(sw, nm, meta, edit, use, del);
    box.append(card);
  }
}

/* ---- Events ---- */
function renderEvents() {
  const box = $("#events-list");
  box.innerHTML = "";
  $("#events-zook").textContent = `Competing: ${genome.name}`;
  for (const [key, c] of Object.entries(CONTESTS)) {
    const card = document.createElement("div"); card.className = "card";
    const nm = document.createElement("b"); nm.textContent = c.label;
    const d = document.createElement("span"); d.className = "muted"; d.textContent = c.desc;
    const go = btn("Compete", () => { showScreen("play"); startContest(key); });
    go.classList.add("primary");
    card.append(nm, d, go);
    box.append(card);
  }
}

/* ---- Play UI: AR, retry, back ---- */
async function toggleAR(force) {
  const want = force === undefined ? !ar.active : force;
  const b = $("#ar-btn");
  if (want && ARSession.supported) {
    try { await ar.start(); b.textContent = "Exit AR"; b.classList.add("primary"); }
    catch (e) { alert("Couldn't start camera AR: " + e.message + "\n(Needs HTTPS + camera permission.)"); }
  } else {
    ar.stop(); b.textContent = "AR"; b.classList.remove("primary");
  }
}
$("#ar-btn").onclick = () => toggleAR();
$("#play-back").onclick = () => showScreen("menu");
$("#result-retry").onclick = () => { if (contest) startContest(currentKeyOf(contest)); };
$("#result-events").onclick = () => showScreen("events");
function currentKeyOf(c) {
  return Object.keys(CONTESTS).find((k) => CONTESTS[k].label === c.name) || "sprint";
}

/* ---- nav buttons ---- */
for (const el of document.querySelectorAll("[data-go]")) {
  el.onclick = () => { const n = el.getAttribute("data-go"); n === "builder" ? openBuilder() : showScreen(n); };
}

/* ------------------------------------------------------------- helpers ---- */
function btn(text, fn) { const b = document.createElement("button"); b.textContent = text; b.onclick = fn; return b; }
function flash(el, text) { const o = el.textContent; el.textContent = text; setTimeout(() => (el.textContent = o), 1200); }

/* ------------------------------------------------------------- startup ---- */
(async () => {
  await initPhysics();
  $("#loading").classList.add("hidden");
  showScreen("menu");
})();

/* ---- PWA ---- */
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(() => {}));
}
let deferred = null;
window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); deferred = e; $("#install").style.display = "inline-block"; });
$("#install").onclick = async () => { if (deferred) { deferred.prompt(); deferred = null; $("#install").style.display = "none"; } };
const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
if (isIOS && !(window.navigator.standalone || matchMedia("(display-mode: standalone)").matches)) $("#ios-hint").style.display = "block";
