import * as THREE from "three";
import { GAME_SCALE } from "./gameScale";

const FUR = 0xb8956c;
const FUR_DARK = 0x8b6f47;
const NOSE = 0x3d2e22;
const TOWEL = 0xf2e6dc;
const TOWEL_STRIP = 0xc45c3e;
const WATER = 0x4a7a8c;

function lowPolyMat(color: number): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    flatShading: true,
    roughness: 0.85,
    metalness: 0.05,
  });
}

/** 온천에 앉아 눈을 감은 느낌의 로우폴리 카피바라 + 덴구이 */
export function createCapybara(): THREE.Group {
  const root = new THREE.Group();

  const body = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.95, 1.25), lowPolyMat(FUR));
  body.position.y = 0.55;
  body.castShadow = true;
  root.add(body);

  const belly = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.35, 1.05), lowPolyMat(FUR_DARK));
  belly.position.set(0, 0.35, 0.15);
  belly.castShadow = true;
  root.add(belly);

  /** 목~덴구이 스쿼시 연출용 (착지 시 Y축 살짝 눌렀다 복귀) */
  const headSquashRoot = new THREE.Group();
  headSquashRoot.position.set(0, 1.06, 0.41);
  root.add(headSquashRoot);
  root.userData.headSquashRoot = headSquashRoot;

  const head = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.72, 0.82), lowPolyMat(FUR));
  head.position.set(0, 0.09, 0.01);
  head.rotation.x = -0.08;
  head.castShadow = true;
  headSquashRoot.add(head);

  const snout = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.28, 0.38), lowPolyMat(FUR_DARK));
  snout.position.set(0, -0.08, 0.51);
  snout.castShadow = true;
  headSquashRoot.add(snout);

  const nose = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.14, 0.12), lowPolyMat(NOSE));
  nose.position.set(0, -0.04, 0.71);
  headSquashRoot.add(nose);

  // 반쯤 감은 눈 — 작은 다각형 슬릿
  const eyeGeom = new THREE.BoxGeometry(0.14, 0.06, 0.02);
  const eyeMat = lowPolyMat(NOSE);
  const eyeL = new THREE.Mesh(eyeGeom, eyeMat);
  eyeL.position.set(-0.22, 0.12, 0.37);
  eyeL.rotation.z = 0.05;
  headSquashRoot.add(eyeL);
  const eyeR = new THREE.Mesh(eyeGeom, eyeMat);
  eyeR.position.set(0.22, 0.12, 0.37);
  eyeR.rotation.z = -0.05;
  headSquashRoot.add(eyeR);

  const earL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.18, 0.12), lowPolyMat(FUR_DARK));
  earL.position.set(-0.48, 0.32, -0.16);
  earL.rotation.z = 0.35;
  headSquashRoot.add(earL);
  const earR = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.18, 0.12), lowPolyMat(FUR_DARK));
  earR.position.set(0.48, 0.32, -0.16);
  earR.rotation.z = -0.35;
  headSquashRoot.add(earR);

  // 앞다리 / 뒷다리 간단 블록 (앉은 자세)
  const legGeom = new THREE.BoxGeometry(0.28, 0.22, 0.38);
  const legFL = new THREE.Mesh(legGeom, lowPolyMat(FUR_DARK));
  legFL.position.set(-0.42, 0.18, 0.55);
  root.add(legFL);
  const legFR = new THREE.Mesh(legGeom, lowPolyMat(FUR_DARK));
  legFR.position.set(0.42, 0.18, 0.55);
  root.add(legFR);
  const legBL = new THREE.Mesh(legGeom, lowPolyMat(FUR_DARK));
  legBL.position.set(-0.48, 0.22, -0.35);
  root.add(legBL);
  const legBR = new THREE.Mesh(legGeom, lowPolyMat(FUR_DARK));
  legBR.position.set(0.48, 0.22, -0.35);
  root.add(legBR);

  // 덴구이 — 살짝 비대칭
  const towel = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.09, 0.52), lowPolyMat(TOWEL));
  towel.position.set(0.06, 0.56, -0.06);
  towel.rotation.set(0.12, 0.08, 0.1);
  towel.castShadow = true;
  headSquashRoot.add(towel);
  root.userData.towelMesh = towel;

  const strip = new THREE.Mesh(new THREE.BoxGeometry(1.08, 0.05, 0.16), lowPolyMat(TOWEL_STRIP));
  strip.position.set(0.06, 0.56, -0.06);
  strip.rotation.copy(towel.rotation);
  headSquashRoot.add(strip);

  /** 물리용 키네마틱 받침대 기준점 — 덴구이 상면 중앙 (머리 스쿼시와 함께 움직임) */
  const platformAnchor = new THREE.Object3D();
  platformAnchor.position.set(0.06, 0.62, -0.03);
  platformAnchor.rotation.copy(towel.rotation);
  headSquashRoot.add(platformAnchor);
  root.userData.platformAnchor = platformAnchor;

  root.position.y = 0.05;
  root.scale.setScalar(GAME_SCALE);
  return root;
}

export function createSteam(count = 120): THREE.Points {
  const positions = new Float32Array(count * 3);
  const r = 6 * GAME_SCALE;
  const ry = 2.5 * GAME_SCALE;
  const rz = 4 * GAME_SCALE;
  for (let i = 0; i < count; i++) {
    positions[i * 3] = (Math.random() - 0.5) * r * 2;
    positions[i * 3 + 1] = Math.random() * ry;
    positions[i * 3 + 2] = (Math.random() - 0.5) * rz - 0.5 * GAME_SCALE;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({
    color: 0xffffff,
    size: 0.06 * GAME_SCALE,
    transparent: true,
    opacity: 0.35,
    depthWrite: false,
    sizeAttenuation: true,
  });
  return new THREE.Points(geo, mat);
}

export function createWaterPlane(): THREE.Mesh {
  const geo = new THREE.PlaneGeometry(24 * GAME_SCALE, 16 * GAME_SCALE);
  const mat = new THREE.MeshStandardMaterial({
    color: WATER,
    flatShading: true,
    roughness: 0.35,
    metalness: 0.15,
    transparent: true,
    opacity: 0.92,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = -0.05 * GAME_SCALE;
  mesh.receiveShadow = true;
  return mesh;
}

export function createLights(): { ambient: THREE.AmbientLight; sun: THREE.DirectionalLight } {
  const s = GAME_SCALE;
  const ambient = new THREE.AmbientLight(0xffe8d5, 0.55);
  const sun = new THREE.DirectionalLight(0xffcfa3, 1.15);
  sun.position.set(3.5 * s, 8 * s, 4 * s);
  sun.castShadow = true;
  sun.shadow.mapSize.width = 1024;
  sun.shadow.mapSize.height = 1024;
  sun.shadow.camera.near = 0.5 * s;
  sun.shadow.camera.far = 24 * s;
  sun.shadow.camera.left = -6 * s;
  sun.shadow.camera.right = 6 * s;
  sun.shadow.camera.top = 6 * s;
  sun.shadow.camera.bottom = -6 * s;
  return { ambient, sun };
}

export function createBackdrop(): THREE.Group {
  const g = new THREE.Group();
  const s = GAME_SCALE;
  const rockMat = lowPolyMat(0x6b5a50);
  const mossMat = lowPolyMat(0x5a7d6a);

  const rock = new THREE.Mesh(new THREE.ConeGeometry(3.2 * s, 1.8 * s, 5), rockMat);
  rock.position.set(-3.2 * s, 0.85 * s, -3 * s);
  rock.rotation.y = 0.4;
  rock.castShadow = true;
  g.add(rock);

  const rock2 = new THREE.Mesh(new THREE.ConeGeometry(2.4 * s, 1.4 * s, 5), rockMat);
  rock2.position.set(3.5 * s, 0.65 * s, -2.8 * s);
  rock2.rotation.y = -0.6;
  rock2.castShadow = true;
  g.add(rock2);

  const bush = new THREE.Mesh(new THREE.IcosahedronGeometry(0.65 * s, 0), mossMat);
  bush.position.set(2.2 * s, 0.45 * s, -1.2 * s);
  bush.castShadow = true;
  g.add(bush);

  return g;
}

/** 떨어질 손님 아이콘용 미니 로우폴리 (연출) */
export function createFloatingGuests(): THREE.Group {
  const group = new THREE.Group();

  const yuzu = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), lowPolyMat(0xf5c542));
  yuzu.position.set(-0.9, 2.2, 0.3);
  yuzu.userData.baseY = yuzu.position.y;
  group.add(yuzu);

  const duck = new THREE.Group();
  duck.position.set(0.85, 2.45, -0.2);
  duck.userData.baseY = duck.position.y;
  const duckBody = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 5), lowPolyMat(0xffe066));
  duck.add(duckBody);
  const duckHead = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 5), lowPolyMat(0xffe066));
  duckHead.position.set(0.1, 0.06, 0.05);
  duck.add(duckHead);
  group.add(duck);

  const bird = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.2, 4), lowPolyMat(0x8b7355));
  bird.position.set(-0.35, 2.65, 0.5);
  bird.rotation.z = Math.PI / 2;
  bird.rotation.y = 0.5;
  bird.userData.baseY = bird.position.y;
  group.add(bird);

  return group;
}
