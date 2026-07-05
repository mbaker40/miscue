// Seeded RNG (mulberry32). Determinism lives HERE and only here (dossier D1):
// racks and upgrade offers are seeded; the physics sim runs free.
export class Rng {
  private s: number;
  constructor(seed: number) { this.s = seed >>> 0; }
  next(): number {
    this.s = (this.s + 0x6d2b79f5) >>> 0;
    let t = this.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  range(a: number, b: number): number { return a + this.next() * (b - a); }
  int(a: number, b: number): number { return Math.floor(this.range(a, b + 1)); }
  pick<T>(arr: T[]): T { return arr[Math.floor(this.next() * arr.length)]; }
}

export function dailySeed(): number {
  const d = new Date();
  return d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate();
}

// AI stream (D1): enemy decisions must be replayable. Seeded per run; separate
// from the rack/draft streams so AI consumption can never desync table content.
let aiStream = new Rng(1);
export function seedAiRng(seed: number) { aiStream = new Rng(seed >>> 0); }
export function aiRandom(): number { return aiStream.next(); }
