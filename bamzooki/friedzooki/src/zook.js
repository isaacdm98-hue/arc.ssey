// The Zook — an autonomous creature built from 3D primitives. Modelled as a
// single driven rigid body (reliable, controllable racing physics) with legs
// that animate over it for life. The genome (size, mass, leg count/length,
// gait speed, muscle power, jump, steer) shapes how it races, jumps and pushes.
import * as THREE from "../vendor/three.module.js";
import { RAPIER } from "./physics.js";
import { sketchMaterial } from "./textures.js";

/** A fresh, sensible default genome: a four-legged trotter. */
export function defaultGenome(name = "Newzook") {
  return {
    name,
    color: "#46c7ff",
    body: { w: 1.3, h: 0.55, l: 1.9, mass: 6 },
    legCount: 4,
    leg: { len: 0.95, radius: 0.16 },
    gait: { freq: 2.2, amplitude: 0.7, drive: 12, jump: 0, steer: 0 },
  };
}

// Locomotion tunables (set via the headless sweep in /tmp tooling).
export const TUNE = {
  BODY_FRICTION: 0.35,  // body slides under muscle drive but keeps some grip
  DRIVE_CAP: 16,        // max forward force = DRIVE_CAP * mass
  SPEED_K: 0.34,        // target forward speed = gait.drive * SPEED_K (m/s)
  BALANCE_K: 11,        // uprighting stiffness
  BALANCE_D: 2.0,       // uprighting damping
};

/** Leg hip positions + diagonal-trot phases for a given leg count. */
function legLayout(genome) {
  const { w, l } = genome.body;
  const n = Math.max(2, Math.min(8, genome.legCount | 0));
  const legs = [];
  const rows = Math.ceil(n / 2);
  for (let i = 0; i < n; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    const row = Math.floor(i / 2);
    const z = rows === 1 ? 0 : (l * 0.5 - 0.3) - (row / (rows - 1)) * (l - 0.6);
    const phase = ((side < 0 ? 0 : Math.PI) + row * Math.PI) % (2 * Math.PI);
    legs.push({ x: side * (w * 0.5), z, phase });
  }
  return legs;
}

const _q = new THREE.Quaternion();
const _fwd = new THREE.Vector3();
const _up = new THREE.Vector3();

export class Zook {
  constructor(genome, world, scene, { x = 0, y = null, z = 0, heading = 0, tint = null, solid = false } = {}) {
    this.solid = solid;   // Sumo: Zooks must physically push each other
    this.genome = genome;
    this.world = world;
    this.scene = scene;
    this.color = tint || genome.color;
    // Bounding half-height of the standing creature (body + legs).
    this.H = (genome.body.h + genome.leg.len) / 2;
    this.start = { x, y: y ?? this.H + 0.05, z, heading };
    this.group = new THREE.Group();
    scene.add(this.group);
    this.object = this.group;
    this.legPivots = [];
    this._jumpArmed = true;
    this.goal = null;   // {x,z} world point to seek, or null = go straight
    this._build(this.start.x, this.start.y, this.start.z, heading);
  }

  _mat(color) { return sketchMaterial(color); }

  _build(x, y, z, heading) {
    const g = this.genome;
    const H = this.H;
    const yaw = { x: 0, y: Math.sin(heading / 2), z: 0, w: Math.cos(heading / 2) };

    // Single dynamic body whose collider bounds the whole standing creature.
    const desc = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(x, y, z).setRotation(yaw)
      .setLinearDamping(0.1).setAngularDamping(3.5).setCcdEnabled(true);
    this.body = this.world.createRigidBody(desc);
    const vol = g.body.w * (2 * H) * g.body.l;
    const col = RAPIER.ColliderDesc.cuboid(g.body.w / 2, H, g.body.l / 2)
      .setDensity(g.body.mass / vol).setFriction(TUNE.BODY_FRICTION)
      // Default: collide with everything except other Zooks (no race pile-ups).
      // Solid (Sumo): collide with everything, so Zooks can shove each other.
      .setCollisionGroups(this.solid ? 0xffffffff : 0x0002fffd);
    this.world.createCollider(col, this.body);

    // --- visuals (children of the group, which tracks the body) ---
    const mat = this._mat(this.color);
    const body = new THREE.Mesh(new THREE.BoxGeometry(g.body.w, g.body.h, g.body.l), mat);
    body.position.y = H - g.body.h / 2;           // body sits at the top of the bounds
    body.castShadow = true;
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 12), this._mat("#e6edf3"));
    eye.position.set(0, g.body.h * 0.15, g.body.l * 0.5);
    body.add(eye);
    this.group.add(body);

    const hipY = H - g.body.h;                     // legs hang from the body's underside
    for (const hip of legLayout(g)) {
      const pivot = new THREE.Group();
      pivot.position.set(hip.x, hipY, hip.z);
      const leg = new THREE.Mesh(
        new THREE.CapsuleGeometry(g.leg.radius, g.leg.len - 2 * g.leg.radius, 4, 10), mat);
      leg.position.y = -g.leg.len / 2;             // extend down from the pivot
      leg.castShadow = true;
      pivot.add(leg);
      this.group.add(pivot);
      this.legPivots.push({ pivot, phase: hip.phase });
    }
  }

  update(t, idle = false) {
    const { gait } = this.genome;
    const mass = this.genome.body.mass;
    const tb = this.body;

    const rot = tb.rotation();
    _q.set(rot.x, rot.y, rot.z, rot.w);
    _fwd.set(0, 0, 1).applyQuaternion(_q);
    _up.set(0, 1, 0).applyQuaternion(_q);

    // Rapier forces persist until reset — clear last frame first.
    tb.resetForces(true);
    tb.resetTorques(true);

    // Active balance (PD) keeps the body upright; yaw stays free for steering.
    const av = tb.angvel();
    tb.addTorque({
      x: (-_up.z) * TUNE.BALANCE_K * mass - av.x * TUNE.BALANCE_D * mass,
      y: 0,
      z: (_up.x) * TUNE.BALANCE_K * mass - av.z * TUNE.BALANCE_D * mass,
    }, true);

    const upright = Math.max(0, _up.y);
    const pos = tb.translation();
    const moveFactor = pos.y > this.H * 0.5 ? upright : 0;

    // Travel direction (xz): seek the goal if set, else go straight ahead.
    let dx, dz;
    if (this.goal) { dx = this.goal.x - pos.x; dz = this.goal.z - pos.z; }
    else { dx = _fwd.x; dz = _fwd.z; }
    const dm = Math.hypot(dx, dz) || 1; dx /= dm; dz /= dm;

    // Yaw the body to face travel direction (+ optional gait steer bias).
    const desired = Math.atan2(dx, dz);
    const current = Math.atan2(_fwd.x, _fwd.z);
    let dyaw = desired - current;
    while (dyaw > Math.PI) dyaw -= 2 * Math.PI;
    while (dyaw < -Math.PI) dyaw += 2 * Math.PI;
    dyaw = Math.max(-1, Math.min(1, dyaw));
    const steerBias = Math.max(-1.5, Math.min(1.5, gait.steer || 0));
    tb.addTorque({ x: 0, y: (dyaw * 1.4 + steerBias - av.y * 0.4) * mass, z: 0 }, true);

    // Forward muscle drive toward the travel direction: speed-targeted, capped.
    if (gait.drive && moveFactor > 0 && !idle) {
      const v = tb.linvel();
      const fwdSpeed = v.x * dx + v.z * dz;
      const accel = Math.max(0, gait.drive * TUNE.SPEED_K - fwdSpeed);
      const f = Math.min(accel * mass * 6, mass * TUNE.DRIVE_CAP) * moveFactor;
      tb.addForce({ x: dx * f, y: 0, z: dz * f }, true);
    }
    // Jump: a single spring per gait cycle, only when grounded (edge-triggered),
    // so it can't accumulate into an infinite launch. jump ≈ m/s of lift.
    if (gait.jump) {
      const phase = Math.sin(2 * Math.PI * gait.freq * t);
      const grounded = tb.translation().y < this.H + 0.12;
      if (phase > 0.95 && this._jumpArmed && grounded) {
        tb.applyImpulse({ x: 0, y: gait.jump * mass, z: 0 }, true);
        this._jumpArmed = false;
      } else if (phase < 0) {
        this._jumpArmed = true;            // re-arm once per cycle
      }
    }

    this.animateLegs(t);
  }

  /** Cosmetic leg swing — derived purely from the clock, so a networked client
   *  can animate legs locally without running physics. */
  animateLegs(t) {
    const g = this.genome.gait;
    for (const lp of this.legPivots)
      lp.pivot.rotation.x = (g.amplitude || 0.6) * Math.sin(2 * Math.PI * g.freq * t + lp.phase);
  }

  /** Apply a networked transform to the rendered group (client side). */
  setNetTransform(a) {
    this.group.position.set(a[0], a[1], a[2]);
    this.group.quaternion.set(a[3], a[4], a[5], a[6]);
  }

  /** Seek a world point; the drive/yaw in update() handles the rest. */
  steerToward(px, pz) { this.goal = { x: px, z: pz }; }
  setGoal(px, pz) { this.goal = { x: px, z: pz }; }
  clearGoal() { this.goal = null; }
  /** Manual drive: aim toward a heading vector (for the Free Roam joystick). */
  driveDir(dx, dz) { this.goal = { x: this.body.translation().x + dx * 50, z: this.body.translation().z + dz * 50 }; }
  /** Manual jump (Free Roam button) — only when grounded. */
  jump() {
    const m = this.genome.body.mass;
    if (this.body.translation().y < this.H + 0.15)
      this.body.applyImpulse({ x: 0, y: Math.max(6, this.genome.gait.jump || 6) * m, z: 0 }, true);
  }

  sync() {
    const p = this.body.translation();
    const r = this.body.rotation();
    this.group.position.set(p.x, p.y - this.H, p.z);   // group origin at the feet
    this.group.quaternion.set(r.x, r.y, r.z, r.w);
  }

  position() { return this.body.translation(); }
  heightOfTorso() { return this.body.translation().y; }

  dispose() {
    try { this.world.removeRigidBody(this.body); } catch (_) {}
    this.scene.remove(this.group);
    this.group.traverse((o) => { o.geometry?.dispose?.(); o.material?.dispose?.(); });
    this.alive = false;
  }
}
