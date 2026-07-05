// Gauntlet racks (dossier D3): waves crescendo — teach → complicate → Elite climax.
// Generated deterministically from the run seed in logical table space.
import { Rng } from './rng';
import { Kind, HALF_W, HALF_L } from './entities';
import { POCKETS } from './physics';

export interface SpawnDef { kind: Exclude<Kind, 'player'>; x: number; z: number; elite: boolean }
export type Wave = SpawnDef[];

type EKind = Exclude<Kind, 'player' | 'boss'>;

// enemy pool unlocks by depth — the world widens as you descend
function poolFor(depth: number): EKind[] {
  const p: EKind[] = ['bumper', 'skitter'];
  if (depth >= 2) p.push('charger');
  if (depth >= 3) p.push('splitter');
  return p;
}

function place(rng: Rng, used: { x: number; z: number }[], minR: number, pressure: number): { x: number; z: number } {
  // per spawn: roll once whether this is a pocket-pressure spawn (crowd a pocket mouth) or the
  // usual far-half placement — escalates with depth (dossier D3: pressure over raw count)
  const pressureSpawn = rng.next() < 0.6 * pressure;
  for (let tries = 0; tries < 40; tries++) {
    let x: number, z: number, ok: boolean;
    if (pressureSpawn) {
      const pk = rng.pick(POCKETS);
      const dist = rng.range(0.12, 0.16);
      // direction biased toward the table interior: negate the pocket's side so we step inward
      let dx = pk.x === 0 ? rng.range(-1, 1) : -Math.sign(pk.x);
      let dz = pk.z === 0 ? rng.range(-1, 1) : -Math.sign(pk.z);
      const len = Math.hypot(dx, dz) || 1;
      dx /= len; dz /= len;
      x = pk.x + dx * dist;
      z = pk.z + dz * dist;
      // clamp inside the rails
      x = Math.max(-HALF_W + 0.05, Math.min(HALF_W - 0.05, x));
      z = Math.max(-HALF_L + 0.05, Math.min(HALF_L - 0.05, z));
      // clamping can drag the point back toward the pocket — push back out of the capture radius
      const d = Math.hypot(x - pk.x, z - pk.z);
      if (d < 0.09) {
        const push = 0.09 / (d || 0.001);
        x = Math.max(-HALF_W + 0.05, Math.min(HALF_W - 0.05, pk.x + (x - pk.x) * push));
        z = Math.max(-HALF_L + 0.05, Math.min(HALF_L - 0.05, pk.z + (z - pk.z) * push));
      }
      ok = true;
    } else {
      // spawn in the far half of the table, away from the player start and pockets
      x = rng.range(-HALF_W * 0.72, HALF_W * 0.72);
      z = rng.range(-HALF_L * 0.8, HALF_L * 0.15);
      ok = Math.abs(x) < HALF_W * 0.78; // keep off mid-pocket lips
    }
    for (const u of used) if (Math.hypot(u.x - x, u.z - z) < minR) { ok = false; break; }
    if (ok) { used.push({ x, z }); return { x, z }; }
  }
  const x = rng.range(-0.3, 0.3), z = rng.range(-0.7, 0);
  used.push({ x, z });
  return { x, z };
}

export function makeRack(depth: number, rng: Rng, money: boolean): Wave[] {
  const act = depth <= 4 ? 1 : depth <= 8 ? 2 : 3;
  const pool = poolFor(depth);
  const pressure = Math.min(1, (depth - 1) / 11);
  const waves: Wave[] = [];
  const nWaves = act === 1 ? 3 : 4;

  for (let w = 0; w < nWaves; w++) {
    const used: { x: number; z: number }[] = [];
    const wave: Wave = [];
    const last = w === nWaves - 1;
    // count ramps with act and wave index, money adds pressure — capped so it never floods
    const count = Math.min(6, 1 + act + (w > 0 ? 1 : 0) + (money ? 1 : 0));

    if (w === 0) {
      // wave 0 is ALWAYS the teach beat — one clean kind, no elites, at every depth
      const k = rng.pick(pool);
      for (let i = 0; i < count; i++) {
        const p = place(rng, used, 0.14, pressure);
        wave.push({ kind: k, x: p.x, z: p.z, elite: false });
      }
    } else {
      // complication — mix types into nasty interactions
      for (let i = 0; i < count; i++) {
        const k = rng.pick(pool);
        const p = place(rng, used, 0.13, pressure);
        wave.push({ kind: k, x: p.x, z: p.z, elite: false });
      }
    }
    if (last) {
      // Elite climax — the rack's signature threat
      const eliteBudget = act + (money ? 1 : 0);
      for (let e = 0; e < eliteBudget; e++) {
        const k = rng.pick(pool);
        const p = place(rng, used, 0.15, pressure);
        wave.push({ kind: k, x: p.x, z: p.z, elite: true });
      }
    }
    waves.push(wave);
  }
  return waves;
}

/** Boss rack: 3 minion waves, one per armor pip. Boss spawned separately.
 *  D5: "a full table of Elites" — every spawn across all three waves is elite. */
export function makeBossWaves(rng: Rng): Wave[] {
  const waves: Wave[] = [];
  const sizes = [2, 2, 3];
  const pool: EKind[] = ['bumper', 'skitter', 'charger', 'splitter'];
  for (let w = 0; w < 3; w++) {
    const used: { x: number; z: number }[] = [{ x: 0, z: -HALF_L * 0.55 }]; // keep clear of boss
    const wave: Wave = [];
    for (let i = 0; i < sizes[w]; i++) {
      const k = rng.pick(pool);
      const p = place(rng, used, 0.14, 1);
      wave.push({ kind: k, x: p.x, z: p.z, elite: true });
    }
    waves.push(wave);
  }
  return waves;
}

/** Mini-boss (Rack-Master, depth 4) rack: single wave, armor 1. A composition check —
 *  three enemies, exactly one elite: do you have a build yet? */
export function makeMiniBossWaves(rng: Rng): Wave[] {
  const pool: EKind[] = ['bumper', 'charger', 'splitter'];
  const used: { x: number; z: number }[] = [{ x: 0, z: -HALF_L * 0.5 }]; // keep clear of mini-boss
  const wave: Wave = [];
  const eliteIdx = rng.int(0, 2);
  for (let i = 0; i < 3; i++) {
    const k = rng.pick(pool);
    const p = place(rng, used, 0.14, 0.3);
    wave.push({ kind: k, x: p.x, z: p.z, elite: i === eliteIdx });
  }
  return [wave];
}
