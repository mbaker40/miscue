# MISCUE

> You're the cue ball. Everything else is a target.

A frantic 3D pool roguelike, web prototype. Three.js + custom pool physics + Vite + TypeScript. Responsive to one logical table: portrait on phones, landscape on desktop.

**Design spec:** see `docs/RACK_AND_RUIN_dossier_v0.3.md` — this prototype implements the resolved decisions D1–D6 (free physics + seeded racks, the Stroke meter, gauntlet waves, crack/shatter health, the chosen-route descent, and the hustler's-afterlife framing).

## What's in the prototype

- Slingshot launch (drag back, release) with bullet-time aiming
- **Stroke meter** — light slow-mo is always free; deep slow-mo drains Stroke, refilled by banks, multi-sinks, and pocket-lip grazes
- Spin pad (bottom-right): english bends your path, top/back spin drives follow and draw
- Trajectory preview with bank bounces and a self-scratch warning (line turns red)
- Four enemies + Elite variants: Bumpers, Skitters, Chargers, Splitters — each readable by shape/pattern, not color
- Gauntlet racks: waves that crescendo to an Elite climax, with a calm beat between
- **Cracks**: visible damage on the cue ball, 3 to shatter; chipped balls curve less true
- The descent: 6 tables, route choices (rack / re-chalk shop / rest / money table), upgrade drafts between tables
- **The 8-ball boss**: armored until its minion waves fall, then sink it
- Daily table: date-seeded rack shared by everyone (seeded generation only — physics runs free, per D1)
- Synthesized audio: the *thunk* and the *crack*

## Run locally

```bash
npm install
npm run dev
```

## Deploy to GitHub Pages

1. Push this repo to GitHub (`main` branch).
2. In the repo: **Settings → Pages → Source → GitHub Actions**.
3. Push (or re-run the workflow). The included `.github/workflows/deploy.yml` builds and publishes automatically.
4. The game goes live at `https://<user>.github.io/miscue/`.

> If you rename the repo, update `base` in `vite.config.ts` to match (`/<repo-name>/`).

## Controls

| Action | Touch | Mouse |
|---|---|---|
| Aim + charge | drag back from your ball | click-drag back |
| Fire | release | release |
| Spin | drag the spin pad knob | drag the spin pad knob |
| Clear spin | double-tap pad | double-click pad |

You can only line up a new shot once you've slowed — grip, aim, fire, coast.

## Project shape

```
src/
  main.ts      entry
  game.ts      run state machine: waves, Stroke, cracks, nodes, boss
  physics.ts   custom pool physics: friction, spin, rails, pockets, path preview
  entities.ts  ball definitions, logical table space
  enemies.ts   AI: skitter flee, charger telegraph-lunge, boss
  waves.ts     seeded gauntlet generator (teach → complicate → Elite)
  upgrades.ts  ball re-forging modifiers
  render.ts    three.js: neon table, responsive camera, ball textures, bloom
  input.ts     slingshot pointer input + spin pad
  hud.ts       DOM HUD and panels
  rng.ts       seeded RNG (daily table)
  audio.ts     synthesized thunk / crack / clack
```

Not in the prototype (deliberately — see dossier): meta-progression/unlock tracks, server-validated leaderboards, ghost replays, the mid-run mini-boss, reactive soundtrack layers.
