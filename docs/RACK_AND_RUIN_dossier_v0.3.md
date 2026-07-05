# RACK & RUIN — Pre-Production Dossier · V0.3

> **You're the cue ball. Everything else is a target.**
> A frantic 3D pool roguelike where you launch yourself across cursed tables, bank off the rails, and sink everything that moves — tall and thumb-friendly on mobile, turned wide for mouse or controller on Steam. *Working title.*

| | |
|---|---|
| **Genre** | 3D Pool Roguelike |
| **Engine** | Unity 6 · URP |
| **Platforms** | iOS · Android · Steam |
| **Model** | Premium one-time purchase |
| **Build model** | Claude writes most gameplay code; human devs review every change |

**What changed in V0.3:** the six biggest open questions are now resolved and moved into the locked log — the physics/daily model, the bullet-time economy, rack escalation, the health model, the run's macro shape, and the world's premise. The game is now internally consistent from the first drag a player makes to ascension 15 forty hours later. Sections marked **▲ NEW** or **▲ RESOLVED** are the V0.3 additions.

---

## 01 · Product Brief

RACK & RUIN turns pool inside out. You don't hold the cue — you're the ball at the end of it. Aim, charge, and fire yourself across living tables where the other balls bite back. Time slows when you line up a shot, so every launch is a split-second read: drive straight through a brute, curve around a hazard with english, or thread a four-bank carom to sink three enemies at once.

### Core loop
One table, one ball, one fail state. Aim in bullet-time, fire, and read the chaos before the next launch.

- Time slows the instant you line up a shot
- Flick to aim, hold to charge, release to fire
- Clear the rack of enemy balls — in **waves** — to open the exit
- Don't shatter, don't scratch — leaving the table ends the run

### The spin language
Power, spin, and angle — the trinity every pool player knows — become a combat vocabulary.

- **Topspin:** plow forward through a target after impact
- **Backspin:** recoil to safety after the hit
- **Side spin (english):** bend your path around hazards
- Power × spin × angle is your entire moveset

### Stroke — the flow meter ▲ NEW
Aiming always grants a light slow-mo, so anyone can point and fire on a thumb. **Stroke** is the *earned* deep bullet-time on top of that — filled by stylish play (banks, caroms, multi-sinks, flirting with a pocket lip without scratching), spent to drop into luxurious time-bent aiming for the hard shots. Empty Stroke never locks you out; you just lose the deep cushion and play closer to real-time. Stroke is the spine the run dances on — the flow pole opposite the dread pole of cracking.

### The rack — a gauntlet, not a brawl ▲ RESOLVED
Every table feeds its roster in **waves** (~3–4), with a held-breath beat of calm between each. Each rack is a mini three-act: **teach** (one clean enemy type) → **complicate** (nasty combinations) → **Elite climax** (a tougher signature variant). Clear the Elite and the exit pocket opens with a *thunk*.

- **Bumpers:** heavy bruisers; knock you flying, teach banking
- **Splitters:** cleave in two if struck off-center; teach the pocket-execute
- **Skitters:** flee and reposition; teach angle cutoffs
- **Chargers:** lunge at wherever you came to rest; teach resting-spot discipline
- An **8-ball boss** waits at the bottom of the run — a table whose every wave is an Elite

### Build your ball
Between tables you re-forge the cue ball itself. No two runs roll the same.

- Crack your core to split on impact
- Magnetize toward enemies
- Trade mass for bounce
- In-run build + permanent meta unlocks across runs

### Orientation — one logical table, reframed per platform
The table fits the device, not the other way around. On mobile, a tall table reads top-to-bottom and puts the aiming arc in the lower third where your thumb already lives. On Steam, the same *logical* table turns on its side to fill a widescreen monitor, played with mouse or controller flick. Because the table is identical in logical terms, **the daily cursed rack stays the same for everyone.** One table. Infinite ways to scratch.

### Accessibility is load-bearing, not polish
This is a game where you read enemies *by ball* — color alone cannot carry meaning. Bumpers, Splitters, Skitters, and Chargers must each be distinguishable by **shape, pattern, or motion.** The cue ball and pockets must stay legible against a neon table. The crack-based health model (below) is colorblind-safe by construction — damage reads as literal surface fracture, by shape and texture, not color. Bake this in from day one, alongside reduced-motion (bullet-time + camera) and remappable controls.

---

## 02 · The Six V0.3 Decisions (Resolved) ▲ RESOLVED

These were the headline OPEN items in V0.2. They are now settled, and each was chosen for *fun first*, then checked for technical and product consequences. They interlock — most of them quietly solve more than one open question.

### D1 · The daily is a shared *puzzle*, not a shared *simulation* — physics runs free
**Resolves:** physics determinism (the headline risk), daily integrity/anti-cheat.

We do **not** build deterministic fixed-point physics. For a frantic multi-ball carom game, frame-perfect determinism buys nothing the player can feel and costs the juice they *can* feel — free PhysX rolls satisfying where fixed-point rolls stiff. Players will never perceive a two-degree divergence in a four-bank carom.

Determinism lives **only** where it's cheap and load-bearing: the seeded rack and the upgrade choices offered, both generated in normalized logical table space (orientation-independent). The simulation itself is free. The daily challenge is the **Balatro model** — a shared *deck*, not a shared *shuffle outcome*. Everyone gets the same rack and the same tools; they compete on the same puzzle.

Leaderboard integrity comes from **logging the player's input stream** and replaying top scores server-side. Bonus: those input logs are most of what you need for future **ghost races** (a translucent rival ball replaying a top run on today's rack) — a feature the other two physics options would have made *harder*. This choice is generative, not just safe, and it unblocks Phase 0 immediately.

### D2 · Bullet-time is metered — and the meter (Stroke) is the best mechanic in the game
**Resolves:** bullet-time economy; softens the spin skill-ceiling question.

Free unlimited aim-time kills the "frantic" pillar. So aim-time is split:

- **Baseline aim → light slow-mo, always free.** Low floor; nobody feels starved on a thumb.
- **Deep bullet-time → costs Stroke.** High ceiling; mastery lives here.
- **Empty Stroke ≠ locked out.** You just play closer to real-time.

Stroke fills from *stylish, risky* play and not from safe tapping, which (a) enforces frantic, (b) rewards the pool-hotshot fantasy the whole game sells, and (c) creates a comeback flywheel — play badly, get less help; land one great shot, refill, claw back. One meter, four open worries quieted.

### D3 · Racks are gauntlets — waves that crescendo
**Resolves:** rack escalation / "brawl vs. gauntlet."

A brawl is loudest at second one and ends on a whimper. A gauntlet crescendos. Three to four waves, calm beat between each, escalating by **composition** (combining enemy types into nasty interactions) and **pressure** (spawning near corners/pockets) far more than by raw count. The calm gap is also a **Stroke gamble** — reposition safe, or hunt one flashy bank on a straggler to top off before the hard wave lands. *Anti-stall rule:* next wave spawns on **timer OR clear, whichever's first**, so a fleeing Skitter can never freeze the rack.

### D4 · Health is physical — the cue ball cracks ▲ NEW
**Resolves:** the health model.

No hidden hit-point bar (it would compete with Scratch as a second, unrelated death). Instead: **one death, and everything feeds it.** The pristine cue ball accumulates **visible cracks** as it's hit. Damage *is* the model, the art, and the readout, all at once — fragility you can see spinning on the table, no corner bar.

- Cracks don't kill directly — they make you **fragile.** Fully cracked + one more big hit = **shatter** (a worse, more dramatic scratch). Same finish line as scratching → the whole game points at one fear.
- **Short health:** 3–4 cracks to shatter, not ten. Frantic games want short health; each crack is an *event* (a spreading web, a sound like ice fracturing).
- Cracks **degrade before they kill** — a chipped ball loses a little Stroke on impact and curves slightly less true, giving feedback and a chance to play careful.
- **Colorblind-safe by construction** — fractures read by shape and texture.

This makes the integrity economy physical: **Rest** = polish out cracks (heal); **Forge** = crack yourself on purpose to deepen an upgrade (a glass-cannon archetype falls out naturally); **Money Table** wagers can ante *cracks* when you're broke. Meta can offer a "tougher core" as an *unlockable*, never the default.

### D5 · The descent is a chosen route — two curves racing
**Resolves:** run macro shape, node pacing, build economy shape.

A run is **12–15 tables, ~20–30 minutes** — a real mobile session you can finish. Difficulty climbs steadily; build power climbs in *jumps*; the fun is the gap. Three acts split by two bosses:

- **Act I — the Shallows:** teaching ground; a build forms. → **Mini-boss** (checks "do you have *a* build yet?").
- **Act II — the Tangle:** combinations turn nasty; the build's adolescence; highest tension.
- **Act III — the Deep:** power fantasy under threat. → **8-ball boss** (a full table of Elites).

After most tables the player **picks the next node from 2–3 visible options** (Rack · Shop/Re-Chalk · Forge · Money Table · Rest · Mystery). The route *is* the strategy and the replay engine — same seed, different paths. Space the power **jumps** (shops) so one lands roughly every 3–4 tables, right as difficulty catches up. *Mobile UI rule:* show a **short forward fan (next 2–3 choices)**, not a full branching map — route locally, table to table; Steam can simply show a little more of the path.

### D6 · The soul — a hustler's afterlife ▲ NEW
**Resolves:** premise, enemy identity, why the roguelike loop *is the story*. See Section 06.

---

## 03 · Decision Log

### LOCKED (from V0.2, unchanged)
- **Core archetype** — 3D pool roguelike; you are the cue ball.
- **Engine** — Unity 6 (URP); one codebase ships iOS, Android, Steam.
- **Art direction** — low-poly stylized · neon-noir "cursed pool hall."
- **Core mechanic** — slingshot aim, charge, fire; top/back/side spin; bullet-time on aim.
- **Orientation** — one logical table, portrait on mobile, landscape on Steam.
- **Roguelike model** — in-run ball build + permanent meta unlocks.
- **Monetization** — premium one-time purchase, both platforms.
- **Online/retention** — cloud save, Steam achievements, daily challenge on a fixed cursed-rack seed.
- **AI workflow** — Claude writes most gameplay code; human devs review every change.

### LOCKED (resolved in V0.3) ▲
- **Physics & daily model (D1)** — non-deterministic free physics; determinism only on rack + offered upgrades in logical space; daily = shared puzzle; leaderboard validated by server-side input replay.
- **Bullet-time economy (D2)** — free light slow-mo floor + metered deep bullet-time ("Stroke"), filled by stylish risk.
- **Rack escalation (D3)** — gauntlet: ~3–4 waves, teach → complicate → Elite climax, calm beats between, timer-or-clear advance.
- **Health model (D4)** — visible cracks; 3–4 to shatter; shatter = dramatic scratch; degrade-before-kill; Rest repairs, Forge cracks for power.
- **Run macro shape (D5)** — 12–15 tables / ~20–30 min; three acts; mini-boss + 8-ball; player-chosen node route shown as a short forward fan.
- **Fail state** — leaving the table: **shatter** (cracks maxed + hit) or **scratch** (sink yourself). One doom, two doors.
- **World/premise (D6)** — hustler's afterlife; enemies are damned players; the death-return loop is the narrative.

### STILL OPEN — needs an owner + answer in week one
- **Pocket & scratch edge cases** — partial pocket entry, rail-hugging, multi-sink in one shot, whether a cue ball can be "saved" at a pocket lip. (Interacts with cracks: does a near-pocket save cost a crack?)
- **Spin tuning & skill ceiling** — how far english bends a path; readability of curve; exact floor/ceiling split now that Stroke structurally helps.
- **Aim trajectory preview** — how many bank bounces to predict; whether the preview shows spin curve and the self-scratch warning; how much it gives away.
- **Enemy authoring depth** — how data-driven Bumper/Splitter/Skitter/Charger + Elite variants are, and who owns tuning as new tables arrive.
- **Orientation camera & HUD** — adaptive framing per aspect; HUD placement; how a controller "flick" maps to the slingshot.
- **Performance target & min-spec** — locked 60 fps; oldest supported device tier; fixed-timestep / collision-pair budget during big caroms.
- **Cross-device account & save** — Unity Gaming Services (Auth + Cloud Save) vs. custom; Steam ↔ mobile account linking.
- **Build economy detail** — currency sources/sinks; size and shape of the permanent unlock tree (now four tracks — see Section 05).
- **Audio, localization, team map & timeline** — reactive-soundtrack source (rule now set: music follows Stroke); launch languages (string-table-first); PR review + branch/CI strategy; MVP / 1.0 line.

---

## 04 · Technology Stack

Chosen for a single codebase across mobile and Steam, a cheap and consistent low-poly neon pipeline, reproducible *rack* generation for the daily, and a tooling surface Claude can drive directly through MCP.

| Layer | Choice | Why |
|---|---|---|
| Engine | Unity 6 LTS | One project ships iOS, Android, Steam (Win/Mac/Linux). |
| Render pipeline | URP | Stylized low-poly neon at 60 fps on phones, crisp on desktop. |
| **Physics** ▲ | **Default PhysX (non-deterministic), free** | D1: daily is a shared puzzle, not a shared sim. No fixed-point engine. Determinism confined to rack + upgrade seeding. |
| Language | C# | Native to Unity; what Claude generates and reviews most reliably. |
| Input | Input System (new) | One action map abstracts touch drag-back, mouse, controller flick into one aim/power/spin payload. |
| Save / auth | Unity Gaming Services | Auth + Cloud Save for cross-device sync without a custom backend. |
| Steam | Steamworks (Facepunch/.NET) | Achievements, Steam build, Steam Cloud; abstracted so mobile can mirror. |
| Procedural | Seeded `System.Random` | Deterministic rack + offered-upgrade generation in logical table space, so the daily is identical for all. |
| **Daily validation** ▲ | **Server-side input-stream replay** | D1: top scores re-simulated from logged inputs; foundation for future ghost races. |
| Assets | Blender → glTF/FBX | Low-poly with emissive URP materials; neon glow keeps tri-counts low. |
| Version control | Git + Git LFS | LFS for binary art; Unity Smart Merge for scenes/prefabs; reviewable diffs. |
| CI / build | Unity Build Automation or GameCI | Multi-platform builds verify every Claude-authored change on real targets. |
| AI tooling | Claude (Opus-class) + Unity MCP | Claude Code for repo work; Unity MCP for live editor context. |

### 04·b — MCP & AI Tooling for Unity
Unity MCP lets Claude read the live editor — scene hierarchy, component values, console errors — and edit scripts without copy-pasting context, closing the error→fix loop and cutting token spend.

- **Unity MCP Server (official)** — in Unity's AI Assistant package for Unity 6; connects Claude Code/Desktop to the running Editor. Set up under *Edit → Project Settings → AI → Unity MCP*; first connection needs manual approval; requires a Unity subscription.
- **MCP for Unity (Coplay, open-source/MIT)** — free bridge via git URL in Package Manager → "Configure All Detected Clients." Strongest free option.
- **Community servers** — CoderGamester's mcp-unity; ivanmurzak's "AI Game Developer" (70+ tools, runtime hooks).

**Recommendation:** drive the repo with Claude Code; connect the official Unity MCP Server if you hold a Unity subscription, else start on Coplay's MCP. Pair either with the GitHub MCP so Claude can open and iterate its own pull requests inside your review flow.

> *Verify Unity MCP package versions, subscription terms, and current docs before committing the pipeline — these move fast.*

---

## 05 · Meta-Progression & First-Time Experience ▲ NEW

Two jobs that pull opposite directions: the first 90 seconds must *hide* the depth; the meta spine must *reveal* it slowly over dozens of runs.

### The first 90 seconds — the hook before the systems
Not a tutorial — a **kill.** Drop the player on a tiny table: one fat enemy in front of an open pocket, no UI, no text. The ball pulses, inviting a drag. They slingshot back (time bends — first unexplained taste of slow-mo), release, and sink the enemy. *Thunk.* That's the hook in three seconds: *I am the ball, and I sank that.*

Then teach **embodied, one verb at a time, never written:**
- An enemy behind a wall → they discover **banking** themselves (the game arranged the failure; they feel like a genius).
- A pocket right where the obvious shot leads → they **scratch** safely and learn *the hole bites*.
- The first hit that **cracks** them → one visible fracture; they learn fragility with no "health" popup.

By 90 seconds they've launched, banked, scratched, and cracked — the whole core loop — with zero tutorial text. **Rule: the table teaches, never the text.** Stroke, routing, Forge, archetypes all come later; complexity is *earned by surviving into it*.

### The meta spine — permanent *variety*, not permanent *power*
The game gets **bigger** over time more than the player gets stronger. Four tracks, in the order a player should feel them:

1. **New Cores (the "characters," the headline unlock).** Each is a starting ball with an identity and bias: *Glass Core* (starts cracked, Stroke fills faster — the daredevil), *Heavy Core* (slow, true, banks like a wrecking ball, barely curves), *Hollow Core* (an extra crack to shatter, hits soft). Each Core is a different *game* on the same table. 2–3 at launch, more post-launch.
2. **Expanding the upgrade pool.** Early runs draw from a small, clean set; play unlocks spicier, combo-enabling pieces into the pool. New players get clarity, veterans get depth, same system.
3. **Bestiary / table variety.** New enemies, Elites, table modifiers, node events unlock into rotation across a career. Tie some to encounters (beat the 8-ball → discover there's a floor *below* it).
4. **Ascension tiers (endgame ladder + the Steam answer).** After a first clear, stack ~15 escalating cruelty modifiers. Higher ascensions run longer and harder — this is where the **longer Steam session** lives, without making the base mobile run a slog.

**Shape, plainly:** start with one Core, a small pool, base bestiary, ascension 0. Every few runs, *something new opens.* Hour 30's game is visibly larger than hour 1's — almost none of it "you got stronger," nearly all of it "the game got bigger." That converts a finished run into a started one.

---

## 06 · The Soul — A Hustler's Afterlife ▲ NEW

**Premise.** You were the best pool player nobody could beat — and you wagered the one thing you shouldn't have. Now you're *racked.* In the underhall beneath the world, great hustlers don't die; they're re-formed as the ball, condemned to play their way back up, table by table, toward a way out that may not exist. The enemy balls are the ones who came before and lost — damned players, ivory-smooth and faintly screaming, sunk so often they've forgotten they were ever anything but a target. The **8-ball** at the bottom is whatever runs this place. Beating it may free you, or may make you *it.*

**Why this earns the design.** The premise explains the verbs: you're fragile and cracking because you're a *soul* pretending to be ivory, and souls chip. Sinking yourself ends the run because the pocket is the drain, and down there is worse. You climb because that's the wager. There's always one more run because you keep getting **re-racked** — the roguelike death-and-return *is the story*, not a mechanic the story tolerates.

**The enemies are who they were** — behavior = backstory:
- **Bumpers** — bruisers and bar-bouncers who won by intimidation; too proud to chase, they just hit back.
- **Splitters** — cheats who never committed to one identity; now they can't hold one form.
- **Skitters** — cowards who ran out on a bad debt; still running, forever fleeing open table.
- **Chargers** — hotheads who broke a cue over someone's head; still lunging at whoever stands where they last got hit.

**The two sounds the game hangs on:**
- **The *thunk*** (sinking an enemy) — the dopamine note, played thousands of times a run. Deep, wet, final — "a door closing on something," pitched low, with a half-beat of held silence after.
- **The *crack*** (taking damage) — the dread note. Ice fracturing under a thumb: high, sharp, intimate, makes you wince. The whole emotional range is the dance between *thunk* (satisfaction) and *crack* (fear).

**Reactive soundtrack — rule:** the music **follows Stroke.** Dead stroke (meter high, sinking everything) → the score opens up, adds a layer, swings. Cracked and desperate → it strips to a lonely, tense pulse. The music tells you how you're doing before the UI does. Flow against dread.

**Visual soul — neon-noir as *temperature*, not just palette.** A warm island of felt-green and hot neon floating in endless cold dark — you never see the underhall's edges (cheapest possible mood, lowest possible tri-count). The cue ball glows faintly warm; the damned are cold dead ivory with faint screaming faces. Neon *pulses* on the *thunk*; the warm light *flickers* on a crack; cracks catch the neon and glitter — fragility made beautiful.

**Title.** *RACK & RUIN* puns the literal rack against "rack and ruin" (falling into total decay) — a place of damnation named for the thing that damns you. Keep it. Splash subtitle: *you're the cue ball, everything else is a target* — now darker, because we know what the targets are.

> **The soul in one breath:** You were the best hustler alive, so death racked you. Now you're the cue ball in the underhall, fighting up through the damned — bruisers, cheats, cowards, hotheads who lost before you — toward an 8-ball that won't say whether the way out is freedom or the throne. Every crack is your soul chipping; every thunk is a door closing on someone who used to be you. Play your way up, or stay racked forever.

---

## 07 · Claude Prompt Playbook (deltas from V0.2)

The V0.2 prompts (P0–P10, R) still hold. The resolved decisions change a few of them — note these when running the sequence:

- **P0 (bootstrap/physics)** — the physics decision is **made:** non-deterministic free PhysX; determinism only on rack + offered-upgrade seeding in logical space; daily validated by server-side input replay (D1). P0 now writes this into CLAUDE.md as a *constraint*, rather than asking Claude to weigh three options.
- **P3 (aim predictor)** — must show the spin curve and a **self-scratch warning**; with cracks in play, also consider a "this hit will crack you" pre-warning when projecting into a Bumper/Charger.
- **NEW P-Stroke** — implement the Stroke meter: free light slow-mo floor + metered deep bullet-time; fills from banks/caroms/multi-sinks/pocket-lip flirts, not safe taps; drives the reactive-audio layer. All magnitudes in a `StrokeTuning` ScriptableObject.
- **P5 (enemies/pockets)** — add **Elite variants** and the **wave/gauntlet controller** (teach→complicate→Elite, calm beat, timer-or-clear advance). Add the **crack/shatter** damage component to the cue ball: visible fracture states, 3–4 to shatter, degrade-before-kill (Stroke loss + slight curve penalty per crack).
- **P6 (rack generator)** — generates a *wave schedule*, not a flat rack; deterministic from seed in normalized logical space; ramps by run depth and act.
- **NEW P-Descent** — the node-map run controller: 12–15 tables, three acts, mini-boss + 8-ball, node types (Rack/Shop/Forge/Money/Rest/Mystery), short-forward-fan UI. Power-jump spacing as data.
- **P7 (build/upgrades)** — Forge applies a **crack-for-power** trade; upgrade pool is *expandable* via meta unlocks.
- **P8/P9 (meta + daily)** — meta spine is **four tracks** (Cores, upgrade pool, bestiary, ascension). Daily uses the shared *rack* seed; state that scoring is validated by input-replay since physics isn't deterministic (D1).

**Token economics, unchanged:** context in the repo (CLAUDE.md, ScriptableObjects, tests) is paid once and reused free; context pasted into chat is re-billed every turn. Push state into the project, keep prompts thin. Reference files with `@`, never paste them. Spec-first for non-trivial systems. Make data designer-editable. Ask for diffs and let Claude self-verify via MCP.

---

## 08 · Suggested Build Sequence

**Phase 0 · Foundations — *does firing yourself feel good?***
Physics decision is locked (D1); stand up Unity 6 + URP + MCP + CI. Prove core feel: slingshot launch, spin, **Stroke** + bullet-time aim predictor, both input schemes, orientation-adaptive camera. Nothing else matters until launching the cue ball is satisfying.

**Phase 1 · The Rack — *a table that fights back***
Enemy roster + Elites, the **gauntlet wave controller**, pockets, the **crack/shatter** fail state, seeded rack generation, clear-to-exit, the 8-ball boss. The first build that's genuinely fun to lose.

**Phase 2 · The Descent — *reasons to re-rack***
The **node-route run** (acts, mini-boss, node types, forward-fan UI), the between-tables ball-build + Forge crack-trade, the **four-track meta spine**, UGS cloud save + cross-device auth, the daily challenge (shared rack seed + input-replay validation) + achievements.

**Phase 3 · Ship Quality — *polish, perf & storefronts***
Physics performance pass, accessibility (shape/pattern enemy ID, reduced motion, remap), orientation camera polish, the **two signature sounds** + Stroke-reactive soundtrack, the **90-second embodied onboarding**, localization, Steam + mobile builds through CI.

---

*RACK & RUIN · Pre-Production Dossier · V0.3 · Working title · Subject to playtest.*
*V0.3 resolves the six headline decisions (D1–D6) and adds the meta/FTUE and soul sections. Confirm Unity MCP package versions, subscription terms, and the (now non-deterministic) physics approach against current Unity documentation before committing the pipeline.*
