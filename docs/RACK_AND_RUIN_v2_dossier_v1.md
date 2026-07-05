# MISCUE v2 — MBU Body, Pool Soul · Dossier V1

> **You're still the cue ball. Now you can see the drop from the rail.**
> The underhall gets a body: a low chase camera rides behind you as you roll across floating tables in the
> void, bank off ramps and walls, and thread gaps a top-down table never had. The soul underneath — Stroke,
> cracks, the hustler's afterlife — doesn't change. The camera does. *v2 preview build.*

| | |
|---|---|
| **Genre** | 3D pool roguelike, chase-cam descent |
| **Engine** | three.js r170 + Rapier3D (WASM) + Vite 6 |
| **Platform** | Touch-first — iPhone, played thumb-first from the first build |
| **Model** | Same as v1: premium one-time purchase, eventual Steam parity |
| **Build model** | Claude writes the packets; the orchestrator reviews and commits every change |

**What v2 is:** the v1 prototype (live at github.io/miscue/) proved the soul — Stroke, cracks, waves, the
route. v2 keeps all of it and replaces the *body*: the flat table becomes a chase-camera platformer in the
mold of Marble Blast Ultra, with real ramps, gaps, moving obstacles, and pads on the field. Nothing about
*why* you're rolling changes. Everything about *what it feels like to roll* does.

---

## 01 · Product Brief

**MBU body, pool soul.** You are still the cue ball, still one shot from a scratch, still climbing out of
the underhall table by table. What's new is the camera drops in behind you and stays there: you *chase* your
own shot instead of watching it from above a felt rectangle. The core loop doesn't change shape, it changes
texture:

**shot → carve → land → shot.**

- **Shot** — drag-back slingshot in bullet-time, spin pad dialed in, same trinity of power/spin/angle v1
  proved out.
- **Carve** — the ball is rolling now, not sliding on a plane. It carries momentum across ramps, banks off
  real walls, catches air over gaps. A little steering is yours mid-roll, at a cost.
- **Land** — the roll resolves: an enemy sunk, a pocket lipped, a wall banked, a gap cleared, or a scratch off
  the edge of the world.
- **Shot** — bullet-time drops back in and the next read begins.

This is a touch-first build from day one — every milestone ships to a phone (`/miscue/v2/`) because a chase
camera and a slingshot drag either both feel right on an iPhone or the whole reframe is dead on arrival.

---

## 02 · The Ten V2 Decisions (LOCKED)

Resolved with the user before any code moved; do not reopen.

### V1 · Controls — hybrid
**The call:** Pool shots stay the core verb — drag-back slingshot, bullet-time aim, spin pad — behind a low
chase camera. Mid-roll steering (real-time english re-hosted as a force) is available but costs Stroke and is
strictly correction-only: it cannot start motion from rest or sustain a climb. Tap-to-peek swaps to an
overhead table view mid-roll.

**Why:** MBU's chase-cam feel needs *some* in-flight agency or the shot just plays out like a cutscene — but
full drive-style control would drown the "one shot, one read" tension that makes pool tense in the first
place. Correction-only steering keeps the slingshot the real decision while the roll still feels alive under
thumb.

**Consequences:** `steer.accel` is capped below `g·sin(9°)` so no authored ramp can be cheesed by holding a
direction; steering drains the same Stroke meter that buys deep bullet-time, a new economy tension. Peek is a
camera-only toggle — it must never stall the sim or eat aim input.

### V2 · Objective — mixed node types
**The call:** Depths mix **combat racks** (sink enemies in pockets, as before) with **traversal gauntlets**
(cross ramps, movers, and hazards to a single exit pocket). The route decides per depth: the open slot's
primary option is rack 60% / gauntlet 40%.

**Why:** a chase-cam reframe that's still "stand on a static arena and shoot things" wastes the half of MBU
that made the pitch land. Gauntlets are where the marble actually gets to run.

**Consequences:** the wave grammar (teach→complicate→elite) only governs rack nodes; gauntlets need their own
crossing/checkpoint economy, and a new `NodeKind: 'gauntlet'` ("The Long Walk").

### V3 · Physics — Rapier 3D
**The call:** swap the 2D pool-on-a-plane sim for `@dimforge/rapier3d-compat` (WASM). Real ramps, jumps,
moving platforms, real collision events. Falling off is now a **scratch**: respawn at last safe ground /
checkpoint, costs Stroke, **+1 crack on boss/mini-boss tables**.

**Why:** convincing 3D platforming needs a real solver — a ramp can't be faked believably in 2D. The
`-compat` WASM build inlines as base64, so it deploys to a GitHub Pages subpath with no loose `.wasm`, no
MIME headaches, no vite plugin.

**Consequences:** physics runs free (D1 carries — no fixed-point, no replay parity, ever); the WASM costs
~1.1 MB gzip, so `RAPIER.init()` fires at boot behind the menu, before `new Game()`; body count stays
≤~20 with CCD player-only to hold mobile frame time.

### V4 · Run length — 8 tables
**The call:** the run shortens from v1's 12 to **8**. Act I = depths 1–4 (mini-boss "Rack-Master" at 4),
Act II = 5–7, finale 8-ball boss at 8. Shops guaranteed offered at depths 3 and 6.

**Why:** a chase-cam 3D level takes longer to read and cross than a flat table glanced at from above — 8
tables at the new pace lands near the same session length v1's 12 gave at the old one.

**Consequences:** `route.ts`'s fixed slots move (4/8, not 4/12); shop cadence compresses from every-4th to
roughly every-3rd; every place that asserted 12 route slots now asserts 8.

### V5 · Levels — authored chunk library + seeded remix
**The call:** levels are hand-built set pieces — arenas, ramp sections, gap jumps, pocket clusters, powerup
spurs — stitched per depth/act by the seed, socket-walked at 90° yaws.

**Why:** authored chunks guarantee the ramps and gaps actually feel good and are provably crossable; fully
procedural 3D geometry is a much bigger, riskier bet stacked on top of a reframe already carrying Rapier and
a new camera as risk.

**Consequences:** seam rule frozen — mating chunk floors share identical Y, overlapped 0.05, so a sphere
player never catches a lip; the chunk library caps at ~12 chunks by M3; `ChunkDef` freezes before the
stitcher is built against it.

### V6 · Powerups — pads on the field, one held slot
**The call:** MBU-style field pickups — Fresh Chalk (next shot 150%), Massé Hop (jump), The Bridge (2 s
slow-fall), Table Brush (3-beat time-slow), 8-Ball Shell (absorbs one crack) — one held slot, pickup replaces.

**Why:** a chase-cam platformer with no field pickups is missing half its genre's vocabulary; one slot, not
an inventory, keeps the decision live and legible on a phone screen.

**Consequences:** needs pad sensors (`onPad`) in the physics seam and a HUD slot widget; Table Brush's
time-slow is 3 *beats*, not 3 seconds — it must sync to the music clock once that exists.

### V7 · Music — procedural WebAudio lounge loop
**The call:** a lookahead-scheduled ~84 BPM swung 4/4 lounge loop (bass, brushed hats, rim clicks, pad), a
sample-accurate beat clock, intensity tiers 0–3 that follow Stroke and combat state.

**Why:** the soul's promise that "the music tells you how you're doing before the UI does" needs an actual
beat to hang the backdrop crowd's bob and the world's pulse on; procedural keeps it a code asset, not a
licensing or bundle-size problem.

**Consequences:** everything that wants to feel "on the beat" — backdrop nods, bloom pulse, pocket-rim
emissive, Table Brush's duration — reads `music.clock` / `onBeat`; that API freezes before M5's
music/backdrop/tuning batch starts.

### V8 · Backdrop — misty human hustler silhouettes
**The call:** procedural billboard sprites of misty, shady **human** figures — trench coats, hat brims,
cigarette embers flaring on the beat — ring the void beyond the level. More gather with depth; they lean in
on boss tables. They are pool "**sharks**" only in the slang sense — never, under any circumstance, literal
sharks.

**Why:** the soul's crowd of the damned isn't decoration, it's the premise made visible — keeping it alive
under a whole new camera, for the cost of a few cheap procedural billboards, is free load-bearing atmosphere.

**Consequences:** sprite count scales `4 + 2·depth`, capped under 30 draw calls; fog-attenuated beyond level
bounds so the void stays cheap and moody; nothing in `backdrop.ts` may read as a literal marine animal — that
word is a hazard, not a design note.

### V9 · HUD v2
**The call:** for the chase cam — chalk-cube Stroke meter bottom-center (a CSS cube that visibly wears down),
spin widget bottom-right, cracks on a cue-ball icon top-left, depth/route top-right, enemy overhead markers +
clamped off-screen edge arrows, powerup slot bottom-left.

**Why:** a top-down HUD reading table-relative positions doesn't survive a chase cam — enemies and pockets
can now be entirely off-screen, so the HUD has new spatial work it never needed to do in v1.

**Consequences:** `hud.ts` inherits v1's panel flow (menu/draft/shop/forge/mystery/wager) near-verbatim
against a new `index.html`; `markers.ts` is a new DOM-pool module for the diamond markers and edge arrows.

### V10 · Delivery
**The call:** v2 is developed on its own branch as a self-contained `v2/` subproject; **v1 stays live at
`/miscue/`**; v2 deploys to a live preview at **`/miscue/v2/`** after each milestone, dispatched from `main`,
for iPhone playtesting.

**Why:** the protected `github-pages` deploy environment is typically locked to the default branch, so v2
can't deploy itself — and every milestone needs a real phone thumb-test, not just a diff review.

**Consequences:** the v2 branch never edits a v1 file, so the eventual merge is purely additive; `deploy.yml`
on `main` gains a v2-branch checkout + build + copy-into-`dist/v2/` step, guarded so a missing v2 branch never
breaks the v1 deploy; previews fire on `workflow_dispatch`, never on a push to `v2`.

---

## 03 · Decision Log

### Carried forward (still governs, unchanged)
- **D1 · Free physics, seeded content only** — physics runs free (now Rapier, not the 2D solver);
  determinism still lives *only* in the route/rack/draft/level streams. Never promise replay parity.
- **D2 · Stroke, the flow meter** — same shape; now also drains under steering, still buys deep bullet-time.
- **D3 · Wave grammar** — teach→complicate→elite, timer-or-clear, boss armor 1:1 with wave clears — governs
  rack-type nodes; gauntlet nodes get their own crossing/checkpoint structure instead.
- **D4 · Cracks & the never-shatter invariant** — visible cracks, 3–4 to shatter, Forge/Money-ante gated on
  `cracks + 1 < maxCracks`, Mystery never adds a crack — carries verbatim. Falling off a chunk is now a
  *second* way to scratch, feeding the same crack/Stroke economy as sinking yourself.
- **D6 · The soul** — hustler's afterlife — carries and extends into the visible backdrop crowd (§06 below).
- **Enemy `Kind` roster frozen** — player/bumper/skitter/charger/splitter/boss. No new kind without a
  render-fallback design.

### Superseded
- v0.3's D5 (12–15 tables, three acts) is replaced by **V4** above: 8 tables, Act I 1–4, Act II 5–7, boss @8.

### STILL-OPEN
- **Spin mode final call** — `forced` (v1's proven english/draw math re-hosted as forces, default) vs
  `physical` (angular velocity + friction) — decided during M0 by feel-test, toggled via `?spin=physical`.
- **Gauntlet reward tuning** — chalk/Stroke/draft payout for a clean crossing vs. a clean rack clear, not yet
  balanced against each other.
- **Enemy-knocked-off-world reward** — ruled a legal verb ("sunk at half chalk"); the exact number is a
  placeholder pending playtesting.

---

## 04 · Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Render | three.js **r170** | Mature, well-documented chase-cam + PBR-lite pipeline; matches v1's renderer family. |
| Build | **Vite 6** | Same tool v1 uses; `base: '/miscue/v2/'` is the only delivery-specific config. |
| Language | **TypeScript 5.6** | Matches v1; packet implementers reuse the same idiom. |
| Physics | **`@dimforge/rapier3d-compat` ^0.19.3** (WASM, base64-inlined) | The repo's only binary asset, and the *only* one it will ever have — `-compat` sidesteps loose `.wasm`, MIME, and subpath problems on Pages. `optimizeDeps.exclude`d so the dev server doesn't choke pre-bundling it. |

**World scale** (locked in `config.ts`): ball radius `r = 0.15`; platforms sized `6–10` logical units;
gravity `(0, -20, 0)`; fixed step `h = 1/60` (Rapier's sweet spot — v1's `0.034 s` step was too coarse for a
real solver).

**The `PhysicsEvents` seam** — the load-bearing contract evolved from v1's `PhysicsEvents`, now sourced from
Rapier's `EventQueue` instead of a hand-rolled 2D resolver:

```ts
onSink(e, pocketId)
onCollide(a, b, impact, tangent)
onSurface(e, impact, 'wall' | 'floor')
onPad(e, padId)
onFall(e)
onGraze(e, pocketId)
```

`impact`/`tangent` are computed from body velocities at the moment of contact, so v1's crack and splitter
thresholds port over meaning-for-meaning.

**RNG tag registry** — v1's tags carry verbatim; three new v2 tags join them, and the whole set freezes at
milestone **M2**:

| Tag | Carried from |
|---|---|
| `ROUTE_TAG`, `RACK_TAG`, `DRAFT_TAG`, `SHOP_TAG`, `MYSTERY_TAG`, `FORGE_TAG`, `AI_TAG` | v1, unchanged values |
| `LEVEL_TAG`, `PAD_TAG`, `MUSIC_TAG` | new in v2 |

The mixing formula is carried verbatim:

```ts
private subRng(tag: number, depth = 0): Rng {
  return new Rng((this.seed ^ tag ^ Math.imul(depth, 0x9e3779b1)) >>> 0);
}
```

**Bundle budget:** Rapier's WASM alone is ~1.1 MB gzip. `RAPIER.init()` is kicked off at boot, behind the
menu, so the cost is paid once before the player can touch anything.

**Delivery:** dual-Pages — v1 stays live at `/miscue/`; v2 preview builds to `/miscue/v2/`. Both are built by
the *same* `deploy.yml` workflow on `main` (checkout the `v2` branch into a subdir, `npm ci && npm run build`,
copy into `dist/v2/`, branch-exists guard), fired by `workflow_dispatch` after each milestone lands.

---

## 05 · Controls Spec

**Gesture zone map** (screen space, not world space):
- **Lower ~55%** of the screen, drag = slingshot aim. The drag vector is rotated by the camera's current yaw
  before becoming an aim direction, so "pull back" always means *away from where the camera is looking*, not
  away from a fixed screen axis.
- **Upper zone, or a two-finger drag anywhere** = manual camera orbit.
- **The same lower-zone drag, while the ball is coasting** (not eligible to aim) = steering.

**Aim eligibility:** grounded + slow — carried from v1's `canAim` gate, now backed by a real raycast
`grounded()` check instead of a flat-table assumption.

**Steering correction-only guarantee (mechanical, not a suggestion):**
- Force is capped at `steer.accel · mass`.
- Below `steer.minSpeed`, steering input does *nothing* — you cannot start rolling from a dead stop by holding
  a direction.
- `steer.accel` is held under `g·sin(9°) ≈ 3.1` (with `g = 20`) — below the acceleration needed to climb any
  authored ramp. Steering can nudge a line, it cannot manufacture one.
- Steering continuously drains Stroke at `steer.drainPerSec` while active and grounded-fast — the same meter
  that buys deep bullet-time, so steering and aiming compete for the same resource.

**Spin pad + double-tap-zero** — carried byte-for-byte from v1's `input.ts`: a draggable knob in a
bottom-right pad, `dx → spinSide` (english), `-dy → spinTop` (draw/follow, up = topspin), clamped to the pad's
unit circle; a second pointerdown within 300 ms zeroes both axes and snaps the knob back to center.

**Peek behavior:** tap `#peek` to lerp the camera to an overhead framing over **0.25 s**, yaw preserved (the
player's sense of facing carries through the transition, it doesn't reset to a fixed compass direction); a
second tap lerps back. Peek never pauses the sim and never eats aim/steer input — it is camera-only.

**Powerup slot tap:** tapping the bottom-left slot consumes the held pad's effect immediately; the slot is
empty until a pad pickup fills it (pickup-replaces — no stacking, no inventory).

---

## 06 · The Soul, Extended

**The long tables over the void.** Each chunk floats with no visible edge to the underhall — the same "warm
island of felt-green and neon in endless cold dark" mood v0.3 set for the top-down table, now *traversed* in
third person instead of glanced at from above. You never see where the void ends; that's still the cheapest
mood the budget buys.

**The misty hustler crowd.** Procedural billboard sprites gather at the fog line beyond the level bounds —
misty, shady human silhouettes, trench coats and hat brims, a cigarette ember flaring on the beat. Count
scales with depth (`4 + 2·depth`); they lean in and thicken on boss and mini-boss tables. The crowd doesn't
just dress the void, it *is the stakes made visible* — more of the damned watching the deeper you get, because
more of them lost right here.

**The lounge loop.** A ~84 BPM swung 4/4 loop whose intensity follows Stroke exactly as v0.3 promised: dead
stroke (meter high, sinking everything) opens the score up, adds a layer, swings; cracked and desperate strips
it to a lonely, tense pulse. What's new in v2 is that the loop now runs on a real sample-accurate beat clock,
and the whole game synchronizes to it — the crowd's bob, the world's bloom pulse, the pocket rims' emissive
flare all key off the same `onBeat`.

**The two signature sounds, carried verbatim.** The *thunk* (sinking an enemy — deep, wet, final, a half-beat
of held silence after) and the *crack* (taking damage — ice fracturing, high, sharp, makes you wince). The
whole emotional range of the game is still the dance between those two notes; nothing about the reframe
touches them.

---

## 07 · Work-Packet Playbook (delta from `docs/tasks/README.md`)

The v1 packet ground rules hold — own only your listed files, no test framework, terse comment-light
prototype idiom, flavor copy is part of the spec. Deltas for v2:

- **File ownership is `v2/**` only.** No v2 packet edits a v1 file, and no v2 packet edits another
  concurrently-dispatched packet's files, even to "help." A second, unrelated agent may be editing other
  parts of `v2/src/**` at the same time — the same ground rule applies double.
- **The frozen `__game.debug` contract:**
  ```ts
  { state(), fire(dirXZ, power, spin?), warp(x, y, z), settle(), enterNode(kind), grantPowerup(p), tick(ms) }
  ```
  Every milestone's headless verification drives through this hook. Its method names and argument shapes do
  not change; a packet that needs new debug surface adds a new method, never renames or repurposes an old one.
- **Verification recipes:**
  - `npx tsc --noEmit` + `npm run build`, run inside `v2/`, on every packet — the acceptance floor.
  - Pure-logic modules (route/waves/chunks/stitch) assert via `esbuild --bundle --format=esm` + `node -e`,
    exactly the v1 P1/P2 recipe.
  - Runtime packets add headless Playwright: chromium at `/opt/pw-browsers`, swiftshader GPU flags, driven
    against `vite preview`, asserting through `window.__game.debug`.

---

## 08 · Build Sequence

Each milestone ends in a `/miscue/v2/` deploy the user thumb-tests on an iPhone before the next one starts.

| Milestone | Scope | Feel-test question |
|---|---|---|
| **M0** — the marble is alive | Scaffold + CI; ball, shot, steering, spin pad, chase cam, peek, fall→respawn on one hand-built platform (ramp + bank + gap). | Shot weight? Steering ergonomics (make-or-break)? Camera comfort? Both spin modes via `?spin=physical`? |
| **M1** — combat rack ported | One static arena, 4 pocket wells, all 5 enemy kinds on forces, waves, `PhysicsEvents`→cracks/chalk/stroke/SFX, shadow-world preview ribbon, minimal HUD. | Can you clear a rack? Does the preview stay honest on banks/ramp? |
| **M2** — roguelike spine | Full 8-table run: route, mini-boss@4/boss@8, drafts, shop/rest/forge/mystery/wager, victory/defeat, daily seed. **RNG tags freeze.** | Win *and* lose a run — does it take ~20 minutes? |
| **M3** — chunks, stitcher, gauntlets, movers | ~12-chunk library, seeded stitching, `gauntlet` nodes with exit pocket + checkpoints, pendulum cue sticks + rolling racks. | Gauntlet crossing feel? Seam smoothness? Checkpoint fairness? |
| **M4** — powerups + HUD v2 | Five powerups on pads + held slot; chalk cube, crack icon, route readout, enemy markers/edge arrows. | Massé Hop a gap? Brush a boss wave? Marker readability? |
| **M5** — music, backdrop, tuning, ship-candidate | Lounge loop + beat clock, world pulse, hustler crowd scaling/leaning, mobile perf pass (`lowFx` auto-trip), balance pass, dossier finalized. | Full run with sound — thermals okay? Does the room feel alive? |
| **M6** (reserve) | Polish only. No new systems. | — |

---

*MISCUE v2 · MBU Body, Pool Soul · Dossier V1 · Working preview build. Mirrors dossier V0.3's structure and
voice; every decision above traces to `plan-those-out-then-vivid-otter.md`. Subject to phone playtest.*
