// Logical table space (dossier: one logical table, orientation-independent):
// x ∈ [-HALF_W, HALF_W], z ∈ [-HALF_L, HALF_L]. Portrait-native; the camera reframes.
import { aiRandom } from './rng';

export const HALF_W = 0.5;
export const HALF_L = 1.0;
export const POCKET_R = 0.062;

export type Kind = 'player' | 'bumper' | 'skitter' | 'charger' | 'splitter' | 'boss';

export interface Ball {
  id: number;
  kind: Kind;
  elite: boolean;
  x: number; z: number;
  vx: number; vz: number;
  r: number;
  mass: number;
  restitution: number;
  alive: boolean;
  // spin (player only): side = english (lateral curve), top = follow(+)/draw(-)
  spinSide: number;
  spinTop: number;
  // enemy AI scratch state
  aiTimer: number;
  aiState: number;      // 0 idle, 1 telegraph, 2 recovering
  aiTx: number; aiTz: number; // charger locked target
  lungesLeft: number;   // elite charger double-lunge
  didSplit: boolean;
  // boss
  armor: number;
  vulnerable: boolean;
}

let nextId = 1;

const STATS: Record<Exclude<Kind, 'player'>, { r: number; mass: number; rest: number }> = {
  bumper:   { r: 0.052, mass: 3.2, rest: 1.05 },
  skitter:  { r: 0.027, mass: 0.55, rest: 0.92 },
  charger:  { r: 0.034, mass: 1.1, rest: 0.95 },
  splitter: { r: 0.040, mass: 1.0, rest: 0.92 },
  boss:     { r: 0.085, mass: 8.0, rest: 0.98 },
};

export function makePlayer(): Ball {
  return {
    id: nextId++, kind: 'player', elite: false,
    x: 0, z: HALF_L * 0.62, vx: 0, vz: 0,
    r: 0.034, mass: 1, restitution: 0.94, alive: true,
    spinSide: 0, spinTop: 0,
    aiTimer: 0, aiState: 0, aiTx: 0, aiTz: 0, lungesLeft: 0, didSplit: false,
    armor: 0, vulnerable: true,
  };
}

export function makeEnemy(kind: Exclude<Kind, 'player'>, x: number, z: number, elite = false): Ball {
  const s = STATS[kind];
  const scale = elite ? 1.22 : 1;
  return {
    id: nextId++, kind, elite,
    x, z, vx: 0, vz: 0,
    r: s.r * scale, mass: s.mass * (elite ? 1.5 : 1), restitution: s.rest,
    alive: true, spinSide: 0, spinTop: 0,
    aiTimer: 0.5 + aiRandom() * 1.5, aiState: 0, aiTx: 0, aiTz: 0,
    lungesLeft: 0, didSplit: false,
    armor: kind === 'boss' ? 3 : 0,
    vulnerable: kind !== 'boss',
  };
}

export function makeSplitChild(parent: Ball, dir: 1 | -1): Ball {
  const b = makeEnemy('splitter', parent.x, parent.z, false);
  b.r = parent.r * 0.68;
  b.mass = parent.mass * 0.45;
  b.didSplit = true; // children never split again
  const px = -parent.vz, pz = parent.vx; // perpendicular to travel
  const n = Math.hypot(px, pz) || 1;
  b.vx = parent.vx * 0.5 + (px / n) * 0.5 * dir;
  b.vz = parent.vz * 0.5 + (pz / n) * 0.5 * dir;
  return b;
}
