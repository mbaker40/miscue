// physics-facing control surface: fire/steer/grounded plus the per-step spin seam.
// pure functions over an Entity + Sim — no input/DOM here, that's input.ts's job.
import * as RAPIER from '@dimforge/rapier3d-compat';
import { CFG } from './config';
import type { Entity } from './registry';
import type { Sim } from './sim';

// minimal stats surface control.ts needs — M2 swaps in the real PlayerStats, same
// field names, so this interface is the contract, not a placeholder to throw away.
export interface PlayerStatsLike { maxPower?: number; stroke: number }

// v1's ShotPayload, carried over — input.ts builds these, main.ts hands them to fire().
export interface ShotPayload {
  dirX: number; dirZ: number; power: number;
  spin?: { side: number; top: number };
}

/** normalize {x,z}; returns {0,0} for a zero-length input (caller should treat as no-op). */
function norm(v: { x: number; z: number }): { x: number; z: number } {
  const len = Math.hypot(v.x, v.z);
  return len > 1e-6 ? { x: v.x / len, z: v.z / len } : { x: 0, z: 0 };
}

/**
 * launch the ball: impulse along dirXZ, magnitude power * CFG.shot.maxImpulse *
 * (stats.maxPower ?? 1). spin scalars are stored on the entity itself (registry.ts
 * already carries spinSide/spinTop — no parallel map needed).
 * 'forced' mode: spin is applied as decaying forces every step by updateSpin(), below.
 * 'physical' mode: spin becomes angular velocity at launch and friction/rolling does
 * the curving; updateSpin() is a near-no-op (decay only) in this mode.
 */
export function fire(
  e: Entity, dirXZ: { x: number; z: number }, power: number,
  spin: { side: number; top: number }, stats: PlayerStatsLike,
): void {
  const d = norm(dirXZ);
  if (d.x === 0 && d.z === 0) return; // no direction, no shot
  const p = Math.max(0, Math.min(1, power));
  const mag = p * CFG.shot.maxImpulse * (stats.maxPower ?? 1);
  e.body.applyImpulse({ x: d.x * mag, y: 0, z: d.z * mag }, true);

  if (CFG.spin.mode === 'forced') {
    e.spinSide = spin.side;
    e.spinTop = spin.top;
  } else {
    // physical stub (M0): fold spin straight into angular velocity, let rapier's
    // friction do whatever curving falls out of it. not feel-tested until M0/M1
    // settles which spin mode ships — this exists so the seam compiles either way.
    const av = e.body.angvel();
    e.body.setAngvel({ x: av.x - spin.top * 4, y: av.y + spin.side * 4, z: av.z }, true);
    e.spinSide = 0; e.spinTop = 0;
  }
}

/**
 * per-fixed-step forced-spin application. main.ts calls this once per fixed step
 * BEFORE sim.step(), per the M0.2 dispatch contract — spin has to bend the velocity
 * rapier is about to integrate, not the velocity from last step.
 * lateral force perpendicular to velocity, scaled by spinSide*speed*curveK (v1's
 * CURVE_K, re-hosted as CFG.spin.curveK); forward/back force along velocity scaled
 * by spinTop*topK (v1's draw/follow constant); both scalars decay exponentially at
 * CFG.spin.decay regardless of mode, so a stale spin value never survives long.
 */
export function updateSpin(e: Entity, dt: number): void {
  // rapier's addForce is PERSISTENT — it keeps applying every step until reset.
  // updateSpin is the once-per-step entry for this entity, so it owns the reset;
  // steer() adds on top and therefore must be called AFTER updateSpin each step.
  e.body.resetForces(true);
  if (CFG.spin.mode === 'forced') {
    const v = e.body.linvel();
    const sp = Math.hypot(v.x, v.z);
    if (sp > 1e-4) {
      if (e.spinSide !== 0) {
        const px = -v.z / sp, pz = v.x / sp; // unit vector perpendicular to velocity, in-plane
        const mag = e.spinSide * CFG.spin.curveK * sp;
        e.body.addForce({ x: px * mag, y: 0, z: pz * mag }, true);
      }
      if (e.spinTop !== 0) {
        const mag = e.spinTop * CFG.spin.topK * sp; // + = follow (accelerate), - = draw (brake)
        e.body.addForce({ x: (v.x / sp) * mag, y: 0, z: (v.z / sp) * mag }, true);
      }
    }
  }
  // decay runs under either mode — 'physical' has nothing above to apply, but the
  // scalars still need to relax so a later mode-switch (or a debug readout) doesn't
  // see spin sitting at full strength forever.
  const decay = Math.exp(-CFG.spin.decay * dt);
  e.spinSide *= decay;
  e.spinTop *= decay;
}

/**
 * correction-only steering: no-op unless CFG.steer.enabled and speed >= minSpeed.
 * force is capped at steer.accel * mass — accel is held under g*sin(9 deg) in
 * config.ts, so this can bend a rolling line but never climb a ramp or start motion
 * from rest (the dossier's steering guarantee, mechanically enforced here).
 * stateless per call by design: main.ts calls this every fixed step while a steer
 * direction is active, from a continuous input.ts callback, not a start/stop event.
 * returns whether force was actually applied, so the caller only drains Stroke when
 * steering actually bites.
 * ORDERING: call after updateSpin() in the same step — updateSpin resets rapier's
 * persistent force accumulator, which would erase a steer force added before it.
 */
export function steer(e: Entity, dirXZ: { x: number; z: number }, dt: number, stats: PlayerStatsLike): boolean {
  if (!CFG.steer.enabled) return false;
  const v = e.body.linvel();
  const speed = Math.hypot(v.x, v.z);
  if (speed < CFG.steer.minSpeed) return false;
  const d = norm(dirXZ);
  if (d.x === 0 && d.z === 0) return false;
  const mag = CFG.steer.accel * e.body.mass();
  e.body.addForce({ x: d.x * mag, y: 0, z: d.z * mag }, true);
  stats.stroke = Math.max(0, stats.stroke - CFG.steer.drainPerSec * dt);
  return true;
}

/**
 * downward raycast, length r+0.05, statics only (QueryFilterFlags.ONLY_FIXED excludes
 * anything attached to a dynamic/kinematic body — enemies and the player itself never
 * count as "ground"). excludes the entity's own collider so it can't hit itself.
 */
export function grounded(e: Entity, sim: Sim): boolean {
  const p = e.body.translation();
  const ray = new RAPIER.Ray({ x: p.x, y: p.y, z: p.z }, { x: 0, y: -1, z: 0 });
  const hit = sim.world.castRay(
    ray, e.r + 0.05, true,
    RAPIER.QueryFilterFlags.ONLY_FIXED, undefined, e.collider,
  );
  return hit !== null;
}

// --- powerup hooks: signatures only for M0, real behavior lands at M4. presence
// matters more than behavior right now, so M4 doesn't need to touch this file's
// public shape to fill these in. ---

/** vertical hop — clears pits/gaps for a beat. stub. */
export function hop(e: Entity): void { /* M4 */ }

/** toggles reduced gravity for a duration the caller (M4) tracks. stub. */
export function slowFall(e: Entity, active: boolean): void { /* M4 */ }

/** paints a time-brush effect (local slow-mo trail?) at the entity. stub. */
export function timeBrush(e: Entity): void { /* M4 */ }
