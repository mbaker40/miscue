// Behavior = backstory (dossier §06). Each enemy teaches one use of the kit.
import { Ball, HALF_W, HALF_L } from './entities';
import { speedOf } from './physics';
import { aiRandom } from './rng';

export interface AiFx {
  telegraph(b: Ball, on: boolean): void;
}

export function updateEnemies(enemies: Ball[], player: Ball, dt: number, fx: AiFx) {
  const playerStill = speedOf(player) < 0.08;
  for (const e of enemies) {
    if (!e.alive) continue;
    switch (e.kind) {
      case 'skitter': updateSkitter(e, player, dt, playerStill); break;
      case 'charger': updateCharger(e, player, dt, playerStill, fx); break;
      case 'boss': updateBoss(e, player, dt, fx); break;
      // bumpers and splitters are passive — their mass and their splitting do the work
    }
  }
}

function interiorTargetAwayFrom(e: Ball, px: number, pz: number): [number, number] {
  // flee away from the player, biased toward the table interior (stays huntable)
  let dx = e.x - px, dz = e.z - pz;
  const n = Math.hypot(dx, dz) || 1;
  dx /= n; dz /= n;
  let tx = e.x + dx * 0.45 + (aiRandom() - 0.5) * 0.3;
  let tz = e.z + dz * 0.45 + (aiRandom() - 0.5) * 0.3;
  tx = Math.max(-HALF_W * 0.7, Math.min(HALF_W * 0.7, tx));
  tz = Math.max(-HALF_L * 0.75, Math.min(HALF_L * 0.75, tz));
  return [tx, tz];
}

function updateSkitter(e: Ball, p: Ball, dt: number, playerStill: boolean) {
  e.aiTimer -= dt;
  if (e.aiTimer <= 0 && playerStill && speedOf(e) < 0.05) {
    const [tx, tz] = interiorTargetAwayFrom(e, p.x, p.z);
    const dx = tx - e.x, dz = tz - e.z;
    const n = Math.hypot(dx, dz) || 1;
    const sp = e.elite ? 1.1 : 0.75;
    e.vx = (dx / n) * sp; e.vz = (dz / n) * sp;
    e.aiTimer = e.elite ? 1.6 : 2.4;
  }
}

function updateCharger(e: Ball, p: Ball, dt: number, playerStill: boolean, fx: AiFx) {
  e.aiTimer -= dt;
  if (e.aiState === 0) {
    // idle: wait for the player to come to rest, then lock on
    if (e.aiTimer <= 0 && playerStill) {
      e.aiState = 1;
      e.aiTimer = 0.75;
      e.aiTx = p.x; e.aiTz = p.z; // punishes where you STOPPED (dossier)
      e.lungesLeft = e.elite ? 2 : 1;
      fx.telegraph(e, true);
    }
  } else if (e.aiState === 1) {
    if (e.aiTimer <= 0) {
      fx.telegraph(e, false);
      const dx = e.aiTx - e.x, dz = e.aiTz - e.z;
      const n = Math.hypot(dx, dz) || 1;
      const sp = e.elite ? 2.2 : 1.8;
      e.vx = (dx / n) * sp; e.vz = (dz / n) * sp;
      e.lungesLeft--;
      if (e.lungesLeft > 0) {
        e.aiState = 1; e.aiTimer = 0.65; e.aiTx = p.x; e.aiTz = p.z;
        fx.telegraph(e, true);
      } else {
        e.aiState = 2; e.aiTimer = e.elite ? 3.2 : 4.2;
      }
    }
  } else if (e.aiState === 2) {
    if (e.aiTimer <= 0) { e.aiState = 0; e.aiTimer = 0.4; }
  }
}

function updateBoss(e: Ball, p: Ball, dt: number, fx: AiFx) {
  e.aiTimer -= dt;
  if (e.aiState === 0) {
    if (e.aiTimer <= 0) {
      e.aiState = 1; e.aiTimer = 0.9;
      e.aiTx = p.x; e.aiTz = p.z;
      fx.telegraph(e, true);
    }
  } else if (e.aiState === 1) {
    if (e.aiTimer <= 0) {
      fx.telegraph(e, false);
      const dx = e.aiTx - e.x, dz = e.aiTz - e.z;
      const n = Math.hypot(dx, dz) || 1;
      e.vx = (dx / n) * 1.5; e.vz = (dz / n) * 1.5;
      e.aiState = 2; e.aiTimer = e.vulnerable ? 3.5 : 6;
    }
  } else if (e.aiState === 2 && e.aiTimer <= 0) {
    e.aiState = 0; e.aiTimer = 0.5;
  }
}
