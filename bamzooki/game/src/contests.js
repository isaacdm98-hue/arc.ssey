// Contest definitions — the five BAMZOOKi events: Sprint, Lap, Hurdles,
// High Jump and Block Push. Each contest builds an arena, spawns the player's
// Zook plus AI opponents, drives them, and reports a result.
import * as THREE from "three";
import { Arena } from "./arena.js";
import { Zook } from "./zook.js";

const AI_TINTS = ["#ff7a59", "#9d6bff", "#3ddc97"];

// Lightly randomise an opponent genome so races aren't identical.
function aiGenome(base, i) {
  const g = structuredClone(base);
  g.name = ["Rival", "Chomper", "Bolt", "Dasher"][i % 4];
  g.color = AI_TINTS[i % AI_TINTS.length];
  g.gait.freq = base.gait.freq * (0.85 + Math.random() * 0.3);
  g.gait.drive = base.gait.drive * (0.8 + Math.random() * 0.35);
  return g;
}

class ContestBase {
  constructor(playerGenome, world, scene, engine) {
    this.world = world; this.scene = scene; this.engine = engine;
    this.arena = new Arena(world, scene);
    this.zooks = [];
    this.dynamics = [];   // arena {body,mesh} pairs to sync each frame
    this.player = null;
    this.t = 0;
    this.done = false;
    this.result = null;
    this.timeLimit = 30;
    this._spawn(playerGenome);
  }
  _dyn(obj) { this.dynamics.push(obj); return obj; }
  _make(genome, opts) {
    const z = new Zook(genome, this.world, this.scene, opts);
    this.zooks.push(z);
    return z;
  }
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
  hud() { return ""; }
  _ai() {}
  _judge() {}
  _timeoutResult() { return { win: false, text: "Out of time" }; }
  dispose() {
    for (const z of this.zooks) z.dispose();
    this.arena.dispose();
  }
}

/* --------------------------------------------------------------- Sprint --- */
class Sprint extends ContestBase {
  _spawn(p) {
    this.name = "Sprint";
    this.finishZ = 26;
    this.timeLimit = 30;
    this.arena.ground();
    this.arena.line(0, 0xffffff);
    this.arena.line(this.finishZ, 0x46c7ff);
    const lanes = [-3, 0, 3, 6];
    this.player = this._make(p, { x: 0, y: 1.1, z: 0 });
    this.engine.setFollow(this.player.object);
    for (let i = 0; i < 3; i++) this._make(aiGenome(p, i), { x: lanes[i + 1], y: 1.1, z: 0, tint: AI_TINTS[i] });
    this.player.start.lane = 0;
  }
  _ai() { for (const z of this.zooks) if (z !== this.player) z.steerToward(z.position().x, 1000, 0.5); }
  _judge() {
    for (const z of this.zooks) {
      if (z.position().z >= this.finishZ) {
        const win = z === this.player;
        this.finish({ win, text: win ? `You won the Sprint! ${this.t.toFixed(1)}s` : "An opponent reached the line first" });
        return;
      }
    }
  }
  hud() { return `Sprint · ${(this.finishZ - this.player.position().z).toFixed(1)}m to go · ${this.t.toFixed(1)}s`; }
}

/* ------------------------------------------------------------------ Lap --- */
class Lap extends ContestBase {
  _spawn(p) {
    this.name = "Lap";
    this.timeLimit = 60;
    this.R = 14;
    this.arena.ground();
    // four corner gates to steer around
    this.gates = [
      { x: 0, z: this.R }, { x: this.R, z: 0 }, { x: 0, z: -this.R }, { x: -this.R, z: 0 },
    ];
    for (const g of this.gates) this.arena.box(g.x, 0.4, g.z, 0.3, 0.4, 0.3, 0x3a5070);
    this.player = this._make(p, { x: -this.R, y: 1.1, z: this.R, heading: Math.PI / 2 });
    this.engine.setFollow(this.player.object);
    for (let i = 0; i < 2; i++)
      this._make(aiGenome(p, i), { x: -this.R + 2 + i * 2, y: 1.1, z: this.R, heading: Math.PI / 2, tint: AI_TINTS[i] });
    this.progress = new Map(this.zooks.map((z) => [z, 0]));
  }
  _target(z) { return this.gates[this.progress.get(z) % 4]; }
  _ai() {
    // Every Zook (player included) auto-navigates the gates — the design/tuning
    // is the skill, not manual driving.
    for (const z of this.zooks) {
      const g = this._target(z);
      z.steerToward(g.x, g.z, 0.8);
      const p = z.position();
      if (Math.hypot(p.x - g.x, p.z - g.z) < 3) this.progress.set(z, this.progress.get(z) + 1);
    }
  }
  _judge() {
    for (const z of this.zooks) {
      if (this.progress.get(z) >= 4) {
        const win = z === this.player;
        this.finish({ win, text: win ? `Lap complete in ${this.t.toFixed(1)}s — you win!` : "An opponent finished the lap first" });
        return;
      }
    }
  }
  hud() {
    const g = this._target(this.player);
    return `Lap · gate ${this.progress.get(this.player) + 1}/4 · steer to the marker · ${this.t.toFixed(1)}s`;
  }
}

/* -------------------------------------------------------------- Hurdles --- */
class Hurdles extends Sprint {
  _spawn(p) {
    super._spawn(p);
    this.name = "Hurdles";
    // Knockable bars: a charging Zook bowls them over, a feeble one gets stopped.
    for (let i = 1; i <= 4; i++)
      this._dyn(this.arena.dynamicBar(0, 0.35, i * 5, 3.5, 0.35, 0.07, 0.4));
  }
  hud() { return `Hurdles · clear the bars! · ${(this.finishZ - this.player.position().z).toFixed(1)}m · ${this.t.toFixed(1)}s`; }
}

/* ------------------------------------------------------------- High Jump --- */
class HighJump extends ContestBase {
  _spawn(p) {
    this.name = "High Jump";
    this.timeLimit = 20;
    this.maxH = 0;
    this.arena.ground();
    const g = structuredClone(p);
    g.gait.jump = Math.max(g.gait.jump, 6);  // ensure it actually springs
    this.player = this._make(g, { x: 0, y: 1.1, z: 0 });
    this.engine.setOrbit(new THREE.Vector3(0, 1.5, 0));
  }
  _judge() {
    const h = this.player.heightOfTorso();
    if (h > this.maxH) this.maxH = h;
  }
  _timeoutResult() {
    const score = Math.max(0, this.maxH - 0.8);
    return { win: score > 1.2, text: `Best height: ${score.toFixed(2)}m ${score > 1.2 ? "— great spring!" : ""}` };
  }
  hud() { return `High Jump · best ${(Math.max(0, this.maxH - 0.8)).toFixed(2)}m · ${(this.timeLimit - this.t).toFixed(1)}s left`; }
}

/* ------------------------------------------------------------ Block Push --- */
class BlockPush extends ContestBase {
  _spawn(p) {
    this.name = "Block Push";
    this.timeLimit = 30;
    this.goalZ = 8;
    this.arena.ground();
    this.arena.line(this.goalZ, 0x3ddc97);
    this.block = this._dyn(this.arena.dynamicBox(0, 0.6, 3, 0.6, 3));
    this.player = this._make(p, { x: 0, y: 1.1, z: 0 });
    this.engine.setFollow(this.player.object, new THREE.Vector3(0, 5, -10));
  }
  _ai() { this.player; }
  _judge() {
    if (this.block.body.translation().z >= this.goalZ)
      this.finish({ win: true, text: `Block pushed home in ${this.t.toFixed(1)}s — strong Zook!` });
  }
  hud() {
    const d = this.goalZ - this.block.body.translation().z;
    return `Block Push · ${d.toFixed(1)}m to the line · ${this.t.toFixed(1)}s`;
  }
  dispose() { super.dispose(); }
}

export const CONTESTS = {
  sprint: { label: "Sprint", desc: "First past the line wins.", cls: Sprint },
  lap: { label: "Lap", desc: "Steer a full lap around the gates.", cls: Lap },
  hurdles: { label: "Hurdles", desc: "Race the sprint, clearing the bars.", cls: Hurdles },
  highjump: { label: "High Jump", desc: "Tune your jump for maximum height.", cls: HighJump },
  blockpush: { label: "Block Push", desc: "Shove the heavy block over the line.", cls: BlockPush },
};

export function makeContest(key, playerGenome, world, scene, engine) {
  return new CONTESTS[key].cls(playerGenome, world, scene, engine);
}
