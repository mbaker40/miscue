// three.js scene shell: renderer, fog into the void, minimal lighting, resize.
// Bloom/composer and ball textures are a later milestone's render/fx.ts — this stays
// genuinely minimal, flat MeshStandardMaterial colors only.
import * as THREE from 'three';
import { CFG } from '../config';

const VOID = 0x05060a;

export class SceneRig {
  scene = new THREE.Scene();
  renderer: THREE.WebGLRenderer;
  private onResize: ((aspect: number) => void) | null = null;

  constructor(container: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, CFG.fx.dprCap));
    container.appendChild(this.renderer.domElement);

    this.scene.background = new THREE.Color(VOID);
    this.scene.fog = new THREE.Fog(VOID, 7, 24); // the long tables float in cold dark (dossier §06)

    this.scene.add(new THREE.AmbientLight(0x8899aa, 0.55));
    const key = new THREE.DirectionalLight(0xffe6c0, 1.15);
    key.position.set(5, 9, 4);
    this.scene.add(key);

    this.resize();
    addEventListener('resize', () => this.resize());
  }

  /** Called once by main.ts to keep the camera's aspect in lockstep with resize. */
  setResizeHandler(cb: (aspect: number) => void): void {
    this.onResize = cb;
    cb(innerWidth / innerHeight);
  }

  resize(): void {
    const w = innerWidth, h = innerHeight;
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, CFG.fx.dprCap));
    this.renderer.setSize(w, h);
    this.onResize?.(w / h);
  }

  render(camera: THREE.Camera): void {
    this.renderer.render(this.scene, camera);
  }
}
