# MISCUE — Dossier Conformance Work Packets

Index and shared contracts for the 12-table descent expansion (dossier D3/D4/D5 + D1 replay-readiness).
Each packet doc (`P1.md`–`P5.md`) is self-contained: an implementer needs only that doc plus the repo.

## Ground rules (every packet)

- **Own only your listed files.** Do not edit any other file, even to "help". Cross-packet needs are compile-time
  contracts defined below; if the contract seems wrong, stop and report — do not improvise.
- **Do not add enemy `Kind` strings.** `render.ts texFor()` does `KIND_TEX[b.kind]()` with no fallback — an
  unknown kind crashes rendering. The roster is frozen: player, bumper, skitter, charger, splitter, boss.
- **Prototype idiom:** match the existing code style — terse, comment-light, design-flavored comments where the
  dossier motivates a rule. No new dependencies, no test frameworks, plain TypeScript.
- **Acceptance floor for every packet:** `npx tsc --noEmit` and `npm run build` pass (P1/P2 compile standalone;
  P3/P4 are typechecked together as one batch). Packet docs add specific assertions on top.
- Flavor copy is part of the spec — use the exact strings given; the voice is the hustler's afterlife
  (dossier §06: the underhall, damned players, chalk and felt).

## The run shape (locked)

- 12 tables. Acts: I "the Shallows" depths 1–4, II "the Tangle" 5–8, III "the Deep" 9–12.
- Depth 4 = **mini-boss** (the Rack-Master). Depth 12 = **the 8-ball**. Depth 1 opens with a plain rack.
- One node per depth slot. Non-combat nodes (shop/rest/forge/mystery) resolve → next choice, **no draft**.
  Combat nodes (rack/money/miniboss/boss) → waves → draft → next choice.
- Shops are guaranteed *offered* at depths 3, 7, 11 (the player may decline — the route is the strategy).

## RNG stream contract (locked — changing any constant reshuffles every daily seed)

All gameplay randomness derives from the run seed via tagged streams; the shared draw-order `this.rng` is retired.

```ts
// route.ts exports:
export const ROUTE_TAG   = 0x057000de;
export const RACK_TAG    = 0x5ac00001;
export const DRAFT_TAG   = 0xd7af0002;
export const SHOP_TAG    = 0x540f0003;
export const MYSTERY_TAG = 0xe7e20004;
export const FORGE_TAG   = 0xf0f60005;
export const AI_TAG      = 0xa11a0007;

// game.ts:
private subRng(tag: number, depth = 0): Rng {
  return new Rng((this.seed ^ tag ^ Math.imul(depth, 0x9e3779b1)) >>> 0);
}
```

Table N's rack, draft, shop roll, mystery event, and forge offers each come from their own `subRng(TAG, N)` —
so the same seed yields the same table-N content no matter which path the player took (dossier D5: "same seed,
different paths"; D1: the daily is a shared puzzle).

## Shared type + HUD contract (locked — P1 defines the types, P3 calls, P4 implements)

```ts
// route.ts (P1)
export type NodeKind = 'rack' | 'shop' | 'forge' | 'money' | 'rest' | 'mystery' | 'miniboss' | 'boss';
export interface NodeOption { kind: NodeKind; title: string; desc: string; cls?: string }
export interface RouteSlot { depth: number; act: 1 | 2 | 3; options: NodeOption[] }
export type Route = RouteSlot[];              // length 12, index = depth - 1
export function actOf(depth: number): 1 | 2 | 3;
export function generateRoute(seed: number): Route;

// events.ts (P1)
export interface ForgeOption { id: string; label: string; desc: string; apply(s: PlayerStats): void }
export function forgeOptions(rng: Rng, n?: number): ForgeOption[];   // n distinct picks, default 2
export interface MysteryResult { title: string; desc: string; chalk?: number; repair?: number; strokeFill?: boolean }
export function rollMystery(rng: Rng, ctx: { cracks: number; chalk: number }): MysteryResult;

// hud.ts (P4 implements, P3 calls)
nodeChoice(depth: number, options: NodeOption[], fan: RouteSlot[], pick: (k: NodeKind) => void): void;
forge(options: { label: string; desc: string }[], onPick: (i: number | null) => void): void;
  // options may be EMPTY: hud then shows the "too fragile to forge" body and only a leave button (onPick(null))
mystery(ev: { title: string; desc: string }, onDone: () => void): void;
wager(chalk: number, canCrack: boolean, actions: { ante: () => void; anteCrack: () => void; decline: () => void }): void;
  // hud disables the chalk ante when chalk < 5; shows the crack ante ONLY when chalk < 5, disabled unless canCrack

// waves.ts (P2)
makeRack(depth: number, rng: Rng, money: boolean): Wave[];   // signature unchanged
makeBossWaves(rng: Rng): Wave[];                             // signature unchanged
export function makeMiniBossWaves(rng: Rng): Wave[];         // new
```

## Invariants (load-bearing; violating any is a rejected packet)

1. **Forge and the Money crack-ante may never shatter the player.** Both are gated on
   `cracks + 1 < stats.maxCracks`. Mystery outcomes never add cracks at all.
2. **Sinking the mini-boss must NOT win the run.** `onSink`'s `kind === 'boss'` branch gates victory on
   `isBossRack`; the mini-boss routes to `rackCleared()`. (Highest-severity known risk.)
3. **Boss armor stays 1:1 with minion-wave clears** — 3 waves / armor 3 for the 8-ball, 1 wave / armor 1 for
   the mini-boss. The anti-stall timer is exempt on BOTH boss tables.
4. `options[0].kind === 'rack'` on every open route slot — combat is always reachable.
5. Tag constants and the `subRng` mixing formula are frozen once P1 lands.

## Dependency graph & dispatch order

```
Batch 1:  P1 (route.ts + events.ts, new files)   ∥   P2 (waves.ts)
Batch 2:  P3 (game.ts, sole owner)               ∥   P4 (hud.ts + README.md)   ← typechecked together
Batch 3:  P5 (rng.ts + entities.ts + enemies.ts + one line in game.ts)
```

| Packet | Files | Doc |
|---|---|---|
| P1 | `src/route.ts`, `src/events.ts` (new) | `P1.md` |
| P2 | `src/waves.ts` | `P2.md` |
| P3 | `src/game.ts` | `P3.md` |
| P4 | `src/hud.ts`, `README.md` | `P4.md` |
| P5 | `src/rng.ts`, `src/entities.ts`, `src/enemies.ts`, `src/game.ts` (one line) | `P5.md` |

## How to run standalone logic assertions (P1/P2)

No test framework. Use esbuild (ships with vite) to bundle the module, then assert in node:

```bash
npx esbuild src/route.ts --bundle --format=esm \
  --outfile=/tmp/claude-0/-home-user-miscue/a6cccb8f-2bd4-5328-9fd4-7f2193e25185/scratchpad/route.check.mjs
node -e "import('<outfile>').then(m => { /* assertions */ })"
```
