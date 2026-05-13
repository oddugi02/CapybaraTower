import * as THREE from "three";
import { Body, Box, Sphere, Vec3 } from "cannon-es";
import type { Material } from "cannon-es";

/** 로우폴리 온천·젠·생물·음식 테마 낙하물 (게임 스케일 u = OU) */
export type ObstacleId =
  | "yuzu"
  | "foldedTowel"
  | "woodenBucket"
  | "sakeSet"
  | "zenPebble"
  | "babyCapybara"
  | "duck"
  | "whiteBird"
  | "frog"
  | "turtle"
  | "onsenMonkey"
  | "triangleKimbap"
  | "pudding"
  | "carrot"
  | "radish"
  | "rubberDuck"
  | "watermelon";

/** 낙하 중 HUD 태그용 짧은 한글 이름 */
export const OBSTACLE_LABEL_KO: Record<ObstacleId, string> = {
  yuzu: "유자",
  foldedTowel: "수건",
  woodenBucket: "욕통",
  sakeSet: "사케",
  zenPebble: "돌",
  babyCapybara: "아기",
  duck: "오리",
  whiteBird: "새",
  frog: "개구리",
  turtle: "거북",
  onsenMonkey: "원숭이",
  triangleKimbap: "삼김",
  pudding: "푸딩",
  carrot: "당근",
  radish: "무",
  rubberDuck: "러덕",
  watermelon: "수박",
};

export function getObstacleLabelKo(id: ObstacleId): string {
  return OBSTACLE_LABEL_KO[id] ?? id;
}

export const OBSTACLE_WEIGHTS: { id: ObstacleId; w: number }[] = [
  { id: "yuzu", w: 18 },
  { id: "foldedTowel", w: 16 },
  { id: "woodenBucket", w: 12 },
  { id: "sakeSet", w: 7 },
  { id: "zenPebble", w: 14 },
  { id: "babyCapybara", w: 11 },
  { id: "duck", w: 12 },
  { id: "whiteBird", w: 10 },
  { id: "frog", w: 11 },
  { id: "turtle", w: 11 },
  { id: "onsenMonkey", w: 10 },
  { id: "triangleKimbap", w: 12 },
  { id: "pudding", w: 10 },
  { id: "carrot", w: 9 },
  { id: "radish", w: 9 },
  { id: "rubberDuck", w: 10 },
  { id: "watermelon", w: 3 },
];

export function pickObstacle(): ObstacleId {
  const sum = OBSTACLE_WEIGHTS.reduce((a, b) => a + b.w, 0);
  let r = Math.random() * sum;
  for (const o of OBSTACLE_WEIGHTS) {
    r -= o.w;
    if (r <= 0) return o.id;
  }
  return "yuzu";
}

function m(color: number, rough = 0.82): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    flatShading: true,
    roughness: rough,
    metalness: 0.06,
  });
}

const FUR = 0xb8956c;
const FUR_D = 0x8b6f47;
const NOSE = 0x3d2e22;

export function createObstacleMesh(id: ObstacleId, u: number): THREE.Group {
  const g = new THREE.Group();
  switch (id) {
    case "yuzu": {
      const s = new THREE.Mesh(new THREE.SphereGeometry(0.13 * u, 10, 8), m(0xf5c542));
      s.castShadow = true;
      g.add(s);
      break;
    }
    case "foldedTowel": {
      const cloth = new THREE.Mesh(new THREE.BoxGeometry(0.44 * u, 0.05 * u, 0.34 * u), m(0xe8dcc8));
      cloth.castShadow = true;
      g.add(cloth);
      const band = new THREE.Mesh(new THREE.BoxGeometry(0.46 * u, 0.035 * u, 0.08 * u), m(0xc45c3e));
      band.position.y = 0.02 * u;
      band.castShadow = true;
      g.add(band);
      break;
    }
    case "woodenBucket": {
      const wood = m(0x8b6914);
      const bot = new THREE.Mesh(new THREE.BoxGeometry(0.34 * u, 0.04 * u, 0.26 * u), wood);
      bot.position.y = 0;
      bot.castShadow = true;
      g.add(bot);
      const t = 0.03 * u;
      const h = 0.14 * u;
      const w = 0.34 * u;
      const d = 0.26 * u;
      for (const [px, pz, rw, rd] of [
        [-w / 2 - t / 2, 0, t, d + 2 * t],
        [w / 2 + t / 2, 0, t, d + 2 * t],
        [0, -d / 2 - t / 2, w + 2 * t, t],
        [0, d / 2 + t / 2, w + 2 * t, t],
      ] as const) {
        const wall = new THREE.Mesh(new THREE.BoxGeometry(rw, h, rd), wood);
        wall.position.set(px, h * 0.5, pz);
        wall.castShadow = true;
        g.add(wall);
      }
      const handle = new THREE.Mesh(new THREE.TorusGeometry(0.12 * u, 0.022 * u, 5, 10, Math.PI), wood);
      handle.rotation.y = Math.PI / 2;
      handle.position.set(0, 0.12 * u, -d / 2 - 0.02 * u);
      g.add(handle);
      break;
    }
    case "sakeSet": {
      const bottle = new THREE.Mesh(new THREE.CylinderGeometry(0.045 * u, 0.055 * u, 0.26 * u, 8, 1), m(0x5d4037));
      bottle.position.y = 0.13 * u;
      bottle.castShadow = true;
      g.add(bottle);
      const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.028 * u, 0.04 * u, 0.06 * u, 6, 1), m(0x4e342e));
      neck.position.y = 0.28 * u;
      neck.castShadow = true;
      g.add(neck);
      const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.05 * u, 0.04 * u, 0.05 * u, 6, 1), m(0xf5f5f5, 0.35));
      cup.position.set(0.16 * u, 0.03 * u, 0.04 * u);
      cup.castShadow = true;
      g.add(cup);
      break;
    }
    case "zenPebble": {
      const peb = new THREE.Mesh(new THREE.DodecahedronGeometry(0.18 * u, 0), m(0x7a7268, 0.9));
      peb.scale.set(1.15, 0.45, 0.95);
      peb.castShadow = true;
      g.add(peb);
      break;
    }
    case "babyCapybara": {
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.22 * u, 0.16 * u, 0.2 * u), m(FUR));
      body.position.y = 0.08 * u;
      body.castShadow = true;
      g.add(body);
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.16 * u, 0.12 * u, 0.14 * u), m(FUR));
      head.position.set(0, 0.18 * u, 0.08 * u);
      head.castShadow = true;
      g.add(head);
      const sn = new THREE.Mesh(new THREE.BoxGeometry(0.08 * u, 0.06 * u, 0.06 * u), m(FUR_D));
      sn.position.set(0, 0.16 * u, 0.16 * u);
      g.add(sn);
      const eye = new THREE.Mesh(new THREE.BoxGeometry(0.04 * u, 0.02 * u, 0.02 * u), m(NOSE));
      eye.position.set(-0.05 * u, 0.2 * u, 0.12 * u);
      g.add(eye);
      const eye2 = eye.clone();
      eye2.position.x = 0.05 * u;
      g.add(eye2);
      break;
    }
    case "duck": {
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.12 * u, 8, 6), m(0xc4956a));
      body.scale.set(1.05, 0.92, 1.1);
      body.castShadow = true;
      g.add(body);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.09 * u, 8, 6), m(0x8d6e63));
      head.position.set(0.11 * u, 0.06 * u, 0.04 * u);
      head.castShadow = true;
      g.add(head);
      const beak = new THREE.Mesh(new THREE.ConeGeometry(0.045 * u, 0.09 * u, 4), m(0xffb300));
      beak.rotation.z = -Math.PI / 2;
      beak.position.set(0.2 * u, 0.05 * u, 0.06 * u);
      g.add(beak);
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.022 * u, 4, 4), m(0x212121));
      eye.position.set(0.14 * u, 0.09 * u, 0.1 * u);
      g.add(eye);
      const tail = new THREE.Mesh(new THREE.ConeGeometry(0.05 * u, 0.1 * u, 4), m(0x5d4037));
      tail.rotation.z = Math.PI / 2;
      tail.position.set(-0.12 * u, 0.02 * u, -0.02 * u);
      g.add(tail);
      break;
    }
    case "whiteBird": {
      const bod = new THREE.Mesh(new THREE.SphereGeometry(0.1 * u, 8, 6), m(0xf5f5f5));
      bod.castShadow = true;
      g.add(bod);
      const wing = new THREE.Mesh(new THREE.BoxGeometry(0.2 * u, 0.03 * u, 0.1 * u), m(0xe0e0e0));
      wing.position.set(-0.06 * u, 0.02 * u, 0);
      wing.castShadow = true;
      g.add(wing);
      const beak = new THREE.Mesh(new THREE.ConeGeometry(0.04 * u, 0.1 * u, 4), m(0xffb74d));
      beak.rotation.z = -Math.PI / 2;
      beak.position.set(0.14 * u, 0.02 * u, 0.04 * u);
      g.add(beak);
      break;
    }
    case "frog": {
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.1 * u, 8, 6), m(0x66bb6a));
      body.scale.set(1.1, 0.85, 1.15);
      body.castShadow = true;
      g.add(body);
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.035 * u, 6, 5), m(0x1b5e20));
      eye.position.set(-0.06 * u, 0.06 * u, 0.08 * u);
      g.add(eye);
      const eye2 = eye.clone();
      eye2.position.x = 0.06 * u;
      g.add(eye2);
      break;
    }
    case "turtle": {
      const shell = new THREE.Mesh(new THREE.IcosahedronGeometry(0.14 * u, 0), m(0x4e7d5f));
      shell.scale.set(1.1, 0.55, 1.05);
      shell.position.y = 0.06 * u;
      shell.castShadow = true;
      g.add(shell);
      const belly = new THREE.Mesh(new THREE.BoxGeometry(0.16 * u, 0.04 * u, 0.14 * u), m(0xc5a572));
      belly.position.y = 0.01 * u;
      belly.castShadow = true;
      g.add(belly);
      for (const [lx, lz] of [
        [-0.1, 0.08],
        [0.1, 0.08],
        [-0.08, -0.06],
        [0.08, -0.06],
      ] as const) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.05 * u, 0.03 * u, 0.06 * u), m(0x5d4037));
        leg.position.set(lx * u, 0, lz * u);
        leg.castShadow = true;
        g.add(leg);
      }
      break;
    }
    case "onsenMonkey": {
      const torso = new THREE.Mesh(new THREE.BoxGeometry(0.14 * u, 0.18 * u, 0.12 * u), m(0x8d6e63));
      torso.position.y = 0.12 * u;
      torso.castShadow = true;
      g.add(torso);
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.12 * u, 0.1 * u, 0.11 * u), m(0xa1887f));
      head.position.set(0, 0.26 * u, 0.04 * u);
      head.castShadow = true;
      g.add(head);
      const armL = new THREE.Mesh(new THREE.BoxGeometry(0.06 * u, 0.2 * u, 0.06 * u), m(0x795548));
      armL.position.set(-0.14 * u, 0.14 * u, 0);
      armL.castShadow = true;
      g.add(armL);
      const armR = armL.clone();
      armR.position.x = 0.14 * u;
      g.add(armR);
      const legL = new THREE.Mesh(new THREE.BoxGeometry(0.07 * u, 0.16 * u, 0.07 * u), m(0x6d4c41));
      legL.position.set(-0.05 * u, 0.02 * u, 0);
      g.add(legL);
      const legR = legL.clone();
      legR.position.x = 0.05 * u;
      g.add(legR);
      const towel = new THREE.Mesh(new THREE.BoxGeometry(0.16 * u, 0.04 * u, 0.14 * u), m(0xf2e6dc));
      towel.position.set(0, 0.08 * u, -0.02 * u);
      towel.rotation.z = 0.08;
      g.add(towel);
      break;
    }
    case "triangleKimbap": {
      const rice = new THREE.Mesh(new THREE.ConeGeometry(0.14 * u, 0.24 * u, 3), m(0xf5f5f5));
      rice.rotation.x = Math.PI;
      rice.position.y = 0.06 * u;
      rice.castShadow = true;
      g.add(rice);
      const nori = new THREE.Mesh(new THREE.ConeGeometry(0.145 * u, 0.22 * u, 3), m(0x1b1b1b, 0.75));
      nori.rotation.x = Math.PI;
      nori.position.y = 0.05 * u;
      g.add(nori);
      const fill = new THREE.Mesh(new THREE.BoxGeometry(0.06 * u, 0.08 * u, 0.12 * u), m(0xff7043));
      fill.position.set(0, 0.02 * u, 0.02 * u);
      g.add(fill);
      break;
    }
    case "pudding": {
      const base = new THREE.Mesh(new THREE.SphereGeometry(0.11 * u, 10, 8), m(0xffcc80, 0.45));
      base.scale.set(1, 0.72, 1);
      base.position.y = 0.04 * u;
      base.castShadow = true;
      g.add(base);
      const top = new THREE.Mesh(new THREE.SphereGeometry(0.09 * u, 8, 6), m(0xfffde7, 0.35));
      top.position.y = 0.12 * u;
      top.scale.set(1, 0.55, 1);
      top.castShadow = true;
      g.add(top);
      const berry = new THREE.Mesh(new THREE.SphereGeometry(0.028 * u, 6, 5), m(0xd32f2f));
      berry.position.y = 0.17 * u;
      g.add(berry);
      break;
    }
    case "carrot": {
      const root = new THREE.Mesh(new THREE.CylinderGeometry(0.05 * u, 0.07 * u, 0.38 * u, 6), m(0xff8a65));
      root.rotation.z = Math.PI / 2;
      root.position.set(0, 0.04 * u, 0);
      root.castShadow = true;
      g.add(root);
      const leaves = new THREE.Mesh(new THREE.ConeGeometry(0.06 * u, 0.12 * u, 5), m(0x66bb6a));
      leaves.position.set(0.2 * u, 0.06 * u, 0);
      leaves.rotation.z = Math.PI / 2;
      g.add(leaves);
      break;
    }
    case "radish": {
      const root = new THREE.Mesh(new THREE.CylinderGeometry(0.055 * u, 0.08 * u, 0.22 * u, 8), m(0xf5f5f5, 0.55));
      root.rotation.z = Math.PI / 2;
      root.position.set(0, 0.03 * u, 0);
      root.castShadow = true;
      g.add(root);
      const band = new THREE.Mesh(new THREE.TorusGeometry(0.07 * u, 0.012 * u, 4, 10), m(0x9e9e9e));
      band.rotation.y = Math.PI / 2;
      band.position.set(-0.06 * u, 0.04 * u, 0);
      g.add(band);
      const leaves = new THREE.Mesh(new THREE.ConeGeometry(0.05 * u, 0.14 * u, 5), m(0x66bb6a));
      leaves.position.set(0.12 * u, 0.05 * u, 0);
      leaves.rotation.z = Math.PI / 2;
      g.add(leaves);
      break;
    }
    case "rubberDuck": {
      const bod = new THREE.Mesh(new THREE.SphereGeometry(0.12 * u, 8, 6), m(0xffeb3b, 0.4));
      bod.scale.set(1.05, 0.88, 1.1);
      bod.castShadow = true;
      g.add(bod);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.08 * u, 8, 6), m(0xffeb3b, 0.4));
      head.position.set(0.1 * u, 0.08 * u, 0.04 * u);
      head.castShadow = true;
      g.add(head);
      const beak = new THREE.Mesh(new THREE.ConeGeometry(0.045 * u, 0.08 * u, 4), m(0xff9800));
      beak.rotation.z = -Math.PI / 2;
      beak.position.set(0.18 * u, 0.06 * u, 0.06 * u);
      g.add(beak);
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.022 * u, 4, 4), m(0x212121));
      eye.position.set(0.12 * u, 0.1 * u, 0.1 * u);
      g.add(eye);
      break;
    }
    case "watermelon": {
      const mel = new THREE.Mesh(new THREE.SphereGeometry(0.32 * u, 10, 8), m(0x2e7d32));
      mel.castShadow = true;
      g.add(mel);
      const stripe1 = new THREE.Mesh(new THREE.TorusGeometry(0.33 * u, 0.028 * u, 5, 14), m(0x1b5e20));
      stripe1.rotation.x = Math.PI / 2;
      g.add(stripe1);
      const stripe2 = stripe1.clone();
      stripe2.rotation.z = Math.PI / 3;
      g.add(stripe2);
      break;
    }
    default:
      break;
  }
  return g;
}

function bodyBase(
  mass: number,
  mat: Material,
  linearDamp = 0.14,
  angularDamp = 0.16,
): Body {
  const b = new Body({
    mass,
    material: mat,
    linearDamping: linearDamp,
    angularDamping: angularDamp,
    allowSleep: false,
    sleepSpeedLimit: 0.035,
    sleepTimeLimit: 0.9,
  });
  /** 평평한 바닥 기준 — 피치·롤 없이 Yaw만 (수직 낙하에 가깝게) */
  b.angularFactor.set(0, 1, 0);
  return b;
}

/** massVol = S^3, massObs = OBS_MUL^3 — 호출부에서 곱 */
export function createObstacleBody(
  id: ObstacleId,
  u: number,
  massVol: number,
  massObs: number,
  mats: { phys: Material; towel: Material; rubber: Material; frog: Material },
): Body {
  const mv = (k: number) => k * massVol * massObs;
  let b: Body;

  switch (id) {
    case "yuzu": {
      b = bodyBase(mv(0.42), mats.phys, 0.09, 0.1);
      b.addShape(new Sphere(0.13 * u));
      break;
    }
    case "foldedTowel": {
      b = bodyBase(mv(0.55), mats.towel, 0.12, 0.22);
      b.addShape(new Box(new Vec3(0.22 * u, 0.028 * u, 0.17 * u)));
      break;
    }
    case "woodenBucket": {
      b = bodyBase(mv(1.15), mats.phys);
      b.addShape(new Box(new Vec3(0.19 * u, 0.1 * u, 0.17 * u)));
      break;
    }
    case "sakeSet": {
      b = bodyBase(mv(0.72), mats.phys, 0.1, 0.18);
      b.addShape(new Box(new Vec3(0.055 * u, 0.13 * u, 0.055 * u)), new Vec3(0, 0.13 * u, 0));
      b.addShape(new Box(new Vec3(0.05 * u, 0.03 * u, 0.05 * u)), new Vec3(0.15 * u, 0.02 * u, 0.04 * u));
      break;
    }
    case "zenPebble": {
      b = bodyBase(mv(4.8), mats.phys, 0.14, 0.28);
      b.addShape(new Box(new Vec3(0.19 * u, 0.055 * u, 0.15 * u)));
      break;
    }
    case "babyCapybara": {
      b = bodyBase(mv(0.62), mats.phys);
      b.addShape(new Box(new Vec3(0.11 * u, 0.1 * u, 0.11 * u)), new Vec3(0, 0.08 * u, 0.04 * u));
      break;
    }
    case "duck": {
      b = bodyBase(mv(0.78), mats.phys, 0.07, 0.1);
      b.addShape(new Box(new Vec3(0.12 * u, 0.1 * u, 0.12 * u)));
      b.addShape(new Box(new Vec3(0.08 * u, 0.08 * u, 0.08 * u)), new Vec3(0.11 * u, 0.06 * u, 0.04 * u));
      b.addShape(new Box(new Vec3(0.06 * u, 0.04 * u, 0.08 * u)), new Vec3(0.18 * u, 0.05 * u, 0.06 * u));
      break;
    }
    case "whiteBird": {
      b = bodyBase(mv(0.26), mats.phys, 0.07, 0.1);
      b.addShape(new Box(new Vec3(0.09 * u, 0.08 * u, 0.09 * u)));
      b.addShape(new Box(new Vec3(0.1 * u, 0.025 * u, 0.05 * u)), new Vec3(-0.07 * u, 0.02 * u, 0));
      b.addShape(new Box(new Vec3(0.06 * u, 0.04 * u, 0.08 * u)), new Vec3(0.12 * u, 0.02 * u, 0.05 * u));
      break;
    }
    case "frog": {
      b = bodyBase(mv(0.32), mats.frog, 0.14, 0.2);
      b.addShape(new Sphere(0.095 * u));
      break;
    }
    case "turtle": {
      b = bodyBase(mv(0.95), mats.phys, 0.1, 0.16);
      b.addShape(new Box(new Vec3(0.15 * u, 0.06 * u, 0.14 * u)), new Vec3(0, 0.06 * u, 0));
      b.addShape(new Box(new Vec3(0.05 * u, 0.03 * u, 0.06 * u)), new Vec3(-0.1 * u, 0, 0.08 * u));
      b.addShape(new Box(new Vec3(0.05 * u, 0.03 * u, 0.06 * u)), new Vec3(0.1 * u, 0, 0.08 * u));
      b.addShape(new Box(new Vec3(0.05 * u, 0.03 * u, 0.06 * u)), new Vec3(-0.08 * u, 0, -0.06 * u));
      b.addShape(new Box(new Vec3(0.05 * u, 0.03 * u, 0.06 * u)), new Vec3(0.08 * u, 0, -0.06 * u));
      break;
    }
    case "onsenMonkey": {
      b = bodyBase(mv(0.88), mats.phys, 0.09, 0.14);
      b.addShape(new Box(new Vec3(0.08 * u, 0.1 * u, 0.07 * u)), new Vec3(0, 0.12 * u, 0));
      b.addShape(new Box(new Vec3(0.06 * u, 0.1 * u, 0.06 * u)), new Vec3(-0.14 * u, 0.14 * u, 0));
      b.addShape(new Box(new Vec3(0.06 * u, 0.1 * u, 0.06 * u)), new Vec3(0.14 * u, 0.14 * u, 0));
      b.addShape(new Box(new Vec3(0.06 * u, 0.08 * u, 0.06 * u)), new Vec3(-0.05 * u, 0.02 * u, 0));
      b.addShape(new Box(new Vec3(0.06 * u, 0.08 * u, 0.06 * u)), new Vec3(0.05 * u, 0.02 * u, 0));
      b.addShape(new Box(new Vec3(0.06 * u, 0.06 * u, 0.06 * u)), new Vec3(0, 0.26 * u, 0.04 * u));
      break;
    }
    case "triangleKimbap": {
      b = bodyBase(mv(0.48), mats.phys);
      b.addShape(new Box(new Vec3(0.12 * u, 0.12 * u, 0.12 * u)));
      break;
    }
    case "pudding": {
      b = bodyBase(mv(0.52), mats.phys, 0.28, 0.38);
      /* 구 대신 납작 박스 — 기울어진 덴구이 위에서 구가 미끄러지며 튀는 현상 완화 */
      b.addShape(new Box(new Vec3(0.09 * u, 0.075 * u, 0.09 * u)));
      b.angularFactor.set(1, 1, 1);
      break;
    }
    case "carrot": {
      b = bodyBase(mv(0.38), mats.phys);
      b.addShape(new Box(new Vec3(0.38 * u, 0.065 * u, 0.065 * u)));
      break;
    }
    case "radish": {
      b = bodyBase(mv(0.42), mats.phys);
      b.addShape(new Box(new Vec3(0.24 * u, 0.07 * u, 0.07 * u)));
      break;
    }
    case "rubberDuck": {
      b = bodyBase(mv(0.22), mats.rubber, 0.05, 0.06);
      b.addShape(new Box(new Vec3(0.13 * u, 0.11 * u, 0.13 * u)));
      b.addShape(new Box(new Vec3(0.08 * u, 0.08 * u, 0.08 * u)), new Vec3(0.1 * u, 0.07 * u, 0.04 * u));
      break;
    }
    case "watermelon": {
      b = bodyBase(mv(11.5), mats.phys, 0.07, 0.1);
      b.addShape(new Sphere(0.32 * u));
      break;
    }
    default: {
      b = bodyBase(mv(0.4), mats.phys);
      b.addShape(new Sphere(0.12 * u));
    }
  }
  return b;
}
