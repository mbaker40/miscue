// touch/mouse input zone model. pointer events cover touch + mouse (v1 dossier P4).
// ported near-verbatim from v1's src/input.ts: pointer-capture discipline, the
// double-tap-zero spin pad, the single-gesture-owner pattern. what's new for v2:
// aim is screen-space (not table-space) and gets rotated by camera yaw, injected via
// getCameraYaw so this file never imports camera.ts (parallel M0-D packet, same batch).
import type { ShotPayload } from './control';

export type { ShotPayload };

// M0 field report: players naturally grab the ball itself, which sits near screen
// CENTER in chase view — a "lower zone only" aim read their drags as orbit and the
// camera slewed 1:1 with the finger ("spazzes all over the screen"). New model:
// a single-finger drag ANYWHERE aims (when eligible) or steers (when coasting);
// only the top ORBIT_ZONE_FRAC strip single-drags as orbit. Two fingers always orbit.
const ORBIT_ZONE_FRAC = 0.2;

// screen px of pull-back that reads as full (100%) power. scaled off the smaller
// viewport dimension so it feels the same on a tall phone or a wide tablet.
const AIM_PULL_FRAC = 0.22;

// a stray tap must not fire (mirrors v1's power > 0.06 gate).
const MIN_FIRE_POWER = 0.06;

// yaw radians of orbit per pixel of orbit drag. feel constant, not a CFG number —
// this file owns its own UI tuning, config.ts is physics/camera tunables only.
const ORBIT_SENS = 0.006;

const DBL_TAP_MS = 300;

// --- aim sign convention -----------------------------------------------------
// slingshot: the shot fires OPPOSITE the drag (v1). in chase view, dragging DOWN
// (toward the player's thumb) pulls the cue back, so the shot fires FORWARD along
// the camera's facing; dragging sideways (dx) fires the opposite lateral way.
// three.js convention: camera looks down -Z at yaw 0, so at yaw the forward/right
// basis vectors in the XZ plane are:
//   forward = (-sin yaw, -cos yaw)     right = (cos yaw, -sin yaw)
// shot dir = normalize(forward*(dragDy*AIM_FWD_SIGN) + right*(dragDx*AIM_LAT_SIGN))
// these two signs are the ENTIRE aim convention — if the feel test says a shot goes
// backwards or mirrored, flip one of these two constants, nothing else.
const AIM_FWD_SIGN = 1;
const AIM_LAT_SIGN = -1;

type Mode = 'none' | 'aim' | 'steer' | 'orbit1' | 'orbit2';

export class Input {
  // wired by main.ts
  canAim: (() => boolean) | null = null;
  onFire: ((s: ShotPayload) => void) | null = null;
  // live aim state for the preview line + bullet time: fires with the current shot on
  // every aim-drag move, and with null when the drag ends (fired or not).
  onAimMove: ((s: ShotPayload | null) => void) | null = null;
  onSteer: ((dir: { x: number; z: number } | null) => void) | null = null;
  onOrbit: ((dyawRad: number) => void) | null = null;
  onPeekToggle: (() => void) | null = null;
  onSlotTap: (() => void) | null = null;

  // spin pad state — read by main.ts at fire() time
  spinSide = 0;
  spinTop = 0;

  private pointers = new Map<number, { x: number; y: number }>();
  private mode: Mode = 'none';
  private gestureId: number | null = null; // the one pointer that owns aim/steer/orbit1
  private startX = 0; private startY = 0;
  private curX = 0; private curY = 0;
  private orbitCx = 0; private orbitCy = 0; // last two-finger centroid

  constructor(private canvas: HTMLElement, private getCameraYaw: () => number) {
    canvas.addEventListener('pointerdown', e => this.down(e));
    canvas.addEventListener('pointermove', e => this.move(e));
    canvas.addEventListener('pointerup', e => this.up(e));
    canvas.addEventListener('pointercancel', e => this.up(e));

    this.wireSpinPad();
    const peek = document.getElementById('peek');
    peek?.addEventListener('click', () => this.onPeekToggle?.());
    const slot = document.getElementById('slot');
    slot?.addEventListener('click', () => this.onSlotTap?.());
  }

  private zoneIsOrbit(y: number): boolean {
    return y < window.innerHeight * ORBIT_ZONE_FRAC;
  }

  private centroid(): { x: number; y: number } {
    let x = 0, y = 0;
    for (const p of this.pointers.values()) { x += p.x; y += p.y; }
    const n = this.pointers.size || 1;
    return { x: x / n, y: y / n };
  }

  private down(e: PointerEvent): void {
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (this.pointers.size === 2) {
      // a second finger always wins: whatever single-pointer gesture was running dies,
      // both fingers become orbit.
      if (this.mode === 'steer') this.onSteer?.(null);
      if (this.mode === 'aim') this.onAimMove?.(null);
      this.mode = 'orbit2';
      this.gestureId = null;
      const c = this.centroid();
      this.orbitCx = c.x; this.orbitCy = c.y;
      return;
    }
    if (this.pointers.size > 2 || this.mode !== 'none') return; // 3rd finger, or gesture already claimed

    this.canvas.setPointerCapture?.(e.pointerId);
    this.gestureId = e.pointerId;
    this.startX = this.curX = e.clientX;
    this.startY = this.curY = e.clientY;

    if (this.zoneIsOrbit(e.clientY)) { this.mode = 'orbit1'; return; }
    // everywhere else: aim if eligible (grounded + slow), otherwise the same drag
    // reads as steering — decided once at gesture start, same as v1's canAim() check.
    this.mode = this.canAim && this.canAim() ? 'aim' : 'steer';
    if (this.mode === 'aim') this.onAimMove?.(this.currentShot());
  }

  private move(e: PointerEvent): void {
    if (!this.pointers.has(e.pointerId)) return;
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (this.mode === 'orbit2') {
      const c = this.centroid();
      this.onOrbit?.((c.x - this.orbitCx) * ORBIT_SENS);
      this.orbitCx = c.x; this.orbitCy = c.y;
      return;
    }
    if (e.pointerId !== this.gestureId) return;

    if (this.mode === 'orbit1') {
      this.onOrbit?.((e.clientX - this.curX) * ORBIT_SENS);
      this.curX = e.clientX; this.curY = e.clientY;
      return;
    }
    this.curX = e.clientX; this.curY = e.clientY;
    if (this.mode === 'steer') this.onSteer?.(this.dragDirXZ());
    else if (this.mode === 'aim') this.onAimMove?.(this.currentShot());
  }

  private up(e: PointerEvent): void {
    this.pointers.delete(e.pointerId);

    if (this.mode === 'orbit2') {
      if (this.pointers.size < 2) this.mode = 'none'; // a lone remaining finger doesn't inherit the gesture
      return;
    }
    if (e.pointerId !== this.gestureId) return;

    if (this.mode === 'aim') {
      const s = this.currentShot();
      this.onAimMove?.(null);
      if (s && s.power > MIN_FIRE_POWER) this.onFire?.(s);
    } else if (this.mode === 'steer') {
      this.onSteer?.(null);
    }
    this.mode = 'none';
    this.gestureId = null;
  }

  // world-space (camera-relative XZ) drag vector — the one aim-convention function.
  // used by both the aim shot (opposite-of-drag) and the continuous steer direction:
  // steering re-reads the same "same drag, reinterpreted" gesture per the M0-C spec.
  private dragDirXZ(): { x: number; z: number } {
    const dragDx = this.curX - this.startX;
    const dragDy = this.curY - this.startY;
    const yaw = this.getCameraYaw();
    const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
    const rx = Math.cos(yaw), rz = -Math.sin(yaw);
    const fwd = dragDy * AIM_FWD_SIGN;
    const lat = dragDx * AIM_LAT_SIGN;
    const x = fx * fwd + rx * lat, z = fz * fwd + rz * lat;
    const len = Math.hypot(x, z);
    return len > 1e-6 ? { x: x / len, z: z / len } : { x: 0, z: 0 };
  }

  private currentShot(): ShotPayload | null {
    const dir = this.dragDirXZ();
    if (dir.x === 0 && dir.z === 0) return null;
    const dragPx = Math.hypot(this.curX - this.startX, this.curY - this.startY);
    const pullPx = Math.min(window.innerWidth, window.innerHeight) * AIM_PULL_FRAC;
    const power = Math.min(1, dragPx / pullPx);
    return { dirX: dir.x, dirZ: dir.z, power, spin: { side: this.spinSide, top: this.spinTop } };
  }

  // spin pad: draggable knob -> english (x) and follow/draw (y). ported verbatim
  // from v1's src/input.ts, including the hand-rolled double-tap (dblclick doesn't
  // fire reliably on touch).
  private wireSpinPad(): void {
    const pad = document.getElementById('spinpad');
    const knob = document.getElementById('spinknob');
    if (!pad || !knob) return;

    const setSpin = (e: PointerEvent) => {
      const rect = pad.getBoundingClientRect();
      let dx = (e.clientX - (rect.left + rect.width / 2)) / (rect.width / 2);
      let dy = (e.clientY - (rect.top + rect.height / 2)) / (rect.height / 2);
      const m = Math.hypot(dx, dy);
      if (m > 1) { dx /= m; dy /= m; }
      this.spinSide = dx;
      this.spinTop = -dy; // up = topspin
      knob.style.left = `${50 + dx * 38}%`;
      knob.style.top = `${50 + dy * 38}%`;
    };
    let padActive = false;
    let lastPadDown = 0;
    pad.addEventListener('pointerdown', e => {
      const now = performance.now();
      if (now - lastPadDown < DBL_TAP_MS) {
        lastPadDown = 0;
        this.spinSide = 0; this.spinTop = 0;
        knob.style.left = '50%'; knob.style.top = '50%';
        return;
      }
      lastPadDown = now;
      padActive = true;
      pad.setPointerCapture(e.pointerId);
      setSpin(e);
    });
    pad.addEventListener('pointermove', e => { if (padActive) setSpin(e); });
    pad.addEventListener('pointerup', () => { padActive = false; });
    pad.addEventListener('pointercancel', () => { padActive = false; });
  }
}
