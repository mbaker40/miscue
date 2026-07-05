// Behavior = backstory (dossier §06). Each enemy teaches one use of the kit.
// v1 logic (src/enemies.ts) ported onto Rapier entities: intent unchanged, actuation
// becomes setLinvel at decision points instead of v1's direct vx/vz writes.
import { CFG } from './config';
import type { Entity } from './registry';
import { aiRandom } from './rng';

export interface AiFx {
  telegraph(e: Entity, on: boolean): void;
}

// arena half-extents — roam targets (skitter flee, spawn placement) clamp inside them.
export interface Bounds { halfW: number; halfL: number }

function speedOf(e: Entity): number {
  const v = e.body.linvel();
  return Math.hypot(v.x, v.z);
}

// new spawns stagger their first decision so a wave doesn't think in lockstep (v1's
// 0.5 + rand*1.5) — waves.ts calls this per spawn, not buildEntity, so bumpers/
// splitters (no AI) don't pay for a timer they never read.
export function seedSpawnTimer(): number {
  return CFG.enemies.spawnTimerMin + aiRandom() * CFG.enemies.spawnTimerRand;
}

export function updateEnemies(enemies: Entity[], player: Entity, dt: number, fx: AiFx, bounds: Bounds): void {
  const pv = player.body.linvel();
  const playerStill = Math.hypot(pv.x, pv.z) < CFG.enemies.playerStillSpeed;
  const pPos = player.body.translation();
  const pPos2 = { x: pPos.x, z: pPos.z };
  for (const e of enemies) {
    if (!e.alive) continue;
    switch (e.kind) {
      case 'skitter': updateSkitter(e, pPos2, dt, playerStill, bounds); break;
      case 'charger': updateCharger(e, pPos2, dt, playerStill, fx); break;
      case 'boss': updateBoss(e, pPos2, dt, fx); break;
      // bumpers and splitters are passive — their mass and their splitting do the work
    }
  }
}

function interiorTargetAwayFrom(ex: number, ez: number, px: number, pz: number, bounds: Bounds): [number, number] {
  // flee away from the player, biased toward the table interior (stays huntable)
  let dx = ex - px, dz = ez - pz;
  const n = Math.hypot(dx, dz) || 1;
  dx /= n; dz /= n;
  let tx = ex + dx * (0.9 * bounds.halfW) + (aiRandom() - 0.5) * (0.6 * bounds.halfW);
  let tz = ez + dz * (0.9 * bounds.halfW) + (aiRandom() - 0.5) * (0.6 * bounds.halfW);
  tx = Math.max(-0.7 * bounds.halfW, Math.min(0.7 * bounds.halfW, tx));
  tz = Math.max(-0.75 * bounds.halfL, Math.min(0.75 * bounds.halfL, tz));
  return [tx, tz];
}

function updateSkitter(e: Entity, p: { x: number; z: number }, dt: number, playerStill: boolean, bounds: Bounds): void {
  e.ai.timer -= dt;
  if (e.ai.timer <= 0 && playerStill && speedOf(e) < CFG.enemies.enemyStillSpeed) {
    const pos = e.body.translation();
    const [tx, tz] = interiorTargetAwayFrom(pos.x, pos.z, p.x, p.z, bounds);
    const dx = tx - pos.x, dz = tz - pos.z;
    const n = Math.hypot(dx, dz) || 1;
    const sp = e.elite ? CFG.enemies.skitter.eliteSpeed : CFG.enemies.skitter.speed;
    const v = e.body.linvel();
    e.body.setLinvel({ x: (dx / n) * sp, y: v.y, z: (dz / n) * sp }, true);
    e.ai.timer = e.elite ? CFG.enemies.skitter.eliteTimerS : CFG.enemies.skitter.timerS;
  }
}

function updateCharger(e: Entity, p: { x: number; z: number }, dt: number, playerStill: boolean, fx: AiFx): void {
  e.ai.timer -= dt;
  if (e.ai.state === 0) {
    // idle: wait for the player to come to rest, then lock on
    if (e.ai.timer <= 0 && playerStill) {
      e.ai.state = 1;
      e.ai.timer = CFG.enemies.charger.telegraphS;
      e.ai.tx = p.x; e.ai.tz = p.z; // punishes where you STOPPED (dossier)
      e.ai.lungesLeft = e.elite ? 2 : 1;
      fx.telegraph(e, true);
    }
  } else if (e.ai.state === 1) {
    if (e.ai.timer <= 0) {
      fx.telegraph(e, false);
      const pos = e.body.translation();
      const dx = e.ai.tx - pos.x, dz = e.ai.tz - pos.z;
      const n = Math.hypot(dx, dz) || 1;
      const sp = e.elite ? CFG.enemies.charger.eliteSpeed : CFG.enemies.charger.speed;
      const v = e.body.linvel();
      e.body.setLinvel({ x: (dx / n) * sp, y: v.y, z: (dz / n) * sp }, true);
      e.ai.lungesLeft--;
      if (e.ai.lungesLeft > 0) {
        e.ai.state = 1; e.ai.timer = CFG.enemies.charger.relungeS;
        e.ai.tx = p.x; e.ai.tz = p.z;
        fx.telegraph(e, true);
      } else {
        e.ai.state = 2;
        e.ai.timer = e.elite ? CFG.enemies.charger.eliteRecoverS : CFG.enemies.charger.recoverS;
      }
    }
  } else if (e.ai.state === 2) {
    if (e.ai.timer <= 0) { e.ai.state = 0; e.ai.timer = 0.4; }
  }
}

function updateBoss(e: Entity, p: { x: number; z: number }, dt: number, fx: AiFx): void {
  // boss ignores playerStill — it lunges on its own clock (v1)
  e.ai.timer -= dt;
  if (e.ai.state === 0) {
    if (e.ai.timer <= 0) {
      e.ai.state = 1; e.ai.timer = CFG.enemies.boss.telegraphS;
      e.ai.tx = p.x; e.ai.tz = p.z;
      fx.telegraph(e, true);
    }
  } else if (e.ai.state === 1) {
    if (e.ai.timer <= 0) {
      fx.telegraph(e, false);
      const pos = e.body.translation();
      const dx = e.ai.tx - pos.x, dz = e.ai.tz - pos.z;
      const n = Math.hypot(dx, dz) || 1;
      const v = e.body.linvel();
      e.body.setLinvel({ x: (dx / n) * CFG.enemies.boss.speed, y: v.y, z: (dz / n) * CFG.enemies.boss.speed }, true);
      e.ai.state = 2;
      // a broken boss recovers faster — more punishable
      e.ai.timer = e.vulnerable ? CFG.enemies.boss.recoverVulnS : CFG.enemies.boss.recoverArmoredS;
    }
  } else if (e.ai.state === 2 && e.ai.timer <= 0) {
    e.ai.state = 0; e.ai.timer = 0.5;
  }
}
