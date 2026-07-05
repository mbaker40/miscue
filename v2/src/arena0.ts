// M1's combat table: a 10x10 felt slab, 4 corner pockets with real wells, rails that
// stop short of each corner so the mouths stay open (an unshootable pocket is no
// pocket). Same authoring idiom as level0.ts — everything through sim.addStatic /
// sim.addSensorZone so render/level.ts's mesh-from-defs mechanism just works.
import type { Sim, Vec3 } from './sim';

const HALF_W = 5;
const HALF_L = 5;

// each pocket well sits this far in from its corner along BOTH axes (the "diagonally
// inside" reading — the well isn't a foot outside the slab, it's tucked into it).
const POCKET_INSET = 0.75;

// rails end this far short of each corner, leaving the mouth open — a ball can sail
// past a pocket into the void, or drop into the well; both are legit outcomes.
const RAIL_CORNER_GAP = 1.4;
const RAIL_HALF = HALF_W - RAIL_CORNER_GAP; // 3.6 — half-length of each edge's rail run
const RAIL_THICK = 0.08; // matches level0's rail cross-section
const RAIL_H = 0.14;

export function buildArena0(sim: Sim): {
  spawn: Vec3;
  checkpoint: Vec3;
  pockets: { x: number; y: number; z: number; id: number }[];
  bounds: { halfW: number; halfL: number };
} {
  // main slab: 10x0.3x10, top surface at y=0, floating over the void.
  sim.addStatic({ type: 'cuboid', hx: HALF_W, hy: 0.15, hz: HALF_L }, { x: 0, y: -0.15, z: 0 });

  // rails along all 4 edges, each stopping RAIL_CORNER_GAP short of both its corners —
  // the corner mouths are the only way in/out, exactly like a real table.
  sim.addStatic(
    { type: 'cuboid', hx: RAIL_HALF, hy: RAIL_H, hz: RAIL_THICK },
    { x: 0, y: RAIL_H, z: HALF_L + RAIL_THICK },
  ); // +z edge
  sim.addStatic(
    { type: 'cuboid', hx: RAIL_HALF, hy: RAIL_H, hz: RAIL_THICK },
    { x: 0, y: RAIL_H, z: -(HALF_L + RAIL_THICK) },
  ); // -z edge
  sim.addStatic(
    { type: 'cuboid', hx: RAIL_THICK, hy: RAIL_H, hz: RAIL_HALF },
    { x: HALF_W + RAIL_THICK, y: RAIL_H, z: 0 },
  ); // +x edge
  sim.addStatic(
    { type: 'cuboid', hx: RAIL_THICK, hy: RAIL_H, hz: RAIL_HALF },
    { x: -(HALF_W + RAIL_THICK), y: RAIL_H, z: 0 },
  ); // -x edge

  // 4 corner pocket wells — sensor cylinders sunk just under the slab surface, inset
  // from each corner along both axes. render/level.ts already draws a neon rim over
  // every pocket sensor, so these read as real pockets with zero extra render work.
  const cornerSigns: [number, number][] = [[1, 1], [-1, 1], [-1, -1], [1, -1]];
  const pockets: { x: number; y: number; z: number; id: number }[] = [];
  cornerSigns.forEach(([sx, sz], id) => {
    const x = sx * (HALF_W - POCKET_INSET);
    const z = sz * (HALF_L - POCKET_INSET);
    sim.addSensorZone('pocket', id, { type: 'cylinder', halfHeight: 0.35, radius: 0.45 }, { x, y: 0.05, z });
    pockets.push({ x, y: 0.05, z, id });
  });

  // player side is +z, matching camera boot yaw π (dossier: you shoot INTO the table).
  const spawn: Vec3 = { x: 0, y: 0.2, z: 3.2 };
  return { spawn, checkpoint: spawn, pockets, bounds: { halfW: HALF_W, halfL: HALF_L } };
}
