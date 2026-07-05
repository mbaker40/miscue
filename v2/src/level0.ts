// one hand-built platform (dossier §04 world scale: 6-10 logical units): a flat spawn
// slab, a ramp well above the steering-can't-climb ceiling (~9deg) so rolling up it
// under momentum works, a bank wall to carom off, and a real gap down to killY so
// falling in actually fires onFall. Chunk library proper is M3 — this is the one
// authored table M0's boot needs.
import type { Sim, Vec3 } from './sim';

const DEG = Math.PI / 180;
const RAMP_DEG = 18;

export function buildLevel0(sim: Sim): { spawn: Vec3; checkpoint: Vec3 } {
  // main slab: 8x0.3x8, top surface at y=0
  sim.addStatic({ type: 'cuboid', hx: 4, hy: 0.15, hz: 4 }, { x: 0, y: -0.15, z: 0 });

  // ramp: 3 wide, rises from the slab's +x edge at 18deg. Box's local +x end is the
  // high end; rotating about Z tilts local x into world y, so position the center so
  // the low end (local -x face) meets the slab edge at (4, 0).
  const rampHalfLen = 1.6;
  const cos = Math.cos(RAMP_DEG * DEG), sin = Math.sin(RAMP_DEG * DEG);
  sim.addStatic(
    { type: 'cuboid', hx: rampHalfLen, hy: 0.15, hz: 1.5 },
    { x: 4 + rampHalfLen * cos, y: rampHalfLen * sin, z: 0 },
    { x: 0, y: 0, z: -RAMP_DEG },
  );

  // bank wall along the -z edge — a vertical collider to carom a shot off.
  sim.addStatic({ type: 'cuboid', hx: 4, hy: 0.6, hz: 0.15 }, { x: 0, y: 0.45, z: -4.15 });

  // rail trim (M0 field fix): without curbs, nearly every shot sailed off the slab
  // into the void — respawn chaos. Low chalk-white rails contain the table like MBU
  // curbing; the -x edge stays OPEN (that's the gap hazard, jumping it is the point)
  // and the +x edge opens 3-wide where the ramp meets the slab.
  sim.addStatic({ type: 'cuboid', hx: 4.16, hy: 0.14, hz: 0.08 }, { x: 0, y: 0.14, z: 4.08 });   // +z edge
  sim.addStatic({ type: 'cuboid', hx: 0.08, hy: 0.14, hz: 1.25 }, { x: 4.08, y: 0.14, z: -2.75 }); // +x, -z side of ramp mouth
  sim.addStatic({ type: 'cuboid', hx: 0.08, hy: 0.14, hz: 1.25 }, { x: 4.08, y: 0.14, z: 2.75 });  // +x, +z side of ramp mouth
  // ramp side rails so a climbing ball doesn't roll off sideways mid-slope
  const rr = 1.6;
  sim.addStatic(
    { type: 'cuboid', hx: rr, hy: 0.12, hz: 0.07 },
    { x: 4 + rr * cos, y: rr * sin + 0.12, z: -1.55 }, { x: 0, y: 0, z: -RAMP_DEG },
  );
  sim.addStatic(
    { type: 'cuboid', hx: rr, hy: 0.12, hz: 0.07 },
    { x: 4 + rr * cos, y: rr * sin + 0.12, z: 1.55 }, { x: 0, y: 0, z: -RAMP_DEG },
  );

  // the gap: nothing between x=-4 (slab edge) and x=-5.6 (island edge) — a 1.6-unit
  // drop to killY. A firm shot carries across; a weak one falls in and triggers onFall.
  sim.addStatic({ type: 'cuboid', hx: 1.5, hy: 0.15, hz: 1.5 }, { x: -7.1, y: -0.15, z: 0 });

  // pocket sensor in a corner well of the main slab — exercises onSink end to end;
  // flavor (the real scratch economy) lands with the game-state work in M1+.
  sim.addSensorZone('pocket', 0, { type: 'cylinder', halfHeight: 0.35, radius: 0.4 }, { x: 3.3, y: 0.05, z: 3.3 });

  const spawn: Vec3 = { x: 0, y: 0.2, z: 1.5 };
  return { spawn, checkpoint: spawn };
}
