// The rack loop (dossier D2-D3): waves spawn, enemies think, physics events become
// cracks/chalk/stroke/SFX, racks clear and escalate. Composition root for M1 combat —
// A/B (enemies/waves/arena/render/audio) built the parts, this file wires them into
// PhysicsEvents + a per-frame update contract main.ts drives. Ported from v1 /src/game.ts,
// re-hosted on Rapier entities; route/upgrades/panels are M2, not here.
import { CFG } from './config';
import { Entity, Kind, spawnEnemy, despawn, spawnSplitChildren, all } from './registry';
import type { Sim, Vec3 } from './sim';
import type { PhysicsEvents } from './physics-events';
import { updateEnemies, seedSpawnTimer, type AiFx, type Bounds } from './enemies';
import { makeRack, makeBossWaves, makeMiniBossWaves, spawnWave, type Wave } from './waves';
import { dailySeed, seedAiRng, subRng, RACK_TAG, AI_TAG } from './rng';
import type { Hud } from './hud';
import * as control from './control';
import * as audio from './audio';

function speedOf(e: Entity): number {
  const v = e.body.linvel();
  return Math.hypot(v.x, v.z);
}

export interface GameOpts {
  sim: Sim;
  player: Entity;
  bounds: Bounds;
  pockets: { x: number; y: number; z: number; id: number }[];
  checkpoint: Vec3;
  hud: Hud;
  fx: AiFx;
}

// 'clear' is the ~1.2s TABLE CLEAR beat between rackCleared() firing and the next
// startRack() — a transitional phase, distinct from 'playing', so it doubles as a
// re-entrancy guard: the live rAF loop and a test's manual debug.tick() can both call
// postStep() within the same real-time window, and without this gate a wave-cleared
// detection from one caller races a second from the other, double-firing rackCleared()
// (each scheduling its own setTimeout) and cascading through several racks at once.
type Phase = 'playing' | 'clear' | 'dead' | 'won';

export class Game {
  private sim: Sim;
  private player: Entity;
  private bounds: Bounds;
  private pockets: { x: number; y: number; z: number; id: number }[];
  private checkpoint: Vec3;
  private hud: Hud;
  private fx: AiFx;

  readonly events: PhysicsEvents;
  readonly stats: control.PlayerStatsLike = { stroke: CFG.combat.strokeStart, maxPower: 1 };

  get stroke(): number { return this.stats.stroke; }
  set stroke(v: number) { this.stats.stroke = v; }

  phase: Phase = 'playing';
  depth = 1;
  chalk = 0;
  cracks = 0;
  iFrames = 0;

  private isBoss = false;
  private isMiniBoss = false;
  private banksThisShot = 0;
  private sinksThisShot = 0;
  private grazedPockets = new Set<number>();
  private waveIdx = -1;
  private waveCalm = CFG.combat.calmStart;
  private waveAge = 0;
  private waves: Wave[] = [];
  private boss: Entity | null = null;

  constructor(opts: GameOpts) {
    this.sim = opts.sim;
    this.player = opts.player;
    this.bounds = opts.bounds;
    this.pockets = opts.pockets;
    this.checkpoint = opts.checkpoint;
    this.hud = opts.hud;
    this.fx = opts.fx;

    this.events = {
      onSink: (e, pocketId) => this.onSink(e, pocketId),
      onCollide: (a, b, impact, tangent) => this.onCollide(a, b, impact, tangent),
      onSurface: (e, impact, kind) => this.onSurface(e, impact, kind),
      onPad: () => {},
      onFall: e => this.onFall(e),
      onGraze: (e, pocketId) => this.onGraze(e, pocketId),
    };

    addEventListener('pointerdown', () => audio.unlockAudio(), { once: true });

    const params = new URLSearchParams(location.search);
    const dParam = parseInt(params.get('depth') ?? '', 10);
    const startDepth = Number.isFinite(dParam) && dParam >= 1 && dParam <= 8 ? dParam : 1;

    // AI stream seeded once at boot (not re-seeded per rack) — v2 depths run 1..8.
    seedAiRng((dailySeed() ^ AI_TAG) >>> 0);

    this.hud.showHud(true);
    this.startRack(startDepth);
  }

  // ---------- fire wiring (input.onFire calls this, then control.fire does the physics) ----------
  fire(dirXZ: { x: number; z: number }, power: number, spin: { side: number; top: number }): void {
    this.banksThisShot = 0;
    this.sinksThisShot = 0;
    this.grazedPockets.clear();
    audio.whoosh(power);
    control.fire(this.player, dirXZ, power, spin, this.stats);
  }

  // ---------- per-frame drive (main.ts's rAF loop calls preStep then stepSim(sdt) then postStep) ----------
  /** bullet time + enemy AI think; returns the scaled dt to feed the physics step. */
  preStep(dt: number, aiming: boolean): number {
    if (this.phase !== 'playing') return 0;
    let sdt: number;
    if (aiming) {
      if (this.stroke > 1) {
        sdt = dt * CFG.combat.aimTimescale;
        this.stroke = Math.max(0, this.stroke - CFG.combat.aimDrainPerSec * dt);
      } else {
        sdt = dt * CFG.combat.aimTimescaleEmpty;
      }
    } else {
      sdt = dt;
    }
    this.stepCombat(sdt);
    return sdt;
  }

  /** iFrames decay + enemy AI actuation — split out so debug.tick can drive it without
   *  re-deriving bullet time (tick passes simulated ms straight through, per the README's
   *  frozen debug hook contract). */
  stepCombat(sdt: number): void {
    if (this.phase !== 'playing') return;
    this.iFrames = Math.max(0, this.iFrames - sdt);
    updateEnemies(this.nonPlayerAlive(), this.player, sdt, this.fx, this.bounds);
  }

  /** graze check + wave progression — must run AFTER the physics step so onSink/onFall
   *  despawns from THIS frame's shot are reflected in the alive counts below. */
  postStep(sdt: number): void {
    if (this.phase !== 'playing') return;
    this.sim.checkGraze(this.player, this.pockets, this.events);

    const aliveEnemies = this.enemiesAlive();
    if (aliveEnemies.length === 0) {
      if ((this.isBoss || this.isMiniBoss) && this.boss && this.boss.alive && this.boss.vulnerable) {
        // climax open — nothing to spawn, the boss itself is the last threat standing
      } else if (this.waveCalm > 0) {
        this.waveCalm -= sdt;
        if (this.waveCalm <= 0) this.spawnNextWave();
      } else if (this.waveIdx >= 0) {
        this.onWaveCleared();
      } else {
        this.waveCalm = 0.5;
      }
    }
    // anti-stall: exempt on boss/mini-boss tables (armor is 1:1 with wave CLEARS there).
    if (!this.isBoss && !this.isMiniBoss && aliveEnemies.length > 0 && this.waveIdx <= this.waves.length - 2) {
      this.waveAge += sdt;
      if (this.waveAge >= CFG.combat.waveStallS) this.spawnNextWave();
    }

    this.hud.setStroke(this.stroke, CFG.combat.strokeMax);
  }

  // ---------- debug hook (main.ts wires these into window.__game.debug) ----------
  spawnDebug(kind: Exclude<Kind, 'player'>, x: number, z: number, elite = false): Entity {
    const e = spawnEnemy(this.sim, kind, { x, y: 1, z }, elite);
    e.body.setTranslation({ x, y: e.r + 0.05, z }, true);
    e.ai.timer = seedSpawnTimer();
    return e;
  }

  clearEnemies(): void {
    for (const e of this.enemiesAlive()) despawn(this.sim, e);
  }

  combatState() {
    return {
      depth: this.depth,
      stroke: this.stroke,
      chalk: this.chalk,
      cracks: this.cracks,
      wave: this.waveIdx + 1,
      waveTotal: this.waves.length,
      enemiesAlive: this.enemiesAlive().length,
      bossArmor: this.boss ? this.boss.armor : 0,
      bossVulnerable: this.boss ? this.boss.vulnerable : false,
      phase: this.phase,
    };
  }

  // ---------- entity queries ----------
  private nonPlayerAlive(): Entity[] {
    return all().filter(e => e.alive && e.kind !== 'player');
  }
  private enemiesAlive(): Entity[] {
    return all().filter(e => e.alive && e.kind !== 'player' && e.kind !== 'boss');
  }
  private despawnAllEnemies(): void {
    for (const e of all()) if (e.alive && e.kind !== 'player') despawn(this.sim, e);
    this.boss = null;
  }
  private respawnPlayer(): void {
    this.player.body.setTranslation(this.checkpoint, true);
    this.player.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    this.player.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
  }

  // ---------- rack lifecycle ----------
  private startRack(depth: number): void {
    this.depth = depth;
    this.phase = 'playing';
    this.banksThisShot = 0;
    this.sinksThisShot = 0;
    this.grazedPockets.clear();
    this.iFrames = 0;
    this.waveAge = 0;
    this.waveIdx = -1;
    this.waveCalm = CFG.combat.calmStart;
    this.boss = null;
    this.isBoss = depth === 8;
    this.isMiniBoss = depth === 4;

    const seed = dailySeed();
    const rng = subRng(seed, RACK_TAG, depth);

    if (this.isBoss) {
      this.waves = makeBossWaves(rng);
      this.boss = this.spawnBossAt(0, -0.55);
      this.hud.banner('THE 8-BALL', true, 2000);
    } else if (this.isMiniBoss) {
      this.waves = makeMiniBossWaves(rng);
      this.boss = this.spawnBossAt(0, -0.5);
      // makeEnemy hard-codes armor 3 for 'boss' kind — override AFTER construction,
      // the mini-boss reads as "lesser": armor 1, smaller, lighter (README invariant #3).
      this.boss.armor = 1;
      this.boss.r *= 0.82;
      this.boss.collider.setRadius(this.boss.r);
      this.boss.collider.setMass(this.boss.body.mass() * 0.6);
      this.hud.banner('THE RACK-MASTER', true, 2000);
    } else {
      this.waves = makeRack(depth, rng, false); // money racks are M2
    }

    this.hud.setDepth(depth, 8);
    this.hud.setCracks(this.cracks, CFG.combat.maxCracks);
    this.hud.setChalk(this.chalk);
    this.hud.setStroke(this.stroke, CFG.combat.strokeMax);
  }

  private spawnBossAt(nx: number, nz: number): Entity {
    const x = nx * this.bounds.halfW, z = nz * this.bounds.halfL;
    const e = spawnEnemy(this.sim, 'boss', { x, y: 1, z });
    e.body.setTranslation({ x, y: e.r + 0.05, z }, true);
    return e;
  }

  private spawnNextWave(): void {
    this.waveIdx++;
    this.waveAge = 0;
    if (this.waveIdx >= this.waves.length) return;
    const wave = this.waves[this.waveIdx];
    spawnWave(this.sim, wave, this.bounds);
    const hasElite = wave.some(s => s.elite);
    this.hud.setWave(this.waveIdx + 1, this.waves.length);
    this.hud.banner(hasElite ? 'ELITE!' : `WAVE ${this.waveIdx + 1}`, hasElite, 1100);
  }

  private onWaveCleared(): void {
    // mini-boss shares the boss's armor/vulnerable gating (invariant #3: 1:1 with wave
    // clears) — its single wave clearing must open the climax, not shortcut to rackCleared().
    if ((this.isBoss || this.isMiniBoss) && this.boss && this.boss.alive) {
      if (this.boss.armor > 0) {
        this.boss.armor--;
        if (this.boss.armor === 0) {
          this.boss.vulnerable = true;
          this.hud.banner('ARMOR BROKEN — SINK IT', false, 2200);
          return; // no more waves — the climax is open
        }
        this.hud.banner(`ARMOR ${this.boss.armor}`, true, 1300);
        this.waveCalm = CFG.combat.calmBossBetween;
        return;
      }
      return;
    }
    if (this.waveIdx >= this.waves.length - 1) {
      this.rackCleared();
    } else {
      this.waveCalm = CFG.combat.calmBetween;
      this.gainStroke(CFG.combat.waveClearStroke);
    }
  }

  private rackCleared(): void {
    this.phase = 'clear'; // gate off postStep re-entry (see the Phase type's comment)
    this.chalk += CFG.combat.rackClearChalk;
    this.hud.setChalk(this.chalk);
    this.hud.banner('TABLE CLEAR', false, 1200);
    setTimeout(() => {
      if (this.phase !== 'clear') return; // a scratch-forced shatter can race this timer
      const next = Math.min(8, this.depth + 1); // cap 8 — the real route/escalation is M2
      this.despawnAllEnemies();
      this.respawnPlayer();
      this.startRack(next);
    }, 1200);
  }

  // ---------- shots, stroke, damage ----------
  private gainStroke(n: number): void {
    this.stroke = Math.min(CFG.combat.strokeMax, this.stroke + n);
    this.hud.setStroke(this.stroke, CFG.combat.strokeMax);
  }

  private takeCrack(force = false): void {
    if (this.iFrames > 0 && !force) return;
    this.iFrames = CFG.combat.iFramesS;
    this.cracks++;
    this.stroke = Math.max(0, this.stroke - CFG.combat.crackStrokeCost);
    audio.crackSnap();
    this.hud.setCracks(this.cracks, CFG.combat.maxCracks);
    if (this.cracks >= CFG.combat.maxCracks) {
      this.shatter();
    } else {
      this.hud.banner('CRACKED', true, 900);
    }
  }

  private shatter(): void {
    this.phase = 'dead';
    audio.shatterSound();
    this.showEndOverlay('SHATTERED', true, 'RACK UP AGAIN', () => location.reload());
  }

  private scratch(): void {
    audio.scratchSound();
    this.respawnPlayer();
    this.stroke = Math.max(0, this.stroke - CFG.scratch.strokeCost);
    // forced crack on boss/mini-boss tables only, bypassing i-frames — not a run-ender.
    if (this.isBoss || this.isMiniBoss) this.takeCrack(true);
    this.hud.banner('SCRATCH', true);
  }

  private victory(): void {
    if (this.phase === 'won') return;
    this.phase = 'won';
    this.hud.banner('RUN WON', false, 2000);
    this.showEndOverlay('RUN WON', false, 'RACK AGAIN', () => location.reload());
  }

  private sinkBoss(): void {
    audio.thunk();
    if (this.isBoss) this.victory();
    else { this.hud.banner('RACK-MASTER DOWN', false, 1400); this.rackCleared(); }
  }

  private showEndOverlay(title: string, bad: boolean, btnLabel: string, onClick: () => void): void {
    const panel = document.getElementById('panel');
    const overlay = document.getElementById('overlay');
    if (panel) {
      panel.innerHTML = `<h2${bad ? ' class="bad"' : ''}>${title}</h2>` +
        `<button class="btn center" id="end-btn"><b>${btnLabel}</b></button>`;
    }
    overlay?.classList.add('on');
    document.getElementById('end-btn')?.addEventListener('click', onClick, { once: true });
  }

  // ---------- physics event handlers ----------
  private onSink(e: Entity, _pocketId: number): void {
    if (e.kind === 'player') { this.scratch(); return; }
    if (e.kind === 'boss') { despawn(this.sim, e); this.sinkBoss(); return; }
    despawn(this.sim, e);
    audio.thunk();
    this.sinksThisShot++;
    this.chalk += CFG.combat.sinkChalk + this.banksThisShot;
    this.gainStroke(
      CFG.combat.sinkStroke + this.banksThisShot * CFG.combat.bankStrokeBonus +
      (this.sinksThisShot > 1 ? CFG.combat.multiSinkBonus : 0),
    );
    this.hud.setChalk(this.chalk);
    if (e.elite) this.hud.banner('ELITE DOWN', false, 900);
  }

  private onCollide(a: Entity, b: Entity, impact: number, tangent: number): void {
    audio.clack(Math.min(1, impact / CFG.combat.clackNorm));
    const pair = a.kind === 'player' ? b : b.kind === 'player' ? a : null;
    if (!pair) return; // both non-player — nothing subscribes to enemy-enemy contact

    // splitter cleaves when struck off-center or simply too hard dead-on (dossier: the
    // cheat comes apart at the seam). Read the parent's live pos/vel BEFORE despawning
    // it — despawn() removes the rapier body, and spawnSplitChildren needs it intact.
    if (pair.kind === 'splitter' && !pair.ai.didSplit && impact > CFG.combat.splitImpact &&
        (tangent > impact * CFG.combat.splitTangentRatio || impact > CFG.combat.splitHardImpact)) {
      pair.ai.didSplit = true;
      spawnSplitChildren(this.sim, pair);
      despawn(this.sim, pair);
    }

    // heavy hitters crack the player
    const heavy = pair.kind === 'bumper' || pair.kind === 'boss' ||
      (pair.kind === 'charger' && speedOf(pair) > CFG.combat.chargerFastSpeed) || pair.elite;
    if ((heavy && impact > CFG.combat.crackHeavyImpact) || impact > CFG.combat.crackLightImpact) {
      this.takeCrack();
    }
  }

  private onSurface(e: Entity, _impact: number, kind: 'wall' | 'floor'): void {
    if (kind === 'wall' && e.kind === 'player' && speedOf(e) > CFG.combat.bankMinSpeed) {
      this.banksThisShot++;
    }
  }

  private onFall(e: Entity): void {
    if (e.kind === 'player') { this.scratch(); return; }
    if (e.kind === 'boss') { despawn(this.sim, e); this.sinkBoss(); return; }
    despawn(this.sim, e);
    this.chalk += 1;
    this.gainStroke(9);
    audio.thunk();
    this.hud.setChalk(this.chalk);
  }

  private onGraze(e: Entity, pocketId: number): void {
    if (e.kind !== 'player') return;
    if (this.grazedPockets.has(pocketId)) return;
    this.grazedPockets.add(pocketId);
    this.gainStroke(CFG.combat.grazeStroke);
  }
}
