// level meshes generated straight from the Sim's authoring record (staticDefs /
// sensorDefs) — terrain can never be physics-only-and-invisible again (the M0 field
// report: the whole table shipped as colliders with no meshes; players saw one white
// ball in a black void). One felt material for floors/ramps, chalk trim for thin
// rails/walls, a neon rim ring over each pocket sensor.
import * as THREE from 'three';
import type { Sim } from '../sim';

const FELT = new THREE.MeshStandardMaterial({ color: 0x14523e, roughness: 0.92, metalness: 0.02 });
const TRIM = new THREE.MeshStandardMaterial({ color: 0xd8d2c4, roughness: 0.6, metalness: 0.05 });
const RIM = new THREE.MeshStandardMaterial({
  color: 0x2ef2c5, emissive: 0x2ef2c5, emissiveIntensity: 1.4, roughness: 0.4,
});

const DEG = Math.PI / 180;

export function buildLevelMeshes(scene: THREE.Scene, sim: Sim): THREE.Group {
  const group = new THREE.Group();

  for (const d of sim.staticDefs) {
    let geo: THREE.BufferGeometry;
    let thin = false; // rails and walls read as chalk trim, slabs as felt
    if (d.shape.type === 'cuboid') {
      geo = new THREE.BoxGeometry(d.shape.hx * 2, d.shape.hy * 2, d.shape.hz * 2);
      thin = Math.min(d.shape.hx, d.shape.hz) < 0.35 || d.shape.hy > 0.3;
    } else {
      geo = new THREE.CylinderGeometry(d.shape.radius, d.shape.radius, d.shape.halfHeight * 2, 28);
    }
    const mesh = new THREE.Mesh(geo, thin ? TRIM : FELT);
    mesh.position.set(d.pos.x, d.pos.y, d.pos.z);
    if (d.rotDeg) mesh.rotation.set(d.rotDeg.x * DEG, d.rotDeg.y * DEG, d.rotDeg.z * DEG);
    group.add(mesh);
  }

  for (const s of sim.sensorDefs) {
    if (s.kind !== 'pocket') continue;
    const radius = s.shape.type === 'cylinder' ? s.shape.radius : Math.max(s.shape.hx, s.shape.hz);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(radius + 0.04, 0.022, 10, 40), RIM);
    ring.rotation.x = -Math.PI / 2;
    // sit the ring just above the surface the sensor is sunk into
    const topY = s.shape.type === 'cylinder' ? s.pos.y + s.shape.halfHeight : s.pos.y + s.shape.hy;
    ring.position.set(s.pos.x, Math.max(topY, 0) + 0.012, s.pos.z);
    group.add(ring);
  }

  scene.add(group);
  return group;
}
