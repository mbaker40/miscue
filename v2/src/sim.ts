// rapier world lifecycle. no three.js, no DOM — this must stay importable from plain
// node (rapier3d-compat inlines its wasm as base64, so it runs outside a browser too;
// that's what the assert-sim script leans on).
import * as RAPIER from '@dimforge/rapier3d-compat';
import { CFG } from './config';
import type { Entity } from './registry';
import type { PhysicsEvents } from './physics-events';

let initialized = false;

export async function initPhysics(): Promise<void> {
  if (initialized) return; // idempotent — callers don't need to track whether it ran
  await RAPIER.init();
  initialized = true;
}

export interface Vec3 { x: number; y: number; z: number }

export type Shape =
  | { type: 'cuboid'; hx: number; hy: number; hz: number }
  | { type: 'cylinder'; halfHeight: number; radius: number };

type SensorKind = 'pocket' | 'pad';

const FLOOR_FRICTION = 0.8;
const GRAZE_SPEED_MIN = 2.0;
const GRAZE_CAPTURE_R = 0.35;
const GRAZE_RIM_R = 0.55;
const GRAZE_THROTTLE_S = 1.0;

const DEG = Math.PI / 180;

// intrinsic XYZ euler -> quaternion, matching three.js's default euler order so level
// authoring in degrees lines up with what the render packet will build meshes from.
function eulerToQuat(rotDeg?: Vec3): RAPIER.Rotation {
  if (!rotDeg) return { x: 0, y: 0, z: 0, w: 1 };
  const x = rotDeg.x * DEG * 0.5, y = rotDeg.y * DEG * 0.5, z = rotDeg.z * DEG * 0.5;
  const cx = Math.cos(x), sx = Math.sin(x);
  const cy = Math.cos(y), sy = Math.sin(y);
  const cz = Math.cos(z), sz = Math.sin(z);
  return {
    x: sx * cy * cz + cx * sy * sz,
    y: cx * sy * cz - sx * cy * sz,
    z: cx * cy * sz + sx * sy * cz,
    w: cx * cy * cz - sx * sy * sz,
  };
}

export class Sim {
  world: RAPIER.World;
  eventQueue: RAPIER.EventQueue;
  killY: number;
  private sensors = new Map<number, { kind: SensorKind; id: number }>();
  private grazeLast = new Map<string, number>(); // `${entityId}:${pocketId}` -> sim-clock seconds
  private clock = 0; // accumulated simulated seconds, advanced only by step() — used to
                      // throttle onGraze in simulated time so slow-mo doesn't spam it

  constructor() {
    this.world = new RAPIER.World(CFG.gravity);
    this.eventQueue = new RAPIER.EventQueue(true); // autoDrain — we drain it ourselves each step anyway
    this.killY = CFG.killY;
  }

  private shapeDesc(shape: Shape): RAPIER.ColliderDesc {
    return shape.type === 'cuboid'
      ? RAPIER.ColliderDesc.cuboid(shape.hx, shape.hy, shape.hz)
      : RAPIER.ColliderDesc.cylinder(shape.halfHeight, shape.radius);
  }

  addStatic(shape: Shape, pos: Vec3, rotDeg?: Vec3): number {
    const bodyDesc = RAPIER.RigidBodyDesc.fixed()
      .setTranslation(pos.x, pos.y, pos.z)
      .setRotation(eulerToQuat(rotDeg));
    const body = this.world.createRigidBody(bodyDesc);
    const desc = this.shapeDesc(shape)
      .setFriction(FLOOR_FRICTION)
      .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);
    const collider = this.world.createCollider(desc, body);
    return collider.handle;
  }

  addSensorZone(kind: SensorKind, id: number, shape: Shape, pos: Vec3): number {
    const body = this.world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(pos.x, pos.y, pos.z));
    const desc = this.shapeDesc(shape)
      .setSensor(true)
      .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);
    const collider = this.world.createCollider(desc, body);
    this.sensors.set(collider.handle, { kind, id });
    return collider.handle;
  }

  snapshotPrev(entities: Entity[]): void {
    for (const e of entities) {
      if (!e.alive) continue;
      const t = e.body.translation(), r = e.body.rotation();
      e.prevPos.x = t.x; e.prevPos.y = t.y; e.prevPos.z = t.z;
      e.prevRot.x = r.x; e.prevRot.y = r.y; e.prevRot.z = r.z; e.prevRot.w = r.w;
    }
  }

  // contact normal for a collider pair, world-space, pointing c1 -> c2. sourced from
  // the narrow-phase manifold (real contact geometry); if the manifold comes back
  // empty — can happen right when drainCollisionEvents reports "started" a hair
  // before the narrow-phase has a manifold populated for it — fall back to the
  // normalized center-to-center vector. every caller here only uses the normal's
  // magnitude-by-axis (|n.y| for floor/wall) or dots it into a velocity, so the sign
  // convention doesn't matter, only that it's *a* unit vector along the contact.
  private contactNormal(c1: RAPIER.Collider, c2: RAPIER.Collider): Vec3 {
    let n: Vec3 | null = null;
    this.world.contactPair(c1, c2, (manifold) => {
      if (n) return;
      const raw = manifold.normal();
      if (raw.x !== 0 || raw.y !== 0 || raw.z !== 0) n = { x: raw.x, y: raw.y, z: raw.z };
    });
    if (n) return n;
    const p1 = c1.translation(), p2 = c2.translation();
    const dx = p2.x - p1.x, dy = p2.y - p1.y, dz = p2.z - p1.z;
    const len = Math.hypot(dx, dy, dz) || 1;
    return { x: dx / len, y: dy / len, z: dz / len };
  }

  step(h: number, entities: Entity[], ev: PhysicsEvents): void {
    this.clock += h;
    this.world.timestep = h;
    this.world.step(this.eventQueue);

    // handle -> Entity for this step only. built from the caller's own entities list
    // rather than a registry import, so sim.ts has zero dependency on registry.ts.
    const byHandle = new Map<number, Entity>();
    for (const e of entities) if (e.alive) byHandle.set(e.collider.handle, e);

    this.eventQueue.drainCollisionEvents((h1, h2, started) => {
      if (!started) return;
      const c1 = this.world.getCollider(h1), c2 = this.world.getCollider(h2);
      if (!c1 || !c2) return;

      const s1 = this.sensors.get(h1), s2 = this.sensors.get(h2);
      if (s1 || s2) {
        const sensor = (s1 ?? s2)!;
        const ball = byHandle.get(s1 ? h2 : h1);
        if (!ball) return;
        if (sensor.kind === 'pocket') ev.onSink(ball, sensor.id);
        else ev.onPad(ball, sensor.id);
        return;
      }

      const e1 = byHandle.get(h1), e2 = byHandle.get(h2);
      if (e1 && e2) {
        // ball vs ball
        const n = this.contactNormal(c1, c2);
        const va = e1.body.linvel(), vb = e2.body.linvel();
        const rvx = vb.x - va.x, rvy = vb.y - va.y, rvz = vb.z - va.z;
        const vn = rvx * n.x + rvy * n.y + rvz * n.z;
        const impact = Math.abs(vn);
        const tx = rvx - vn * n.x, ty = rvy - vn * n.y, tz = rvz - vn * n.z;
        const tangent = Math.hypot(tx, ty, tz);
        ev.onCollide(e1, e2, impact, tangent);
      } else if (e1 || e2) {
        // ball vs static terrain
        const ball = (e1 ?? e2)!;
        const ballCollider = e1 ? c1 : c2;
        const staticCollider = e1 ? c2 : c1;
        const n = this.contactNormal(ballCollider, staticCollider);
        const kind: 'wall' | 'floor' = Math.abs(n.y) > 0.6 ? 'floor' : 'wall';
        const v = ball.body.linvel();
        const impact = Math.abs(v.x * n.x + v.y * n.y + v.z * n.z);
        ev.onSurface(ball, impact, kind);
      }
      // static vs static: not tracked, nothing subscribes to it
    });

    // fall detection: fire once, exactly on the step where the entity crosses below
    // killY — not a sticky flag, just comparing against the pre-step snapshot that
    // snapshotPrev() already took. an entity resting below killY across frames won't
    // refire because its prevPos.y is already below killY too by the next tick.
    for (const e of entities) {
      if (!e.alive) continue;
      const y = e.body.translation().y;
      if (y < this.killY && e.prevPos.y >= this.killY) ev.onFall(e);
    }
  }

  // near-miss reward: called by the game loop (not from step — it's a proximity
  // check, not a physics event), throttled per pocket per simulated second.
  checkGraze(player: Entity, pockets: { x: number; y: number; z: number; id: number }[], ev: PhysicsEvents): void {
    if (!player.alive) return;
    const v = player.body.linvel();
    const speed = Math.hypot(v.x, v.z); // horizontal — a vertical bounce shouldn't count as a graze
    if (speed <= GRAZE_SPEED_MIN) return;
    const p = player.body.translation();
    for (const pk of pockets) {
      const d = Math.hypot(p.x - pk.x, p.z - pk.z);
      if (d <= GRAZE_CAPTURE_R || d > GRAZE_RIM_R) continue;
      const key = `${player.id}:${pk.id}`;
      const last = this.grazeLast.get(key) ?? -Infinity;
      if (this.clock - last < GRAZE_THROTTLE_S) continue;
      this.grazeLast.set(key, this.clock);
      ev.onGraze(player, pk.id);
    }
  }
}
