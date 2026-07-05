// chase-cam rig (dossier §04/§05): critically-damped spring behind the ball, yaw
// auto-tracks velocity heading while rolling, manual orbit while parked, occlusion
// pulls the rig in along the look ray instead of clipping through geometry, peek
// flips to an overhead frame over 0.25s. No composer/bloom yet — render/fx.ts, later.
import * as THREE from 'three';
import * as RAPIER from '@dimforge/rapier3d-compat';
import { CFG } from './config';
import type { Sim, Vec3 } from './sim';

const YAW_TRACK_MIN_SPEED = 0.35; // below this the ball reads as "parked" for yaw purposes

// exact closed-form critically-damped spring (damping ratio 1, natural freq = omega):
// x(t) = (x0 + (v0 + omega*x0)*t) * e^-omega*t, x0 = current - target. No per-axis
// discretization blowup at low framerate the way a naive lerp-toward-target has.
function critSpring(x: number, v: number, target: number, omega: number, dt: number): [number, number] {
  const x0 = x - target;
  const decay = Math.exp(-omega * dt);
  const temp = (v + omega * x0) * dt;
  const nx = (x0 + temp) * decay + target;
  const nv = (v - omega * temp) * decay;
  return [nx, nv];
}

function wrapAngle(a: number): number {
  return Math.atan2(Math.sin(a), Math.cos(a));
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export class ChaseCamera {
  readonly camera: THREE.PerspectiveCamera;

  private px = 0; private py = CFG.cam.height; private pz = CFG.cam.dist;
  private vx = 0; private vy = 0; private vz = 0;
  // yaw π = looking down -z. matches the constructor position (+z side of the ball,
  // spawn faces the table) — yaw 0 here made the rig swing 180° around the ball
  // during the first second of boot and start play facing the void.
  private _yaw = Math.PI;
  private manualYaw = Math.PI;
  private wasMoving = false;
  private peekOn = false;
  private peekT = 0; // 0 = chase framing, 1 = fully overhead

  private rayOrigin = { x: 0, y: 0, z: 0 };
  private rayDir = { x: 0, y: 0, z: 0 };

  constructor(aspect: number) {
    this.camera = new THREE.PerspectiveCamera(58, aspect, 0.05, 60);
  }

  get yaw(): number { return this._yaw; }
  get peeking(): boolean { return this.peekOn; }

  setAspect(aspect: number): void {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  // manual orbit input (from input.ts's orbit callback, wired in main.ts) — a signed
  // yaw delta in radians, applied only while the ball is parked (see update()).
  orbit(dYaw: number): void {
    this.manualYaw += dYaw;
  }

  // 0.25s lerp to/from overhead, preserving yaw (dossier §05) — see peekT in update().
  peek(on: boolean): void {
    this.peekOn = on;
  }

  update(dt: number, ball: { pos: Vec3; vel: Vec3 }, sim: Sim): void {
    const speed = Math.hypot(ball.vel.x, ball.vel.z);
    const moving = speed > YAW_TRACK_MIN_SPEED;
    if (!moving && this.wasMoving) this.manualYaw = this._yaw; // seed orbit so resuming doesn't snap
    this.wasMoving = moving;

    if (moving) {
      const targetYaw = Math.atan2(ball.vel.x, ball.vel.z);
      const yawDiff = wrapAngle(targetYaw - this._yaw);
      this._yaw += yawDiff * Math.min(1, 1 - Math.exp(-CFG.cam.spring * dt));
    } else {
      // manual pan is 1:1 — no spring between the finger and the frame (field
      // report: parked panning "feels lagged... should not be any smoothing").
      this._yaw = wrapAngle(this.manualYaw);
      this.manualYaw = this._yaw; // keep the accumulator bounded
    }

    const fwdX = Math.sin(this._yaw), fwdZ = Math.cos(this._yaw);
    const desiredX = ball.pos.x - fwdX * CFG.cam.dist;
    const desiredY = ball.pos.y + CFG.cam.height;
    const desiredZ = ball.pos.z - fwdZ * CFG.cam.dist;

    if (moving) {
      [this.px, this.vx] = critSpring(this.px, this.vx, desiredX, CFG.cam.spring, dt);
      [this.py, this.vy] = critSpring(this.py, this.vy, desiredY, CFG.cam.spring, dt);
      [this.pz, this.vz] = critSpring(this.pz, this.vz, desiredZ, CFG.cam.spring, dt);
    } else {
      // parked: the rig is a tripod, not a boom — position derives rigidly from yaw
      // so orbiting tracks the finger exactly. The snap at the moving->parked
      // transition is sub-perceptual: spring lag at the 0.35 speed gate is ~v/omega
      // ≈ 0.06u, and manualYaw is seeded from _yaw at that same transition above.
      this.px = desiredX; this.py = desiredY; this.pz = desiredZ;
      this.vx = this.vy = this.vz = 0;
    }

    // look-ahead: bias toward where the ball is headed, falling back to facing
    // direction at rest. gated at the same speed as yaw tracking — below it the
    // velocity direction is settling noise and the look target would teleport
    // ±lookAhead every frame (the M0 field-report "camera spazz").
    let dirX = fwdX, dirZ = fwdZ;
    if (moving) { dirX = ball.vel.x / speed; dirZ = ball.vel.z / speed; }
    const lookX = ball.pos.x + dirX * CFG.cam.lookAhead;
    const lookY = ball.pos.y + CFG.ballR;
    const lookZ = ball.pos.z + dirZ * CFG.cam.lookAhead;

    // occlusion pull-in: raycast look -> desired cam pos against statics only; if
    // something's in the way, ride the ray in instead of poking the lens through it.
    let camX = this.px, camY = this.py, camZ = this.pz;
    const dx = camX - lookX, dy = camY - lookY, dz = camZ - lookZ;
    const dist = Math.hypot(dx, dy, dz);
    if (dist > 0.001) {
      this.rayOrigin.x = lookX; this.rayOrigin.y = lookY; this.rayOrigin.z = lookZ;
      this.rayDir.x = dx / dist; this.rayDir.y = dy / dist; this.rayDir.z = dz / dist;
      const ray = new RAPIER.Ray(this.rayOrigin, this.rayDir);
      // statics only, same QueryFilterFlags.ONLY_FIXED pattern control.ts's grounded() uses.
      const hit = sim.world.castRay(ray, dist, true, RAPIER.QueryFilterFlags.ONLY_FIXED);
      if (hit && hit.timeOfImpact < dist) {
        const pull = Math.max(0.1, hit.timeOfImpact - 0.15);
        camX = lookX + this.rayDir.x * pull;
        camY = lookY + this.rayDir.y * pull;
        camZ = lookZ + this.rayDir.z * pull;
      }
    }

    // peek blend: lerp toward straight-down-from-above, yaw preserved via the up vector
    // (so the player's sense of facing carries into and out of the overhead frame).
    this.peekT += ((this.peekOn ? 1 : 0) - this.peekT) * Math.min(1, dt / CFG.cam.peekLerp);
    const overheadX = ball.pos.x, overheadY = ball.pos.y + CFG.cam.peekHeight, overheadZ = ball.pos.z;

    const finalX = lerp(camX, overheadX, this.peekT);
    const finalY = lerp(camY, overheadY, this.peekT);
    const finalZ = lerp(camZ, overheadZ, this.peekT);
    const finalLookX = lerp(lookX, ball.pos.x, this.peekT);
    const finalLookY = lerp(lookY, ball.pos.y, this.peekT);
    const finalLookZ = lerp(lookZ, ball.pos.z, this.peekT);

    const upX = lerp(0, fwdX, this.peekT), upY = lerp(1, 0.0001, this.peekT), upZ = lerp(0, fwdZ, this.peekT);
    const upLen = Math.hypot(upX, upY, upZ) || 1;

    this.camera.up.set(upX / upLen, upY / upLen, upZ / upLen);
    this.camera.position.set(finalX, finalY, finalZ);
    this.camera.lookAt(finalLookX, finalLookY, finalLookZ);
  }
}
