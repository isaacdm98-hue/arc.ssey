// From-scratch physics — no Rapier. A kinematic creature controller (always
// upright, reliable) plus simple dynamic obstacle bodies (boxes, a ball) with
// ground + push collision. Enough for the trials; fully deterministic & testable.
const G = 18;

export class Creature {
  constructor(genome) { this.set(genome); this.reset(); }
  set(g) {
    this.g = g;
    this.H = g.body.h / 2 + g.leg.len;          // ride height (centre of body)
    this.speed = g.gait.drive * 0.34;           // m/s top speed
    this.jumpV = Math.max(0, g.gait.jump) * 1.1; // launch velocity
    this.turn = 6;                               // rad/s yaw rate
    this.r = Math.max(g.body.w, g.body.l) / 2 + 0.1; // collision radius
  }
  reset(x = 0, z = 0, yaw = 0) {
    this.pos = [x, this.H, z]; this.vel = [0, 0, 0]; this.yaw = yaw;
    this.onGround = true; this.phase = 0; this.goal = null; this.idle = false;
  }
  forward() { return [Math.sin(this.yaw), 0, Math.cos(this.yaw)]; }

  step(dt) {
    const g = this.g;
    // desired heading
    let dx, dz;
    if (this.goal) { dx = this.goal[0] - this.pos[0]; dz = this.goal[1] - this.pos[2]; }
    else { const f = this.forward(); dx = f[0]; dz = f[2]; }
    const m = Math.hypot(dx, dz) || 1; dx /= m; dz /= m;

    // turn yaw toward heading
    const want = Math.atan2(dx, dz);
    let d = want - this.yaw; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
    this.yaw += Math.max(-this.turn * dt, Math.min(this.turn * dt, d));
    this.yaw += (g.gait.steer || 0) * dt * 0.4;

    // horizontal velocity toward facing, scaled by drive
    const target = this.idle ? 0 : this.speed;
    const f = this.forward();
    const desired = [f[0] * target, f[2] * target];
    this.vel[0] += (desired[0] - this.vel[0]) * Math.min(1, dt * 6);
    this.vel[2] += (desired[1] - this.vel[2]) * Math.min(1, dt * 6);

    // gravity + integrate
    this.vel[1] -= G * dt;
    this.pos[0] += this.vel[0] * dt; this.pos[1] += this.vel[1] * dt; this.pos[2] += this.vel[2] * dt;
    if (this.pos[1] <= this.H) { this.pos[1] = this.H; this.vel[1] = 0; this.onGround = true; } else this.onGround = false;

    // gait phase advances with speed (drives leg animation)
    const sp = Math.hypot(this.vel[0], this.vel[2]);
    this.phase += dt * (1.5 + sp * 1.6) * g.gait.freq;
  }
  jump() { if (this.onGround) { this.vel[1] = this.jumpV; this.onGround = false; } }
}

export class Body {
  constructor(kind, pos, half, mass) { this.kind = kind; this.pos = pos.slice(); this.vel = [0, 0, 0]; this.half = half; this.mass = mass; this.rest = half[1]; this.fallen = 0; }
  step(dt) {
    this.vel[1] -= G * dt;
    for (let i = 0; i < 3; i++) this.pos[i] += this.vel[i] * dt;
    if (this.pos[1] <= this.rest) { this.pos[1] = this.rest; this.vel[1] = 0; }
    // horizontal drag
    this.vel[0] *= (1 - Math.min(1, dt * 2)); this.vel[2] *= (1 - Math.min(1, dt * 2));
  }
}

/** Push a dynamic body if the creature overlaps it (capsule-vs-box, simplified). */
export function pushBody(c, b, dt) {
  const dx = b.pos[0] - c.pos[0], dz = b.pos[2] - c.pos[2];
  const dist = Math.hypot(dx, dz) || 1;
  const reach = c.r + Math.max(b.half[0], b.half[2]);
  if (dist < reach && Math.abs(b.pos[1] - c.pos[1]) < c.H + b.half[1]) {
    const nx = dx / dist, nz = dz / dist;
    const sp = Math.hypot(c.vel[0], c.vel[2]);
    const force = (sp + 1.5) * (6 / b.mass);
    b.vel[0] += nx * force * dt * 10; b.vel[2] += nz * force * dt * 10;
    return true;
  }
  return false;
}

/** Resolve creature-vs-creature shove (Sumo). Stronger drive wins ground. */
export function shove(a, b, dt) {
  const dx = b.pos[0] - a.pos[0], dz = b.pos[2] - a.pos[2];
  const dist = Math.hypot(dx, dz) || 1;
  if (dist < a.r + b.r) {
    const nx = dx / dist, nz = dz / dist, overlap = (a.r + b.r) - dist;
    const pa = a.speed, pb = b.speed, tot = pa + pb;
    a.pos[0] -= nx * overlap * (pb / tot); a.pos[2] -= nz * overlap * (pb / tot);
    b.pos[0] += nx * overlap * (pa / tot); b.pos[2] += nz * overlap * (pa / tot);
  }
}
