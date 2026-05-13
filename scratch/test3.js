import * as THREE from 'three';
const S = 0.1875;
const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 120);
camera.position.set(0, 0.92, 4.2);
camera.lookAt(0, 2.35, 0);
camera.updateMatrixWorld(true);
camera.updateProjectionMatrix();

const targetFromTop = 0.052;
const ndcY = 1 - 2 * targetFromTop;
const ndcX = 0; // center

const projProbe = new THREE.Vector3();
projProbe.set(ndcX, ndcY, -1).unproject(camera);
const x0 = projProbe.x;
const y0 = projProbe.y;
const z0 = projProbe.z;

const relOnPlatform = new THREE.Vector3();
relOnPlatform.set(ndcX, ndcY, 1).unproject(camera);
const rdx = relOnPlatform.x - x0;
const rdy = relOnPlatform.y - y0;
const rdz = relOnPlatform.z - z0;

const cy = 0.88 * S;
const t = (cy - y0) / rdy;
const ox = x0 + t * rdx;
const oz = z0 + t * rdz;

console.log({ y0, rdy, cy, t, ox, oz, camZ: camera.position.z });
