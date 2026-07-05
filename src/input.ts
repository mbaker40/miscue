// One input layer, two devices (dossier P4): pointer events cover touch + mouse.
// Slingshot: drag back from the ball, release to fire. Grip only when slowed.
import { Renderer3D } from './render';

export interface ShotPayload { dirX: number; dirZ: number; power: number }

const GRAB_R = 0.12; // how close to the cue a drag must start (logical units; ball r = 0.034)

export class AimInput {
  aiming = false;
  private dragX = 0; private dragZ = 0;
  private aimId: number | null = null; // the one pointer that owns the aim gesture
  spinSide = 0; spinTop = 0;
  onFire: ((s: ShotPayload) => void) | null = null;
  canAim: (() => boolean) | null = null;
  getBallPos: (() => { x: number; z: number }) | null = null;

  constructor(private r3d: Renderer3D, canvas: HTMLElement, spinPad: HTMLElement, spinKnob: HTMLElement) {
    canvas.addEventListener('pointerdown', e => {
      if (this.aiming) return; // a second finger can't steal the gesture
      if (!this.canAim || !this.canAim()) return;
      const p = this.r3d.screenToTable(e.clientX, e.clientY);
      // slingshot starts ON the ball — a stray tap on open felt must not fire
      const b = this.getBallPos ? this.getBallPos() : null;
      if (!b || Math.hypot(p.x - b.x, p.z - b.z) > GRAB_R) return;
      this.aiming = true;
      this.aimId = e.pointerId;
      canvas.setPointerCapture(e.pointerId);
      this.dragX = p.x; this.dragZ = p.z;
    });
    canvas.addEventListener('pointermove', e => {
      if (!this.aiming || e.pointerId !== this.aimId) return;
      const p = this.r3d.screenToTable(e.clientX, e.clientY);
      this.dragX = p.x; this.dragZ = p.z;
    });
    const release = (e: PointerEvent) => {
      if (!this.aiming || e.pointerId !== this.aimId) return;
      this.aiming = false;
      this.aimId = null;
      const s = this.currentShot();
      if (s && s.power > 0.06 && this.onFire) this.onFire(s);
    };
    canvas.addEventListener('pointerup', release);
    canvas.addEventListener('pointercancel', e => {
      if (e.pointerId !== this.aimId) return;
      this.aiming = false; this.aimId = null;
    });

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
    let lastPadDown = 0;
    spinPad.addEventListener('pointerdown', e => {
      // double-tap to zero spin — hand-rolled so it works on touch (dblclick doesn't)
      const now = performance.now();
      if (now - lastPadDown < 300) {
        lastPadDown = 0;
        this.spinSide = 0; this.spinTop = 0;
        spinKnob.style.left = '50%'; spinKnob.style.top = '50%';
        return;
      }
      lastPadDown = now;
      padActive = true;
      spinPad.setPointerCapture(e.pointerId);
      setSpin(e);
    });
    spinPad.addEventListener('pointermove', e => { if (padActive) setSpin(e); });
    spinPad.addEventListener('pointerup', () => { padActive = false; });
    spinPad.addEventListener('pointercancel', () => { padActive = false; });
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
