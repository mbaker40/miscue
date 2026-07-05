# MISCUE v2 — Work Packets

Index and shared contracts for the MBU-reframe rewrite. Mirrors `docs/tasks/README.md`'s ground rules and
format. Each packet doc (`M0.md`, and milestone docs authored as each milestone starts) is self-contained: an
implementer needs only that doc plus the repo.

## Ground rules (every packet)

- **Own only `v2/**` files, and only the ones listed in your packet.** Do not edit any other file, even to
  "help" — a v1 file, another packet's file, or a doc. Cross-packet needs are compile-time contracts defined
  below; if a contract seems wrong or missing, stop and report — do not improvise.
- **Never touch anything under v1's `src/` or `docs/tasks/`.** The v2 branch's changes must stay purely
  additive so the eventual merge is trivial.
- **Do not add enemy `Kind` strings.** The roster is frozen: `player`, `bumper`, `skitter`, `charger`,
  `splitter`, `boss`. An unknown kind has no render fallback by design — adding one without a render-fallback
  design crashes rendering.
- **Prototype idiom:** match v1's existing style — terse, comment-light except where the dossier motivates a
  rule. No new dependencies beyond `three`, `vite`, `typescript`, `@dimforge/rapier3d-compat`. No test
  framework, plain TypeScript.
- **Acceptance floor for every packet:** `npx tsc --noEmit` and `npm run build`, run inside `v2/`, pass.
  Packet docs add specific assertions on top. Some packets are typechecked jointly with a sibling (noted per
  batch below), matching v1's P3/P4 pattern.
- Flavor copy is part of the spec — use the exact strings given; voice is the hustler's afterlife (dossier
  `docs/RACK_AND_RUIN_v2_dossier_v1.md` §06), technical numbers are exact.

## Milestone / batch table

Same ground rules as v1 packets; `∥` = parallel, disjoint files, dispatched together; batches within a
milestone run in the listed order.

| Batch | Packets | Key acceptance |
|---|---|---|
| M0.1 | Scaffold+CI (done by orchestrator) ∥ Physics core (`config`,`sim`,`registry`,`physics-events`) | build emits `dist/`; dropped ball settles; kill-plane fires |
| M0.2 | Control+input (`control`,`input`) ∥ Camera+render-min+`level0`+boot (`camera`,`render/scene`,`render/balls`,`level0`,`main`) | `debug.fire` moves the ball; steer at rest does nothing; peek toggles |
| M1.1 | Enemies+waves ∥ Level render+FX+audio | wave shape counts correct |
| M1.2 | Game combat slice+HUD-min ∥ Preview | scripted shots sink an enemy; crack on bumper hit; preview endpoint ≈ real shot on flat |
| M2.1 | Route+events+upgrades | 8 slots, shops@3/6, miniboss@4, boss@8, `options[0]`-equivalent primary always reachable |
| M2.2 | Game spine ∥ HUD panels (typechecked jointly) | full run walk via `debug.enterNode`; invariants re-asserted (mini-boss must not win run, armor 1:1) |
| M3.1 | Chunk library ∥ Stitcher (`ChunkDef` frozen first) | 100 seeds × every recipe → connected, no socket orphans, coplanar seams |
| M3.2 | Movers ∥ Gauntlet wiring | seam-sweep script: ball across all sockets, no vertical-velocity spikes |
| M4 | Powerups ∥ Markers/HUD | grant + use each powerup, assert state effects |
| M5 | Music ∥ Backdrop ∥ Tuning (`onBeat` API frozen first) | beat events at BPM ±1%; frame-time budget log |

Only **M0** has a packet doc today (`M0.md`); later milestone docs are authored per-milestone as learnings
land, same as the plan's execution order dictates.

## Frozen cross-packet contracts

```ts
// config.ts — every tunable + kill-switch, single source of truth
CFG = {
  ballR, gravity, h,
  shot: { maxImpulse },
  steer: { accel, minSpeed, drainPerSec, enabled },
  spin: { mode: 'forced' | 'physical', ... },
  cam: { dist, height, lookAhead, spring, peekHeight },
  fx: { lowFx, dprCap },
  preview: { steps, stride },
  scratch: { strokeCost: 30 },
}

// registry.ts — Entity replaces v1's Ball
interface Entity {
  id, kind, elite, body: RigidBody, collider, alive, r,
  prevPos, prevRot,       // render interpolation
  ai: { ... }, armor, vulnerable,
}
// Kind roster frozen: player | bumper | skitter | charger | splitter | boss
byCollider(handle): Entity | undefined

// physics-events.ts — the seam, evolved from v1
interface PhysicsEvents {
  onSink(e: Entity, pocketId: number): void;
  onCollide(a: Entity, b: Entity, impact: number, tangent: number): void;
  onSurface(e: Entity, impact: number, surface: 'wall' | 'floor'): void;
  onPad(e: Entity, padId: string): void;
  onFall(e: Entity): void;
  onGraze(e: Entity, pocketId: number): void;
}
// impact/tangent computed from body velocities at contact — v1 crack/splitter thresholds port unchanged.

// the frozen debug hook — every milestone's headless verification drives through this
window.__game.debug = {
  state(), fire(dirXZ, power, spin?), warp(x, y, z), settle(), enterNode(kind), grantPowerup(p), tick(ms),
};

// chunks/types.ts — frozen before the M3 stitcher is built against it
interface ChunkDef {
  id: string;
  tags: ('start' | 'arena' | 'ramp' | 'curve' | 'gap' | 'pocketcluster' | 'spur' | 'exit' | 'boss')[];
  colliders: (CuboidDef | CylinderDef)[];
  sockets: { pos: Vec3; yaw: 0 | 90 | 180 | 270; width: number }[];
  anchors: { spawns: Vec3[]; pockets: (Vec3 & { exit?: boolean })[]; pads: Vec3[]; checkpoint?: Vec3 };
  movers?: MoverDef[];   // pendulum | rotor | platform, optional beatSync
}
```

## Invariants (load-bearing; violating any is a rejected packet)

1. **Never-shatter.** Forge and the Money crack-ante may never shatter the player — both gated on
   `cracks + 1 < stats.maxCracks`. Mystery outcomes never add cracks at all. (Carried from v1.)
2. **Mini-boss must not win the run.** Sinking the depth-4 mini-boss routes to the next rack clear, never to
   victory — only the depth-8 boss table triggers a run win. (Carried from v1, re-scaled to the 8-table run.)
3. **Boss armor stays 1:1 with minion-wave clears** — 1 wave / armor 1 for the mini-boss, 3 waves / armor 3
   for the 8-ball boss. The anti-stall timer is exempt on both boss tables.
4. **Enemy roster frozen.** `player | bumper | skitter | charger | splitter | boss` — no new `Kind` string
   without an accompanying render-fallback design.
5. **RNG tags freeze at M2.** v1's `ROUTE/RACK/DRAFT/SHOP/MYSTERY/FORGE/AI` tags carry verbatim; the new
   `LEVEL_TAG/PAD_TAG/MUSIC_TAG` join them; the `subRng` mixing formula
   (`(seed ^ TAG ^ Math.imul(depth, 0x9e3779b1)) >>> 0`) is frozen from the moment it lands.
6. **Steering correction-only guarantee.** The steer force cap does nothing below `steer.minSpeed`; `accel`
   stays under `g·sin(9°) ≈ 3.1` (with `g = 20`) so steering alone can never climb a ramp or start motion
   from rest.
7. **Seam rule.** Mating chunk floors share identical Y, overlapped 0.05 — the sphere player must never catch
   a lip at a chunk boundary.
8. **A route's primary option is always combat-reachable.** Every open slot's first option is rack or
   gauntlet (60%/40%) — never a slot where only shop/rest/forge/mystery are offered.

## Acceptance floor

Every packet, no exceptions: `npx tsc --noEmit` and `npm run build` inside `v2/`. Runtime packets add headless
Playwright (`/opt/pw-browsers` chromium, swiftshader flags, `vite preview`, assertions via
`window.__game.debug`). Pure-logic packets (route/waves/chunks/stitch) assert via `esbuild --bundle
--format=esm` + `node -e`, the same recipe v1's P1/P2 used — bundle to the scratchpad, then assert in node.
