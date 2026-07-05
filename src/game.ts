// The run, end to end (dossier D2–D5): Stroke, gauntlet waves, cracks, the descent, the 8-ball.
import { Ball, makePlayer, makeEnemy, makeSplitChild, HALF_L } from './entities';
import { step, speedOf, simulatePath, MAX_SHOT_SPEED, PhysicsEvents } from './physics';
import { updateEnemies } from './enemies';
import { makeRack, makeBossWaves, makeMiniBossWaves, Wave } from './waves';
import { baseStats, PlayerStats, draftUpgrades, UPGRADES, Upgrade } from './upgrades';
import { Rng, dailySeed } from './rng';
import {
  generateRoute, Route, RouteSlot, NodeKind, actOf,
  RACK_TAG, DRAFT_TAG, SHOP_TAG, MYSTERY_TAG, FORGE_TAG,
} from './route';
import { forgeOptions, rollMystery } from './events';
import { Renderer3D } from './render';
import { AimInput } from './input';
import { Hud } from './hud';
import * as audio from './audio';

type Phase = 'menu' | 'playing' | 'panel' | 'over';

const MAX_STROKE = 100;
const MAX_DEPTH = 12;
const WAVE_STALL_S = 25; // anti-stall (dossier D3): next wave drops on timer OR clear

export class Game {
  private r3d: Renderer3D;
  private input: AimInput;
  private hud = new Hud();

  private phase: Phase = 'menu';
  private balls: Ball[] = [];
  private player: Ball = makePlayer();
  private stats: PlayerStats = baseStats();
  private seed = 1;
  private isDaily = false;

  private depth = 1;
  private chalk = 0;
  private cracks = 0;
  private stroke = 40;
  private owned = new Set<string>();

  private route: Route = [];
  private isMiniBoss = false;

  private waves: Wave[] = [];
  private waveIdx = 0;
  private waveCalm = 0;        // calm-beat countdown between waves
  private waveAge = 0;         // time since current wave spawned (anti-stall)
  private isBossRack = false;
  private isMoneyRack = false;
  private boss: Ball | null = null;

  private banksThisShot = 0;
  private sinksThisShot = 0;
  private grazedPockets = new Set<number>();
  private iFrames = 0;
  private timescale = 1;
  private lastT = 0;
  private acc = 0;

  constructor(container: HTMLElement) {
    this.r3d = new Renderer3D(container);
    this.input = new AimInput(
      this.r3d, this.r3d.renderer.domElement,
      document.getElementById('spinpad')!, document.getElementById('spinknob')!,
    );
    this.input.canAim = () =>
      this.phase === 'playing' && this.player.alive && speedOf(this.player) < 0.06;
    this.input.getBallPos = () => ({ x: this.player.x, z: this.player.z });
    this.input.onFire = s => this.fire(s.dirX, s.dirZ, s.power);
    addEventListener('pointerdown', () => audio.unlockAudio(), { once: true });
    if ((import.meta as any).env?.DEV) (window as any).__game = this;
  }

  private subRng(tag: number, depth = 0): Rng {
    return new Rng((this.seed ^ tag ^ Math.imul(depth, 0x9e3779b1)) >>> 0);
  }

  start() {
    this.showMenu();
    this.lastT = performance.now();
    requestAnimationFrame(t => this.loop(t));
  }

  private showMenu() {
    this.phase = 'menu';
    this.hud.showHud(false);
    const d = new Date();
    this.hud.menu(
      () => this.newRun((Math.random() * 2 ** 31) | 0, false),
      () => this.newRun(dailySeed(), true),
      d.toISOString().slice(0, 10),
    );
  }

  private newRun(seed: number, daily: boolean) {
    this.seed = seed; this.isDaily = daily;
    this.depth = 1; this.chalk = 0; this.cracks = 0; this.stroke = 40;
    this.owned = new Set(); this.stats = baseStats();
    this.hud.showHud(true);
    this.route = generateRoute(seed);
    this.startRack('rack');
  }

  private seedLabel(): string {
    return this.isDaily ? `daily seed ${this.seed}` : `seed ${this.seed}`;
  }

  // ---------- rack lifecycle ----------
  private startRack(type: string) {
    this.phase = 'playing';
    this.isBossRack = this.depth === MAX_DEPTH;
    this.isMiniBoss = this.depth === 4;
    this.isMoneyRack = type === 'money';
    this.stats.lipUsedThisRack = false;
    this.r3d.clearBalls();

    this.player = makePlayer();
    this.player.mass = this.stats.mass;
    this.balls = [this.player];
    this.boss = null;

    if (this.isBossRack) {
      this.waves = makeBossWaves(this.subRng(RACK_TAG, this.depth));
      this.boss = makeEnemy('boss', 0, -HALF_L * 0.55);
      this.balls.push(this.boss);
      this.hud.banner('THE 8-BALL', true, 2000);
    } else if (this.isMiniBoss) {
      this.waves = makeMiniBossWaves(this.subRng(RACK_TAG, this.depth));
      this.boss = makeEnemy('boss', 0, -HALF_L * 0.5);
      this.boss.armor = 1;          // makeEnemy hard-codes 3 — override AFTER construction
      this.boss.r *= 0.82;          // reads as "lesser"
      this.boss.mass *= 0.6;
      this.balls.push(this.boss);
      this.hud.banner('THE RACK-MASTER', true, 2000);
    } else {
      this.waves = makeRack(this.depth, this.subRng(RACK_TAG, this.depth), this.isMoneyRack);
      if (this.isMoneyRack) this.hud.banner('MONEY TABLE', false, 1600);
    }
    this.waveIdx = -1;
    this.waveCalm = 0.8;
    this.waveAge = 0;
    this.hud.setDepth(this.depth, MAX_DEPTH);
    this.hud.setCracks(this.cracks, this.stats.maxCracks);
    this.hud.setChalk(this.chalk);
    this.r3d.setPlayerCracks(this.cracks);
  }

  private spawnNextWave() {
    this.waveIdx++;
    this.waveAge = 0;
    if (this.waveIdx >= this.waves.length) return;
    const wave = this.waves[this.waveIdx];
    for (const s of wave) this.balls.push(makeEnemy(s.kind, s.x, s.z, s.elite));
    const hasElite = wave.some(s => s.elite);
    this.hud.setWave(this.waveIdx + 1, this.waves.length);
    this.hud.banner(hasElite ? 'ELITE!' : `WAVE ${this.waveIdx + 1}`, hasElite, 1100);
  }

  private enemiesAlive(): Ball[] {
    return this.balls.filter(b => b.alive && b.kind !== 'player' && b.kind !== 'boss');
  }

  private onWaveCleared() {
    // mini-boss shares the boss's armor/vulnerable gating (invariant #3: 1:1 with wave clears) —
    // its single wave clearing must open the climax, not shortcut straight to rackCleared().
    if ((this.isBossRack || this.isMiniBoss) && this.boss && this.boss.alive) {
      if (this.boss.armor > 0) {
        this.boss.armor--;
        if (this.boss.armor === 0) {
          this.boss.vulnerable = true;
          this.r3d.bossVulnerable(this.boss);
          this.hud.banner('ARMOR BROKEN — SINK IT', false, 2200);
          return; // no more waves; the climax is open
        }
        this.hud.banner(`ARMOR ${this.boss.armor}`, true, 1300);
        this.waveCalm = 2.2;
        return;
      }
      return;
    }
    if (this.waveIdx >= this.waves.length - 1) {
      this.rackCleared();
    } else {
      this.waveCalm = 2.4; // the held breath between waves
      this.stroke = Math.min(MAX_STROKE, this.stroke + 8);
    }
  }

  private rackCleared() {
    this.phase = 'panel';
    this.chalk += this.isMoneyRack ? 8 : 4;
    this.hud.setChalk(this.chalk);
    this.hud.banner('TABLE CLEAR', false, 1200);
    setTimeout(() => this.offerDraft(), 700);
  }

  private offerDraft() {
    const n = this.isMoneyRack ? 4 : 3;
    const picks = draftUpgrades(this.subRng(DRAFT_TAG, this.depth), this.owned, n);
    this.hud.draft(picks, u => {
      if (u) { this.owned.add(u.id); u.apply(this.stats); }
      else this.chalk += 5;
      this.hud.setChalk(this.chalk);
      this.hud.setCracks(this.cracks, this.stats.maxCracks);
      this.offerNext();
    });
  }

  // ---------- the descent: choose your route ----------
  private offerNext() {
    this.depth++;
    this.hud.setDepth(this.depth, MAX_DEPTH);
    const slot = this.route[this.depth - 1];
    const fan = this.route.slice(this.depth, this.depth + 3); // next 2–3 slots, may be short near the end
    this.hud.nodeChoice(this.depth, slot.options, fan, k => this.enterSlot(k));
  }
  private enterSlot(kind: NodeKind) {
    switch (kind) {
      case 'shop':    return this.openShop();
      case 'rest':    return this.openRest();
      case 'forge':   return this.openForge();
      case 'mystery': return this.openMystery();
      case 'money':   return this.openWager();
      default:        return this.startRack('rack'); // rack / miniboss / boss — depth drives detection
    }
  }

  private openShop() {
    const refresh = () => this.hud.shopRefresh(this.chalk, this.cracks);
    const shopRng = this.subRng(SHOP_TAG, this.depth);
    this.hud.shop(this.chalk, this.cracks, {
      repair: () => {
        if (this.chalk >= 8 && this.cracks > 0) {
          this.chalk -= 8; this.cracks--; audio.blip();
          this.hud.setChalk(this.chalk); this.hud.setCracks(this.cracks, this.stats.maxCracks);
          this.r3d.setPlayerCracks(this.cracks);
          refresh(); return true;
        } return false;
      },
      stroke: () => {
        if (this.chalk >= 5) {
          this.chalk -= 5; this.stroke = MAX_STROKE; audio.blip();
          this.hud.setChalk(this.chalk); refresh(); return true;
        } return false;
      },
      upgrade: () => {
        const avail = UPGRADES.filter(u => !this.owned.has(u.id));
        if (this.chalk >= 14 && avail.length > 0) {
          this.chalk -= 14;
          const u = avail[Math.floor(shopRng.next() * avail.length)];
          this.owned.add(u.id); u.apply(this.stats); audio.blip();
          this.hud.banner(u.name, false, 1500);
          this.hud.setChalk(this.chalk); this.hud.setCracks(this.cracks, this.stats.maxCracks);
          refresh(); return true;
        } return false;
      },
      leave: () => this.offerNext(),
    });
  }

  private openRest() {
    if (this.cracks > 0) this.cracks--;
    this.stroke = Math.min(MAX_STROKE, this.stroke + 40);
    this.r3d.setPlayerCracks(this.cracks);
    this.hud.setCracks(this.cracks, this.stats.maxCracks);
    this.hud.rest(() => this.offerNext());
  }

  private openForge() {
    const canForge = this.cracks + 1 < this.stats.maxCracks; // the Forge never deals the killing crack
    const opts = canForge ? forgeOptions(this.subRng(FORGE_TAG, this.depth), 2) : [];
    this.hud.forge(opts.map(o => ({ label: o.label, desc: o.desc })), i => {
      if (i !== null && opts[i]) {
        this.cracks++;
        opts[i].apply(this.stats);
        audio.crackSnap();
        this.r3d.setPlayerCracks(this.cracks);
        this.hud.setCracks(this.cracks, this.stats.maxCracks);
        this.hud.banner(opts[i].label.toUpperCase(), true, 1400);
      }
      this.offerNext();
    });
  }

  private openMystery() {
    const ev = rollMystery(this.subRng(MYSTERY_TAG, this.depth), { cracks: this.cracks, chalk: this.chalk });
    if (ev.chalk) this.chalk = Math.max(0, this.chalk + ev.chalk);
    if (ev.repair && this.cracks > 0) { this.cracks--; this.r3d.setPlayerCracks(this.cracks); }
    if (ev.strokeFill) this.stroke = MAX_STROKE;
    this.hud.setChalk(this.chalk);
    this.hud.setCracks(this.cracks, this.stats.maxCracks);
    this.hud.mystery(ev, () => this.offerNext());
  }

  private openWager() {
    const canCrack = this.chalk < 5 && this.cracks + 1 < this.stats.maxCracks;
    this.hud.wager(this.chalk, canCrack, {
      ante: () => { this.chalk -= 5; this.hud.setChalk(this.chalk); this.startRack('money'); },
      anteCrack: () => {
        this.cracks++; audio.crackSnap();
        this.r3d.setPlayerCracks(this.cracks);
        this.hud.setCracks(this.cracks, this.stats.maxCracks);
        this.startRack('money');
      },
      decline: () => this.startRack('rack'), // walk to a plain table instead
    });
  }

  // ---------- shots, stroke, damage ----------
  private fire(dx: number, dz: number, power: number) {
    const sp = power * MAX_SHOT_SPEED * this.stats.maxPower;
    this.player.vx = dx * sp;
    this.player.vz = dz * sp;
    // chipped balls don't roll true (dossier D4): curve efficiency drops per crack
    const chip = Math.pow(0.93, this.cracks);
    this.player.spinSide = this.input.spinSide * 0.9 * this.stats.curve * chip;
    this.player.spinTop = this.input.spinTop * 0.9;
    this.banksThisShot = 0;
    this.sinksThisShot = 0;
    this.grazedPockets.clear();
    audio.whoosh(power);
  }

  private gainStroke(n: number) {
    this.stroke = Math.min(MAX_STROKE, this.stroke + n * this.stats.strokeGain);
  }

  private takeCrack() {
    if (this.iFrames > 0 || !this.player.alive) return;
    this.iFrames = 1.2;
    this.cracks++;
    this.stroke = Math.max(0, this.stroke - 15);
    audio.crackSnap();
    this.r3d.pulse('crack');
    // shatter ON the last crack — the pips the player sees ARE the health (dossier D4)
    if (this.cracks >= this.stats.maxCracks) {
      this.shatter();
    } else {
      this.r3d.setPlayerCracks(this.cracks);
      this.hud.setCracks(this.cracks, this.stats.maxCracks);
      this.hud.banner('CRACKED', true, 900);
    }
  }

  private shatter() {
    this.player.alive = false;
    audio.shatterSound();
    this.endRun('shatter');
  }

  private scratch() {
    audio.scratchSound();
    this.endRun('scratch');
  }

  private endRun(reason: 'scratch' | 'shatter') {
    if (this.phase === 'over') return; // one ending per run, even if events race
    this.phase = 'over';
    setTimeout(() => {
      this.hud.gameOver(reason, this.depth, () => this.showMenu(), this.seedLabel());
    }, 900);
  }

  private victory() {
    if (this.phase === 'over') return;
    this.phase = 'over';
    audio.thunk();
    setTimeout(() => this.hud.victory(() => this.showMenu(), this.seedLabel()), 1000);
  }

  // ---------- physics event wiring ----------
  private events: PhysicsEvents = {
    onSink: (b, _pi) => {
      if (b.kind === 'player') {
        // Guardian Lip: once per rack, the pocket spits you back out
        if (this.stats.guardianLip && !this.stats.lipUsedThisRack) {
          this.stats.lipUsedThisRack = true;
          b.alive = true;
          b.x = Math.sign(b.x || 0.01) * -0.1; b.z = b.z * 0.7;
          b.vx = 0; b.vz = 0;
          this.hud.banner('SAVED AT THE LIP', false, 1300);
          return;
        }
        this.scratch();
        return;
      }
      if (b.kind === 'boss') {
        audio.thunk(); this.r3d.pulse('sink');
        if (this.isBossRack) this.victory();
        else { this.hud.banner('RACK-MASTER DOWN', false, 1400); this.rackCleared(); }
        return;
      }
      audio.thunk();
      this.r3d.pulse('sink');
      this.sinksThisShot++;
      let chalkGain = (this.isMoneyRack ? 2 : 1) * 2 + this.banksThisShot;
      let strokeGain = 18 + this.banksThisShot * 8 + (this.sinksThisShot > 1 ? 10 : 0);
      if (this.stats.rubber && this.banksThisShot > 0) { chalkGain += 2; strokeGain += 10; }
      this.chalk += chalkGain;
      this.gainStroke(strokeGain);
      this.hud.setChalk(this.chalk);
      if (b.elite) this.hud.banner('ELITE DOWN', false, 900);
    },
    onCollide: (a, b, impact, tangent) => {
      audio.clack(Math.min(1, impact / 2));
      const pair = a.kind === 'player' ? b : b.kind === 'player' ? a : null;
      if (pair) {
        // splitter cleaves when struck off-center (dossier flavor: the cheat comes
        // apart at the seam) — or when a dead-center hit is simply too hard to survive
        if (pair.kind === 'splitter' && !pair.didSplit && impact > 0.5 &&
            (tangent > impact * 0.4 || impact > 1.0)) {
          pair.didSplit = true;
          pair.alive = false;
          const n = pair.elite ? 3 : 2;
          for (let i = 0; i < n; i++) this.balls.push(makeSplitChild(pair, i % 2 === 0 ? 1 : -1));
        }
        // heavy hitters crack the player
        const heavy = pair.kind === 'bumper' || pair.kind === 'boss' ||
          (pair.kind === 'charger' && speedOf(pair) > 0.6) || pair.elite;
        if (heavy && impact > 0.55) this.takeCrack();
        else if (impact > 1.15) this.takeCrack();
      }
    },
    onRail: (b, _impact) => {
      if (b.kind === 'player' && speedOf(b) > 0.15) this.banksThisShot++;
    },
    onGraze: (b, pi) => {
      if (!this.grazedPockets.has(pi)) {
        this.grazedPockets.add(pi);
        this.gainStroke(4);
      }
    },
  };

  // ---------- main loop ----------
  private loop(t: number) {
    requestAnimationFrame(tt => this.loop(tt));
    let dt = Math.min(0.05, (t - this.lastT) / 1000);
    this.lastT = t;

    if (this.phase === 'playing' || this.phase === 'panel' || this.phase === 'over') {
      // bullet time (dossier D2): light slow-mo free; deep slow costs Stroke
      let target = 1;
      if (this.input.aiming && this.phase === 'playing') {
        if (this.stroke > 1) {
          target = 0.12;
          this.stroke = Math.max(0, this.stroke - 22 * this.stats.strokeDrain * dt);
        } else target = 0.45;
      }
      this.timescale += (target - this.timescale) * Math.min(1, dt * 10);
      const sdt = dt * this.timescale;

      if (this.phase === 'playing') {
        this.iFrames = Math.max(0, this.iFrames - sdt);

        // magnet core homing
        if (this.stats.magnet > 0 && speedOf(this.player) > 0.15) {
          let best: Ball | null = null, bd = 9;
          for (const e of this.enemiesAlive()) {
            const d = Math.hypot(e.x - this.player.x, e.z - this.player.z);
            if (d < bd) { bd = d; best = e; }
          }
          if (best && bd < 0.5) {
            const dx = best.x - this.player.x, dz = best.z - this.player.z;
            const n = Math.hypot(dx, dz) || 1;
            this.player.vx += (dx / n) * this.stats.magnet * sdt;
            this.player.vz += (dz / n) * this.stats.magnet * sdt;
          }
        }

        updateEnemies(this.balls.filter(b => b.kind !== 'player'), this.player, sdt, {
          telegraph: (b, on) => this.r3d.telegraph(b, on),
        });

        // fixed-step physics under the timescale
        this.acc += sdt;
        const h = 1 / 120;
        let n = 0;
        while (this.acc >= h && n < 12) {
          step(this.balls, h, this.events);
          this.acc -= h; n++;
        }

        // anti-stall (dossier D3): a fleeing straggler can't hold the rack hostage —
        // the next wave drops on a timer even if the current one isn't cleared.
        // Boss racks are exempt: armor pips are tied 1:1 to wave CLEARS.
        if (!this.isBossRack && !this.isMiniBoss && this.enemiesAlive().length > 0 &&
            this.waveIdx >= 0 && this.waveIdx < this.waves.length - 1) {
          this.waveAge += sdt;
          if (this.waveAge >= WAVE_STALL_S) this.spawnNextWave();
        }

        // wave progression: calm beat, then the next wave drops
        if (this.enemiesAlive().length === 0 && this.phase === 'playing') {
          if (this.isBossRack && this.boss && this.boss.alive && this.boss.vulnerable) {
            // climax open — nothing to spawn
          } else if (this.waveCalm > 0) {
            this.waveCalm -= sdt;
            if (this.waveCalm <= 0) this.spawnNextWave();
          } else if (this.waveIdx >= 0) {
            this.onWaveCleared();
          } else {
            this.waveCalm = 0.5;
          }
        }

        // aim preview
        if (this.input.aiming) {
          const s = this.input.currentShot();
          if (s) {
            const sp = s.power * MAX_SHOT_SPEED * this.stats.maxPower;
            const chip = Math.pow(0.93, this.cracks);
            this.r3d.showAim(simulatePath(
              this.player.x, this.player.z, s.dirX * sp, s.dirZ * sp,
              this.input.spinSide * 0.9 * this.stats.curve * chip,
              this.input.spinTop * 0.9,
              this.enemiesAlive().concat(this.boss && this.boss.alive ? [this.boss] : []),
            ));
          } else this.r3d.showAim(null);
        } else this.r3d.showAim(null);

        this.hud.setStroke(this.stroke, MAX_STROKE);
      }

      this.r3d.sync(this.balls, sdt);
    }
    this.r3d.render(dt);
  }
}
