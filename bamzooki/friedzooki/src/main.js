// FriedZooki — game flow: Title → Workshop (build) → My Zooks → Trials → Run.
// Hand-drawn, tactile UI. The Zook is always on stage while building. Trials run
// with a countdown, record results to each Zook's Passport, and can be played in
// AR on your desk.
import * as THREE from "../vendor/three.module.js";
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
import { Net } from "./net.js";
import { Joystick } from "./joystick.js";
import { narrator } from "./narrator.js";

const TRIAL_INTRO = {
  sprint: "The Sprint! First Zook past the line takes it.",
  hurdles: "Hurdles. Charge through the bars and don't get stopped.",
  lap: "The Lap. A full circuit around the gates — keep it tight.",
  highjump: "High Jump. Tune that spring and reach for the sky.",
  blockpush: "Block Push. Put your shoulder in and shove it home.",
};

const $ = (s) => document.querySelector(s);
const canvas = $("#scene");
const engine = new Engine(canvas);
const ar = new ARSession(engine, $("#cam"));
const net = new Net();
const joystick = new Joystick($("#joy-base"), $("#joy-knob"));

let genome = defaultGenome("My First Zook");
let mode = "idle";          // idle | sandbox | freeroam | countdown | contest | net-host | net-client
let world = null, arena = null, player = null, contest = null;
let trialKey = null;
let versusPair = null;      // { a, b } genomes when in hotseat Versus
let netRole = null, netMine = null, netTheirs = null, netState = null, netAccum = 0;

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
  narrator.say(TRIAL_INTRO[key] || "");
  runCountdown();
}

function startVersus(key, gA, gB) {
  teardown();
  trialKey = key; versusPair = { a: gA, b: gB };
  world = createWorld();
  contest = makeContest(key, gA, world, engine.scene, engine, { opponents: [gB] });
  mode = "countdown";
  $("#result").classList.remove("show");
  narrator.say(`${gA.name} versus ${gB.name}. May the best Zook win!`);
  runCountdown();
}

/* --------------------------------------------------------------- loop ----- */
engine.onFrame((dt, t) => {
  if (mode === "sandbox" && player) { player.update(t); world.step(); player.sync(); }
  else if (mode === "freeroam" && player) {
    const idle = !(joystick.x || joystick.y);
    if (!idle) player.driveDir(joystick.x, joystick.y); else player.clearGoal();
    player.update(t, idle); world.step(); player.sync();
  }
  else if (mode === "contest" && contest) {
    contest.step(dt);
    $("#hud").textContent = contest.hud();
    if (contest.done) finishContest();
  }
  else if (mode === "net-host" && contest) {
    contest.step(dt);
    $("#hud").textContent = contest.hud();
    netAccum += dt;
    if (netAccum >= 1 / 20) { net.send({ t: "state", s: contest.serialize() }); netAccum = 0; }
    if (contest.done) {
      const winner = contest.result.win ? netMine.name : netTheirs.name;
      net.send({ t: "state", s: contest.serialize() });
      net.send({ t: "result", winner });
      mode = "idle"; showNetResult(winner);
    }
  }
  else if (mode === "net-client" && contest) {
    if (netState) { contest.applyState(netState); $("#hud").textContent = netState.h || ""; }
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
    narrator.say(`${winner} takes the win! Glorious.`);
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
  if (r.win) { sfx.win(); confetti(); narrator.say(rec.improved ? "A brand new record! Magnificent." : "A win! Beautifully done."); }
  else { sfx.lose(); narrator.say("So close. Tweak your Zook and have another go."); }
}

/* --------------------------------------------------------------- screens -- */
function showScreen(name) {
  for (const el of document.querySelectorAll(".screen")) el.classList.remove("show");
  const playing = name === "play";
  $("#play-ui").classList.toggle("hidden", !playing);
  $("#joy-wrap").classList.add("hidden");      // shown again only by Free Roam
  if (!playing) { teardown(); engine.setOrbit(); }
  const el = $("#screen-" + name); if (el) el.classList.add("show");
  if (name === "roster") renderRoster();
  if (name === "trials") renderTrials();
  if (name === "versus") renderVersus();
  if (name === "online") renderOnline();
}

/* ---- Free Roam (manual touch drive) ---- */
function startFreeRoam() {
  teardown();
  world = createWorld();
  arena = new Arena(world, engine.scene);
  arena.ground(0x6f9b6a);
  for (let i = 0; i < 6; i++) arena.box((Math.random() * 2 - 1) * 12, 0.6, (Math.random() * 2 - 1) * 12, 0.6, 0.6, 0.6, 0xffb454);
  player = new Zook(genome, world, engine.scene, { x: 0, z: 0 });
  engine.setFollow(player.object, new THREE.Vector3(0, 5, -9));
  mode = "freeroam";
  showScreen("play");
  $("#joy-wrap").classList.remove("hidden");
  $("#hud").textContent = "Free Roam — drive with the stick, tap JUMP!";
  narrator.say("Free roam! Use the stick to wander, and give JUMP a try.");
}
$("#btn-freeroam").onclick = () => { sfx.whoosh(); startFreeRoam(); };
$("#jump-btn").onclick = () => { if (player) player.jump(); sfx.pop(); };

/* ---- Online (WebRTC) ---- */
function renderOnline() {
  const list = loadRoster();
  const sel = $("#net-zook");
  sel.innerHTML = list.length
    ? list.map((g) => `<option value="${g.name}">${g.name}</option>`).join("")
    : `<option value="">(save a Zook first)</option>`;
  $("#net-host-panel").style.display = "none";
  $("#net-join-panel").style.display = "none";
  $("#net-start").style.display = "none";
  $("#net-status").textContent = "";
}
function netPickGenome() {
  const name = $("#net-zook").value;
  const g = loadRoster().find((z) => z.name === name);
  return structuredClone(g || genome);
}
function netStatus(s) { $("#net-status").textContent = s; }

$("#net-host").onclick = async () => {
  sfx.tap(); netRole = "host"; netMine = netPickGenome();
  $("#net-host-panel").style.display = "block"; $("#net-join-panel").style.display = "none";
  netStatus("Creating invite…");
  try { $("#net-offer").value = await net.host(); netStatus("Share the invite, then paste their reply."); }
  catch (e) { netStatus("Couldn't start: " + e.message); }
};
$("#net-join").onclick = () => {
  sfx.tap(); netRole = "join"; netMine = netPickGenome();
  $("#net-join-panel").style.display = "block"; $("#net-host-panel").style.display = "none";
  netStatus("Paste the invite, then make your reply.");
};
$("#net-join-gen").onclick = async () => {
  const code = $("#net-offer-in").value.trim(); if (!code) return netStatus("Paste the invite first.");
  try { $("#net-reply").value = await net.join(code); netStatus("Send your reply back to the host."); }
  catch (e) { netStatus("Bad invite code."); }
};
$("#net-host-connect").onclick = async () => {
  const code = $("#net-reply-in").value.trim(); if (!code) return netStatus("Paste their reply first.");
  try { await net.hostAccept(code); netStatus("Connecting…"); } catch (e) { netStatus("Bad reply code."); }
};
$("#net-offer-copy").onclick = () => { copyText($("#net-offer").value); netStatus("Invite copied!"); };
$("#net-reply-copy").onclick = () => { copyText($("#net-reply").value); netStatus("Reply copied!"); };

net.onOpen = () => { netStatus("Connected! 🎉"); net.send({ t: "hello", genome: netMine }); };
net.onClose = () => { netStatus("Disconnected."); };
net.onMessage = (m) => {
  if (m.t === "hello") { netTheirs = m.genome; netMaybeReady(); }
  else if (m.t === "start") { startNetClient(m.key, m.host, m.guest); }
  else if (m.t === "state") { netState = m.s; }
  else if (m.t === "result") { mode = "idle"; showNetResult(m.winner); }
};
function netMaybeReady() {
  if (!netMine || !netTheirs) return;
  $("#net-start").style.display = "block";
  $("#net-ready").textContent = `${netMine.name}  vs  ${netTheirs.name}`;
  const box = $("#net-trials"); box.innerHTML = "";
  if (netRole === "host") {
    $("#net-waiting").style.display = "none";
    for (const key of ["sprint", "hurdles", "lap"]) {
      box.appendChild(mkbtn(`${CONTESTS[key].icon} ${CONTESTS[key].label}`, "btn-blob", () => {
        net.send({ t: "start", key, host: netMine, guest: netTheirs });
        startNetHost(key, netMine, netTheirs);
      }));
    }
  } else { $("#net-waiting").style.display = "block"; }
}
function startNetHost(key, hostG, guestG) {
  teardown(); trialKey = key; netRole = "host"; netMine = hostG; netTheirs = guestG;
  world = createWorld();
  contest = makeContest(key, hostG, world, engine.scene, engine, { opponents: [guestG] });
  engine.setFollow(contest.zooks[0].object);
  mode = "net-host"; netAccum = 0; sfx.whoosh();
  showScreen("play"); runCountdown();
}
function startNetClient(key, hostG, guestG) {
  teardown(); trialKey = key;
  world = createWorld();
  contest = makeContest(key, hostG, world, engine.scene, engine, { opponents: [guestG] });
  engine.setFollow(contest.zooks[1] ? contest.zooks[1].object : contest.zooks[0].object);
  mode = "net-client"; netState = null; sfx.whoosh();
  showScreen("play"); runCountdown();
}
function showNetResult(winner) {
  $("#result-title").textContent = `🏆 ${winner} wins!`;
  $("#result-metric").textContent = "";
  $("#result-text").textContent = `${CONTESTS[trialKey].label} · online`;
  $("#result").classList.add("show");
  const youWon = netMine && winner === netMine.name;
  if (youWon) { sfx.win(); confetti(); } else sfx.lose();
  narrator.say(`${winner} wins the duel!`);
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
  narrator.say("Welcome to the workshop. Slide the controls and watch your Zook spring to life.");
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
  if (netRole && net.connected) { showScreen("online"); netMaybeReady(); return; }
  if (versusPair) startVersus(trialKey, versusPair.a, versusPair.b); else startContest(trialKey);
};
$("#result-trials").onclick = () => {
  sfx.tap(); $("#result").classList.remove("show");
  if (netRole && net.connected) { showScreen("online"); netMaybeReady(); return; }
  showScreen(versusPair ? "versus" : "trials");
};

/* ---- nav + chrome ---- */
for (const b of document.querySelectorAll("[data-go]")) {
  b.onclick = () => { sfx.tap(); const n = b.getAttribute("data-go"); n === "build" ? openBuild() : showScreen(n); };
}
$("#mute-btn").onclick = (e) => { const m = toggleMute(); e.target.textContent = m ? "🔇" : "🔊"; };
$("#narrate-btn").onclick = (e) => {
  const on = narrator.toggle();
  e.target.textContent = on ? "🗣️" : "🔇";
  if (on) narrator.say("Narrator on.", { force: true });
};
if (!narrator.enabled) $("#narrate-btn").textContent = "🔇";
document.body.addEventListener("pointerdown", () => {
  primeAudio();
  narrator.say("Welcome to FriedZooki! Build a creature, tune how it moves, then race it through the trials.");
}, { once: true });

/* ------------------------------------------------------------- helpers ---- */
function el(tag, cls) { const e = document.createElement(tag); if (cls) e.className = cls; return e; }
function mkbtn(text, cls, fn) { const b = el("button", cls); b.textContent = text; b.onclick = () => { sfx.tap(); fn(); }; return b; }
function flash(b, t) { const o = b.textContent; b.textContent = t; setTimeout(() => (b.textContent = o), 1100); }
function copyText(s) {
  if (navigator.clipboard) navigator.clipboard.writeText(s).catch(() => {});
  else { const ta = document.createElement("textarea"); ta.value = s; document.body.appendChild(ta); ta.select(); try { document.execCommand("copy"); } catch (_) {} ta.remove(); }
}
function fmt(key, v) { return CONTESTS[key].cls.name === "HighJump" || key === "highjump" ? `${v.toFixed(2)}m` : `${v.toFixed(1)}s`; }

/* ------------------------------------------------------------- startup ---- */
(async () => {
  try {
    await initPhysics();
    $("#loading").classList.remove("show");
    showScreen("title");
  } catch (e) {
    const el = $("#boot-err");
    if (el) { el.style.display = "block"; el.textContent = "⚠ Couldn't start physics: " + (e.message || e); }
  }
})();

/* ---- PWA ---- */
if ("serviceWorker" in navigator)
  window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(() => {}));
let deferred = null;
window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); deferred = e; $("#install").style.display = "inline-block"; });
$("#install").onclick = async () => { sfx.pop(); if (deferred) { deferred.prompt(); deferred = null; $("#install").style.display = "none"; } };
const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
if (isIOS && !(window.navigator.standalone || matchMedia("(display-mode: standalone)").matches)) $("#ios-hint").style.display = "block";
