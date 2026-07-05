// MISCUE v2 boot (M1-C): the combat table wired in — waves, enemies, cracks, chalk,
// stroke. Rapier is a ~1.1MB wasm payload (dossier §04) — sim.ts (and rapier3d-compat
// underneath it) is dynamic-imported so that cost is paid once, here, at boot, not
// bundled into the top-level chunk graph.
import * as THREE from 'three';
import { CFG } from './config';
import { spawnPlayer, all, type Entity } from './registry';
import type { PhysicsEvents } from './physics-events';
import { buildLevel0 } from './level0';
import { buildArena0 } from './arena0';
import { ChaseCamera } from './camera';
import { SceneRig } from './render/scene';
import { BallViews } from './render/balls';
import { buildLevelMeshes } from './render/level';
import { AimLine } from './render/aim';
import * as control from './control';
import { Input, type ShotPayload } from './input';
import { Game } from './game';
import { Hud } from './hud';
import { Markers } from './markers';
import * as audio from './audio';
import type { AiFx, Bounds } from './enemies';

declare const __BUILD_ID__: string;

async function boot(): Promise<void> {
  // build stamp — always visible, ends every "is this the new build?" debate.
  // first cut was 8px dark-teal at top:2px: technically rendered, humanly invisible
  // on a phone (under the notch, no contrast). now: legible, notch-safe, and echoed
  // into the tab title + console for two more independent readouts.
  const buildId = typeof __BUILD_ID__ !== 'undefined' ? __BUILD_ID__ : 'dev';
  const stamp = document.createElement('div');
  stamp.textContent = `build ${buildId}`;
  stamp.style.cssText =
    'position:fixed;top:max(12px, env(safe-area-inset-top));left:50%;transform:translateX(-50%);' +
    'font-size:11px;letter-spacing:.12em;color:#6fae9e;text-shadow:0 0 8px rgba(46,242,197,.45);' +
    'z-index:30;pointer-events:none;font-family:inherit;';
  document.body.appendChild(stamp);
  document.title += ` · ${buildId}`;
  console.log(`MISCUE v2 — build ${buildId}`);
  const { initPhysics, Sim } = await import('./sim');
  await initPhysics();

  const sim = new Sim();

  // ?level=feel keeps the M0 table + plain respawn events (no combat) so the M0
  // regression suite still runs unmodified; the default boot is the M1 combat table.
  const params = new URLSearchParams(location.search);
  const feelMode = params.get('level') === 'feel';
  const levelBuilder = feelMode ? buildLevel0 : buildArena0;

  let spawn: { x: number; y: number; z: number };
  let checkpoint: { x: number; y: number; z: number };
  let bounds: Bounds = { halfW: 5, halfL: 5 };
  let pockets: { x: number; y: number; z: number; id: number }[] = [];
  if (feelMode) {
    const lvl = buildLevel0(sim);
    spawn = lvl.spawn; checkpoint = lvl.checkpoint;
  } else {
    const lvl = buildArena0(sim);
    spawn = lvl.spawn; checkpoint = lvl.checkpoint; bounds = lvl.bounds; pockets = lvl.pockets;
  }

  const player = spawnPlayer(sim, spawn);
  const entities = all(); // live array (registry.ts)

  // ---------- render + camera ----------
  const app = document.getElementById('app')!;
  app.innerHTML = '';
  const sceneRig = new SceneRig(app);
  const camera = new ChaseCamera(innerWidth / innerHeight);
  sceneRig.setResizeHandler(aspect => camera.setAspect(aspect));
  const ballViews = new BallViews(sceneRig.scene);
  buildLevelMeshes(sceneRig.scene, sim); // terrain meshes straight from the physics defs
  const aimLine = new AimLine(sceneRig.scene);
  const markers = new Markers(document.getElementById('markers')!);

  // shadow world for the aim preview — same level build, same ball phys (preview.ts).
  // levelBuilder's return value is discarded (AimPreview's build param is (sim)=>void).
  const { AimPreview } = await import('./preview');
  const preview = new AimPreview(levelBuilder);

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

  const speedOf = (e: Entity): number => {
    const v = e.body.linvel();
    return Math.hypot(v.x, v.z);
  };

  // ---------- game state (M1: combat slice) or plain M0 stats, depending on level ----------
  const hud = feelMode ? null : new Hud();
  const fx: AiFx = { telegraph: (e, on) => ballViews.setTelegraph(e, on) };
  // Game construction is deferred behind the intro overlay (M1.5) — waves must not
  // spawn while a new player is still reading how to play. Debug/feel boots skip the
  // intro, so every headless suite constructs (or omits) the Game exactly as before.
  let game: Game | null = null;
  const startGame = (): void => {
    if (!feelMode && !game) game = new Game({ sim, player, bounds, pockets, checkpoint, hud: hud!, fx });
  };
  const fallbackStats: control.PlayerStatsLike = { stroke: 100 }; // feel mode / pre-intro
  const statsNow = (): control.PlayerStatsLike => (game ? game.stats : fallbackStats);

  // ---------- input ----------
  const input = new Input(sceneRig.renderer.domElement, () => camera.yaw, ballScreenPos);
  let steerDir: { x: number; z: number } | null = null;
  let peekOn = false;
  const peekBtn = document.getElementById('peek');

  let aimShot: ShotPayload | null = null;
  const powerWrap = document.getElementById('powerwrap');
  const powerFill = document.getElementById('powerfill');
  input.canAim = () => control.grounded(player, sim) && speedOf(player) < 0.6;
  input.onFire = s => {
    const dir = { x: s.dirX, z: s.dirZ };
    const spin = s.spin ?? { side: 0, top: 0 };
    if (game) game.fire(dir, s.power, spin);
    else control.fire(player, dir, s.power, spin, statsNow());
  };
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

  // ---------- physics events: the real combat wiring (game.events) or M0's plain
  // respawn-on-sink/-fall stubs when ?level=feel keeps the old regression table. ----------
  function respawn(e: Entity): void {
    e.body.setTranslation(checkpoint, true);
    e.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    e.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
  }
  // delegating object: before the intro is dismissed (game === null) sinks/falls just
  // respawn, which is also the entire ?level=feel behavior — one seam serves both.
  const events: PhysicsEvents = {
    onSink: (e, id) => { if (game) game.events.onSink(e, id); else respawn(e); },
    onCollide: (a, b, impact, tangent) => { game?.events.onCollide(a, b, impact, tangent); },
    onSurface: (e, impact, kind) => { game?.events.onSurface(e, impact, kind); },
    onPad: (e, id) => { game?.events.onPad(e, id); },
    onFall: e => { if (game) game.events.onFall(e); else respawn(e); },
    onGraze: (e, id) => { game?.events.onGraze(e, id); },
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
      if (steerDir) control.steer(player, steerDir, CFG.h, statsNow());
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

    // bullet time: game.ts owns the CFG.combat aim economy (replaces M0's flat 0.25);
    // in ?level=feel there's no Game, so keep M0's flat behavior for suite compatibility.
    let sdt: number;
    if (game) {
      sdt = game.preStep(dt, aimShot !== null);
    } else {
      const timescale = aimShot ? 0.25 : 1;
      sdt = dt * timescale;
    }
    stepSim(sdt);
    if (game) game.postStep(sdt);

    // aim ribbon: re-simulated in the shadow world every frame the drag is live.
    // live enemies ride along as overlap obstacles (M1-D) so the line stops honestly
    // at the first ball it would meet — only built while aiming, so no steady-state cost.
    if (aimShot && aimShot.power > 0.02) {
      const p = player.body.translation();
      const obstacles = entities
        .filter(e => e.alive && e.kind !== 'player')
        .map(e => {
          const t = e.body.translation();
          return { x: t.x, y: t.y, z: t.z, r: e.r };
        });
      aimLine.show(preview.simulate(
        p, { x: aimShot.dirX, z: aimShot.dirZ }, aimShot.power,
        aimShot.spin ?? { side: 0, top: 0 }, obstacles,
      ), aimShot.power);
    } else if (!aimShot) {
      aimLine.hide();
    }

    camera.update(dt, { pos: player.body.translation(), vel: player.body.linvel() }, sim);
    ballViews.sync(entities, renderAlpha);
    markers.sync(entities, camera.camera);

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

  const debugEnabled = (import.meta as any).env?.DEV || location.search.includes('debug');

  // ---------- intro gate (M1.5): the 3 lines a new player needs, then BREAK ----------
  // skipped in feel mode (no combat) and debug/dev boots (headless suites unchanged).
  const overlay = document.getElementById('overlay');
  const panel = document.getElementById('panel');
  if (!feelMode && !debugEnabled && overlay && panel) {
    panel.innerHTML =
      '<h1>MISCUE</h1>' +
      '<div class="sub">Drag <b>from the cue ball</b> — pull back, let go.<br>' +
      'Knock the other balls into the pockets before they crack you.<br>' +
      "Don't fall off the table.</div>" +
      '<button class="btn gold center" id="break-btn"><b>BREAK</b></button>';
    overlay.classList.add('on');
    document.getElementById('break-btn')?.addEventListener('click', () => {
      overlay.classList.remove('on');
      audio.unlockAudio(); // the tap that starts the run is the gesture that unlocks sound
      startGame();
    }, { once: true });
  } else {
    startGame();
  }

  // ---------- frozen debug hook (docs/tasks-v2/README.md) ----------
  if (debugEnabled) {
    (window as any).__game = {
      debug: {
        state() {
          const p = player.body.translation(), v = player.body.linvel();
          return {
            pos: [p.x, p.y, p.z], vel: [v.x, v.y, v.z],
            grounded: control.grounded(player, sim),
            peek: camera.peeking, yaw: camera.yaw, stroke: statsNow().stroke,
          };
        },
        fire(dirXZ: { x: number; z: number }, power: number, spin?: { side: number; top: number }) {
          if (game) game.fire(dirXZ, power, spin ?? { side: 0, top: 0 });
          else control.fire(player, dirXZ, power, spin ?? { side: 0, top: 0 }, statsNow());
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
        // M1: also drives the combat per-frame contract (enemy AI + wave progression)
        // at the SAME simulated seconds, bypassing bullet-time scaling — deterministic.
        tick(ms: number) {
          const simSeconds = Math.min(ms, 20000) / 1000;
          if (game) game.stepCombat(simSeconds);
          stepSim(simSeconds, 1e9);
          if (game) game.postStep(simSeconds);
        },
        aiming() { return aimShot !== null; },
        ballScreen() { return ballScreenPos(); }, // where the grab test thinks the ball is
        canAim() { return input.canAim ? input.canAim() : false; },
        // --- M1-C additive debug surface: enemy spawning + combat readout ---
        spawn(kind: string, x: number, z: number, elite = false) {
          if (!game) return null;
          const e = game.spawnDebug(kind as any, x, z, elite);
          return e.id;
        },
        clearEnemies() { if (game) game.clearEnemies(); },
        combat() { return game ? game.combatState() : null; },
      },
    };
  }
}

boot();
export {};
