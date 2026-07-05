// Gauntlet racks (dossier D3): waves crescendo — teach → complicate → Elite climax.
// Generated deterministically from the run seed in logical table space.
import { Rng } from './rng';
import { Kind, HALF_W, HALF_L } from './entities';

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

function place(rng: Rng, used: { x: number; z: number }[], minR: number): { x: number; z: number } {
  // spawn in the far half of the table, away from the player start and pockets
  for (let tries = 0; tries < 40; tries++) {
    const x = rng.range(-HALF_W * 0.72, HALF_W * 0.72);
    const z = rng.range(-HALF_L * 0.8, HALF_L * 0.15);
    let ok = Math.abs(x) < HALF_W * 0.78; // keep off mid-pocket lips
    for (const u of used) if (Math.hypot(u.x - x, u.z - z) < minR) { ok = false; break; }
    if (ok) { used.push({ x, z }); return { x, z }; }
  }
  const x = rng.range(-0.3, 0.3), z = rng.range(-0.7, 0);
  used.push({ x, z });
  return { x, z };
}

export function makeRack(depth: number, rng: Rng, money: boolean): Wave[] {
  const pool = poolFor(depth);
  const waves: Wave[] = [];
  const nWaves = depth <= 1 ? 2 : 3;
  const eliteBudget = money ? 2 : 1;

  for (let w = 0; w < nWaves; w++) {
    const used: { x: number; z: number }[] = [];
    const wave: Wave = [];
    const last = w === nWaves - 1;
    // count ramps gently with depth and wave index
    let count = 2 + Math.min(2, Math.floor(depth / 2)) + (w > 0 ? 1 : 0);
    if (money) count += 1;

    if (w === 0 && depth <= 2) {
      // teaching wave — one clean type
      const k = rng.pick(pool);
      for (let i = 0; i < count; i++) {
        const p = place(rng, used, 0.14);
        wave.push({ kind: k, x: p.x, z: p.z, elite: false });
      }
    } else {
      // complication — mix types into nasty interactions
      for (let i = 0; i < count; i++) {
        const k = rng.pick(pool);
        const p = place(rng, used, 0.13);
        wave.push({ kind: k, x: p.x, z: p.z, elite: false });
      }
    }
    if (last) {
      // Elite climax — the rack's signature threat
      for (let e = 0; e < eliteBudget; e++) {
        const k = rng.pick(pool);
        const p = place(rng, used, 0.15);
        wave.push({ kind: k, x: p.x, z: p.z, elite: true });
      }
    }
    waves.push(wave);
  }
  return waves;
}

/** Boss rack: 3 minion waves, one per armor pip. Boss spawned separately. */
export function makeBossWaves(rng: Rng): Wave[] {
  const waves: Wave[] = [];
  const sizes = [2, 3, 3];
  const pool: EKind[] = ['bumper', 'skitter', 'charger', 'splitter'];
  for (let w = 0; w < 3; w++) {
    const used: { x: number; z: number }[] = [{ x: 0, z: -HALF_L * 0.55 }]; // keep clear of boss
    const wave: Wave = [];
    for (let i = 0; i < sizes[w]; i++) {
      const k = rng.pick(pool);
      const p = place(rng, used, 0.14);
      wave.push({ kind: k, x: p.x, z: p.z, elite: w === 2 && i === 0 });
    }
    waves.push(wave);
  }
  return waves;
}
