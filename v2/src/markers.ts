// enemy markers (pulled forward from M4 in minimal form — M1.5 playability pass).
// The chase cam looks where YOU are going; the moment you strike a ball it leaves the
// frame and the objective goes invisible (field report: "hard to keep track of the
// enemies"). A DOM pool in #markers keeps every live enemy readable: a kind-colored
// diamond floating over on-screen enemies, a clamped edge arrow pointing at off-screen
// ones, a red pulse while a charger/boss is telegraphing. M4 replaces this with the
// full HUD-v2 treatment; the contract here is deliberately tiny: sync(entities, cam).
import * as THREE from 'three';
import type { Entity, Kind } from './registry';

// brightened relative to render/balls.ts KIND_COLOR — these sit on near-black.
const KIND_HEX: Record<Kind, string> = {
  player: '#ffffff', // never shown
  bumper: '#8fa1b8',
  skitter: '#e8e2d4',
  charger: '#ff6a3d',
  splitter: '#54c97c',
  boss: '#e9e4f7',
};

const EDGE_MARGIN = 26; // px — clear of notch/HUD corners
const TELEGRAPH_HZ = 10;

export class Markers {
  private pool: HTMLDivElement[] = [];
  private world = new THREE.Vector3();
  private ndc = new THREE.Vector3();

  constructor(private layer: HTMLElement) {}

  private ensure(i: number): HTMLDivElement {
    while (this.pool.length <= i) {
      const d = document.createElement('div');
      d.style.cssText =
        'position:absolute;left:0;top:0;font-size:15px;line-height:1;pointer-events:none;' +
        'will-change:transform;text-shadow:0 0 6px rgba(0,0,0,.9);display:none;';
      this.layer.appendChild(d);
      this.pool.push(d);
    }
    return this.pool[i];
  }

  sync(entities: Entity[], camera: THREE.PerspectiveCamera): void {
    const w = innerWidth, h = innerHeight;
    const t = performance.now() / 1000;
    let i = 0;
    for (const e of entities) {
      if (!e.alive || e.kind === 'player') continue;
      const el = this.ensure(i++);
      const p = e.body.translation();
      this.world.set(p.x, p.y + e.r * 2 + 0.3, p.z);

      // behind-camera check first — project() mirrors coordinates for points behind
      // the eye, so the raw NDC can look "on screen" while the enemy is at your back.
      this.ndc.copy(this.world).applyMatrix4(camera.matrixWorldInverse);
      const behind = this.ndc.z > 0; // three cameras look down -z
      this.ndc.copy(this.world).project(camera);
      let sx = (this.ndc.x * 0.5 + 0.5) * w;
      let sy = (-this.ndc.y * 0.5 + 0.5) * h;
      if (behind) { sx = w - sx; sy = h - sy; }
      const off = behind || sx < 0 || sx > w || sy < 0 || sy > h;

      const telegraphing = (e.kind === 'charger' || e.kind === 'boss') && e.ai.state === 1;
      const color = telegraphing ? '#ff4a4a' : KIND_HEX[e.kind];
      const scale = telegraphing ? 1.15 + 0.25 * Math.sin(t * TELEGRAPH_HZ * Math.PI * 2)
        : e.elite || e.kind === 'boss' ? 1.25 : 1;

      if (off) {
        sx = Math.max(EDGE_MARGIN, Math.min(w - EDGE_MARGIN, sx));
        sy = Math.max(EDGE_MARGIN, Math.min(h - EDGE_MARGIN, sy));
        const rot = Math.atan2(sy - h / 2, sx - w / 2); // arrow points outward at the enemy
        el.textContent = '➤';
        el.style.transform =
          `translate(${sx}px, ${sy}px) translate(-50%,-50%) rotate(${rot}rad) scale(${scale})`;
      } else {
        el.textContent = '◆';
        el.style.transform = `translate(${sx}px, ${sy}px) translate(-50%,-50%) scale(${scale})`;
      }
      el.style.color = color;
      el.style.display = 'block';
      // the hot-pink halo is the elite tell, same hue as the render's emissive rim
      el.style.textShadow = e.elite
        ? '0 0 8px rgba(255,62,165,.95), 0 0 3px rgba(0,0,0,.9)'
        : '0 0 6px rgba(0,0,0,.9)';
    }
    for (let k = i; k < this.pool.length; k++) this.pool[k].style.display = 'none';
  }
}
