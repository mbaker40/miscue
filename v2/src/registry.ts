// entity model — replaces v1's flat Ball array with rapier bodies underneath. each
// Entity owns exactly one dynamic rigid-body + one ball collider; static terrain and
// sensor zones live in Sim directly and never get an Entity.
import * as RAPIER from '@dimforge/rapier3d-compat';
import { CFG } from './config';
import type { Sim } from './sim';

// roster is FROZEN — adding a kind means touching AI, art, and stats everywhere.
export type Kind = 'player' | 'bumper' | 'skitter' | 'charger' | 'splitter' | 'boss';

export interface Vec3 { x: number; y: number; z: number }

export interface Entity {
  id: number;
  kind: Kind;
  elite: boolean;
  body: RAPIER.RigidBody;
  collider: RAPIER.Collider;
  alive: boolean;
  r: number;
  prevPos: { x: number; y: number; z: number };
  prevRot: { x: number; y: number; z: number; w: number };
  spinSide: number;
  spinTop: number;
  ai: { timer: number; state: number; tx: number; ty: number; tz: number; lungesLeft: number; didSplit: boolean };
  armor: number;
  vulnerable: boolean;
}

interface Stats { r: number; mass: number; rest: number }

// ratios carried over from v1 (src/entities.ts STATS), rescaled to ballR 0.15.
// bumper rest bumped 1.05 -> 1.0 here: v1 let bumpers gain energy on hit, we don't.
const STATS: Record<Exclude<Kind, 'player'>, Stats> = {
  bumper: { r: 0.23, mass: 3.2, rest: 1.0 },
  skitter: { r: 0.12, mass: 0.55, rest: 0.92 },
  charger: { r: 0.15, mass: 1.1, rest: 0.95 },
  splitter: { r: 0.18, mass: 1.0, rest: 0.92 },
  boss: { r: 0.38, mass: 8.0, rest: 0.98 },
};
const PLAYER_STATS: Stats = { r: CFG.ballR, mass: 1, rest: 0.94 };
const ELITE_R_SCALE = 1.22;
const ELITE_MASS_SCALE = 1.5;

// rolling-pool-ball-on-felt feel: v1's table friction was an exponential velocity
// decay (0.72/s). rapier has no direct analog, so linearDamping/angularDamping here
// are separately tuned to *look* like that decay at ballR-scale speeds, not derived
// from it — retune together if motion feels wrong, not just one in isolation.
const LIN_DAMPING = 0.65; // 0.55 = ice; 0.8 = mud on the 10u arena (M1.5 field report:
                          // full power couldn't cross the table). shared via BALL_PHYS.
const ANG_DAMPING = 0.5; // rolling brake — with LIN this sets full-power roll-out;
                         // (0.7, 0.5, shot 12) = full send just crosses the 10u arena
const FRICTION = 0.8;

// shared with preview.ts's shadow-world ghost so the aim line rolls with exactly the
// same phys as the real cue ball — drift here means a lying preview.
export const BALL_PHYS = {
  linDamping: LIN_DAMPING, angDamping: ANG_DAMPING,
  friction: FRICTION, restitution: 0.94,
};

let nextId = 1;
const entities: Entity[] = [];
const colliderIndex = new Map<number, Entity>(); // collider.handle -> Entity

function buildEntity(
  sim: Sim, kind: Kind, elite: boolean, pos: Vec3, r: number, mass: number, rest: number, ccd: boolean,
): Entity {
  const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
    .setTranslation(pos.x, pos.y, pos.z)
    .setLinearDamping(LIN_DAMPING)
    .setAngularDamping(ANG_DAMPING)
    .setCcdEnabled(ccd);
  const body = sim.world.createRigidBody(bodyDesc);
  const colliderDesc = RAPIER.ColliderDesc.ball(r)
    .setMass(mass) // explicit mass, not density — stats are authored as mass directly
    .setFriction(FRICTION)
    .setRestitution(rest)
    .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);
  const collider = sim.world.createCollider(colliderDesc, body);
  const e: Entity = {
    id: nextId++, kind, elite, body, collider, alive: true, r,
    prevPos: { x: pos.x, y: pos.y, z: pos.z },
    prevRot: { x: 0, y: 0, z: 0, w: 1 },
    spinSide: 0, spinTop: 0,
    ai: { timer: 0, state: 0, tx: 0, ty: 0, tz: 0, lungesLeft: 0, didSplit: false },
    armor: kind === 'boss' ? 3 : 0,
    vulnerable: kind !== 'boss',
  };
  entities.push(e);
  colliderIndex.set(collider.handle, e);
  return e;
}

export function spawnPlayer(sim: Sim, pos: Vec3): Entity {
  // CCD only on the player: it's the one body fast/small enough to tunnel through
  // thin terrain on a hard shot, and the only one where that would be game-breaking.
  return buildEntity(sim, 'player', false, pos, PLAYER_STATS.r, PLAYER_STATS.mass, PLAYER_STATS.rest, true);
}

export function spawnEnemy(sim: Sim, kind: Exclude<Kind, 'player'>, pos: Vec3, elite = false): Entity {
  const s = STATS[kind];
  const rScale = elite ? ELITE_R_SCALE : 1;
  const massScale = elite ? ELITE_MASS_SCALE : 1;
  return buildEntity(sim, kind, elite, pos, s.r * rScale, s.mass * massScale, s.rest, false);
}

// v1 makeSplitChild ported: a splitter that took a hard/off-center enough impact
// breaks into n smaller non-elite splitters (never re-split — ai.didSplit gates that
// at the caller). Caller despawns the parent; this only spawns the children, still at
// the parent's position/velocity split, so a step never sees parent and children both
// alive with overlapping colliders.
export function spawnSplitChildren(sim: Sim, parent: Entity): Entity[] {
  const n = parent.elite ? 3 : 2;
  const pos = parent.body.translation();
  const v = parent.body.linvel();
  const r = parent.r * 0.68;
  const mass = parent.body.mass() * 0.45;
  const rest = STATS.splitter.rest;
  const speed = Math.hypot(v.x, v.z);
  let px = -v.z, pz = v.x; // perpendicular to travel
  const pn = Math.hypot(px, pz) || 1;
  px /= pn; pz /= pn;
  const children: Entity[] = [];
  for (let i = 0; i < n; i++) {
    const sign = i % 2 === 0 ? 1 : -1;
    const child = buildEntity(sim, 'splitter', false, { x: pos.x, y: pos.y, z: pos.z }, r, mass, rest, false);
    child.ai.didSplit = true; // children never split again
    child.body.setLinvel({ x: v.x * 0.5 + px * 0.5 * speed * sign, y: v.y, z: v.z * 0.5 + pz * 0.5 * speed * sign }, true);
    children.push(child);
  }
  return children;
}

export function despawn(sim: Sim, e: Entity): void {
  if (!e.alive) return;
  e.alive = false;
  colliderIndex.delete(e.collider.handle);
  sim.world.removeRigidBody(e.body); // takes the attached collider with it
}

export function byCollider(handle: number): Entity | undefined {
  return colliderIndex.get(handle);
}

// live array, not a copy — spawn/despawn are the only writers, everyone else should
// only read it (and skip !alive entries, same convention as v1's balls array).
export function all(): Entity[] {
  return entities;
}

export function resetRegistry(): void {
  entities.length = 0;
  colliderIndex.clear();
  nextId = 1;
}
