// From-scratch EMERGENT physics — the BAMZOOKi feel. A Zook is a rigid body whose
// legs plant on the ground and spring it along, producing real torque, wobble and
// the occasional tumble. A gentle self-righting keeps it mostly upright — but a bad
// design, a shove or rough luck can tip it. No three.js, no Rapier.
import { V, Q } from "./math3.js";

const G = 16;
// Tunables (found by the headless sweep in tools).
export const TUNE = {
  legK: 26,        // foot spring stiffness (×mass) — how hard legs push
  legDamp: 4.0,    // foot velocity damping
  band: 0.16,      // foot is "planted" below this height
  rightK: 16,      // self-righting strength
  angDamp: 0.90,   // angular-velocity damping per step (prevents spin-out)
  linDamp: 0.995,  // linear damping per step
  steerK: 5.0,     // yaw torque toward goal
  invI: 1.6,       // angular responsiveness (÷mass)
  maxF: 70,        // per-leg force cap (×mass)
};

function legLayout(g) {
  const n = Math.max(2, Math.min(8, g.legCount | 0)), rows = Math.ceil(n / 2), out = [];
  for (let i = 0; i < n; i++) {
    const side = i % 2 === 0 ? -1 : 1, row = (i / 2) | 0;
    const z = rows === 1 ? 0 : (g.body.l / 2 - 0.25) - (row / (rows - 1)) * (g.body.l - 0.5);
    out.push({ hip: [side * g.body.w / 2, -g.body.h / 2, z], phase: (side < 0 ? 0 : Math.PI) + row * Math.PI, anchor: null });
  }
  return out;
}

export class Creature {
  constructor(genome) { this.set(genome); this.reset(); }
  set(g) {
    this.g = g; this.mass = g.body.mass;
    this.H = g.body.h / 2 + g.leg.len;            // nominal standing height
    this.r = Math.max(g.body.w, g.body.l) / 2 + 0.1;
    this.minY = g.body.h / 2 + 0.05;              // body can't sink below this
    this.legs = legLayout(g);
    this.legLen = g.leg.len;
    this.power = 0.6 + g.gait.drive * 0.14;        // muscle power scales leg push
  }
  reset(x = 0, z = 0, yaw = 0) {
    this.pos = [x, this.H, z]; this.vel = [0, 0, 0];
    this.quat = Q.fromYaw(yaw); this.angVel = [0, 0, 0];
    this.phase = Math.random() * 6.28; this.goal = null; this.idle = false;
    for (const l of this.legs) l.anchor = null;
  }
  up() { return Q.rot(this.quat, [0, 1, 0]); }
  forward() { return Q.rot(this.quat, [0, 0, 1]); }

  step(dt) {
    const g = this.g, q = this.quat, pos = this.pos, m = this.mass;
    this.phase += dt * g.gait.freq * 6.2832 * (this.idle ? 0.25 : 1);
    const amp = (g.gait.amplitude || 0.7);

    let F = [0, -G * m, 0], T = [0, 0, 0];
    const feet = [];   // world foot positions, for rendering

    // legs: a cycloid gait — foot plants & pushes BACK during stance (propels the
    // body forward), then lifts & swings FORWARD during the return. The offset
    // foot forces create the emergent torque/wobble.
    const stride = amp * this.legLen * 0.7, liftA = this.legLen * 0.38;
    for (const leg of this.legs) {
      const th = this.phase + leg.phase;
      const lift = Math.max(0, -Math.sin(th)) * liftA;          // lift only on the return
      const footLocal = [leg.hip[0], leg.hip[1] - this.legLen + lift, leg.hip[2] + stride * Math.cos(th)];
      const footW = V.add(pos, Q.rot(q, footLocal));
      feet.push(footW);
      if (footW[1] < TUNE.band) {
        if (!leg.anchor) leg.anchor = [footW[0], 0, footW[2]];
        const r = V.sub(footW, pos);
        const footVel = V.add(this.vel, V.cross(this.angVel, r));
        let legF = V.add(
          V.scale(V.sub(leg.anchor, footW), TUNE.legK * m * this.power),
          V.scale(footVel, -TUNE.legDamp * m));
        const fm = V.len(legF), cap = TUNE.maxF * m;
        if (fm > cap) legF = V.scale(legF, cap / fm);
        F = V.add(F, legF);
        T = V.add(T, V.cross(r, legF));
      } else leg.anchor = null;
    }
    this.feet = feet;

    // self-righting (gentle — can be overcome → tumble) + angular damping
    const up = this.up();
    T = V.add(T, V.scale(V.cross(up, [0, 1, 0]), TUNE.rightK * m));

    // steer yaw toward goal / forward heading
    let dx, dz;
    if (this.goal) { dx = this.goal[0] - pos[0]; dz = this.goal[1] - pos[2]; }
    else { const f = this.forward(); dx = f[0]; dz = f[2]; }
    const dm = Math.hypot(dx, dz) || 1; dx /= dm; dz /= dm;
    const fwd = this.forward();
    let yawErr = Math.atan2(dx, dz) - Math.atan2(fwd[0], fwd[2]);
    while (yawErr > Math.PI) yawErr -= 6.2832; while (yawErr < -Math.PI) yawErr += 6.2832;
    T = V.add(T, [0, (yawErr * TUNE.steerK + (g.gait.steer || 0)) * m, 0]);

    // integrate linear
    this.vel = V.add(this.vel, V.scale(F, dt / m));
    this.vel = V.scale(this.vel, TUNE.linDamp);
    this.pos = V.add(pos, V.scale(this.vel, dt));

    // integrate angular
    this.angVel = V.add(this.angVel, V.scale(T, dt * TUNE.invI / m));
    this.angVel = V.scale(this.angVel, TUNE.angDamp);
    const wq = [this.angVel[0], this.angVel[1], this.angVel[2], 0];
    const dq = Q.mul(wq, q);
    const nq = [q[0] + 0.5 * dq[0] * dt, q[1] + 0.5 * dq[1] * dt, q[2] + 0.5 * dq[2] * dt, q[3] + 0.5 * dq[3] * dt];
    const ql = Math.hypot(nq[0], nq[1], nq[2], nq[3]) || 1;
    this.quat = [nq[0] / ql, nq[1] / ql, nq[2] / ql, nq[3] / ql];

    // floor for the body centre
    if (this.pos[1] < this.minY) { this.pos[1] = this.minY; if (this.vel[1] < 0) this.vel[1] = 0; }
  }
  jump() { this.vel[1] += Math.max(0, this.g.gait.jump) * 1.3; }
  upright() { return this.up()[1]; }   // 1 = perfectly upright, <0 = fallen
}

/* ---- obstacle bodies (ball / block / bar) ---- */
export class Body {
  constructor(kind, pos, half, mass) { this.kind = kind; this.pos = pos.slice(); this.vel = [0, 0, 0]; this.half = half; this.mass = mass; this.rest = half[1]; }
  step(dt) {
    this.vel[1] -= G * dt;
    for (let i = 0; i < 3; i++) this.pos[i] += this.vel[i] * dt;
    if (this.pos[1] <= this.rest) { this.pos[1] = this.rest; this.vel[1] = 0; }
    this.vel[0] *= (1 - Math.min(1, dt * 2)); this.vel[2] *= (1 - Math.min(1, dt * 2));
  }
}
export function pushBody(c, b, dt) {
  const dx = b.pos[0] - c.pos[0], dz = b.pos[2] - c.pos[2], dist = Math.hypot(dx, dz) || 1;
  if (dist < c.r + Math.max(b.half[0], b.half[2]) && Math.abs(b.pos[1] - c.pos[1]) < c.H + b.half[1]) {
    const nx = dx / dist, nz = dz / dist, sp = Math.hypot(c.vel[0], c.vel[2]);
    const force = (sp + 1.5) * (6 / b.mass);
    b.vel[0] += nx * force * dt * 10; b.vel[2] += nz * force * dt * 10;
    return true;
  }
  return false;
}
export function shove(a, b) {
  const dx = b.pos[0] - a.pos[0], dz = b.pos[2] - a.pos[2], dist = Math.hypot(dx, dz) || 1;
  if (dist < a.r + b.r) {
    const nx = dx / dist, nz = dz / dist, overlap = (a.r + b.r) - dist, tot = a.power + b.power;
    a.pos[0] -= nx * overlap * (b.power / tot); a.pos[2] -= nz * overlap * (b.power / tot);
    b.pos[0] += nx * overlap * (a.power / tot); b.pos[2] += nz * overlap * (a.power / tot);
  }
}
