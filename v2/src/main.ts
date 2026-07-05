// MISCUE v2 boot (M0-D): scene + camera + one hand-built table + the fixed-step loop
// that ties physics to render. Rapier is a ~1.1MB wasm payload (dossier §04) — sim.ts
// (and rapier3d-compat underneath it) is dynamic-imported so that cost is paid once,
// here, at boot, not bundled into the top-level chunk graph.
import { CFG } from './config';
import { spawnPlayer, all, type Entity } from './registry';
import type { PhysicsEvents } from './physics-events';
import { buildLevel0 } from './level0';
import { ChaseCamera } from './camera';
import { SceneRig } from './render/scene';
import { BallViews } from './render/balls';
import * as control from './control';
import { Input } from './input';

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

  // felt slab + ramp + bank + island are physics-only in M0 (buildLevel0 has no mesh
  // side); nothing to add here yet beyond the ball itself — level render art is a
  // later milestone. (render/fx.ts, chunk render, etc.)

  // ---------- input ----------
  const input = new Input(sceneRig.renderer.domElement, () => camera.yaw);
  let steerDir: { x: number; z: number } | null = null;
  let peekOn = false;
  const peekBtn = document.getElementById('peek');

  input.canAim = () => control.grounded(player, sim) && speedOf(player) < 0.6;
  input.onFire = s => control.fire(player, { x: s.dirX, z: s.dirZ }, s.power, s.spin ?? { side: 0, top: 0 }, stats);
  input.onSteer = dir => { steerDir = dir; };
  input.onOrbit = dyaw => camera.orbit(dyaw);
  input.onPeekToggle = () => {
    peekOn = !peekOn;
    camera.peek(peekOn);
    peekBtn?.classList.toggle('on', peekOn);
  };
  input.onSlotTap = () => { /* powerup consume — stub, lands at M4 */ };

  // input.ts has no public "actively aiming" flag (its gesture state is private), and
  // main.ts needs one for bullet-time (dossier's deep-slowmo-while-aiming feel, v1
  // pattern). Rather than edit input.ts, track it in parallel here with the same
  // lower-zone/canAim gate input.ts uses internally — a light seam adaptation, not a
  // second source of truth for the gesture itself (input.ts still owns fire/steer).
  let aiming = false;
  let aimPointerId: number | null = null;
  const LOWER_ZONE_FRAC = 0.55;
  sceneRig.renderer.domElement.addEventListener('pointerdown', e => {
    if (aimPointerId !== null) return;
    const inLowerZone = e.clientY >= innerHeight * (1 - LOWER_ZONE_FRAC);
    if (inLowerZone && input.canAim && input.canAim()) { aiming = true; aimPointerId = e.pointerId; }
  });
  const endAimTrack = (e: PointerEvent) => {
    if (e.pointerId === aimPointerId) { aiming = false; aimPointerId = null; }
  };
  sceneRig.renderer.domElement.addEventListener('pointerup', endAimTrack);
  sceneRig.renderer.domElement.addEventListener('pointercancel', endAimTrack);

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
  function stepSim(simSeconds: number): void {
    acc += simSeconds;
    let n = 0;
    while (acc >= CFG.h && n < 8) {
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
    const timescale = aiming ? 0.25 : 1;
    stepSim(dt * timescale);

    camera.update(dt, { pos: player.body.translation(), vel: player.body.linvel() }, sim);
    ballViews.sync(entities, renderAlpha);
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
        tick(ms: number) { stepSim(ms / 1000); },
      },
    };
  }
}

boot();
export {};
