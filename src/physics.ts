// Pool-on-a-plane physics. 2D circles in logical table space, rendered in 3D.
// Physics runs FREE (dossier D1) — feel over determinism.
import { Ball, HALF_W, HALF_L, POCKET_R } from './entities';

export interface PhysicsEvents {
  onSink(b: Ball, pocketIdx: number): void;
  /** impact: closing speed along the contact normal. tangent: relative speed
   *  across it — the off-centeredness of the hit (0 = dead center). */
  onCollide(a: Ball, b: Ball, impact: number, tangent: number): void;
  onRail(b: Ball, impact: number): void;
  onGraze(b: Ball, pocketIdx: number): void;
}

// 6 pockets: 4 corners + 2 mid on the long rails
export const POCKETS: { x: number; z: number }[] = [
  { x: -HALF_W, z: -HALF_L }, { x: HALF_W, z: -HALF_L },
  { x: -HALF_W, z: 0 }, { x: HALF_W, z: 0 },
  { x: -HALF_W, z: HALF_L }, { x: HALF_W, z: HALF_L },
];

const FRICTION = 0.72;        // exponential decay per second
const STOP_SPEED = 0.02;
const CURVE_K = 1.9;          // english lateral force
const SPIN_DECAY = 1.1;
const RAIL_REST = 0.88;
export const MAX_SHOT_SPEED = 3.0;

export function speedOf(b: Ball): number { return Math.hypot(b.vx, b.vz); }

function stepBall(b: Ball, dt: number) {
  const sp = speedOf(b);
  if (sp < STOP_SPEED) { b.vx = 0; b.vz = 0; b.spinSide = 0; b.spinTop = 0; return; }
  // english: lateral acceleration perpendicular to velocity, scaled by speed
  if (b.spinSide !== 0) {
    const px = -b.vz / sp, pz = b.vx / sp;
    const a = b.spinSide * CURVE_K * sp;
    b.vx += px * a * dt; b.vz += pz * a * dt;
  }
  // draw/follow: gentle accel along (draw: against) travel while rolling
  if (b.spinTop !== 0) {
    const a = b.spinTop * 0.55;
    b.vx += (b.vx / sp) * a * dt; b.vz += (b.vz / sp) * a * dt;
  }
  const f = Math.exp(-FRICTION * dt);
  b.vx *= f; b.vz *= f;
  const sd = Math.exp(-SPIN_DECAY * dt);
  b.spinSide *= sd; b.spinTop *= sd;
  b.x += b.vx * dt; b.z += b.vz * dt;
}

function railBounce(b: Ball, ev: PhysicsEvents | null): number {
  let hits = 0;
  const rx = HALF_W - b.r, rz = HALF_L - b.r;
  if (b.x < -rx && b.vx < 0) { b.x = -rx; b.vx = -b.vx * RAIL_REST; hits++; }
  else if (b.x > rx && b.vx > 0) { b.x = rx; b.vx = -b.vx * RAIL_REST; hits++; }
  if (b.z < -rz && b.vz < 0) { b.z = -rz; b.vz = -b.vz * RAIL_REST; hits++; }
  else if (b.z > rz && b.vz > 0) { b.z = rz; b.vz = -b.vz * RAIL_REST; hits++; }
  if (hits && ev) ev.onRail(b, speedOf(b));
  return hits;
}

/** Is this point inside a pocket capture zone? Returns pocket index or -1. */
export function pocketAt(x: number, z: number, ballR: number): number {
  for (let i = 0; i < POCKETS.length; i++) {
    const p = POCKETS[i];
    if (Math.hypot(x - p.x, z - p.z) < POCKET_R - ballR * 0.25) return i;
  }
  return -1;
}

function resolvePair(a: Ball, b: Ball, ev: PhysicsEvents | null) {
  const dx = b.x - a.x, dz = b.z - a.z;
  const dist = Math.hypot(dx, dz);
  const min = a.r + b.r;
  if (dist >= min || dist === 0) return;
  const nx = dx / dist, nz = dz / dist;
  // positional correction
  const overlap = min - dist;
  const total = a.mass + b.mass;
  a.x -= nx * overlap * (b.mass / total);
  a.z -= nz * overlap * (b.mass / total);
  b.x += nx * overlap * (a.mass / total);
  b.z += nz * overlap * (a.mass / total);
  // impulse
  const rvx = b.vx - a.vx, rvz = b.vz - a.vz;
  const vn = rvx * nx + rvz * nz;
  if (vn > 0) return;
  const rest = Math.min(a.restitution, b.restitution);
  const j = (-(1 + rest) * vn) / (1 / a.mass + 1 / b.mass);
  a.vx -= (j / a.mass) * nx; a.vz -= (j / a.mass) * nz;
  b.vx += (j / b.mass) * nx; b.vz += (j / b.mass) * nz;
  const impact = Math.abs(vn);
  const tangent = Math.abs(rvx * -nz + rvz * nx); // slip across the contact — off-center measure
  // follow/draw: on player contact, convert topspin into an impulse along/against travel
  for (const [self] of [[a, b], [b, a]] as [Ball, Ball][]) {
    if (self.kind === 'player' && Math.abs(self.spinTop) > 0.05) {
      const sp = speedOf(self) || 1;
      const k = self.spinTop * 0.5;
      self.vx += (self.vx / sp) * k + nx * -k * 0.3;
      self.vz += (self.vz / sp) * k + nz * -k * 0.3;
      self.spinTop *= 0.3;
    }
  }
  if (ev) ev.onCollide(a, b, impact, tangent);
}

/** One fixed physics step over all balls. */
export function step(balls: Ball[], dt: number, ev: PhysicsEvents) {
  for (const b of balls) if (b.alive) stepBall(b, dt);
  for (const b of balls) if (b.alive) railBounce(b, ev);
  for (let i = 0; i < balls.length; i++) {
    if (!balls[i].alive) continue;
    for (let j = i + 1; j < balls.length; j++) {
      if (!balls[j].alive) continue;
      resolvePair(balls[i], balls[j], ev);
    }
  }
  for (const b of balls) {
    if (!b.alive) continue;
    // boss refuses the pocket until vulnerable — the table repels it
    if (b.kind === 'boss' && !b.vulnerable) {
      for (const p of POCKETS) {
        const dx = b.x - p.x, dz = b.z - p.z;
        const d = Math.hypot(dx, dz);
        if (d < POCKET_R * 2.2 && d > 0) {
          b.vx += (dx / d) * 1.2 * dt * 60 * 0.02;
          b.vz += (dz / d) * 1.2 * dt * 60 * 0.02;
        }
      }
      continue;
    }
    const pi = pocketAt(b.x, b.z, b.r);
    if (pi >= 0) { b.alive = false; ev.onSink(b, pi); continue; }
    // graze detection (stroke reward for flirting with the lip)
    if (b.kind === 'player' && speedOf(b) > 0.35) {
      for (let i = 0; i < POCKETS.length; i++) {
        const p = POCKETS[i];
        const d = Math.hypot(b.x - p.x, b.z - p.z);
        if (d < POCKET_R * 1.6 && d > POCKET_R) ev.onGraze(b, i);
      }
    }
  }
}

export function allSettled(balls: Ball[]): boolean {
  for (const b of balls) if (b.alive && speedOf(b) > STOP_SPEED * 1.5) return false;
  return true;
}

export interface PathPoint { x: number; z: number }
export interface PathResult { points: PathPoint[]; danger: boolean; hitEnemy: boolean }

/** Trajectory preview: same movement rules, rails + curve, stops at first enemy or pocket. */
export function simulatePath(
  x: number, z: number, vx: number, vz: number,
  spinSide: number, spinTop: number,
  obstacles: Ball[], maxBounces = 2,
): PathResult {
  const ghost: Ball = {
    id: -1, kind: 'player', elite: false, x, z, vx, vz,
    r: 0.034, mass: 1, restitution: 0.94, alive: true,
    spinSide, spinTop, aiTimer: 0, aiState: 0, aiTx: 0, aiTz: 0,
    lungesLeft: 0, didSplit: false, armor: 0, vulnerable: true,
  };
  const pts: PathPoint[] = [{ x, z }];
  let bounces = 0, danger = false, hitEnemy = false;
  const dt = 1 / 90;
  for (let i = 0; i < 240; i++) {
    stepBall(ghost, dt);
    bounces += railBounce(ghost, null);
    if (i % 3 === 0) pts.push({ x: ghost.x, z: ghost.z });
    if (pocketAt(ghost.x, ghost.z, ghost.r) >= 0) { danger = true; break; }
    let stop = false;
    for (const o of obstacles) {
      if (!o.alive) continue;
      if (Math.hypot(o.x - ghost.x, o.z - ghost.z) < o.r + ghost.r) { hitEnemy = true; stop = true; break; }
    }
    if (stop || bounces > maxBounces || speedOf(ghost) < STOP_SPEED) break;
  }
  pts.push({ x: ghost.x, z: ghost.z });
  return { points: pts, danger, hitEnemy };
}
