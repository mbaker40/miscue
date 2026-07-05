// One input layer, two devices (dossier P4): pointer events cover touch + mouse.
// Slingshot: drag back from the ball, release to fire. Grip only when slowed.
import { Renderer3D } from './render';

export interface ShotPayload { dirX: number; dirZ: number; power: number }

export class AimInput {
  aiming = false;
  private dragX = 0; private dragZ = 0;
  spinSide = 0; spinTop = 0;
  onFire: ((s: ShotPayload) => void) | null = null;
  canAim: (() => boolean) | null = null;
  getBallPos: (() => { x: number; z: number }) | null = null;

  constructor(private r3d: Renderer3D, canvas: HTMLElement, spinPad: HTMLElement, spinKnob: HTMLElement) {
    canvas.addEventListener('pointerdown', e => {
      if (!this.canAim || !this.canAim()) return;
      this.aiming = true;
      canvas.setPointerCapture(e.pointerId);
      const p = this.r3d.screenToTable(e.clientX, e.clientY);
      this.dragX = p.x; this.dragZ = p.z;
    });
    canvas.addEventListener('pointermove', e => {
      if (!this.aiming) return;
      const p = this.r3d.screenToTable(e.clientX, e.clientY);
      this.dragX = p.x; this.dragZ = p.z;
    });
    const release = () => {
      if (!this.aiming) return;
      this.aiming = false;
      const s = this.currentShot();
      if (s && s.power > 0.06 && this.onFire) this.onFire(s);
    };
    canvas.addEventListener('pointerup', release);
    canvas.addEventListener('pointercancel', () => { this.aiming = false; });

    // spin pad: draggable knob → english (x) and follow/draw (y)
    const setSpin = (e: PointerEvent) => {
      const rect = spinPad.getBoundingClientRect();
      let dx = (e.clientX - (rect.left + rect.width / 2)) / (rect.width / 2);
      let dy = (e.clientY - (rect.top + rect.height / 2)) / (rect.height / 2);
      const m = Math.hypot(dx, dy);
      if (m > 1) { dx /= m; dy /= m; }
      this.spinSide = dx;
      this.spinTop = -dy; // up = topspin
      spinKnob.style.left = `${50 + dx * 38}%`;
      spinKnob.style.top = `${50 + dy * 38}%`;
    };
    let padActive = false;
    spinPad.addEventListener('pointerdown', e => { padActive = true; spinPad.setPointerCapture(e.pointerId); setSpin(e); e.stopPropagation(); });
    spinPad.addEventListener('pointermove', e => { if (padActive) setSpin(e); });
    spinPad.addEventListener('pointerup', () => { padActive = false; });
    // double-tap the pad to zero spin
    spinPad.addEventListener('dblclick', () => {
      this.spinSide = 0; this.spinTop = 0;
      spinKnob.style.left = '50%'; spinKnob.style.top = '50%';
    });
  }

  /** Slingshot vector: pull back from the ball; launch is the opposite direction. */
  currentShot(): ShotPayload | null {
    if (!this.getBallPos) return null;
    const b = this.getBallPos();
    const dx = b.x - this.dragX, dz = b.z - this.dragZ;
    const len = Math.hypot(dx, dz);
    if (len < 0.005) return null;
    return { dirX: dx / len, dirZ: dz / len, power: Math.min(1, len / 0.55) };
  }
}
