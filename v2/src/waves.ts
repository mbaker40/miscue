// Gauntlet racks (dossier D3): waves crescendo — teach → complicate → Elite climax.
// Generated deterministically from the run seed, in NORMALIZED table space [-1, 1] —
// game.ts scales by the live arena's bounds, so a rack def is arena-shape-agnostic.
import { Rng } from './rng';
import { Kind, Entity, spawnEnemy } from './registry';
import type { Sim } from './sim';
import { Bounds, seedSpawnTimer } from './enemies';

export interface SpawnDef { kind: Exclude<Kind, 'player'>; nx: number; nz: number; elite: boolean }
export type Wave = SpawnDef[];

type EKind = Exclude<Kind, 'player' | 'boss'>;

// enemy pool unlocks by depth — the world widens as you descend
function poolFor(depth: number): EKind[] {
  const p: EKind[] = ['bumper', 'skitter'];
  if (depth >= 2) p.push('charger');
  if (depth >= 3) p.push('splitter');
  return p;
}

// the 4 pocket corners in normalized space (v2's arena has 4 corner pockets, not v1's 6)
const CORNERS: { nx: number; nz: number }[] = [
  { nx: -1, nz: -1 }, { nx: 1, nz: -1 }, { nx: -1, nz: 1 }, { nx: 1, nz: 1 },
];

function place(rng: Rng, used: { nx: number; nz: number }[], minR: number, pressure: number): { nx: number; nz: number } {
  // per spawn: roll once whether this is a pocket-pressure spawn (crowd a pocket mouth) or the
  // usual far-half placement — escalates with depth (dossier D3: pressure over raw count)
  const pressureSpawn = rng.next() < 0.6 * pressure;
  for (let tries = 0; tries < 40; tries++) {
    let nx: number, nz: number;
    if (pressureSpawn) {
      const pk = rng.pick(CORNERS);
      const dist = rng.range(0.24, 0.32);
      // direction biased toward the table interior: step inward off the corner
      let dx = -Math.sign(pk.nx), dz = -Math.sign(pk.nz);
      const len = Math.hypot(dx, dz) || 1;
      dx /= len; dz /= len;
      nx = pk.nx + dx * dist;
      nz = pk.nz + dz * dist;
      nx = Math.max(-0.9, Math.min(0.9, nx));
      nz = Math.max(-0.9, Math.min(0.9, nz));
      // clamping can drag the point back toward the pocket — push back out of the capture radius
      const d = Math.hypot(nx - pk.nx, nz - pk.nz);
      if (d < 0.18) {
        const push = 0.18 / (d || 0.001);
        nx = Math.max(-0.9, Math.min(0.9, pk.nx + (nx - pk.nx) * push));
        nz = Math.max(-0.9, Math.min(0.9, pk.nz + (nz - pk.nz) * push));
      }
    } else {
      // far half of the table, away from the player start (+nz) and pockets
      nx = rng.range(-0.72, 0.72);
      nz = rng.range(-0.8, 0.15);
    }
    let ok = true;
    for (const u of used) if (Math.hypot(u.nx - nx, u.nz - nz) < minR) { ok = false; break; }
    if (ok) { used.push({ nx, nz }); return { nx, nz }; }
  }
  const nx = rng.range(-0.3, 0.3), nz = rng.range(-0.7, 0);
  used.push({ nx, nz });
  return { nx, nz };
}

export function makeRack(depth: number, rng: Rng, money: boolean): Wave[] {
  // v2 run is 8 tables — do NOT copy v1's act-3/depth-12 branch
  const act = depth <= 4 ? 1 : 2;
  const pool = poolFor(depth);
  const pressure = Math.min(1, (depth - 1) / 7); // v1 /11, rescaled to the 8-table run
  const waves: Wave[] = [];
  const nWaves = act === 1 ? 3 : 4;

  for (let w = 0; w < nWaves; w++) {
    const used: { nx: number; nz: number }[] = [];
    const wave: Wave = [];
    const last = w === nWaves - 1;
    // count ramps with act and wave index, money adds pressure — capped so it never floods
    const count = Math.min(6, 1 + act + (w > 0 ? 1 : 0) + (money ? 1 : 0));

    if (w === 0) {
      // wave 0 is ALWAYS the teach beat — one clean kind, no elites, at every depth
      const k = rng.pick(pool);
      for (let i = 0; i < count; i++) {
        const p = place(rng, used, 0.28, pressure);
        wave.push({ kind: k, nx: p.nx, nz: p.nz, elite: false });
      }
    } else {
      // complication — mix types into nasty interactions
      for (let i = 0; i < count; i++) {
        const k = rng.pick(pool);
        const p = place(rng, used, 0.26, pressure);
        wave.push({ kind: k, nx: p.nx, nz: p.nz, elite: false });
      }
    }
    if (last) {
      // Elite climax — the rack's signature threat
      const eliteBudget = act + (money ? 1 : 0);
      for (let e = 0; e < eliteBudget; e++) {
        const k = rng.pick(pool);
        const p = place(rng, used, 0.30, pressure);
        wave.push({ kind: k, nx: p.nx, nz: p.nz, elite: true });
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
    const used: { nx: number; nz: number }[] = [{ nx: 0, nz: -0.55 }]; // keep clear of boss
    const wave: Wave = [];
    for (let i = 0; i < sizes[w]; i++) {
      const k = rng.pick(pool);
      const p = place(rng, used, 0.28, 1);
      wave.push({ kind: k, nx: p.nx, nz: p.nz, elite: true });
    }
    waves.push(wave);
  }
  return waves;
}

/** Mini-boss (Rack-Master, depth 4) rack: single wave, armor 1. A composition check —
 *  three enemies, exactly one elite: do you have a build yet? */
export function makeMiniBossWaves(rng: Rng): Wave[] {
  const pool: EKind[] = ['bumper', 'charger', 'splitter'];
  const used: { nx: number; nz: number }[] = [{ nx: 0, nz: -0.5 }]; // keep clear of mini-boss
  const wave: Wave = [];
  const eliteIdx = rng.int(0, 2);
  for (let i = 0; i < 3; i++) {
    const k = rng.pick(pool);
    const p = place(rng, used, 0.28, 0.3);
    wave.push({ kind: k, nx: p.nx, nz: p.nz, elite: i === eliteIdx });
  }
  return [wave];
}

export function spawnWave(sim: Sim, wave: Wave, bounds: Bounds): Entity[] {
  const out: Entity[] = [];
  for (const s of wave) {
    const x = s.nx * bounds.halfW, z = s.nz * bounds.halfL;
    const e = spawnEnemy(sim, s.kind, { x, y: 1, z }, s.elite);
    e.body.setTranslation({ x, y: e.r + 0.05, z }, true); // r only known post-spawn
    e.ai.timer = seedSpawnTimer();
    out.push(e);
  }
  return out;
}
