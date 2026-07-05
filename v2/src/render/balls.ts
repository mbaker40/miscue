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

// elite rim: a hot pink emissive glow layered on top of the kind's own base emissive
// (elites already read bigger via r — this is the "this one bites back" tell).
const ELITE_EMISSIVE = 0xff3ea5;
const ELITE_INTENSITY = 0.35;

// telegraph pulse: an armed/charging enemy glows hot red, breathing so it reads as a
// live threat rather than a static color swap.
const TELEGRAPH_EMISSIVE = 0xff4a4a;
const TELEGRAPH_BASE = 0.4;
const TELEGRAPH_AMP = 0.35;
const TELEGRAPH_HZ = 14;

// boss ring band: a thin white torus around the unit sphere's equator so "the 8-ball"
// reads at a glance. Shared geometry/material across the (at most one) boss instance.
const RING_GEO = new THREE.TorusGeometry(1.0, 0.09, 8, 32);
const RING_MAT = new THREE.MeshStandardMaterial({ color: 0xf2f2ec, roughness: 0.5, metalness: 0.05 });

interface BallView {
  mesh: THREE.Mesh;
  mat: THREE.MeshStandardMaterial;
  baseEmissive: number;
  baseIntensity: number;
  telegraph: boolean;
}

export class BallViews {
  private geo = new THREE.SphereGeometry(1, 20, 16);
  private views = new Map<number, BallView>();
  private qa = new THREE.Quaternion();
  private qb = new THREE.Quaternion();

  constructor(private scene: THREE.Scene) {}

  private ensure(e: Entity): BallView {
    let v = this.views.get(e.id);
    if (v) return v;
    const baseEmissive = e.kind === 'player' ? 0x332211 : (e.elite ? ELITE_EMISSIVE : 0x000000);
    const baseIntensity = e.kind === 'player' ? 0.25 : (e.elite ? ELITE_INTENSITY : 0);
    const mat = new THREE.MeshStandardMaterial({
      color: KIND_COLOR[e.kind] ?? 0xffffff,
      roughness: 0.4, metalness: 0.05,
      emissive: baseEmissive,
      emissiveIntensity: baseIntensity,
    });
    const mesh = new THREE.Mesh(this.geo, mat);
    mesh.scale.setScalar(e.r);
    if (e.kind === 'boss') {
      const ring = new THREE.Mesh(RING_GEO, RING_MAT);
      ring.rotation.x = -Math.PI / 2; // flat around the vertical axis, like a stripe
      mesh.add(ring);
    }
    this.scene.add(mesh);
    v = { mesh, mat, baseEmissive, baseIntensity, telegraph: false };
    this.views.set(e.id, v);
    return v;
  }

  /** M1-A's AiFx sink: armed/charging enemies glow and pulse until told otherwise. */
  setTelegraph(e: Entity, on: boolean): void {
    const v = this.ensure(e);
    v.telegraph = on;
    if (!on) {
      v.mat.emissive.setHex(v.baseEmissive);
      v.mat.emissiveIntensity = v.baseIntensity;
    }
  }

  sync(entities: Entity[], alpha: number): void {
    const t = performance.now() / 1000; // module clock for the telegraph pulse
    const seen = new Set<number>();
    for (const e of entities) {
      if (!e.alive) continue;
      seen.add(e.id);
      const v = this.ensure(e);
      const t2 = e.body.translation(), r = e.body.rotation();
      v.mesh.position.set(
        e.prevPos.x + (t2.x - e.prevPos.x) * alpha,
        e.prevPos.y + (t2.y - e.prevPos.y) * alpha,
        e.prevPos.z + (t2.z - e.prevPos.z) * alpha,
      );
      this.qa.set(e.prevRot.x, e.prevRot.y, e.prevRot.z, e.prevRot.w);
      this.qb.set(r.x, r.y, r.z, r.w);
      v.mesh.quaternion.slerpQuaternions(this.qa, this.qb, alpha);
      if (v.telegraph) {
        v.mat.emissive.setHex(TELEGRAPH_EMISSIVE);
        v.mat.emissiveIntensity = TELEGRAPH_BASE + TELEGRAPH_AMP * Math.sin(t * TELEGRAPH_HZ);
      }
    }
    for (const [id, v] of this.views) {
      if (seen.has(id)) continue;
      this.scene.remove(v.mesh);
      v.mat.dispose();
      this.views.delete(id);
    }
  }
}
