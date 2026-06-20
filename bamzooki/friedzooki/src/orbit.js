// Minimal orbit camera control — a tiny self-contained replacement for three's
// OrbitControls, so the app needs no addon and no import map. One-finger / mouse
// drag rotates; wheel or two-finger pinch zooms. Damped.
import * as THREE from "../vendor/three.module.js";

export class OrbitControls {
  constructor(camera, dom) {
    this.camera = camera;
    this.dom = dom;
    this.target = new THREE.Vector3(0, 1, 0);
    this.enabled = true;
    this.enableDamping = true;
    this.touches = {};
    this.minR = 3; this.maxR = 60;

    const off = new THREE.Vector3().copy(camera.position).sub(this.target);
    const sph = new THREE.Spherical().setFromVector3(off);
    this.theta = sph.theta; this.phi = sph.phi; this.radius = sph.radius;
    this._tt = this.theta; this._tp = this.phi; this._tr = this.radius;

    this._ptrs = new Map();
    this._pinch = 0;
    dom.addEventListener("pointerdown", (e) => this._down(e));
    dom.addEventListener("pointermove", (e) => this._move(e));
    window.addEventListener("pointerup", (e) => this._up(e));
    window.addEventListener("pointercancel", (e) => this._up(e));
    dom.addEventListener("wheel", (e) => { if (this.enabled) { this._tr = clamp(this._tr * (1 + Math.sign(e.deltaY) * 0.1), this.minR, this.maxR); e.preventDefault(); } }, { passive: false });
  }

  _down(e) { if (!this.enabled) return; this._ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY }); if (this._ptrs.size === 2) this._pinch = this._dist(); }
  _up(e) { this._ptrs.delete(e.pointerId); if (this._ptrs.size < 2) this._pinch = 0; }
  _dist() { const p = [...this._ptrs.values()]; return Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y); }
  _move(e) {
    if (!this.enabled || !this._ptrs.has(e.pointerId)) return;
    const prev = this._ptrs.get(e.pointerId);
    const dx = e.clientX - prev.x, dy = e.clientY - prev.y;
    this._ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this._ptrs.size === 2) {
      const d = this._dist();
      if (this._pinch) this._tr = clamp(this._tr * (this._pinch / d), this.minR, this.maxR);
      this._pinch = d;
    } else {
      this._tt -= dx * 0.005;
      this._tp = clamp(this._tp - dy * 0.005, 0.2, Math.PI - 0.2);
    }
  }

  update() {
    const k = this.enableDamping ? 0.18 : 1;
    this.theta += (this._tt - this.theta) * k;
    this.phi += (this._tp - this.phi) * k;
    this.radius += (this._tr - this.radius) * k;
    const off = new THREE.Vector3().setFromSpherical(new THREE.Spherical(this.radius, this.phi, this.theta));
    this.camera.position.copy(this.target).add(off);
    this.camera.lookAt(this.target);
  }
}
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
