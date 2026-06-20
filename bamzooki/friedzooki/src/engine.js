// Rendering engine — Three.js scene, camera (orbit + follow modes), lights,
// the main loop, and AR camera-passthrough background support.
import * as THREE from "../vendor/three.module.js";
import { OrbitControls } from "./orbit.js";
import { skyTexture } from "./textures.js";

const SKY = 0xeef3ea;

export class Engine {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.scene = new THREE.Scene();
    this.skyColor = new THREE.Color(SKY);
    this.sky = skyTexture();
    this.scene.background = this.sky || this.skyColor;
    this.scene.fog = new THREE.Fog(SKY, 45, 140);

    this.camera = new THREE.PerspectiveCamera(55, 1, 0.05, 500);
    this.camera.position.set(7, 5, 10);

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.target.set(0, 1, 0);

    this.scene.add(new THREE.HemisphereLight(0xfff4e0, 0x9bbf86, 1.15));
    const sun = new THREE.DirectionalLight(0xfff6e8, 1.7);
    sun.position.set(10, 18, 8);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    const s = 30;
    sun.shadow.camera.left = -s; sun.shadow.camera.right = s;
    sun.shadow.camera.top = s; sun.shadow.camera.bottom = -s;
    sun.shadow.camera.far = 80;
    this.scene.add(sun);
    this.sun = sun;

    this.follow = null;          // { obj, offset } or null
    this.ar = { active: false, targetObj: null, radius: 9, theta: 0, phi: 1.15 };
    this._cb = null;
    this._last = performance.now();
    this._lw = 0; this._lh = 0;
    this._tmp = new THREE.Vector3();
    requestAnimationFrame(this._loop.bind(this));
  }

  onFrame(cb) { this._cb = cb; }

  setFollow(obj, offset = new THREE.Vector3(0, 5, -10)) {
    this.follow = obj ? { obj, offset } : null;
    this.controls.enabled = !obj;
  }

  setOrbit(target = new THREE.Vector3(0, 1, 0)) {
    this.follow = null;
    this.controls.enabled = true;
    this.controls.target.copy(target);
  }

  /** AR: make the WebGL background transparent so the camera <video> shows through. */
  setTransparent(on) {
    this.renderer.setClearAlpha(on ? 0 : 1);
    this.scene.background = on ? null : this.skyColor;
    this.scene.fog = on ? null : new THREE.Fog(0x0b0e14, 40, 120);
  }

  /** Enter AR camera mode: orbit the live-tracked target via device orientation. */
  enableAR(targetObj, radius = 9) {
    this.ar.active = true; this.ar.targetObj = targetObj; this.ar.radius = radius;
    this.controls.enabled = false; this.follow = null;
  }
  disableAR() { this.ar.active = false; }
  setARView(theta, phi) {
    this.ar.theta = theta;
    this.ar.phi = Math.max(0.25, Math.min(1.5, phi));
  }

  _resize() {
    const c = this.canvas;
    const w = c.clientWidth, h = c.clientHeight;
    if (w !== this._lw || h !== this._lh) {
      this._lw = w; this._lh = h;
      this.renderer.setSize(w, h, false);
      this.camera.aspect = w / Math.max(1, h);
      this.camera.updateProjectionMatrix();
    }
  }

  _loop(now) {
    requestAnimationFrame(this._loop.bind(this));
    const dt = Math.min(0.05, (now - this._last) / 1000);
    this._last = now;
    this._resize();
    if (this._cb) this._cb(dt, now / 1000);

    if (this.ar.active) {
      // Orbit the (moving) target at a fixed radius; angles come from the phone's
      // orientation, so the creature stays framed as you move the device around it.
      const t = this.ar.targetObj ? this.ar.targetObj.position : this._tmp.set(0, 0, 0);
      const { radius: r, theta, phi } = this.ar;
      this._tmp.set(
        t.x + r * Math.sin(phi) * Math.sin(theta),
        Math.max(0.5, t.y + r * Math.cos(phi)),
        t.z + r * Math.sin(phi) * Math.cos(theta),
      );
      this.camera.position.lerp(this._tmp, 0.2);
      this.camera.lookAt(t.x, t.y + 0.5, t.z);
    } else if (this.follow) {
      const { obj, offset } = this.follow;
      this._tmp.copy(offset).applyQuaternion(obj.quaternion).add(obj.position);
      this.camera.position.lerp(this._tmp, 0.08);
      this.camera.lookAt(obj.position.x, obj.position.y + 0.8, obj.position.z);
    } else {
      this.controls.update();
    }
    this.renderer.render(this.scene, this.camera);
  }
}
