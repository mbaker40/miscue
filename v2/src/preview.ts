// aim preview via a shadow rapier world: the level's statics + one ghost ball,
// stepped ~CFG.preview.steps per aim frame with the exact same phys constants as the
// real cue ball (BALL_PHYS) and the same forced-spin math as control.updateSpin —
// the line is honest about ramps, banks and gaps because it IS the physics, not an
// approximation of it. Runs only while aiming (under bullet time), so the cost
// (~0.5-1ms) never lands on a busy frame.
import * as RAPIER from '@dimforge/rapier3d-compat';
import { CFG } from './config';
import { BALL_PHYS } from './registry';
import { Sim, Vec3 } from './sim';

export interface PreviewResult {
  /** preallocated — only the first `n` entries are meaningful this frame. */
  points: Vec3[];
  n: number;
  /** the previewed shot leaves the world (crosses killY) — draw it as a warning. */
  offWorld: boolean;
  /** the previewed shot first meets a live enemy — the ribbon truncates there. */
  hitEnemy: boolean;
}

/** live enemy position + radius, registry-agnostic (caller maps Entity -> this). */
export interface PreviewObstacle { x: number; y: number; z: number; r: number }

const MAX_PTS = 64;

export class AimPreview {
  private sim: Sim;
  private ghost: RAPIER.RigidBody;
  private result: PreviewResult = {
    points: Array.from({ length: MAX_PTS }, () => ({ x: 0, y: 0, z: 0 })),
    n: 0,
    offWorld: false,
    hitEnemy: false,
  };

  /** build receives a fresh Sim and must add the SAME statics as the live level. */
  constructor(build: (sim: Sim) => void) {
    this.sim = new Sim();
    build(this.sim);
    const body = this.sim.world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setLinearDamping(BALL_PHYS.linDamping)
        .setAngularDamping(BALL_PHYS.angDamping)
        .setCcdEnabled(true),
    );
    this.sim.world.createCollider(
      RAPIER.ColliderDesc.ball(CFG.ballR)
        .setMass(1)
        .setFriction(BALL_PHYS.friction)
        .setRestitution(BALL_PHYS.restitution),
      body,
    );
    this.ghost = body;
  }

  simulate(
    pos: Vec3, dir: { x: number; z: number }, power: number,
    spin: { side: number; top: number },
    // optional/defaulted: M1-C's 4-arg call site (pre-obstacles) still compiles.
    obstacles: PreviewObstacle[] = [],
  ): PreviewResult {
    const r = this.result;
    r.n = 0;
    r.offWorld = false;
    r.hitEnemy = false;

    const speed = Math.max(0, Math.min(1, power)) * CFG.shot.maxImpulse; // ghost mass 1
    this.ghost.setTranslation(pos, true);
    this.ghost.setLinvel({ x: dir.x * speed, y: 0, z: dir.z * speed }, true);
    this.ghost.setAngvel({ x: 0, y: 0, z: 0 }, true);

    let spinSide = spin.side, spinTop = spin.top;
    const h = CFG.h;
    this.sim.world.timestep = h;
    const decay = Math.exp(-CFG.spin.decay * h);

    const put = (p: { x: number; y: number; z: number }) => {
      if (r.n >= MAX_PTS) return;
      const o = r.points[r.n++];
      o.x = p.x; o.y = p.y; o.z = p.z;
    };
    put(pos);

    for (let i = 0; i < CFG.preview.steps; i++) {
      // same forced-spin force model as control.updateSpin, on the ghost's scalars
      this.ghost.resetForces(true);
      if (CFG.spin.mode === 'forced') {
        const v = this.ghost.linvel();
        const sp = Math.hypot(v.x, v.z);
        if (sp > 1e-4) {
          if (spinSide !== 0) {
            const px = -v.z / sp, pz = v.x / sp;
            const mag = spinSide * CFG.spin.curveK * sp;
            this.ghost.addForce({ x: px * mag, y: 0, z: pz * mag }, true);
          }
          if (spinTop !== 0) {
            const mag = spinTop * CFG.spin.topK * sp;
            this.ghost.addForce({ x: (v.x / sp) * mag, y: 0, z: (v.z / sp) * mag }, true);
          }
        }
      }
      spinSide *= decay; spinTop *= decay;

      this.sim.world.step();

      const t = this.ghost.translation();

      // enemy overlap test: 2D (xz) vs the passed obstacle list, gated by a loose y
      // band so a ramp-borne ghost above an enemy doesn't falsely truncate. Never add
      // enemy bodies to the shadow world — a post-hit carom would be a lie without
      // simulating the enemy's own response (dossier preview-honesty rule).
      let hitObstacle = false;
      for (let k = 0; k < obstacles.length; k++) {
        const o = obstacles[k];
        if (Math.abs(t.y - o.y) < 0.6 && Math.hypot(t.x - o.x, t.z - o.z) <= CFG.ballR + o.r) {
          put(t); r.hitEnemy = true; hitObstacle = true; break;
        }
      }
      if (hitObstacle) break;

      if (i % CFG.preview.stride === 0) put(t);
      if (t.y < this.sim.killY) { r.offWorld = true; put(t); break; }
      const v = this.ghost.linvel();
      if (Math.hypot(v.x, v.y, v.z) < 0.15) { put(t); break; }
    }
    return r;
  }
}
