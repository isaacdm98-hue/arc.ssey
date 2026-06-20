// Arena helpers — build the ground and event obstacles as paired Three meshes
// and Rapier colliders. Everything an Arena creates is removed on dispose().
import * as THREE from "../vendor/three.module.js";
import { RAPIER } from "./physics.js";
import { sketchMaterial, paperTexture } from "./textures.js";

export class Arena {
  constructor(world, scene) {
    this.world = world;
    this.scene = scene;
    this.bodies = [];
    this.objects = [];
  }

  _mat(color) { return sketchMaterial(color); }

  _add(mesh) { this.scene.add(mesh); this.objects.push(mesh); return mesh; }

  /** Big flat floor at y=0, with a hand-drawn paper texture. */
  ground(color = 0x7fae7a, size = 200) {
    const desc = RAPIER.RigidBodyDesc.fixed();
    const body = this.world.createRigidBody(desc);
    this.world.createCollider(RAPIER.ColliderDesc.cuboid(size / 2, 0.5, size / 2).setFriction(1.2)
      .setTranslation(0, -0.5, 0), body);
    this.bodies.push(body);
    const map = paperTexture(new THREE.Color(color).getStyle());
    const mat = map ? new THREE.MeshToonMaterial({ map }) : new THREE.MeshStandardMaterial({ color, roughness: 0.95 });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size, size).rotateX(-Math.PI / 2), mat);
    mesh.receiveShadow = true;
    this._add(mesh);
    return this;
  }

  /** A static box obstacle / platform. */
  box(x, y, z, hx, hy, hz, color = 0x3a5070) {
    const body = this.world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(x, y, z));
    this.world.createCollider(RAPIER.ColliderDesc.cuboid(hx, hy, hz).setFriction(1.0), body);
    this.bodies.push(body);
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(hx * 2, hy * 2, hz * 2), this._mat(color));
    mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true;
    this._add(mesh);
    return mesh;
  }

  /** A free dynamic block (Block Push target). */
  dynamicBox(x, y, z, size, mass, color = 0xffb454) {
    const body = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic().setTranslation(x, y, z).setLinearDamping(0.4).setAngularDamping(0.6));
    this.world.createCollider(
      RAPIER.ColliderDesc.cuboid(size, size, size).setDensity(mass / (8 * size ** 3)).setFriction(0.7), body);
    this.bodies.push(body);
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(size * 2, size * 2, size * 2), this._mat(color, { metalness: 0.2 }));
    mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true;
    this._add(mesh);
    return { body, mesh };
  }

  /** A light dynamic bar (a hurdle) that topples when a Zook bowls through it. */
  dynamicBar(x, y, z, hx, hy, hz, mass, color = 0xff5470) {
    const body = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic().setTranslation(x, y, z).setAngularDamping(0.3));
    this.world.createCollider(
      RAPIER.ColliderDesc.cuboid(hx, hy, hz).setDensity(mass / (8 * hx * hy * hz)).setFriction(0.5), body);
    this.bodies.push(body);
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(hx * 2, hy * 2, hz * 2), this._mat(color, { metalness: 0.1 }));
    mesh.position.set(x, y, z); mesh.castShadow = true;
    this._add(mesh);
    return { body, mesh };
  }

  /** A dynamic ball (Football). */
  sphere(x, y, z, r, mass, color = 0xf2f2f2) {
    const body = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic().setTranslation(x, y, z).setLinearDamping(0.5).setAngularDamping(0.4));
    this.world.createCollider(
      RAPIER.ColliderDesc.ball(r).setDensity(mass / ((4 / 3) * Math.PI * r ** 3)).setFriction(0.6).setRestitution(0.4), body);
    this.bodies.push(body);
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(r, 18, 14), this._mat(color));
    mesh.position.set(x, y, z); mesh.castShadow = true;
    this._add(mesh);
    return { body, mesh };
  }

  /** A static ramp (a slab tilted about X), used by the Assault Course. */
  ramp(x, y, z, w, len, angle, color = 0x9d6bff) {
    const q = { x: Math.sin(angle / 2), y: 0, z: 0, w: Math.cos(angle / 2) };
    const body = this.world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(x, y, z).setRotation(q));
    this.world.createCollider(RAPIER.ColliderDesc.cuboid(w / 2, 0.12, len / 2).setFriction(1.0), body);
    this.bodies.push(body);
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, 0.24, len), this._mat(color));
    mesh.position.set(x, y, z); mesh.quaternion.set(q.x, q.y, q.z, q.w);
    mesh.castShadow = true; mesh.receiveShadow = true;
    this._add(mesh);
    return mesh;
  }

  /** A flat ring marker on the ground (Sumo arena edge), no collider. */
  ring(radius, color = 0xff7a59) {
    const mesh = new THREE.Mesh(new THREE.RingGeometry(radius - 0.25, radius, 48).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }));
    mesh.position.y = 0.02;
    this._add(mesh);
    return mesh;
  }

  /** A goal frame (two posts + crossbar) at z, returns nothing (visual + posts). */
  goal(z, halfWidth = 3, color = 0x46c7ff) {
    this.box(-halfWidth, 0.9, z, 0.12, 0.9, 0.12, color);
    this.box(halfWidth, 0.9, z, 0.12, 0.9, 0.12, color);
    this.box(0, 1.85, z, halfWidth + 0.12, 0.12, 0.12, color);
    this.line(z, color, halfWidth * 2);
  }

  /** A coloured visual strip on the ground (start/finish lines), no collider. */
  line(z, color = 0x46c7ff, width = 14) {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, 0.4).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color }));
    mesh.position.set(0, 0.02, z);
    this._add(mesh);
    return mesh;
  }

  /** A high-jump / hurdle bar (thin static box you must clear). */
  bar(z, height, color = 0xff5470, width = 6) {
    return this.box(0, height, z, width / 2, 0.06, 0.06, color);
  }

  dispose() {
    for (const b of this.bodies) { try { this.world.removeRigidBody(b); } catch (_) {} }
    for (const o of this.objects) {
      this.scene.remove(o);
      o.geometry?.dispose?.();
      if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose()); else o.material?.dispose?.();
    }
    this.bodies = []; this.objects = [];
  }
}
