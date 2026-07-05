// single source of tunables + kill-switches. nothing in sim/registry/physics-events
// should hardcode a number that belongs here — if a later milestone wants to retune
// feel, this is the only file it should need to touch.
export const CFG = {
  ballR: 0.15,
  gravity: { x: 0, y: -20, z: 0 },
  h: 1 / 60,
  killY: -8,                       // world-space fall plane (level can override)
  shot: { maxImpulse: 12, minImpulse: 1.2 },   // player mass is 1 → impulse ≈ launch speed
  steer: { enabled: true, accel: 3.0, minSpeed: 0.8, drainPerSec: 12 },
  // accel MUST stay < g·sin(9°) ≈ 3.14 — the "correction-only" guarantee:
  // steering can bend a rolling ball but can never climb a ramp or start motion.
  spin: { mode: 'forced' as 'forced' | 'physical', curveK: 1.6, topK: 0.5, decay: 1.1 },
  cam: { dist: 3.2, height: 1.6, lookAhead: 0.45, spring: 6, peekHeight: 9, peekLerp: 0.25 },
  fx: { lowFx: false, dprCap: 1.5 },
  preview: { steps: 90, stride: 3 },
  scratch: { strokeCost: 30 },
};
