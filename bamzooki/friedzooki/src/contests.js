// FriedZooki contests — the five trials: Sprint, Lap, Hurdles, High Jump and
// Block Push. Each builds an arena, spawns the player's Zook plus AI rivals,
// drives them, and reports a result with a numeric metric for the Zook Passport.
// Races run until the PLAYER finishes (or time runs out), so every attempt
// records a time/score.
import * as THREE from "../vendor/three.module.js";
import { Arena } from "./arena.js";
import { Zook } from "./zook.js";

const AI_TINTS = ["#ff7a59", "#9d6bff", "#3ddc97"];
const ORD = ["", "1st", "2nd", "3rd", "4th"];

function aiGenome(base, i) {
  const g = structuredClone(base);
  g.name = ["Rival", "Chomper", "Bolt", "Dasher"][i % 4];
  g.color = AI_TINTS[i % AI_TINTS.length];
  g.gait.freq = base.gait.freq * (0.85 + Math.random() * 0.3);
  g.gait.drive = base.gait.drive * (0.8 + Math.random() * 0.35);
  return g;
}

class ContestBase {
  constructor(playerGenome, world, scene, engine, opts = {}) {
    this.world = world; this.scene = scene; this.engine = engine;
    this.opts = opts;            // { opponents: [genome,...] } for Versus
    this.arena = new Arena(world, scene);
    this.zooks = [];
    this.dynamics = [];
    this.player = null;
    this.t = 0;
    this.done = false;
    this.result = null;
    this.timeLimit = 30;
    this._order = [];
    this._fin = new Set();
    this._spawn(playerGenome);
  }
  _place(z) { if (!this._fin.has(z)) { this._fin.add(z); this._order.push(z); } return this._order.indexOf(z) + 1; }
  _dyn(obj) { this.dynamics.push(obj); return obj; }
  /** Rival genomes: explicit Versus opponents if given, else random AI. */
  _rivalList(p, defaultN) {
    const ops = this.opts.opponents;
    if (ops && ops.length) return ops.map((g, i) => {
      const c = structuredClone(g); c.color = g.color || AI_TINTS[i % AI_TINTS.length]; return c;
    });
    return Array.from({ length: defaultN }, (_, i) => aiGenome(p, i));
  }
  _make(genome, opts) { const z = new Zook(genome, this.world, this.scene, opts); this.zooks.push(z); return z; }

  step(dt) {
    if (this.done) return;
    this.t += dt;
    for (const z of this.zooks) z.update(this.t);
    this._ai();
    this.world.step();
    for (const z of this.zooks) z.sync();
    for (const d of this.dynamics) {
      const p = d.body.translation(), r = d.body.rotation();
      d.mesh.position.set(p.x, p.y, p.z);
      d.mesh.quaternion.set(r.x, r.y, r.z, r.w);
    }
    this._judge();
    if (!this.done && this.t > this.timeLimit) this.finish(this._timeoutResult());
  }
  finish(result) { this.done = true; this.result = result; }

  /** Host → client: pack every rendered transform + clock into a compact frame. */
  serialize() {
    const T = (o) => [o.position.x, o.position.y, o.position.z, o.quaternion.x, o.quaternion.y, o.quaternion.z, o.quaternion.w];
    return { z: this.zooks.map((z) => T(z.group)), d: this.dynamics.map((d) => T(d.mesh)), t: this.t, h: this.hud() };
  }
  /** Client: apply a host frame (no local physics; legs animate from the clock). */
  applyState(s) {
    s.z.forEach((a, i) => { const z = this.zooks[i]; if (z) { z.setNetTransform(a); z.animateLegs(s.t); } });
    s.d.forEach((a, i) => { const d = this.dynamics[i]; if (d) { d.mesh.position.set(a[0], a[1], a[2]); d.mesh.quaternion.set(a[3], a[4], a[5], a[6]); } });
    this.t = s.t;
  }
  hud() { return ""; }
  _ai() {}
  _judge() {}
  _timeoutResult() { return { win: false, text: "Out of time", metric: null }; }
  dispose() { for (const z of this.zooks) z.dispose(); this.arena.dispose(); }
}

/* --------------------------------------------------------------- Sprint --- */
class Sprint extends ContestBase {
  _spawn(p) {
    this.name = "Sprint"; this.finishZ = 26; this.timeLimit = 30;
    this.arena.ground(); this.arena.line(0, 0xffffff); this.arena.line(this.finishZ, 0x46c7ff);
    this.player = this._make(p, { x: 0, z: 0 });
    this.engine.setFollow(this.player.object);
    const lanes = [-3, 3, 6, -6];
    this._rivalList(p, 3).forEach((g, i) => this._make(g, { x: lanes[i] ?? (-3 - i * 3), z: 0, tint: g.color }));
  }
  _ai() {}
  _judge() {
    for (const z of this.zooks) if (z.position().z >= this.finishZ) {
      const place = this._place(z);
      if (z === this.player) this.finish({
        win: place === 1, place,
        text: place === 1 ? `${ORD[place]} place — you win!` : `${ORD[place]} place`,
        metric: this.t, unit: "s", better: "lower",
      });
    }
  }
  hud() { return `SPRINT · ${Math.max(0, this.finishZ - this.player.position().z).toFixed(1)}m to go · ${this.t.toFixed(1)}s`; }
}

/* -------------------------------------------------------------- Hurdles --- */
class Hurdles extends Sprint {
  _spawn(p) {
    super._spawn(p); this.name = "Hurdles";
    for (let i = 1; i <= 4; i++) this._dyn(this.arena.dynamicBar(0, 0.35, i * 5, 3.5, 0.35, 0.07, 0.4));
  }
  hud() { return `HURDLES · ${Math.max(0, this.finishZ - this.player.position().z).toFixed(1)}m · clear the bars! · ${this.t.toFixed(1)}s`; }
}

/* ------------------------------------------------------------------ Lap --- */
class Lap extends ContestBase {
  _spawn(p) {
    this.name = "Lap"; this.timeLimit = 60; this.R = 14;
    this.arena.ground();
    this.gates = [{ x: 0, z: this.R }, { x: this.R, z: 0 }, { x: 0, z: -this.R }, { x: -this.R, z: 0 }];
    for (const g of this.gates) this.arena.box(g.x, 0.4, g.z, 0.3, 0.4, 0.3, 0xffb454);
    this.player = this._make(p, { x: -this.R, z: this.R, heading: Math.PI / 2 });
    this.engine.setFollow(this.player.object);
    this._rivalList(p, 2).forEach((g, i) => this._make(g, { x: -this.R + 2 + (i + 1) * 2, z: this.R, heading: Math.PI / 2, tint: g.color }));
    this.progress = new Map(this.zooks.map((z) => [z, 0]));
  }
  _target(z) { return this.gates[this.progress.get(z) % 4]; }
  _ai() {
    for (const z of this.zooks) {
      const g = this._target(z);
      z.steerToward(g.x, g.z);
      const p = z.position();
      if (Math.hypot(p.x - g.x, p.z - g.z) < 3) this.progress.set(z, this.progress.get(z) + 1);
    }
  }
  _judge() {
    for (const z of this.zooks) if (this.progress.get(z) >= 4) {
      const place = this._place(z);
      if (z === this.player) this.finish({
        win: place === 1, place,
        text: place === 1 ? `${ORD[place]} — lap won!` : `${ORD[place]} place`,
        metric: this.t, unit: "s", better: "lower",
      });
    }
  }
  hud() { return `LAP · gate ${Math.min(4, this.progress.get(this.player) + 1)}/4 · ${this.t.toFixed(1)}s`; }
}

/* ------------------------------------------------------------- High Jump --- */
class HighJump extends ContestBase {
  _spawn(p) {
    this.name = "High Jump"; this.timeLimit = 18; this.maxH = 0;
    this.arena.ground();
    const g = structuredClone(p); g.gait.jump = Math.max(g.gait.jump, 6);
    this.player = this._make(g, { x: 0, z: 0 });
    this.engine.setOrbit(new THREE.Vector3(0, 1.5, 0));
  }
  _judge() { const h = this.player.heightOfTorso(); if (h > this.maxH) this.maxH = h; }
  _score() { return Math.max(0, this.maxH - 0.8); }
  _timeoutResult() {
    const s = this._score();
    return { win: s > 1.2, text: `Best height ${s.toFixed(2)}m${s > 1.2 ? " — great spring!" : ""}`, metric: s, unit: "m", better: "higher" };
  }
  hud() { return `HIGH JUMP · best ${this._score().toFixed(2)}m · ${(this.timeLimit - this.t).toFixed(1)}s left`; }
}

/* ------------------------------------------------------------ Block Push --- */
class BlockPush extends ContestBase {
  _spawn(p) {
    this.name = "Block Push"; this.timeLimit = 30; this.goalZ = 8;
    this.arena.ground(); this.arena.line(this.goalZ, 0x3ddc97);
    this.block = this._dyn(this.arena.dynamicBox(0, 0.6, 3, 0.6, 3));
    this.player = this._make(p, { x: 0, z: 0 });
    this.engine.setFollow(this.player.object, new THREE.Vector3(0, 5, -10));
  }
  _judge() {
    if (this.block.body.translation().z >= this.goalZ)
      this.finish({ win: true, text: `Pushed home in ${this.t.toFixed(1)}s!`, metric: this.t, unit: "s", better: "lower" });
  }
  hud() { return `BLOCK PUSH · ${Math.max(0, this.goalZ - this.block.body.translation().z).toFixed(1)}m to the line · ${this.t.toFixed(1)}s`; }
}

/* ------------------------------------------------------------- Football --- */
class Football extends ContestBase {
  _spawn(p) {
    this.name = "Football"; this.timeLimit = 40; this.goalZ = 16; this.goalW = 3;
    this.arena.ground(); this.arena.goal(this.goalZ, this.goalW);
    this.ball = this._dyn(this.arena.sphere(0, 0.6, 6, 0.6, 1.0));
    this.player = this._make(p, { x: 0, z: 0 });
    this.engine.setFollow(this.player.object);
  }
  _ai() {
    // Dribble: approach the ball from the side away from the goal, pushing it in.
    const b = this.ball.body.translation();
    let dx = b.x - 0, dz = b.z - this.goalZ; const m = Math.hypot(dx, dz) || 1;
    this.player.setGoal(b.x + (dx / m) * 1.3, b.z + (dz / m) * 1.3);
  }
  _judge() {
    const b = this.ball.body.translation();
    if (b.z >= this.goalZ && Math.abs(b.x) <= this.goalW)
      this.finish({ win: true, text: `GOAL in ${this.t.toFixed(1)}s!`, metric: this.t, unit: "s", better: "lower" });
  }
  hud() { return `FOOTBALL · dribble the ball home · ${this.t.toFixed(1)}s`; }
}

/* ---------------------------------------------------------------- Sumo ----- */
class Sumo extends ContestBase {
  _spawn(p) {
    this.name = "Sumo"; this.timeLimit = 25; this.R = 4;
    this.arena.ground(0x8fb0c9); this.arena.ring(this.R);
    const buff = (g, f) => { const c = structuredClone(g); c.gait.drive = Math.max(14, c.gait.drive) * f; return c; };
    this.player = this._make(buff(p, 1), { x: 0, z: -2.6, heading: 0, solid: true });
    this.engine.setFollow(this.player.object, new THREE.Vector3(0, 8, -12));
    const r = this._rivalList(p, 1)[0];
    this.rival = this._make(buff(r, 0.82), { x: 0, z: 2.6, heading: Math.PI, tint: r.color, solid: true });
  }
  _ai() {
    this.player.setGoal(this.rival.position().x, this.rival.position().z);
    this.rival.setGoal(this.player.position().x, this.player.position().z);
  }
  _rad(z) { const p = z.position(); return Math.hypot(p.x, p.z); }
  _out(z) { return this._rad(z) > this.R || z.position().y < 0.3; }
  _judge() {
    if (this._out(this.rival)) this.finish({ win: true, text: `Out of the ring in ${this.t.toFixed(1)}s!`, metric: this.t, unit: "s", better: "lower" });
    else if (this._out(this.player)) this.finish({ win: false, text: "You were shoved out!", metric: null });
  }
  _timeoutResult() {
    const win = this._rad(this.player) <= this._rad(this.rival);   // nearer the centre dominates
    return { win, text: win ? "You held the ring!" : "Your rival held firm.", metric: win ? this.t : null, unit: "s", better: "lower" };
  }
  hud() { return `SUMO · shove your rival out · ${this.t.toFixed(1)}s`; }
}

/* ----------------------------------------------------------- Assault ------ */
class Assault extends Sprint {
  _spawn(p) {
    super._spawn(p); this.name = "Assault Course"; this.timeLimit = 40;
    // A long gauntlet of knockable bars at rising heights — all traversable.
    const zs = [5, 8, 11, 14, 17, 20, 23];
    zs.forEach((z, i) => this._dyn(this.arena.dynamicBar(0, 0.32 + i * 0.03, z, 3.5, 0.32 + i * 0.03, 0.06, 0.45)));
    // decorative side walls, well clear of the centre lane
    this.arena.box(-4.2, 0.5, 14, 0.4, 0.5, 9, 0x9d6bff);
    this.arena.box(4.2, 0.5, 14, 0.4, 0.5, 9, 0x9d6bff);
  }
  hud() { return `ASSAULT · bowl through the gauntlet · ${Math.max(0, this.finishZ - this.player.position().z).toFixed(1)}m · ${this.t.toFixed(1)}s`; }
}

export const CONTESTS = {
  sprint: { label: "Sprint", icon: "🏃", desc: "First past the line.", cls: Sprint },
  hurdles: { label: "Hurdles", icon: "🚧", desc: "Sprint and bowl through the bars.", cls: Hurdles },
  lap: { label: "Lap", icon: "🔁", desc: "A full circuit round the gates.", cls: Lap },
  highjump: { label: "High Jump", icon: "⬆️", desc: "Tune your spring for max height.", cls: HighJump },
  blockpush: { label: "Block Push", icon: "📦", desc: "Shove the block over the line.", cls: BlockPush },
  football: { label: "Football", icon: "⚽", desc: "Dribble the ball into the goal.", cls: Football },
  sumo: { label: "Sumo", icon: "🤼", desc: "Shove your rival out of the ring.", cls: Sumo },
  assault: { label: "Assault Course", icon: "🧗", desc: "Ramps, walls & bars to the line.", cls: Assault },
};

/** Order used for the Championship ladder. */
export const CHAMPIONSHIP = ["sprint", "hurdles", "highjump", "football", "sumo", "blockpush", "assault", "lap"];

export function makeContest(key, playerGenome, world, scene, engine, opts = {}) {
  return new CONTESTS[key].cls(playerGenome, world, scene, engine, opts);
}
