// Forge deepenings + mystery events (dossier D4/D5). Forge picks are repeatable across visits —
// stacking multipliers on a near-shatter ball is the glass-cannon archetype.
import { Rng } from './rng';
import { PlayerStats } from './upgrades';

export interface ForgeOption { id: string; label: string; desc: string; apply(s: PlayerStats): void }

const FORGE_POOL: ForgeOption[] = [
  { id: 'f-power', label: 'Overstrike',  desc: 'Hit 20% harder than a soul should.',
    apply: s => { s.maxPower *= 1.2; } },
  { id: 'f-slow',  label: 'Slow Blood',  desc: 'Deep time drains 25% slower.',
    apply: s => { s.strokeDrain *= 0.75; } },
  { id: 'f-eyes',  label: 'Sharp Eyes',  desc: 'Style pays out 30% bigger Stroke.',
    apply: s => { s.strokeGain *= 1.3; } },
  { id: 'f-bent',  label: 'Bent True',   desc: 'Your english bends 35% deeper.',
    apply: s => { s.curve *= 1.35; } },
  { id: 'f-dense', label: 'Dense Core',  desc: 'A quarter again your mass. You hit like a grudge.',
    apply: s => { s.mass *= 1.25; } },
];

export function forgeOptions(rng: Rng, n = 2): ForgeOption[] {
  const pool = [...FORGE_POOL];
  const out: ForgeOption[] = [];
  while (out.length < n && pool.length > 0) {
    const i = Math.floor(rng.next() * pool.length);
    out.push(pool.splice(i, 1)[0]);
  }
  return out;
}

export interface MysteryResult { title: string; desc: string; chalk?: number; repair?: number; strokeFill?: boolean }

export function rollMystery(rng: Rng, ctx: { cracks: number; chalk: number }): MysteryResult {
  const r = rng.next();
  if (r < 0.30) {
    return { title: 'A stash under the rail', desc: 'Somebody hid chalk here and never came back for it.', chalk: 8 };
  }
  if (r < 0.55) {
    if (ctx.cracks > 0) {
      return { title: 'A kind stranger', desc: 'Gone before you can ask a name. One crack polished smooth.', repair: 1 };
    }
    return { title: 'A stash under the rail', desc: 'Nothing needs mending. You pocket the tip instead.', chalk: 4 };
  }
  if (r < 0.80) {
    return { title: 'A long drink of quiet', desc: 'The felt hums low. Your Stroke settles full.', strokeFill: true };
  }
  return { title: 'Hustled', desc: 'You never even saw the cue move. Your chalk is lighter.', chalk: -Math.min(5, ctx.chalk) };
}
