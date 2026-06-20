// A Zook on the from-scratch engine: a sim.Creature (emergent physics) + renderer
// nodes. Legs are drawn from each hip to the live foot position the sim computes,
// so what you see is exactly what's being simulated — wobble and all.
import { Creature } from "./sim.js";
import { Q, V } from "./math3.js";

export function defaultGenome(name = "My Zook") {
  return {
    name, color: "#46c7ff",
    body: { w: 1.3, h: 0.55, l: 1.9, mass: 6 },
    legCount: 4, leg: { len: 0.95, radius: 0.16 },
    gait: { freq: 2.2, amplitude: 0.8, drive: 12, jump: 0, steer: 0 },
    records: {},
  };
}

function quatFromTo(a, b) {            // rotate unit a onto unit b
  const d = V.dot(a, b);
  if (d > 0.9999) return [0, 0, 0, 1];
  if (d < -0.9999) return [1, 0, 0, 0];
  return Q.fromAxis(V.norm(V.cross(a, b)), Math.acos(Math.max(-1, Math.min(1, d))));
}

export class Zook3 {
  constructor(genome, renderer, { x = 0, z = 0, yaw = 0, tint = null } = {}) {
    this.g = genome; this.r = renderer; this.color = tint || genome.color;
    this.sim = new Creature(genome); this.sim.reset(x, z, yaw);
    this.bodyNode = renderer.add("box", this.color, [genome.body.w / 2, genome.body.h / 2, genome.body.l / 2]);
    this.eyeNode = renderer.add("sphere", "#16181d", [0.12, 0.12, 0.12]);
    this.legNodes = this.sim.legs.map(() => renderer.add("box", shade(this.color), [genome.leg.radius, 0.1, genome.leg.radius]));
    this.nodes = [this.bodyNode, this.eyeNode, ...this.legNodes];
    this.sim.step(0.0001); this.sync();
  }
  get object() { return this.bodyNode; }
  position() { return this.sim.pos; }
  height() { return this.sim.pos[1]; }
  upright() { return this.sim.upright(); }
  setGoal(x, z) { this.sim.goal = [x, z]; }
  clearGoal() { this.sim.goal = null; }
  jump() { this.sim.jump(); }
  update(dt, idle = false) { this.sim.idle = idle; this.sim.step(dt); this.sync(); }

  sync() {
    const s = this.sim, g = this.g, q = s.quat;
    this.bodyNode.pos = s.pos.slice(); this.bodyNode.quat = q;
    this.eyeNode.pos = V.add(s.pos, Q.rot(q, [0, g.body.h * 0.18, g.body.l * 0.5])); this.eyeNode.quat = q;
    const feet = s.feet || [];
    for (let i = 0; i < this.legNodes.length; i++) {
      const hipW = V.add(s.pos, Q.rot(q, s.legs[i].hip));
      const footW = feet[i] || hipW;
      const seg = V.sub(footW, hipW);
      const len = Math.max(0.05, V.len(seg));
      const n = this.legNodes[i];
      n.pos = V.scale(V.add(hipW, footW), 0.5);
      n.quat = quatFromTo([0, 1, 0], V.scale(seg, 1 / len));
      n.scale = [g.leg.radius, len / 2, g.leg.radius];
    }
  }
  dispose() { for (const n of this.nodes) this.r.remove(n); this.nodes = []; }
}

function shade(hex) {
  const h = hex.replace("#", "");
  const f = (i) => Math.max(0, Math.round(parseInt(h.slice(i, i + 2), 16) * 0.82)).toString(16).padStart(2, "0");
  return "#" + f(0) + f(2) + f(4);
}
