// dotted aim ribbon fed by preview.ts. CONSTANT-SIZE point buffer, padded with the
// endpoint — three r160+ setFromPoints reuses the existing position attribute over
// the OLD point count, and a shrinking array reads past its end and throws every
// frame (v1 shipped exactly this freeze; the lesson is load-bearing here).
import * as THREE from 'three';
import type { PreviewResult } from '../preview';

const PTS = 64; // must be >= preview.ts MAX_PTS

const OK_COLOR = 0x2ef2c5;
const DANGER_COLOR = 0xff4a4a;

export class AimLine {
  private geo = new THREE.BufferGeometry();
  private mat = new THREE.LineDashedMaterial({
    color: OK_COLOR, dashSize: 0.11, gapSize: 0.07, transparent: true, opacity: 0.85,
  });
  private line: THREE.Line;
  private pts = Array.from({ length: PTS }, () => new THREE.Vector3());

  constructor(scene: THREE.Scene) {
    this.geo.setFromPoints(this.pts);
    this.line = new THREE.Line(this.geo, this.mat);
    this.line.visible = false;
    this.line.frustumCulled = false;
    scene.add(this.line);
  }

  show(res: PreviewResult): void {
    if (res.n < 2) { this.hide(); return; }
    const last = res.points[res.n - 1];
    for (let i = 0; i < PTS; i++) {
      const p = i < res.n ? res.points[i] : last;
      // lift slightly off the surface so the dashes don't z-fight the felt
      this.pts[i].set(p.x, p.y + 0.02, p.z);
    }
    this.geo.setFromPoints(this.pts);
    this.line.computeLineDistances();
    this.mat.color.setHex(res.offWorld ? DANGER_COLOR : OK_COLOR);
    this.line.visible = true;
  }

  hide(): void {
    this.line.visible = false;
  }
}
