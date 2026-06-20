// A Zook built on the from-scratch engine: a sim.Creature for motion + renderer
// nodes for the body and animated legs. No three.js, no Rapier.
import { Creature } from "./sim.js";
import { Q, V } from "./math3.js";

export function defaultGenome(name = "My Zook") {
  return {
    name, color: "#46c7ff",
    body: { w: 1.3, h: 0.55, l: 1.9, mass: 6 },
    legCount: 4, leg: { len: 0.95, radius: 0.18 },
    gait: { freq: 2.2, amplitude: 0.8, drive: 12, jump: 0, steer: 0 },
    records: {},
  };
}

function legHips(g) {
  const n = Math.max(2, Math.min(8, g.legCount | 0)), rows = Math.ceil(n / 2), out = [];
  for (let i = 0; i < n; i++) {
    const side = i % 2 === 0 ? -1 : 1, row = (i / 2) | 0;
    const z = rows === 1 ? 0 : (g.body.l / 2 - 0.25) - (row / (rows - 1)) * (g.body.l - 0.5);
    out.push({ x: side * g.body.w / 2, z, phase: ((side < 0 ? 0 : Math.PI) + row * Math.PI) });
  }
  return out;
}

export class Zook3 {
  constructor(genome, renderer, { x = 0, z = 0, yaw = 0, tint = null } = {}) {
    this.g = genome; this.r = renderer; this.color = tint || genome.color;
    this.sim = new Creature(genome); this.sim.reset(x, z, yaw);
    this.bodyNode = renderer.add("box", this.color, [genome.body.w / 2, genome.body.h / 2, genome.body.l / 2]);
    this.eyeNode = renderer.add("sphere", "#1c1c1c", [0.11, 0.11, 0.11]);
    this.legNodes = legHips(genome).map((h) => ({
      hip: h, node: renderer.add("box", this.color, [genome.leg.radius, genome.leg.len / 2, genome.leg.radius]),
    }));
    this.nodes = [this.bodyNode, this.eyeNode, ...this.legNodes.map((l) => l.node)];
    this.sync();
  }
  get object() { return this.bodyNode; }
  position() { return this.sim.pos; }
  height() { return this.sim.pos[1]; }
  setGoal(x, z) { this.sim.goal = [x, z]; }
  clearGoal() { this.sim.goal = null; }
  jump() { this.sim.jump(); }

  update(dt, idle = false) { this.sim.idle = idle; this.sim.step(dt); this.sync(); }

  sync() {
    const s = this.sim, g = this.g, yawQ = Q.fromYaw(s.yaw);
    // body
    this.bodyNode.pos = s.pos.slice(); this.bodyNode.quat = yawQ;
    // eye (front-top of body)
    const eo = Q.rot(yawQ, [0, g.body.h * 0.2, g.body.l * 0.5]);
    this.eyeNode.pos = V.add(s.pos, eo); this.eyeNode.quat = yawQ;
    // legs: from each hip, swing fore-aft by the gait phase
    const L = g.leg.len;
    for (const l of this.legNodes) {
      const swing = (g.gait.amplitude || 0.6) * Math.sin(s.phase + l.hip.phase);
      const legQ = Q.mul(yawQ, Q.fromAxis([1, 0, 0], swing));
      const hipLocal = [l.hip.x, -g.body.h / 2, l.hip.z];
      const hipWorld = V.add(s.pos, Q.rot(yawQ, hipLocal));
      const down = Q.rot(legQ, [0, -L / 2, 0]);
      l.node.pos = V.add(hipWorld, down);
      l.node.quat = legQ;
    }
  }
  dispose() { for (const n of this.nodes) this.r.remove(n); this.nodes = []; }
}
