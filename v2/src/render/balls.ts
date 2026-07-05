// one mesh per live Entity: unit sphere geometry scaled to e.r, flat colors (v1's
// canvas-texture identity treatment is a later milestone's render split, not this one).
// Position/rotation each frame come from lerping prevPos->pos and slerping
// prevRot->rot by the render alpha — Rapier's rotation *is* the roll now.
import * as THREE from 'three';
import type { Entity, Kind } from '../registry';

const KIND_COLOR: Record<Kind, number> = {
  player: 0xf5ead6,   // cue-ball white
  bumper: 0x3d4450,   // the bruiser: dark slate
  skitter: 0xd9d2c5,  // the coward: pale
  charger: 0xc8452a,  // the hothead: ember
  splitter: 0x3f9e5f, // the cheat: felt green
  boss: 0x151018,     // the 8-ball
};

interface BallView { mesh: THREE.Mesh }

export class BallViews {
  private geo = new THREE.SphereGeometry(1, 20, 16);
  private views = new Map<number, BallView>();
  private qa = new THREE.Quaternion();
  private qb = new THREE.Quaternion();

  constructor(private scene: THREE.Scene) {}

  private ensure(e: Entity): BallView {
    let v = this.views.get(e.id);
    if (v) return v;
    const mat = new THREE.MeshStandardMaterial({
      color: KIND_COLOR[e.kind] ?? 0xffffff,
      roughness: 0.4, metalness: 0.05,
      emissive: e.kind === 'player' ? 0x332211 : 0x000000,
      emissiveIntensity: e.kind === 'player' ? 0.25 : 0,
    });
    const mesh = new THREE.Mesh(this.geo, mat);
    mesh.scale.setScalar(e.r);
    this.scene.add(mesh);
    v = { mesh };
    this.views.set(e.id, v);
    return v;
  }

  sync(entities: Entity[], alpha: number): void {
    const seen = new Set<number>();
    for (const e of entities) {
      if (!e.alive) continue;
      seen.add(e.id);
      const v = this.ensure(e);
      const t = e.body.translation(), r = e.body.rotation();
      v.mesh.position.set(
        e.prevPos.x + (t.x - e.prevPos.x) * alpha,
        e.prevPos.y + (t.y - e.prevPos.y) * alpha,
        e.prevPos.z + (t.z - e.prevPos.z) * alpha,
      );
      this.qa.set(e.prevRot.x, e.prevRot.y, e.prevRot.z, e.prevRot.w);
      this.qb.set(r.x, r.y, r.z, r.w);
      v.mesh.quaternion.slerpQuaternions(this.qa, this.qb, alpha);
    }
    for (const [id, v] of this.views) {
      if (seen.has(id)) continue;
      this.scene.remove(v.mesh);
      (v.mesh.material as THREE.Material).dispose();
      this.views.delete(id);
    }
  }
}
