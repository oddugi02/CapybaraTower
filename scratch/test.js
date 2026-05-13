import * as THREE from 'three';

const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 120);
camera.position.set(0, 0.92, 4.2);
camera.lookAt(0, 0.5, 0); // approx getFrameLookYBase
camera.updateMatrixWorld(true);
camera.updateProjectionMatrix();

const targetFromTop = 0.052;
let lo = 0.2;
let hi = 52;
let worldX = 0, worldZ = 0;
const projProbe = new THREE.Vector3();

for (let i = 0; i < 28; i++) {
  const mid = (lo + hi) / 2;
  projProbe.set(worldX, mid, worldZ);
  projProbe.project(camera);
  const fromTop = (1 - projProbe.y) / 2;
  if (fromTop > targetFromTop) lo = mid;
  else hi = mid;
}
console.log("Spawn Y:", (lo + hi) / 2);
