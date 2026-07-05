// MISCUE v2 boot (M0-D): scene + camera + one hand-built table + the fixed-step loop
// that ties physics to render. Rapier is a ~1.1MB wasm payload (dossier §04) — sim.ts
// (and rapier3d-compat underneath it) is dynamic-imported so that cost is paid once,
// here, at boot, not bundled into the top-level chunk graph.
import * as THREE from 'three';
import { CFG } from './config';
import { spawnPlayer, all, type Entity } from './registry';
import type { PhysicsEvents } from './physics-events';
import { buildLevel0 } from './level0';
import { ChaseCamera } from './camera';
import { SceneRig } from './render/scene';
import { BallViews } from './render/balls';
import { buildLevelMeshes } from './render/level';
import { AimLine } from './render/aim';
import * as control from './control';
import { Input, type ShotPayload } from './input';

async function boot(): Promise<void> {
  const { initPhysics, Sim } = await import('./sim');
  await initPhysics();

  const sim = new Sim();
  const { spawn, checkpoint } = buildLevel0(sim);
  const player = spawnPlayer(sim, spawn);
  const entities = all(); // live array (registry.ts) — player is the only entity in M0

  const stats: control.PlayerStatsLike = { stroke: 100 }; // real Stroke economy is M1+

  const speedOf = (e: Entity): number => {
    const v = e.body.linvel();
    return Math.hypot(v.x, v.z);
  };

  // ---------- render + camera ----------
  const app = document.getElementById('app')!;
  app.innerHTML = '';
  const sceneRig = new SceneRig(app);
  const camera = new ChaseCamera(innerWidth / innerHeight);
  sceneRig.setResizeHandler(aspect => camera.setAspect(aspect));
  const ballViews = new BallViews(sceneRig.scene);
  buildLevelMeshes(sceneRig.scene, sim); // terrain meshes straight from the physics defs
  const aimLine = new AimLine(sceneRig.scene);

  // shadow world for the aim preview — same level build, same ball phys (preview.ts).
  const { AimPreview } = await import('./preview');
  const preview = new AimPreview(s => { buildLevel0(s); });

  // grab affordance: glowing ring under the ball whenever it's aim-eligible — the
  // gesture model is "touch the ball to act on it", so the ball says when it's ready.
  const grabRing = new THREE.Mesh(
    new THREE.RingGeometry(CFG.ballR * 1.5, CFG.ballR * 1.95, 36),
    new THREE.MeshBasicMaterial({ color: 0x2ef2c5, transparent: true, opacity: 0.45, side: THREE.DoubleSide }),
  );
  grabRing.rotation.x = -Math.PI / 2;
  grabRing.visible = false;
  sceneRig.scene.add(grabRing);

  // ball position in screen px for input's grab test (null when behind the camera)
  const projScratch = new THREE.Vector3();
  const ballScreenPos = (): { x: number; y: number } | null => {
    const p = player.body.translation();
    projScratch.set(p.x, p.y, p.z).project(camera.camera);
    if (projScratch.z > 1) return null;
    return {
      x: (projScratch.x * 0.5 + 0.5) * innerWidth,
      y: (-projScratch.y * 0.5 + 0.5) * innerHeight,
    };
  };

  // ---------- input ----------
  const input = new Input(sceneRig.renderer.domElement, () => camera.yaw, ballScreenPos);
  let steerDir: { x: number; z: number } | null = null;
  let peekOn = false;
  const peekBtn = document.getElementById('peek');

  let aimShot: ShotPayload | null = null;
  const powerWrap = document.getElementById('powerwrap');
  const powerFill = document.getElementById('powerfill');
  input.canAim = () => control.grounded(player, sim) && speedOf(player) < 0.6;
  input.onFire = s => control.fire(player, { x: s.dirX, z: s.dirZ }, s.power, s.spin ?? { side: 0, top: 0 }, stats);
  input.onAimMove = s => {
    aimShot = s;
    powerWrap?.classList.toggle('on', !!s);
    if (s && powerFill) powerFill.style.width = `${Math.round(s.power * 100)}%`;
    if (!s) aimLine.hide();
  };
  input.onSteer = dir => { steerDir = dir; };
  input.onOrbit = dyaw => camera.orbit(dyaw);
  input.onPeekToggle = () => {
    peekOn = !peekOn;
    camera.peek(peekOn);
    peekBtn?.classList.toggle('on', peekOn);
  };
  input.onSlotTap = () => { /* powerup consume — stub, lands at M4 */ };

  // bullet time + the preview line both key off input's live aim state (onAimMove) —
  // the old parallel pointer tracker is gone with the zone-model rework.

  // ---------- physics events (minimal M0 wiring — full scratch economy is M1+) ----------
  function respawn(e: Entity): void {
    e.body.setTranslation(checkpoint, true);
    e.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    e.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
  }
  const events: PhysicsEvents = {
    onSink: e => respawn(e),   // flavor (real scratch rule) lands with game-state work
    onCollide: () => {},
    onSurface: () => {},
    onPad: () => {},
    onFall: e => respawn(e),
    onGraze: () => {},
  };

  // ---------- fixed-step accumulator loop ----------
  let acc = 0;
  let renderAlpha = 1;

  // advances physics by `simSeconds` of SIMULATED time — shared by the rAF loop (which
  // scales real dt by the bullet-time factor before calling this) and __game.debug.tick
  // (which passes simulated ms straight through, no timescale, for deterministic drives).
  function stepSim(simSeconds: number, maxSteps = 8): void {
    acc += simSeconds;
    let n = 0;
    while (acc >= CFG.h && n < maxSteps) {
      control.updateSpin(player, CFG.h); // forced-spin forces, BEFORE sim.step integrates them
      if (steerDir) control.steer(player, steerDir, CFG.h, stats);
      sim.snapshotPrev(entities);
      sim.step(CFG.h, entities, events);
      acc -= CFG.h;
      n++;
    }
    renderAlpha = Math.min(1, acc / CFG.h);
  }

  let lastT = performance.now();
  function frame(t: number): void {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (t - lastT) / 1000);
    lastT = t;

    // bullet time while aiming (v1's deep-slowmo pattern; the full Stroke-driven
    // bullet-time economy is M1+ — M0 just runs a flat timescale during the drag).
    const timescale = aimShot ? 0.25 : 1;
    stepSim(dt * timescale);

    // aim ribbon: re-simulated in the shadow world every frame the drag is live
    if (aimShot && aimShot.power > 0.02) {
      const p = player.body.translation();
      aimLine.show(preview.simulate(
        p, { x: aimShot.dirX, z: aimShot.dirZ }, aimShot.power,
        aimShot.spin ?? { side: 0, top: 0 },
      ), aimShot.power);
    } else if (!aimShot) {
      aimLine.hide();
    }

    camera.update(dt, { pos: player.body.translation(), vel: player.body.linvel() }, sim);
    ballViews.sync(entities, renderAlpha);

    const grabbable = input.canAim ? input.canAim() : false;
    grabRing.visible = grabbable || aimShot !== null;
    if (grabRing.visible) {
      const p = player.body.translation();
      grabRing.position.set(p.x, p.y - CFG.ballR + 0.015, p.z);
    }

    sceneRig.render(camera.camera);
  }
  requestAnimationFrame(frame);

  document.getElementById('hud')?.classList.add('on');

  // ---------- frozen debug hook (docs/tasks-v2/README.md) ----------
  const debugEnabled = (import.meta as any).env?.DEV || location.search.includes('debug');
  if (debugEnabled) {
    (window as any).__game = {
      debug: {
        state() {
          const p = player.body.translation(), v = player.body.linvel();
          return {
            pos: [p.x, p.y, p.z], vel: [v.x, v.y, v.z],
            grounded: control.grounded(player, sim),
            peek: camera.peeking, yaw: camera.yaw, stroke: stats.stroke,
          };
        },
        fire(dirXZ: { x: number; z: number }, power: number, spin?: { side: number; top: number }) {
          control.fire(player, dirXZ, power, spin ?? { side: 0, top: 0 }, stats);
        },
        warp(x: number, y: number, z: number) {
          player.body.setTranslation({ x, y, z }, true);
          player.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
          player.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
        },
        settle() {
          player.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
          player.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
        },
        enterNode(_kind: string) { /* not until M2 — route/node graph doesn't exist yet */ },
        grantPowerup(_p: string) { /* not until M4 — powerups don't exist yet */ },
        // uncapped step budget: tick(1500) must simulate the full 1.5s. the rAF path
        // keeps its small cap (spiral-of-death guard); tests must not be lied to —
        // the original capped tick made a half-power shot look 10x weaker than live.
        tick(ms: number) { stepSim(Math.min(ms, 20000) / 1000, 1e9); },
        aiming() { return aimShot !== null; },
        ballScreen() { return ballScreenPos(); }, // where the grab test thinks the ball is
        canAim() { return input.canAim ? input.canAim() : false; },
      },
    };
  }
}

boot();
export {};
