// Between-tables ball re-forging (dossier D5/§05). Modifiers stack on PlayerStats.
import { Rng } from './rng';

export interface PlayerStats {
  maxCracks: number;
  maxPower: number;      // multiplier on shot speed
  curve: number;         // english effectiveness multiplier
  strokeGain: number;    // multiplier on stroke rewards
  strokeDrain: number;   // multiplier on deep-slow drain
  mass: number;
  magnet: number;        // homing strength
  rubber: boolean;       // bank bonus
  guardianLip: boolean;  // one pocket-save per rack
  lipUsedThisRack: boolean;
}

export function baseStats(): PlayerStats {
  return {
    maxCracks: 3, maxPower: 1, curve: 1, strokeGain: 1, strokeDrain: 1,
    mass: 1, magnet: 0, rubber: false, guardianLip: false, lipUsedThisRack: false,
  };
}

export interface Upgrade {
  id: string;
  name: string;
  desc: string;
  apply(s: PlayerStats): void;
}

export const UPGRADES: Upgrade[] = [
  { id: 'magnet', name: 'Magnet Core', desc: 'You drift slightly toward the nearest enemy while rolling.',
    apply: s => { s.magnet += 0.5; } },
  { id: 'rubber', name: 'Rubber Soul', desc: 'Bank shots pay out — sinks after a rail bounce give bonus chalk and Stroke.',
    apply: s => { s.rubber = true; } },
  { id: 'heavy', name: 'Heavy Core', desc: 'Half again your mass. You knock them flying; english bends you less.',
    apply: s => { s.mass *= 1.5; s.curve *= 0.75; } },
  { id: 'deadstroke', name: 'Dead Stroke', desc: 'Deep slow-mo drains 40% slower. Stay in the pocket of time.',
    apply: s => { s.strokeDrain *= 0.6; } },
  { id: 'chalk', name: "Hustler's Chalk", desc: 'All Stroke gains up 50%. Style pays.',
    apply: s => { s.strokeGain *= 1.5; } },
  { id: 'hollow', name: 'Hollow Core', desc: 'One extra crack before you shatter. You hit 10% softer.',
    apply: s => { s.maxCracks += 1; s.maxPower *= 0.9; } },
  { id: 'break', name: 'Sharp Break', desc: '+15% max launch power.',
    apply: s => { s.maxPower *= 1.15; } },
  { id: 'lip', name: 'Guardian Lip', desc: 'Once per table, the pocket spits you back out instead of taking you.',
    apply: s => { s.guardianLip = true; } },
  { id: 'english', name: 'Cursed English', desc: 'Your english bends 40% harder. The table remembers your spin.',
    apply: s => { s.curve *= 1.4; } },
];

export function draftUpgrades(rng: Rng, owned: Set<string>, n = 3): Upgrade[] {
  const avail = UPGRADES.filter(u => !owned.has(u.id));
  const out: Upgrade[] = [];
  const pool = [...avail];
  while (out.length < n && pool.length > 0) {
    const i = Math.floor(rng.next() * pool.length);
    out.push(pool.splice(i, 1)[0]);
  }
  return out;
}
