// single source of tunables + kill-switches. nothing in sim/registry/physics-events
// should hardcode a number that belongs here — if a later milestone wants to retune
// feel, this is the only file it should need to touch.
export const CFG = {
  ballR: 0.15,
  gravity: { x: 0, y: -20, z: 0 },
  h: 1 / 60,
  killY: -8,                       // world-space fall plane (level can override)
  // player mass is 1 → impulse ≈ launch speed. 8 was tuned for M0's small UNRAILED
  // slab (12 sent casual shots into the void); the railed 10u arena needs 11 — the
  // M1 field report was "can't even hit the ball across the table at full power",
  // and the playability audit confirmed full-power roll-out (~7u) < table length.
  shot: { maxImpulse: 11, minImpulse: 1.2 },
  steer: { enabled: true, accel: 3.0, minSpeed: 0.8, drainPerSec: 12 },
  // accel MUST stay < g·sin(9°) ≈ 3.14 — the "correction-only" guarantee:
  // steering can bend a rolling ball but can never climb a ramp or start motion.
  spin: { mode: 'forced' as 'forced' | 'physical', curveK: 1.6, topK: 0.5, decay: 1.1 },
  // height 2.3 (was 1.6): looking at the ball from higher tilts the frame down, so
  // portrait screens show mostly table instead of 40% empty void above the horizon.
  cam: { dist: 3.4, height: 2.3, lookAhead: 0.45, spring: 6, peekHeight: 9, peekLerp: 0.25 },
  fx: { lowFx: false, dprCap: 1.5 },
  preview: { steps: 90, stride: 3 },
  scratch: { strokeCost: 30 },

  // --- M1 combat economy. v1 numbers converted where they are closing SPEEDS:
  // v1 max shot speed was 3.0, v2's is shot.maxImpulse = 8 (player mass 1), so
  // speed thresholds scale ×8/3 ≈ 2.67 to stay the same *fraction of a full shot*.
  // Dimensionless ratios and second-valued timers copy verbatim.
  combat: {
    // M1.5 playability pass: the straight v1 conversions (1.47/3.07 = 18%/38% of max
    // shot) made the player's own medium shots into bumpers crack THEM — with zero
    // crack recovery before M2's economy, shatter was structurally near-guaranteed
    // (field report: "shattering feels too easy"). Raised so cracks come from
    // enemy-initiated violence (charger lunge 4.8, boss 4.0) and true full sends.
    crackHeavyImpact: 2.6,    // bumper/boss/elite/fast-charger contact cracks above this
    crackLightImpact: 4.6,    // ANY enemy cracks the player at this closing speed
    chargerFastSpeed: 1.6,    // v1 0.60 — a charger moving faster than this counts as heavy
    splitImpact: 1.33,        // v1 0.50 — min closing speed for a splitter to split
    splitHardImpact: 2.67,    // v1 1.00 — dead-center hits split above this regardless of tangent
    splitTangentRatio: 0.4,   // verbatim — off-center = tangent > impact * ratio
    bankMinSpeed: 0.4,        // v1 0.15 — wall contact above this speed counts as a bank
    clackNorm: 5.3,           // v1 /2  — clack loudness = min(1, impact / clackNorm)
    iFramesS: 1.2,
    maxCracks: 3,             // becomes stats.maxCracks at M2
    crackStrokeCost: 15,
    strokeStart: 40,
    strokeMax: 100,
    sinkStroke: 18, bankStrokeBonus: 8, multiSinkBonus: 10,
    grazeStroke: 4, waveClearStroke: 8,
    sinkChalk: 2,             // ×2 on money racks (M2), +banksThisShot on top
    rackClearChalk: 4,        // ×2 on money racks (M2)
    aimTimescale: 0.12,       // bullet time while aiming with stroke to burn...
    aimTimescaleEmpty: 0.45,  // ...and the free shallow slow when the tank is dry
    aimDrainPerSec: 12,       // 22 (v1) punished thinking time; steering costs 12/s,
                              // aiming shouldn't cost more than acting (M1.5)
    waveStallS: 25,           // anti-stall; EXEMPT on boss/mini-boss (armor is 1:1 with clears)
    calmStart: 0.8, calmBetween: 2.4, calmBossBetween: 2.2,
  },
  // enemy AI feel numbers (speeds converted ×8/3 like combat; timers verbatim).
  enemies: {
    playerStillSpeed: 0.21,   // v1 0.08 — AI punishes you when you've STOPPED
    enemyStillSpeed: 0.13,    // v1 0.05 — skitter only re-plans from near rest
    spawnTimerMin: 0.5, spawnTimerRand: 1.5,
    skitter: { speed: 2.0, eliteSpeed: 2.93, timerS: 2.4, eliteTimerS: 1.6 },
    charger: { speed: 4.8, eliteSpeed: 5.87, telegraphS: 0.75, relungeS: 0.65, recoverS: 4.2, eliteRecoverS: 3.2 },
    boss: { speed: 4.0, telegraphS: 0.9, recoverVulnS: 3.5, recoverArmoredS: 6 },
  },
};
