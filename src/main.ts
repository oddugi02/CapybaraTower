import * as THREE from "three";
import "./style.css";
import {
  createBackdrop,
  createCapybara,
  createFloatingGuests,
  createLights,
  createSteam,
  createWaterPlane,
} from "./capyScene";
import { fitGameCamera, getFrameCamZBase, getFrameLookYBase } from "./cameraFrame";
import { GAME_SCALE } from "./gameScale";
import { StackGame } from "./game";

const canvas = document.getElementById("capy-canvas") as HTMLCanvasElement | null;
if (!canvas) throw new Error("canvas missing");

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: false,
  preserveDrawingBuffer: true,
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.setClearColor(0x2a221e, 1);

const scene = new THREE.Scene();
/* 카메라가 멀어져도 배경이 너무 빨리 뭉개지지 않도록 여유 있게 */
scene.fog = new THREE.Fog(0x3d2f28, 12, 58);

const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 120);
camera.position.set(0, 0.92, 4.2);

const capy = createCapybara();
scene.add(capy);

const guests = createFloatingGuests();
guests.visible = false;
scene.add(guests);

scene.add(createWaterPlane());
scene.add(createBackdrop());

const steam = createSteam(140);
scene.add(steam);

const { ambient, sun } = createLights();
scene.add(ambient);
scene.add(sun);

const rim = new THREE.DirectionalLight(0xa8c4ff, 0.35);
rim.position.set(-5, 4.5, -3);
scene.add(rim);

const game = new StackGame({
  scene,
  camera,
  capy,
  guests,
  canvas,
  onRender: () => {
    renderer.render(scene, camera);
  },
});

function applyViewport(): void {
  const vv = window.visualViewport;
  const w = Math.max(64, Math.round(vv?.width ?? window.innerWidth));
  const h = Math.max(64, Math.round(vv?.height ?? window.innerHeight));
  camera.aspect = w / h;
  camera.fov = w < 720 ? 62 : 48;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h, false);
}

let cameraRefitTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleCameraRefit(): void {
  if (cameraRefitTimer != null) clearTimeout(cameraRefitTimer);
  cameraRefitTimer = setTimeout(() => {
    cameraRefitTimer = null;
    const vv = window.visualViewport;
    const w = vv?.width ?? window.innerWidth;
    const h = vv?.height ?? window.innerHeight;
    if (w >= 200 && h >= 200) fitGameCamera(camera, capy);
  }, 280);
}

function applyInitialCameraFrame(): void {
  applyViewport();
  fitGameCamera(camera, capy);
}

applyInitialCameraFrame();
requestAnimationFrame(() => {
  applyInitialCameraFrame();
});

function onViewportEvent(): void {
  applyViewport();
  scheduleCameraRefit();
}

window.addEventListener("resize", onViewportEvent);
window.visualViewport?.addEventListener("resize", onViewportEvent);

const clock = new THREE.Clock();
const steamPositions = steam.geometry.attributes.position.array as Float32Array;

function animate() {
  requestAnimationFrame(animate);
  const raw = clock.getDelta();
  const dt = Math.min(Math.max(raw, 1 / 240), 0.05);

  game.step(dt);

  /* 카메라(+Z 쪽)를 항상 바라보도록 Yaw만 — 좌우 이동해도 정면이 보이게 */
  capy.rotation.x = 0;
  capy.rotation.z = 0;
  const dx = camera.position.x - capy.position.x;
  const dz = camera.position.z - capy.position.z;
  capy.rotation.y = Math.hypot(dx, dz) > 1e-5 ? Math.atan2(dx, dz) : 0;

  const lookY = getFrameLookYBase();
  camera.position.set(0, 0.92, getFrameCamZBase());
  camera.lookAt(0, lookY, 0);

  for (let i = 0; i < steamPositions.length / 3; i++) {
    steamPositions[i * 3 + 1] += 0.008 * GAME_SCALE;
    if (steamPositions[i * 3 + 1] > 3.2 * GAME_SCALE) {
      steamPositions[i * 3 + 1] = 0;
      steamPositions[i * 3] = (Math.random() - 0.5) * 12 * GAME_SCALE;
      steamPositions[i * 3 + 2] =
        (Math.random() - 0.5) * 4 * GAME_SCALE - 0.5 * GAME_SCALE;
    }
  }
  steam.geometry.attributes.position.needsUpdate = true;

  renderer.render(scene, camera);
}

animate();
