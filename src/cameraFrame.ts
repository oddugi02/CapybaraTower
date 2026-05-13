import * as THREE from "three";
import { GAME_SCALE } from "./gameScale";

/**
 * 레이아웃: 카피바라 바운딩 박스 높이가 뷰포트 높이의 일정 비율이 되도록 거리·시선 맞춤.
 * BASE × MAG ≈ 화면에서의 “확대 배율”에 가깝게 조정 (MAG를 올리면 더 가깝게 줌인).
 */
const BASE_SCREEN_HEIGHT_FRAC = 0.105;
/** 클수록 화면에서 카피·씬이 더 크게(카메라 더 가까이) */
const VIEW_MAGNIFICATION = 6.2;
const TARGET_SCREEN_HEIGHT_FRAC = BASE_SCREEN_HEIGHT_FRAC * VIEW_MAGNIFICATION;
const BOTTOM_MARGIN_FRAC = 0.028;
const CAM_Y = 0.92;

const CAM_Z_MIN = 1.95;
const CAM_Z_MAX = 12.5;
const LOOK_Y_MIN = 0.55;
const LOOK_Y_MAX = 4.6;

let cachedLookY = 2.35;
let cachedCamZ = 4.2;
let lastStableCamZ = 4.2;
let lastStableLookY = 2.35;
let frameFitEverOk = false;

export function getFrameLookYBase(): number {
  return cachedLookY;
}

export function getFrameCamZBase(): number {
  return cachedCamZ;
}

const _limOrigin = new THREE.Vector3();
const _limFar = new THREE.Vector3();
const _limBox = new THREE.Box3();
const _limCtr = new THREE.Vector3();

/**
 * 뷰포트 좌·우 가장자리에서 바닥면(y≈발)으로 내린 시선과의 교차로,
 * 카피바라 중심이 갈 수 있는 |x| 상한(메시가 화면 밖으로 크게 나가지 않도록 반폭 차감).
 */
export function getPlayerWorldLimitX(
  camera: THREE.PerspectiveCamera,
  capy: THREE.Group,
): number {
  const fallback = 1.05 * GAME_SCALE;
  camera.updateMatrixWorld(true);
  camera.updateProjectionMatrix();
  capy.updateMatrixWorld(true);
  _limBox.setFromObject(capy);
  if (_limBox.isEmpty()) return fallback;

  const feetY = _limBox.min.y - 0.008 * GAME_SCALE;
  _limBox.getCenter(_limCtr);
  _limCtr.project(camera);
  const ndcY = THREE.MathUtils.clamp(_limCtr.y, -0.94, 0.94);

  const hitX = (ndcX: number): number | null => {
    _limOrigin.set(ndcX, ndcY, 0).unproject(camera);
    _limFar.set(ndcX, ndcY, 1).unproject(camera);
    const dy = _limFar.y - _limOrigin.y;
    if (Math.abs(dy) < 1e-7) return null;
    const t = (feetY - _limOrigin.y) / dy;
    if (t < 1e-4 || t > 8000) return null;
    const dx = _limFar.x - _limOrigin.x;
    return _limOrigin.x + t * dx;
  };

  const xL = hitX(-1);
  const xR = hitX(1);
  if (xL === null || xR === null || !Number.isFinite(xL) || !Number.isFinite(xR)) {
    return fallback;
  }
  const capyHalfX = (_limBox.max.x - _limBox.min.x) * 0.5;
  const leftRoom = -xL - capyHalfX;
  const rightRoom = xR - capyHalfX;
  const span = Math.min(leftRoom, rightRoom);
  const inset = 0.018 * GAME_SCALE;
  return Math.max(0.12 * GAME_SCALE, span - inset);
}

function screenMetrics(
  camera: THREE.PerspectiveCamera,
  box: THREE.Box3,
): { heightFrac: number; centerYFromTop: number } | null {
  const corners = [
    [box.min.x, box.min.y, box.min.z],
    [box.max.x, box.min.y, box.min.z],
    [box.min.x, box.max.y, box.min.z],
    [box.max.x, box.max.y, box.min.z],
    [box.min.x, box.min.y, box.max.z],
    [box.max.x, box.min.y, box.max.z],
    [box.min.x, box.max.y, box.max.z],
    [box.max.x, box.max.y, box.max.z],
  ] as const;
  let minNy = 1;
  let maxNy = -1;
  const mid = new THREE.Vector3();
  box.getCenter(mid);
  const pMid = mid.clone().project(camera);
  if (!Number.isFinite(pMid.x) || !Number.isFinite(pMid.y)) return null;
  for (const [x, y, z] of corners) {
    const p = new THREE.Vector3(x, y, z).project(camera);
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) return null;
    minNy = Math.min(minNy, p.y);
    maxNy = Math.max(maxNy, p.y);
  }
  const heightFrac = (maxNy - minNy) / 2;
  const centerYFromTop = (1 - pMid.y) / 2;
  if (!Number.isFinite(heightFrac) || !Number.isFinite(centerYFromTop)) return null;
  if (heightFrac <= 0 || heightFrac > 0.99) return null;
  return { heightFrac, centerYFromTop };
}

function binarySearchCamZ(
  camera: THREE.PerspectiveCamera,
  box: THREE.Box3,
  lookY: number,
): number | null {
  let lo = 1.65;
  let hi = 14;
  for (let i = 0; i < 24; i++) {
    const z = (lo + hi) / 2;
    camera.position.set(0, CAM_Y, z);
    camera.lookAt(0, lookY, 0);
    camera.updateMatrixWorld(true);
    camera.updateProjectionMatrix();
    const m = screenMetrics(camera, box);
    if (!m) return null;
    if (m.heightFrac > TARGET_SCREEN_HEIGHT_FRAC) lo = z;
    else hi = z;
  }
  return (lo + hi) / 2;
}

function binarySearchLookY(
  camera: THREE.PerspectiveCamera,
  box: THREE.Box3,
  camZ: number,
  targetCenterFromTop: number,
): number | null {
  let lo = 0.35;
  let hi = 5.2;
  for (let i = 0; i < 22; i++) {
    const ly = (lo + hi) / 2;
    camera.position.set(0, CAM_Y, camZ);
    camera.lookAt(0, ly, 0);
    camera.updateMatrixWorld(true);
    camera.updateProjectionMatrix();
    const m = screenMetrics(camera, box);
    if (!m) return null;
    if (m.centerYFromTop < targetCenterFromTop) lo = ly;
    else hi = ly;
  }
  return (lo + hi) / 2;
}

function applyStableCamera(camera: THREE.PerspectiveCamera): void {
  cachedCamZ = lastStableCamZ;
  cachedLookY = lastStableLookY;
  camera.position.set(0, CAM_Y, cachedCamZ);
  camera.lookAt(0, cachedLookY, 0);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);
}

/**
 * 카메라 거리·시선을 카피바라에 맞춤. 실패·비정상 값이면 이전 안정 값 유지.
 * `capy.scale` 펄스는 바운딩 계산 전에 `GAME_SCALE`로만 잰 뒤 복구.
 */
export function fitGameCamera(camera: THREE.PerspectiveCamera, capy: THREE.Group): boolean {
  const prevScale = capy.scale.clone();
  capy.scale.setScalar(GAME_SCALE);
  capy.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(capy);
  capy.scale.copy(prevScale);
  capy.updateMatrixWorld(true);

  if (!Number.isFinite(box.min.x) || box.isEmpty()) {
    applyStableCamera(camera);
    return false;
  }

  const targetCenterFromTop = 1 - BOTTOM_MARGIN_FRAC - TARGET_SCREEN_HEIGHT_FRAC / 2;
  let lookYForZFit = 2.15;
  let nextZ: number | null = null;
  let nextLook: number | null = null;

  for (let pass = 0; pass < 2; pass++) {
    nextZ = binarySearchCamZ(camera, box, lookYForZFit);
    if (nextZ === null) {
      applyStableCamera(camera);
      return false;
    }
    nextLook = binarySearchLookY(camera, box, nextZ, targetCenterFromTop);
    if (nextLook === null) {
      applyStableCamera(camera);
      return false;
    }
    lookYForZFit = nextLook;
  }

  nextZ = THREE.MathUtils.clamp(nextZ!, CAM_Z_MIN, CAM_Z_MAX);
  nextLook = THREE.MathUtils.clamp(nextLook!, LOOK_Y_MIN, LOOK_Y_MAX);

  if (!Number.isFinite(nextZ) || !Number.isFinite(nextLook)) {
    applyStableCamera(camera);
    return false;
  }

  if (
    frameFitEverOk &&
    lastStableCamZ > 4 &&
    (nextZ > lastStableCamZ * 1.55 || nextZ < lastStableCamZ * 0.45)
  ) {
    applyStableCamera(camera);
    return false;
  }

  cachedCamZ = nextZ;
  cachedLookY = nextLook;
  lastStableCamZ = nextZ;
  lastStableLookY = nextLook;
  frameFitEverOk = true;

  camera.position.set(0, CAM_Y, cachedCamZ);
  camera.lookAt(0, cachedLookY, 0);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);
  return true;
}
