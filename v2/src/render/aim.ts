// dotted aim ribbon fed by preview.ts. CONSTANT-SIZE point buffer, padded with the
// endpoint — three r160+ setFromPoints reuses the existing position attribute over
// the OLD point count, and a shrinking array reads past its end and throws every
// frame (v1 shipped exactly this freeze; the lesson is load-bearing here).
import * as THREE from 'three';
import type { PreviewResult } from '../preview';

const PTS = 64; // must be >= preview.ts MAX_PTS

const SOFT = new THREE.Color(0x2ef2c5);   // gentle tap — cool neon
const HARD = new THREE.Color(0xf5c542);   // full send — hot gold
const DANGER = new THREE.Color(0xff4a4a); // this shot leaves the world
const MIX = new THREE.Color();

export class AimLine {
  private geo = new THREE.BufferGeometry();
  private mat = new THREE.LineDashedMaterial({
    color: 0x2ef2c5, dashSize: 0.11, gapSize: 0.07, transparent: true, opacity: 0.85,
  });
  private line: THREE.Line;
  private pts = Array.from({ length: PTS }, () => new THREE.Vector3());

  // impact marker: a small ring at the ribbon's endpoint when the shot meets an enemy
  // first — the ribbon truncates there (preview.ts never simulates past the hit, so
  // this is the only extra draw call the "hitEnemy" case needs).
  private markerMat = new THREE.MeshBasicMaterial({
    color: 0xffffff, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false,
  });
  private marker: THREE.Mesh;

  constructor(scene: THREE.Scene) {
    this.geo.setFromPoints(this.pts);
    this.line = new THREE.Line(this.geo, this.mat);
    this.line.visible = false;
    this.line.frustumCulled = false;
    scene.add(this.line);

    const ringGeo = new THREE.RingGeometry(0.12, 0.18, 24);
    ringGeo.rotateX(-Math.PI / 2); // lies flat, facing up
    this.marker = new THREE.Mesh(ringGeo, this.markerMat);
    this.marker.visible = false;
    this.marker.frustumCulled = false;
    scene.add(this.marker);
  }

  /** power (0..1) drives the color — cool neon tap → hot gold full send; the line's
   *  LENGTH is already the honest speed readout (it's the simulated roll). */
  show(res: PreviewResult, power = 0.5): void {
    if (res.n < 2) { this.hide(); return; }
    const last = res.points[res.n - 1];
    for (let i = 0; i < PTS; i++) {
      const p = i < res.n ? res.points[i] : last;
      // lift slightly off the surface so the dashes don't z-fight the felt
      this.pts[i].set(p.x, p.y + 0.02, p.z);
    }
    this.geo.setFromPoints(this.pts);
    this.line.computeLineDistances();
    // offWorld beats hitEnemy on paper, but they can never both be true in one result
    // — preview.ts breaks its ghost loop the instant either fires — so the order here
    // just documents which branch wins if that ever changes.
    if (res.offWorld) this.mat.color.copy(DANGER);
    else this.mat.color.copy(MIX.copy(SOFT).lerp(HARD, Math.min(1, power)));
    this.line.visible = true;

    if (res.hitEnemy) {
      this.marker.position.set(last.x, last.y + 0.03, last.z);
      // subtle pulse, module clock off performance.now() (this file has no dt param)
      this.markerMat.opacity = 0.7 + 0.2 * Math.sin(performance.now() / 1000 * 6);
      this.marker.visible = true;
    } else {
      this.marker.visible = false;
    }
  }

  hide(): void {
    this.line.visible = false;
    this.marker.visible = false;
  }
}
