// Physics layer — thin wrapper over the Rapier 3D engine.
// Real rigid bodies, colliders, and motorised revolute joints (the "muscles"
// that drive a Zook's legs).
import RAPIER from "@dimforge/rapier3d-compat";

let _ready = false;

/** Load the Rapier WASM once. Must be awaited before any world is created. */
export async function initPhysics() {
  if (!_ready) {
    await RAPIER.init();
    _ready = true;
  }
  return RAPIER;
}

/** A fresh world with Earth gravity. */
export function createWorld() {
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  world.integrationParameters.numSolverIterations = 8;
  return world;
}

export { RAPIER };
