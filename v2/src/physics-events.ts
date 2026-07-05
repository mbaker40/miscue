// the seam between physics and everything else — game/audio/fx/score implement this,
// sim.step() (and the game loop, for onGraze) call into it. evolved from v1's
// PhysicsEvents: onRail split into onSurface (wall vs floor matters now that terrain
// isn't just four rails), onSink/onPad/onFall added for the marble-blast move to 3D.
import type { Entity } from './registry';

export interface PhysicsEvents {
  onSink(e: Entity, pocketId: number): void;
  onCollide(a: Entity, b: Entity, impact: number, tangent: number): void; // impact = closing speed along contact normal; tangent = slip across it
  onSurface(e: Entity, impact: number, kind: 'wall' | 'floor'): void;      // ball vs static terrain, split by contact normal (|ny| > 0.6 → floor)
  onPad(e: Entity, padId: number): void;
  onFall(e: Entity): void;          // crossed the kill plane
  onGraze(e: Entity, pocketId: number): void;  // near-miss past a pocket rim (player only, speed-gated) — v1 stroke reward
}
