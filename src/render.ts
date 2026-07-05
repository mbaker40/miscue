// The visual soul (dossier §06): a warm island of felt and neon floating in cold dark.
// One logical table; the camera reframes it portrait or landscape.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { Ball, HALF_W, HALF_L, POCKET_R } from './entities';
import { POCKETS, PathResult } from './physics';

const NEON = 0x2ef2c5;
const MAGENTA = 0xff3ea5;

// ---------- procedural ball textures (shape/pattern ID — accessibility is load-bearing) ----------
function canvasTex(draw: (c: CanvasRenderingContext2D, s: number) => void): THREE.CanvasTexture {
  const s = 256;
  const cv = document.createElement('canvas');
  cv.width = s; cv.height = s;
  const c = cv.getContext('2d')!;
  draw(c, s);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function playerTexture(cracks: number): THREE.CanvasTexture {
  return canvasTex((c, s) => {
    c.fillStyle = '#f5ead6'; c.fillRect(0, 0, s, s);
    const g = c.createRadialGradient(s * 0.4, s * 0.35, s * 0.05, s * 0.5, s * 0.5, s * 0.7);
    g.addColorStop(0, 'rgba(255,230,190,0.9)'); g.addColorStop(1, 'rgba(230,210,180,0)');
    c.fillStyle = g; c.fillRect(0, 0, s, s);
    // cracks: jagged dark polylines, one web per crack taken
    c.strokeStyle = '#3a2f28'; c.lineWidth = 3; c.lineCap = 'round';
    for (let k = 0; k < cracks; k++) {
      const ox = s * (0.2 + 0.3 * ((k * 7) % 3)) * 0.9;
      const oy = s * (0.15 + 0.35 * ((k * 5) % 2));
      let x = ox, y = oy;
      c.beginPath(); c.moveTo(x, y);
      let ang = (k * 2.1) % (Math.PI * 2);
      for (let i = 0; i < 7; i++) {
        ang += (Math.random() - 0.5) * 1.4;
        const len = s * (0.05 + Math.random() * 0.08);
        x += Math.cos(ang) * len; y += Math.sin(ang) * len;
        c.lineTo(x, y);
        if (i === 3) { // branch
          c.moveTo(x, y);
          c.lineTo(x + Math.cos(ang + 1.2) * s * 0.07, y + Math.sin(ang + 1.2) * s * 0.07);
          c.moveTo(x, y);
        }
      }
      c.stroke();
    }
  });
}

const KIND_TEX: Record<string, () => THREE.CanvasTexture> = {
  bumper: () => canvasTex((c, s) => {
    // the bruiser: dark slate + one thick white band
    c.fillStyle = '#3d4450'; c.fillRect(0, 0, s, s);
    c.fillStyle = '#e8e8e8'; c.fillRect(0, s * 0.38, s, s * 0.24);
  }),
  skitter: () => canvasTex((c, s) => {
    // the coward: pale + scatter of dots
    c.fillStyle = '#d9d2c5'; c.fillRect(0, 0, s, s);
    c.fillStyle = '#5a4f42';
    for (let i = 0; i < 26; i++) {
      c.beginPath();
      c.arc((i * 97) % s, (i * 61 + 30) % s, s * 0.03, 0, Math.PI * 2);
      c.fill();
    }
  }),
  charger: () => canvasTex((c, s) => {
    // the hothead: ember + chevrons
    c.fillStyle = '#c8452a'; c.fillRect(0, 0, s, s);
    c.strokeStyle = '#ffd9a0'; c.lineWidth = s * 0.05;
    for (let i = 0; i < 3; i++) {
      const y = s * (0.25 + i * 0.25);
      c.beginPath();
      c.moveTo(s * 0.2, y + s * 0.08); c.lineTo(s * 0.5, y - s * 0.06); c.lineTo(s * 0.8, y + s * 0.08);
      c.stroke();
    }
  }),
  splitter: () => canvasTex((c, s) => {
    // the cheat: two-tone halves, never one identity
    c.fillStyle = '#3f9e5f'; c.fillRect(0, 0, s / 2, s);
    c.fillStyle = '#1d5a36'; c.fillRect(s / 2, 0, s / 2, s);
    c.strokeStyle = '#0c2416'; c.lineWidth = 5;
    c.beginPath(); c.moveTo(s / 2, 0); c.lineTo(s / 2, s); c.stroke();
  }),
  boss: () => canvasTex((c, s) => {
    // the 8-ball
    c.fillStyle = '#0a0a0e'; c.fillRect(0, 0, s, s);
    c.fillStyle = '#f5f0e6';
    c.beginPath(); c.arc(s * 0.5, s * 0.42, s * 0.16, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#0a0a0e';
    c.font = `bold ${s * 0.2}px sans-serif`;
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText('8', s * 0.5, s * 0.43);
  }),
};

// ---------- renderer ----------
interface BallView { mesh: THREE.Mesh; ring?: THREE.Mesh; mat: THREE.MeshStandardMaterial }

export class Renderer3D {
  scene = new THREE.Scene();
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  composer: EffectComposer;
  private views = new Map<number, BallView>();
  private aimLine: THREE.Line;
  private aimGeo = new THREE.BufferGeometry();
  private aimMat: THREE.LineDashedMaterial;
  private ballGeo = new THREE.SphereGeometry(1, 24, 18);
  private playerTexCache: THREE.CanvasTexture[] = [];
  private kindTexCache = new Map<string, THREE.CanvasTexture>();
  private shakeT = 0;
  private camBase = new THREE.Vector3(); // framed camera position; shake offsets from here
  private feltMat: THREE.MeshStandardMaterial;
  private railMats: THREE.MeshStandardMaterial[] = [];
  portrait = true;

  constructor(container: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    container.appendChild(this.renderer.domElement);

    this.scene.background = new THREE.Color(0x05060a);
    this.scene.fog = new THREE.Fog(0x05060a, 2.2, 5.5);

    this.camera = new THREE.PerspectiveCamera(46, 1, 0.1, 20);

    // lights: dim ambient + one warm key over the table
    this.scene.add(new THREE.AmbientLight(0x8899aa, 0.55));
    const key = new THREE.PointLight(0xffe6c0, 22, 8, 1.8);
    key.position.set(0, 2.2, 0);
    this.scene.add(key);

    // felt — the warm island
    this.feltMat = new THREE.MeshStandardMaterial({ color: 0x0a2e22, roughness: 0.92, metalness: 0 });
    const felt = new THREE.Mesh(new THREE.PlaneGeometry(HALF_W * 2 + 0.06, HALF_L * 2 + 0.06), this.feltMat);
    felt.rotation.x = -Math.PI / 2;
    felt.position.y = -0.001;
    this.scene.add(felt);

    // neon rails
    const railH = 0.05, railT = 0.035;
    const mkRail = (w: number, d: number, x: number, z: number) => {
      const m = new THREE.MeshStandardMaterial({
        color: 0x0a1f1a, roughness: 0.4,
        emissive: NEON, emissiveIntensity: 0.9,
      });
      this.railMats.push(m);
      const r = new THREE.Mesh(new THREE.BoxGeometry(w, railH, d), m);
      r.position.set(x, railH / 2, z);
      this.scene.add(r);
    };
    const RW = HALF_W + railT, RL = HALF_L + railT;
    mkRail(RW * 2 + railT * 2, railT, 0, -RL);
    mkRail(RW * 2 + railT * 2, railT, 0, RL);
    mkRail(railT, RL * 2, -RW, 0);
    mkRail(railT, RL * 2, RW, 0);

    // pockets: black holes with magenta lip rings
    for (const p of POCKETS) {
      const hole = new THREE.Mesh(
        new THREE.CircleGeometry(POCKET_R, 24),
        new THREE.MeshBasicMaterial({ color: 0x000000 }),
      );
      hole.rotation.x = -Math.PI / 2;
      hole.position.set(p.x, 0.002, p.z);
      this.scene.add(hole);
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(POCKET_R * 0.92, POCKET_R * 1.12, 24),
        new THREE.MeshStandardMaterial({ color: 0x11040c, emissive: MAGENTA, emissiveIntensity: 1.4, side: THREE.DoubleSide }),
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(p.x, 0.003, p.z);
      this.scene.add(ring);
    }

    // aim preview line
    this.aimMat = new THREE.LineDashedMaterial({ color: NEON, dashSize: 0.03, gapSize: 0.022, transparent: true, opacity: 0.9 });
    this.aimLine = new THREE.Line(this.aimGeo, this.aimMat);
    this.aimLine.visible = false;
    this.scene.add(this.aimLine);

    // bloom — the neon is real
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.85, 0.6, 0.72);
    this.composer.addPass(bloom);
    this.composer.addPass(new OutputPass());

    for (let i = 0; i <= 5; i++) this.playerTexCache.push(playerTexture(i));

    this.resize();
    addEventListener('resize', () => this.resize());
  }

  resize() {
    const w = innerWidth, h = innerHeight;
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.setSize(w, h);
    this.composer.setSize(w, h);
    const aspect = w / h;
    this.camera.aspect = aspect;
    this.portrait = aspect < 1;

    // fit the logical table to the viewport: long axis along the screen's long axis
    const halfV = this.portrait ? HALF_L : HALF_W;
    const halfH = this.portrait ? HALF_W : HALF_L;
    const fovY = THREE.MathUtils.degToRad(this.camera.fov);
    const dV = halfV / Math.tan(fovY / 2);
    const dH = halfH / (Math.tan(fovY / 2) * aspect);
    const dist = Math.max(dV, dH) * 1.22 + 0.25;

    // slight tilt from the player's end for 3D depth; rotated per orientation
    const tilt = 0.22;
    if (this.portrait) {
      this.camera.position.set(0, dist * Math.cos(tilt), dist * Math.sin(tilt));
      this.camera.up.set(0, 0, -1);
    } else {
      this.camera.position.set(dist * Math.sin(tilt), dist * Math.cos(tilt), 0);
      this.camera.up.set(-1, 0, 0);
    }
    this.camera.lookAt(0, 0, 0);
    this.camera.updateProjectionMatrix();
    this.camBase.copy(this.camera.position);
  }

  private texFor(b: Ball): THREE.CanvasTexture {
    if (b.kind === 'player') return this.playerTexCache[0];
    let t = this.kindTexCache.get(b.kind);
    if (!t) { t = KIND_TEX[b.kind](); this.kindTexCache.set(b.kind, t); }
    return t;
  }

  private ensureView(b: Ball): BallView {
    let v = this.views.get(b.id);
    if (v) return v;
    const mat = new THREE.MeshStandardMaterial({
      map: this.texFor(b), roughness: 0.35, metalness: 0.05,
      emissive: b.kind === 'player' ? 0xffd9a0 : 0x000000,
      emissiveIntensity: b.kind === 'player' ? 0.18 : 0,
    });
    const mesh = new THREE.Mesh(this.ballGeo, mat);
    mesh.scale.setScalar(b.r);
    this.scene.add(mesh);
    v = { mesh, mat };
    if (b.elite || b.kind === 'boss') {
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(1.25, 1.5, 24),
        new THREE.MeshStandardMaterial({
          color: 0x2a2005, emissive: b.kind === 'boss' ? MAGENTA : 0xf5c542,
          emissiveIntensity: 1.6, side: THREE.DoubleSide, transparent: true, opacity: 0.9,
        }),
      );
      ring.rotation.x = -Math.PI / 2;
      this.scene.add(ring);
      v.ring = ring;
    }
    this.views.set(b.id, v);
    return v;
  }

  setPlayerCracks(n: number) {
    this.playerCracks = Math.min(n, this.playerTexCache.length - 1);
  }
  private playerCracks = 0;

  telegraph(b: Ball, on: boolean) {
    const v = this.views.get(b.id);
    if (!v) return;
    v.mat.emissive.set(on ? 0xff2222 : 0x000000);
    v.mat.emissiveIntensity = on ? 0.9 : (b.kind === 'player' ? 0.18 : 0);
  }

  bossVulnerable(b: Ball) {
    const v = this.views.get(b.id);
    if (!v) return;
    v.mat.emissive.set(MAGENTA);
    v.mat.emissiveIntensity = 0.5;
  }

  pulse(kind: 'sink' | 'crack') {
    // the neon breathes with the two sounds: pulse on thunk, flicker on crack
    if (kind === 'sink') {
      for (const m of this.railMats) m.emissiveIntensity = 2.2;
    } else {
      for (const m of this.railMats) m.emissiveIntensity = 0.15;
      this.shakeT = 0.25;
    }
  }

  sync(balls: Ball[], dt: number) {
    const seen = new Set<number>();
    for (const b of balls) {
      if (!b.alive) continue;
      seen.add(b.id);
      const v = this.ensureView(b);
      v.mesh.position.set(b.x, b.r, b.z);
      if (b.kind === 'player') {
        const want = this.playerTexCache[this.playerCracks];
        if (v.mat.map !== want) { v.mat.map = want; v.mat.needsUpdate = true; }
      }
      // roll the sphere by travel
      const sp = Math.hypot(b.vx, b.vz);
      if (sp > 0.01) {
        const axis = new THREE.Vector3(b.vz, 0, -b.vx).normalize();
        v.mesh.rotateOnWorldAxis(axis, (sp * dt) / b.r);
      }
      if (v.ring) {
        v.ring.position.set(b.x, 0.004, b.z);
        const s = b.r * (1 + Math.sin(performance.now() * 0.004) * 0.06);
        v.ring.scale.setScalar(s);
      }
    }
    // remove views for dead balls (shrink-out could be added later)
    for (const [id, v] of this.views) {
      if (!seen.has(id)) {
        this.disposeView(v);
        this.views.delete(id);
      }
    }
    // rail glow decays back to baseline
    for (const m of this.railMats) m.emissiveIntensity += (0.9 - m.emissiveIntensity) * Math.min(1, dt * 5);
  }

  showAim(path: PathResult | null) {
    if (!path || path.points.length < 2) { this.aimLine.visible = false; return; }
    const pts = path.points.map(p => new THREE.Vector3(p.x, 0.02, p.z));
    this.aimGeo.setFromPoints(pts);
    this.aimLine.computeLineDistances();
    this.aimMat.color.set(path.danger ? 0xff4a4a : path.hitEnemy ? 0xf5c542 : NEON);
    this.aimLine.visible = true;
  }

  render(dt: number) {
    // shake as an offset from the framed base — never a random walk that drifts the camera
    if (this.shakeT > 0) {
      this.shakeT -= dt;
      const s = Math.max(0, this.shakeT) * 0.02;
      this.camera.position.set(
        this.camBase.x + (Math.random() - 0.5) * s,
        this.camBase.y,
        this.camBase.z + (Math.random() - 0.5) * s,
      );
      if (this.shakeT <= 0) this.camera.position.copy(this.camBase);
    }
    this.composer.render();
  }

  private disposeView(v: BallView) {
    this.scene.remove(v.mesh);
    v.mat.dispose();
    if (v.ring) {
      this.scene.remove(v.ring);
      v.ring.geometry.dispose();
      (v.ring.material as THREE.Material).dispose();
    }
  }

  clearBalls() {
    for (const [, v] of this.views) this.disposeView(v);
    this.views.clear();
  }

  /** Raycast a screen point onto the table plane → logical coords. */
  private pickRay = new THREE.Raycaster();
  private pickPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private pickNdc = new THREE.Vector2();
  private pickOut = new THREE.Vector3();
  screenToTable(cx: number, cy: number): { x: number; z: number } {
    this.pickNdc.set((cx / innerWidth) * 2 - 1, -(cy / innerHeight) * 2 + 1);
    this.pickRay.setFromCamera(this.pickNdc, this.camera);
    this.pickRay.ray.intersectPlane(this.pickPlane, this.pickOut);
    return { x: this.pickOut.x, z: this.pickOut.z };
  }
}
