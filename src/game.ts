import * as THREE from "three";
import { Fireworks } from "./fireworks";
import {
  Body,
  Box,
  ContactMaterial,
  Material,
  Quaternion as CQuat,
  Vec3,
  World,
} from "cannon-es";
import { getPlayerWorldLimitX } from "./cameraFrame";
import { GAME_SCALE } from "./gameScale";
import {
  createObstacleBody,
  createObstacleMesh,
  getObstacleLabelKo,
  pickObstacle,
  type ObstacleId,
} from "./obstacles";

const S = GAME_SCALE;
/** 장애물 메시·충돌체 폭/크기 배율 (요청: 약 3배) */
const OBS_MUL = 3;
const OU = S * OBS_MUL;
const MASS_OBS = OBS_MUL ** 3;
const WATER_Y = 0.12 * S;
/** 부피 비례 질량 (축소 세계에서 관성 유지) */
const MASS_VOL = S * S * S;
const MAX_DYNAMIC_PIECES = 42;
/** 물리 박스와 동일 — 덴구이 면 내 낙하·안착 판정 */
const PLAT_HALF_X = 0.52 * S;
const PLAT_HALF_Z = 0.34 * S;
/** 테트리스 느낌 낙하 — 중력 + 최대 낙하 속도 */
const WORLD_GRAVITY_Y = -6.0;
/** 공중에서 아래 방향 속도 상한 (월드 단위/초, 절댓값) */
const MAX_OBSTACLE_FALL_SPEED = 1.0;
/** 키네마틱 낙하 서브스텝 — 한 프레임에 받침면을 통과하지 않도록 */
const KIN_FALL_SUBSTEP_MAX_SEC = 1 / 120;
const KIN_FALL_MAX_DOWN_PER_SUB = 0.018 * OU;
/** 동시 낙하 허용 개수 — 한 번에 하나씩 */
const WIN_STACK_TOP_FROM_TOP = 0.082;

interface Piece {
  mesh: THREE.Object3D;
  body: Body;
  obstacleId: ObstacleId;
  /** 스폰·낙하 중 고정 XZ (월드) — 카피 이동과 무관 */
  spawnX: number;
  spawnZ: number;
  /** 키네마틱 낙하 수직 속도 (월드 Y/초) */
  fallVelY: number;
  /** 스폰에서 떨어지는 조각만 true — 붕괴 후 동적 조각은 false */
  spawnFall: boolean;
  /** 푸딩 지글 위상 */
  jigglePhase?: number;
  /** 착지 여부 */
  welded: boolean;
  /** 카피바라 앵커 대비 로컬 위치/회전/스케일 — 웰드 유지용 */
  localPos?: THREE.Vector3;
  localQuat?: THREE.Quaternion;
  localScale?: THREE.Vector3;
}

export class StackGame {
  readonly world: World;

  private readonly scene: THREE.Scene;
  private readonly camera: THREE.PerspectiveCamera;
  private readonly capy: THREE.Group;
  private readonly guests: THREE.Group;
  private readonly canvas: HTMLCanvasElement;

  private readonly platformBody: Body;
  private readonly physicsMat: Material;
  private readonly groundMat: Material;
  private readonly towelMat: Material;
  private readonly rubberMat: Material;
  private readonly frogMat: Material;
  private readonly groundBody: Body;

  private pieces: Piece[] = [];
  private score = 0;
  private gameOver = false;
  private gameWon = false;
  private spawnCooldown = 0;

  private playerX = 0;
  private input = 0;
  private pointerDx = 0;
  private dragPrevX: number | null = null;

  private readonly tmpV = new THREE.Vector3();
  private readonly projProbe = new THREE.Vector3();
  private readonly tmpQ = new THREE.Quaternion();
  private readonly platformCenterWorld = new THREE.Vector3();
  private readonly platformQuatWorld = new THREE.Quaternion();
  private readonly relOnPlatform = new THREE.Vector3();
  private readonly weldMatLoc = new THREE.Matrix4();
  private readonly weldMatWorld = new THREE.Matrix4();
  private readonly weldInvAnchor = new THREE.Matrix4();
  private readonly weldPos = new THREE.Vector3();
  private readonly weldQuat = new THREE.Quaternion();
  private readonly weldSc = new THREE.Vector3();
  private readonly defaultWeldScale = new THREE.Vector3(1, 1, 1);
  private readonly bodyQuat = new CQuat();
  private readonly originCamY: number;

  private readonly scoreEl: HTMLElement | null;
  private readonly overlayEl: HTMLElement | null;
  private readonly finalScoreEl: HTMLElement | null;
  private readonly fallTagEl: HTMLElement | null;
  private readonly _stackBox = new THREE.Box3();
  private readonly _probeWeldedBox = new THREE.Box3();

  constructor(opts: {
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    capy: THREE.Group;
    guests: THREE.Group;
    canvas: HTMLCanvasElement;
  }) {
    this.scene = opts.scene;
    this.camera = opts.camera;
    this.capy = opts.capy;
    this.guests = opts.guests;
    this.canvas = opts.canvas;
    this.originCamY = opts.camera.position.y;

    this.scoreEl = document.getElementById("score-val");
    this.overlayEl = document.getElementById("game-over");
    this.finalScoreEl = document.getElementById("final-score");
    this.fallTagEl = document.getElementById("falling-ob-tag");
    const fwCanvas = document.getElementById("fireworks-canvas") as HTMLCanvasElement | null;
    this.fireworksCanvas = fwCanvas;
    this.fireworks = new Fireworks(fwCanvas ?? document.createElement("canvas"));
    window.addEventListener("resize", () => this.fireworks.resize(), { passive: true });

    this.world = new World({ gravity: new Vec3(0, WORLD_GRAVITY_Y, 0) });
    this.world.defaultContactMaterial.friction = 0.88;
    this.world.defaultContactMaterial.restitution = 0;

    this.physicsMat = new Material("phys");
    const platMat = new Material("plat");
    this.groundMat = new Material("ground");
    this.towelMat = new Material("towel");
    this.rubberMat = new Material("rubber");
    this.frogMat = new Material("frog");

    this.world.addContactMaterial(
      new ContactMaterial(this.physicsMat, this.physicsMat, { friction: 10.0, restitution: 0 }),
    );
    this.world.addContactMaterial(
      new ContactMaterial(this.physicsMat, this.towelMat, { friction: 15.0, restitution: 0 }),
    );
    this.world.addContactMaterial(
      new ContactMaterial(this.physicsMat, platMat, { friction: 12.0, restitution: 0 }),
    );
    this.world.addContactMaterial(
      new ContactMaterial(this.physicsMat, this.groundMat, { friction: 1.5, restitution: 0 }),
    );
    this.world.addContactMaterial(
      new ContactMaterial(this.towelMat, platMat, { friction: 1.12, restitution: 0 }),
    );
    this.world.addContactMaterial(
      new ContactMaterial(this.towelMat, this.groundMat, { friction: 0.9, restitution: 0 }),
    );
    this.world.addContactMaterial(
      new ContactMaterial(this.rubberMat, platMat, { friction: 0.88, restitution: 0 }),
    );
    this.world.addContactMaterial(
      new ContactMaterial(this.rubberMat, this.groundMat, { friction: 0.78, restitution: 0 }),
    );
    this.world.addContactMaterial(
      new ContactMaterial(this.frogMat, platMat, { friction: 1.0, restitution: 0 }),
    );
    this.world.addContactMaterial(
      new ContactMaterial(this.frogMat, this.groundMat, { friction: 0.88, restitution: 0 }),
    );
    this.world.addContactMaterial(
      new ContactMaterial(this.rubberMat, this.physicsMat, { friction: 0.96, restitution: 0 }),
    );
    this.world.addContactMaterial(
      new ContactMaterial(this.frogMat, this.physicsMat, { friction: 0.98, restitution: 0 }),
    );
    this.world.addContactMaterial(
      new ContactMaterial(this.rubberMat, this.towelMat, { friction: 0.95, restitution: 0 }),
    );
    this.world.addContactMaterial(
      new ContactMaterial(this.frogMat, this.towelMat, { friction: 0.98, restitution: 0 }),
    );

    this.platformBody = new Body({
      mass: 0,
      type: Body.KINEMATIC,
      material: platMat,
    });
    this.platformBody.addShape(new Box(new Vec3(0.52 * S, 0.06 * S, 0.34 * S)));
    /** 물리 충돌을 위해 플랫폼·지면 바디를 world에 추가 */
    this.world.addBody(this.platformBody);

    this.groundBody = new Body({ mass: 0, material: this.groundMat });
    this.groundBody.addShape(new Box(new Vec3(14 * S, 0.08 * S, 10 * S)));
    this.groundBody.position.set(0, -0.18 * S, 0);
    this.world.addBody(this.groundBody);

    const canvas = this.canvas;
    canvas.addEventListener(
      "pointerdown",
      (ev: PointerEvent) => {
        try { canvas.setPointerCapture(ev.pointerId); } catch { /* Safari */ }
        this.dragPrevX = ev.clientX;
      },
      { passive: true },
    );
    canvas.addEventListener("pointermove", this.onPointerMove, { passive: true });
    canvas.addEventListener("pointerup",     this.onPointerUp,   { passive: true });
    canvas.addEventListener("pointercancel", this.onPointerUp,   { passive: true });

    /* 좌우 이동 버튼 (touchstart/end 로 다중 터치 지원) */
    this.bindMoveBtn("btn-left",  -1);
    this.bindMoveBtn("btn-right",  1);

    document.getElementById("restart-btn")?.addEventListener("click", () => this.reset());
    document.getElementById("btn-reset-win")?.addEventListener("click", () => this.reset());
    document.getElementById("btn-download")?.addEventListener("click", () => this.downloadJpeg());

    this.guests.visible = false;
    this.reset(false);
  }

  /** 좌우 버튼에 터치 프레스/릴리즈 연결 */
  private bindMoveBtn(id: string, dir: -1 | 1): void {
    const el = document.getElementById(id);
    if (!el) return;
    const press = () => { this.input = dir;  el.classList.add("move-btn--pressing"); };
    const release = () => { if (this.input === dir) this.input = 0; el.classList.remove("move-btn--pressing"); };
    el.addEventListener("touchstart", press,   { passive: true });
    el.addEventListener("touchend",   release, { passive: true });
    el.addEventListener("touchcancel",release, { passive: true });
    /* 데스크톱 폴백 */
    el.addEventListener("mousedown", press);
    el.addEventListener("mouseup",   release);
    el.addEventListener("mouseleave",release);
  }

  private onPointerMove = (e: PointerEvent): void => {
    if (this.dragPrevX === null) return;
    const w = (e.target as HTMLCanvasElement).clientWidth || 1;
    const dx = e.clientX - this.dragPrevX;
    this.dragPrevX = e.clientX;
    /* 터치 스와이프 이동 감도 조정 */
    this.pointerDx += (dx / w) * 9;
  };

  private onPointerUp = (): void => {
    this.dragPrevX = null;
    this.pointerDx = 0;
  };

  dispose(): void {
    this.reset(false);
  }

  reset(playAgain = true): void {
    for (const p of this.pieces) {
      this.scene.remove(p.mesh);
      this.world.removeBody(p.body);
    }
    this.pieces = [];
    this.score = 0;
    this.gameOver = false;
    this.gameWon = false;
    this.spawnCooldown = playAgain ? 0.45 : 0;
    this.playerX = 0;
    this.capy.position.x = 0;
    this.capy.scale.setScalar(GAME_SCALE);
    this.camera.position.y = this.originCamY;
    this.overlayEl?.classList.add("hidden");
    this.fallTagEl?.classList.add("obstacle-tag--hidden");
    /** 폭죽 종료 + 버튼 숨김 */
    this.fireworks.stop();
    this.fireworksCanvas?.classList.add("hidden");
    document.getElementById("win-actions")?.classList.add("hidden");
    this.syncHud();
    if (this.scoreEl) this.scoreEl.textContent = "0";
  }

  private syncHud(): void {
    if (this.scoreEl) this.scoreEl.textContent = String(this.score);
  }

  /**
   * 화면 상단(스폰 라인) 시선과 앵커 Z 평면의 교차로 월드 XZ를 구함.
   * → 화면 가로 전체에서 랜덤한 X 스폰, Z는 앵커 위치 고정.
   * Z 교차가 실패하면 덴구이 면 안 랜덤으로 폴백.
   */
  private pickSpawnWorldXZ(): { ox: number; oz: number } {
    this.camera.updateMatrixWorld(true);
    this.camera.updateProjectionMatrix();
    const targetFromTop = 0.052;
    const ndcY = 1 - 2 * targetFromTop;
    const inset = 0.18; /* 화면 가장자리 여백 확보 — 화면 안쪽에만 스폰 */
    const ndcX = (Math.random() * 2 - 1) * (1 - inset);

    this.projProbe.set(ndcX, ndcY, -1).unproject(this.camera);
    const x0 = this.projProbe.x;
    const z0 = this.projProbe.z;
    this.relOnPlatform.set(ndcX, ndcY, 1).unproject(this.camera);
    const rdx = this.relOnPlatform.x - x0;
    const rdz = this.relOnPlatform.z - z0;

    const anchor = this.capy.userData.platformAnchor as THREE.Object3D | undefined;
    this.capy.updateMatrixWorld(true);
    let cx = this.capy.position.x;
    let cz = 0;
    if (anchor) {
      anchor.getWorldPosition(this.tmpV);
      cx = this.tmpV.x;
      cz = this.tmpV.z;
    }

    /** 앵커 Z 평면(z = cz)과의 교차 */
    if (Math.abs(rdz) < 1e-5) return this.pickSpawnWorldXZOnPlatform(cx, cz);
    const t = (cz - z0) / rdz;
    if (!Number.isFinite(t) || t < 0.001 || t > 400) {
      return this.pickSpawnWorldXZOnPlatform(cx, cz);
    }
    let ox = x0 + t * rdx;

    /** 화면 가시 영역 내에 클램프 — NDC 중앙 80% 이내 x 범위로 제한 */
    const limNdcX = (1 - inset) * 0.88; // 내측 여백 추가
    this.projProbe.set(limNdcX, ndcY, -1).unproject(this.camera);
    const xRight0 = this.projProbe.x;
    const xRightZ0 = this.projProbe.z;
    this.relOnPlatform.set(limNdcX, ndcY, 1).unproject(this.camera);
    const tR = (cz - xRightZ0) / (this.relOnPlatform.z - xRightZ0);
    const maxOx = Number.isFinite(tR) && tR > 0 ? xRight0 + tR * (this.relOnPlatform.x - xRight0) : 2.0;
    ox = THREE.MathUtils.clamp(ox, -Math.abs(maxOx), Math.abs(maxOx));

    return { ox, oz: cz };
  }

  /** 덴구이 면 안에서만 랜덤 (시선 폴백) */
  private pickSpawnWorldXZOnPlatform(cx: number, cz: number): { ox: number; oz: number } {
    const m = 0.98;
    return {
      ox: cx + (Math.random() * 2 - 1) * PLAT_HALF_X * m,
      oz: cz + (Math.random() * 2 - 1) * PLAT_HALF_Z * m,
    };
  }

  /**
   * 스폰 지점 (worldX, worldZ)에서 화면 위쪽에서 보이도록 높이 Y를 맞춤 — 테트리스처럼 상단에서 낙하.
   */
  private spawnWorldYAtScreenTop(worldX: number, worldZ: number): number {
    this.camera.updateMatrixWorld(true);
    this.camera.updateProjectionMatrix();
    /** 뷰포트 위에서부터의 위치(0=맨 위, 1=맨 아래) — 상단 살짝 안쪽 */
    const targetFromTop = 0.052;
    let lo = 2.0 * S;
    let hi = 52;
    for (let i = 0; i < 28; i++) {
      const mid = (lo + hi) / 2;
      this.projProbe.set(worldX, mid, worldZ);
      this.projProbe.project(this.camera);
      const fromTop = (1 - this.projProbe.y) / 2;
      if (fromTop > targetFromTop) lo = mid;
      else hi = mid;
    }
    return (lo + hi) / 2;
  }

  /** 화면 세로 0=위, 1=아래 (spawnWorldYAtScreenTop 과 동일 척도) */
  private worldToScreenFromTop(wx: number, wy: number, wz: number): number {
    this.camera.updateMatrixWorld(true);
    this.camera.updateProjectionMatrix();
    this.projProbe.set(wx, wy, wz);
    this.projProbe.project(this.camera);
    return (1 - this.projProbe.y) / 2;
  }

  private spawnPiece(): void {
    if (this.gameOver || this.gameWon) return;
    if (this.pieces.length >= MAX_DYNAMIC_PIECES) return;
    const id = pickObstacle();
    const mesh = createObstacleMesh(id, OU);
    const body = createObstacleBody(id, OU, MASS_VOL, MASS_OBS, {
      phys: this.physicsMat,
      towel: this.towelMat,
      rubber: this.rubberMat,
      frog: this.frogMat,
    });

    const { ox, oz } = this.pickSpawnWorldXZ();
    const rawSpawnY = this.spawnWorldYAtScreenTop(ox, oz);
    /** 스택 꼭대기보다 항상 위에서 스폰 — 스택 안 스폰 시 관통 방지 */
    const stackTopY = this.getStackPeakWorldY();
    const spawnY = Math.max(rawSpawnY, stackTopY + 0.18 * OU);
    body.position.set(ox, spawnY, oz);
    body.velocity.set(0, 0, 0);
    body.angularVelocity.set(0, 0, 0);
    /** STATIC: cannon은 KINEMATIC도 중력·속도로 적분함 → 스크립트 낙하와 충돌. STATIC은 integrate 생략 */
    body.type = Body.STATIC;
    body.collisionResponse = false;
    body.collisionFilterGroup = 2;
    body.collisionFilterMask = 0;
    body.updateMassProperties();
    body.quaternion.set(0, 0, 0, 1);

    mesh.position.set(body.position.x, body.position.y, body.position.z);
    mesh.quaternion.set(
      body.quaternion.x,
      body.quaternion.y,
      body.quaternion.z,
      body.quaternion.w,
    );

    this.scene.add(mesh);
    this.world.addBody(body);
    this.pieces.push({
      mesh,
      body,
      obstacleId: id,
      spawnX: ox,
      spawnZ: oz,
      fallVelY: 0,
      spawnFall: true,
      welded: false,
    });
    this.spawnCooldown = 0.02;
  }

  private settleSpawnLogic(dt: number): void {
    if (this.gameOver || this.gameWon) return;

    this.spawnCooldown -= dt;
    if (this.spawnCooldown > 0) return;
    if (this.pieces.length >= MAX_DYNAMIC_PIECES) return;

    const fallingPieces = this.pieces.filter((p) => p.spawnFall && !p.welded);
    const nFalling = fallingPieces.length;

    /** 이미 2개 낙하 중이면 대기 */
    if (nFalling >= 2) return;

    if (nFalling === 0) {
      this.spawnPiece();
      return;
    }

    /** 현재 낙하 물체가 화면 30% 지점 도달 시 다음 스폰 */
    const reached = fallingPieces.some((p) =>
      this.worldToScreenFromTop(p.body.position.x, p.body.position.y, p.body.position.z) >= 0.30,
    );
    if (reached) this.spawnPiece();
  }

  private checkGameOver(): void {
    if (this.gameWon) return;
    
    /** 무게중심 안정성 체크: 웰드된 조각들의 평균 X 편차가 너무 크면 붕괴 */
    let avgOffX = 0;
    let count = 0;
    const pcx = this.platformCenterWorld.x;
    for (const p of this.pieces) {
      if (p.welded) {
        avgOffX += (p.body.position.x - pcx);
        count++;
      }
    }
    if (this.score >= 40) {
      avgOffX /= count;
      // 평균 편차가 플랫폼 너비의 70%를 넘으면 붕괴
      if (Math.abs(avgOffX) > PLAT_HALF_X * 0.7) {
        this.triggerCollapse();
        return;
      }
    }

    for (const p of this.pieces) {
      const { x, y, z } = p.body.position;
      if (y < WATER_Y) {
        this.triggerGameOver();
        return;
      }
      if (
        y < 0.5 * S &&
        (Math.abs(x) > 4.5 * S * OBS_MUL || Math.abs(z) > 4 * S * OBS_MUL)
      ) {
        this.triggerGameOver();
        return;
      }
    }
  }

  private triggerCollapse(): void {
    if (this.gameOver) return;
    // 모든 웰드를 풀고 물리 엔진에 맡김
    for (const p of this.pieces) {
      if (p.welded) {
        p.body.type = Body.DYNAMIC;
        p.body.collisionResponse = true;
        p.body.collisionFilterGroup = 1;
        p.body.collisionFilterMask = -1;
        p.body.linearDamping = 0.1;
        p.body.angularDamping = 0.1;
        p.body.wakeUp();
      }
    }
    // 약간의 시간 뒤에 게임오버 트리거
    setTimeout(() => this.triggerGameOver(), 1200);
  }

  private triggerGameOver(): void {
    if (this.gameOver) return;
    this.gameOver = true;
    this.fireworks.stop();
    this.fireworksCanvas?.classList.add("hidden");
    document.getElementById("win-actions")?.classList.add("hidden");
    this.fallTagEl?.classList.add("obstacle-tag--hidden");
    if (this.finalScoreEl) this.finalScoreEl.textContent = String(this.score);
    this.overlayEl?.classList.remove("hidden");
  }

  private readonly fireworks: Fireworks;
  private readonly fireworksCanvas: HTMLCanvasElement | null;

  private downloadJpeg(): void {
    const a = document.createElement("a");
    a.download = "capy-zen-stack.jpg";
    a.href = this.canvas.toDataURL("image/jpeg", 0.92);
    a.click();
  }

  private triggerWin(): void {
    if (this.gameWon || this.gameOver) return;
    this.gameWon = true;
    this.fallTagEl?.classList.add("obstacle-tag--hidden");
    /** 폭죽 시작 */
    if (this.fireworksCanvas) {
      this.fireworksCanvas.classList.remove("hidden");
      this.fireworks.start();
    }
    /** 우상단 액션 버튼 표시 */
    document.getElementById("win-actions")?.classList.remove("hidden");
  }

  /** 탑 꼭대기가 화면 최상단 근처에 오면 성공 */
  private checkWin(): void {
    if (this.gameOver || this.gameWon) return;
    if (!this.pieces.some((p) => p.welded)) return;
    const peakY = this.getStackPeakWorldY();
    const pc = this.platformCenterWorld;
    const fromTop = this.worldToScreenFromTop(pc.x, peakY, pc.z);
    if (fromTop <= WIN_STACK_TOP_FROM_TOP) this.triggerWin();
  }

  private syncPlatform(): void {
    const anchor = this.capy.userData.platformAnchor as THREE.Object3D | undefined;
    if (!anchor) return;
    this.capy.updateMatrixWorld(true);
    anchor.getWorldPosition(this.tmpV);
    anchor.getWorldQuaternion(this.tmpQ);
    this.platformBody.position.set(this.tmpV.x, this.tmpV.y, this.tmpV.z);
    this.platformBody.quaternion.set(
      this.tmpQ.x,
      this.tmpQ.y,
      this.tmpQ.z,
      this.tmpQ.w,
    );
    // velocity.x는 updatePlayer에서 직접 계산하여 설정함 (마찰력 전달용)
    this.platformBody.velocity.y = 0;
    this.platformBody.velocity.z = 0;
    this.platformBody.angularVelocity.set(0, 0, 0);

    this.platformCenterWorld.copy(this.tmpV);
    this.platformQuatWorld.copy(this.tmpQ);
  }

  /** 수건·플랫폼 상단 (웰드 없을 때 받침면) */
  private getSurfaceBaseWorldY(): number {
    const pc = this.platformCenterWorld;
    this.tmpV.set(0, 0.06 * S, 0);
    this.tmpV.applyQuaternion(this.platformQuatWorld);
    let base = pc.y + this.tmpV.y;
    const towelMesh = this.capy.userData.towelMesh as THREE.Object3D | undefined;
    if (towelMesh) {
      this.capy.updateMatrixWorld(true);
      towelMesh.updateMatrixWorld(true);
      this._probeWeldedBox.setFromObject(towelMesh);
      base = Math.max(base, this._probeWeldedBox.max.y);
    }
    return base;
  }

  /**
   * 탑 꼭대기(월드 Y) — 성공 판정. 안착한(welded=true) 모든 조각 중 최대 상단.
   */
  getStackPeakWorldY(): number {
    const base = this.getSurfaceBaseWorldY();
    let top = -Infinity;
    for (const p of this.pieces) {
      if (!p.welded) continue;
      p.mesh.updateMatrixWorld(true);
      this._stackBox.setFromObject(p.mesh);
      top = Math.max(top, this._stackBox.max.y);
    }
    if (top <= -Infinity) return base;
    return top;
  }


  /**
   * 받침면 Y — 가장 위에 쌓인 웰드 조각의 상단(max.y) 직접 반환.
   * XZ 겹침 판정을 제거해 anchor 회전 드리프트 문제 해결.
   * → 낙하 물체 밑면이 최상단 조각 상단에 정확히 닿는 순간 즉시 멈춤.
   */
  private getSupportSurfaceYForMesh(mesh: THREE.Object3D): number {
    this._stackBox.setFromObject(mesh);
    const base = this.getSurfaceBaseWorldY();
    let topY = base;

    for (const p of this.pieces) {
      if (p.spawnFall || !p.welded) continue; // 낙하 중이거나 아직 안착하지 않은 물체 제외
      
      p.mesh.updateMatrixWorld(true);
      this._probeWeldedBox.setFromObject(p.mesh);
      
      // XZ 평면에서 겹치는지 확인 (약간의 여유 0.02 부여)
      const overlapX = Math.max(0, Math.min(this._stackBox.max.x, this._probeWeldedBox.max.x) - Math.max(this._stackBox.min.x, this._probeWeldedBox.min.x));
      const overlapZ = Math.max(0, Math.min(this._stackBox.max.z, this._probeWeldedBox.max.z) - Math.max(this._stackBox.min.z, this._probeWeldedBox.min.z));

      // 어느 정도 면적이 겹칠 때만 받침면으로 인정 (물체 크기의 일부라도 겹치면)
      if (overlapX > 0.02 * S && overlapZ > 0.02 * S) {
        if (this._probeWeldedBox.max.y > topY) {
          topY = this._probeWeldedBox.max.y;
        }
      }
    }
    return topY;
  }

  /** 충돌 없이 키네마틱 낙하 — 받침면에 메시 밑면이 닿으면 웰드 (여러 낙하 조각 동시 처리, 낮은 것부터) */
  private advanceKinematicFall(dt: number): void {
    const order: number[] = [];
    for (let i = 0; i < this.pieces.length; i++) {
      const p = this.pieces[i];
      if (p.spawnFall && !p.welded) order.push(i);
    }
    order.sort((ia, ib) => this.pieces[ia].body.position.y - this.pieces[ib].body.position.y);
    for (const i of order) {
      this.advanceOneKinematicFall(this.pieces[i], dt);
    }
  }

  private advanceOneKinematicFall(p: Piece, dt: number): void {
    const b = p.body;
    const pc = this.platformCenterWorld;

    let left = dt;
    for (let iter = 0; iter < 56 && left > 1e-10 && !p.welded; iter++) {
      b.position.x = p.spawnX;
      b.position.z = p.spawnZ;
      b.velocity.set(0, 0, 0);
      b.angularVelocity.set(0, 0, 0);

      const vy0 = p.fallVelY;
      let sub = Math.min(left, KIN_FALL_SUBSTEP_MAX_SEC);
      sub = Math.max(sub, 1e-6);
      sub = Math.min(sub, left);
      let vy1 = Math.max(vy0 + WORLD_GRAVITY_Y * sub, -MAX_OBSTACLE_FALL_SPEED);
      let vAvg = (vy0 + vy1) * 0.5;
      if (Math.abs(vAvg) > 1e-5) {
        sub = Math.min(sub, KIN_FALL_MAX_DOWN_PER_SUB / Math.abs(vAvg));
      }
      sub = Math.max(sub, 1e-6);
      sub = Math.min(sub, left);
      vy1 = Math.max(vy0 + WORLD_GRAVITY_Y * sub, -MAX_OBSTACLE_FALL_SPEED);
      vAvg = (vy0 + vy1) * 0.5;
      p.fallVelY = vy1;
      b.position.y += vAvg * sub;
      left -= sub;

      p.mesh.position.set(b.position.x, b.position.y, b.position.z);
      p.mesh.quaternion.set(
        b.quaternion.x,
        b.quaternion.y,
        b.quaternion.z,
        b.quaternion.w,
      );
      p.mesh.updateMatrixWorld(true);
      this._stackBox.setFromObject(p.mesh);

      if (b.position.y < WATER_Y - 0.2 * S) return;

      /** 카피바라 중심에서 너무 멀면 (물체 크기 고려) 스킵 — 공중 웰드 방지 */
      const distX = Math.abs(b.position.x - pc.x);
      const distZ = Math.abs(b.position.z - pc.z);
      if (distX > PLAT_HALF_X * 8 || distZ > PLAT_HALF_Z * 12) continue;

      const supportY = this.getSupportSurfaceYForMesh(p.mesh);
      this._stackBox.setFromObject(p.mesh);

      /** 물체 밑면이 예상 받침면 근처에 도달하면 물리 엔진에 완전히 맡김 (DYNAMIC 전환) */
      if (this._stackBox.min.y <= supportY + 0.01 * S) {
        // 착지 시 지면에 아주 정밀하게 붙임 (미세 튀어오름 방지)
        const snap = supportY - this._stackBox.min.y;
        b.position.y += snap;
        p.mesh.position.y += snap;
        p.mesh.updateMatrixWorld(true);

        p.fallVelY = 0;
        this.landPiece(p);
        return;
      }
    }
  }

  private landPiece(p: Piece): void {
    if (p.welded || this.gameWon) return;
    const anchor = this.capy.userData.platformAnchor as THREE.Object3D | undefined;
    if (!anchor) return;

    this.capy.updateMatrixWorld(true);
    p.mesh.updateMatrixWorld(true);

    /** 착지 위치 그대로 기록 (중앙 스냅 없음) */
    this.weldInvAnchor.copy(anchor.matrixWorld).invert();
    this.weldMatLoc.copy(p.mesh.matrixWorld).premultiply(this.weldInvAnchor);
    this.weldMatLoc.decompose(this.weldPos, this.weldQuat, this.weldSc);

    p.localPos = this.weldPos.clone();
    p.localQuat = this.weldQuat.clone();
    p.localScale = this.weldSc.clone();

    p.welded = true; 
    p.spawnFall = false;
    p.body.type = Body.KINEMATIC; // 카피바라와 함께 움직이도록 고정
    p.body.collisionResponse = false;
    p.body.collisionFilterGroup = 2;
    p.body.collisionFilterMask = 0;
    p.body.velocity.set(0, 0, 0);
    p.body.angularVelocity.set(0, 0, 0);
    p.body.wakeUp();

    this.score += 1;
    this.syncHud();
    this.spawnCooldown = Math.max(this.spawnCooldown, 0.4);
  }

  /** 웰드된 조각들의 위치를 카피바라 앵커에 맞춰 동기화 */
  private syncWeldedBodiesToAnchor(): void {
    const anchor = this.capy.userData.platformAnchor as THREE.Object3D | undefined;
    if (!anchor) return;
    this.capy.updateMatrixWorld(true);

    for (const p of this.pieces) {
      if (!p.welded || !p.localPos || !p.localQuat) continue;
      const sc = p.localScale ?? this.defaultWeldScale;
      this.weldMatLoc.compose(p.localPos, p.localQuat, sc);
      this.weldMatWorld.multiplyMatrices(anchor.matrixWorld, this.weldMatLoc);
      this.weldMatWorld.decompose(this.weldPos, this.weldQuat, this.weldSc);

      p.body.position.set(this.weldPos.x, this.weldPos.y, this.weldPos.z);
      p.body.quaternion.set(this.weldQuat.x, this.weldQuat.y, this.weldQuat.z, this.weldQuat.w);
      p.body.velocity.set(0, 0, 0);
      p.body.angularVelocity.set(0, 0, 0);
    }
  }

  private applyPuddingJiggle(dt: number): void {
    for (const p of this.pieces) {
      if (p.obstacleId !== "pudding") continue;
      p.jigglePhase = (p.jigglePhase ?? 0) + dt * (9 + p.body.velocity.length() * 2.4);
      const v = Math.min(2.8, p.body.velocity.length());
      const w = Math.sin(p.jigglePhase) * 0.048 * (0.82 + v * 0.38);
      p.mesh.scale.set(1 + w * 0.48, 1 - w * 0.58, 1 + w * 0.36);
    }
  }

  private syncMeshes(): void {
    for (const p of this.pieces) {
      p.mesh.position.set(p.body.position.x, p.body.position.y, p.body.position.z);
      this.bodyQuat.set(
        p.body.quaternion.x,
        p.body.quaternion.y,
        p.body.quaternion.z,
        p.body.quaternion.w,
      );
      p.mesh.quaternion.set(this.bodyQuat.x, this.bodyQuat.y, this.bodyQuat.z, this.bodyQuat.w);
    }
  }

  private updatePlayer(dt: number): void {
    const steer = this.input * 2.4 + this.pointerDx;
    this.pointerDx *= 0.88;
    const prevX = this.playerX;
    this.playerX += steer * dt * 2.8;
    const limX = getPlayerWorldLimitX(this.camera, this.capy);
    this.playerX = THREE.MathUtils.clamp(this.playerX, -limX, limX);
    
    /** 플랫폼 속도를 계산하여 물리 엔진이 마찰력을 전달할 수 있게 함 */
    this.platformBody.velocity.x = (this.playerX - prevX) / dt;

    const tx = this.playerX;
    this.capy.position.x += (tx - this.capy.position.x) * Math.min(1, 14 * dt);
  }

  private updateFallingObstacleTag(): void {
    const el = this.fallTagEl;
    if (!el) return;
    if (this.gameWon) {
      el.classList.add("obstacle-tag--hidden");
      return;
    }
    let last: Piece | undefined;
    for (let i = this.pieces.length - 1; i >= 0; i--) {
      const p = this.pieces[i];
      if (p.spawnFall && !p.welded) {
        last = p;
        break;
      }
    }
    if (this.gameOver || !last) {
      el.classList.add("obstacle-tag--hidden");
      return;
    }

    this.camera.updateMatrixWorld(true);
    this.camera.updateProjectionMatrix();
    last.mesh.updateMatrixWorld(true);
    this._stackBox.setFromObject(last.mesh);
    this._stackBox.getCenter(this.tmpV);
    this.tmpV.project(this.camera);
    if (
      Math.abs(this.tmpV.x) > 1.35 ||
      Math.abs(this.tmpV.y) > 1.35 ||
      !Number.isFinite(this.tmpV.x) ||
      !Number.isFinite(this.tmpV.y)
    ) {
      el.classList.add("obstacle-tag--hidden");
      return;
    }

    const hero = this.canvas.parentElement;
    if (!hero) {
      el.classList.add("obstacle-tag--hidden");
      return;
    }
    const hr = hero.getBoundingClientRect();
    const cr = this.canvas.getBoundingClientRect();
    const nx = this.tmpV.x * 0.5 + 0.5;
    const ny = -this.tmpV.y * 0.5 + 0.5;
    const px = nx * cr.width + (cr.left - hr.left);
    const py = ny * cr.height + (cr.top - hr.top);
    el.textContent = getObstacleLabelKo(last.obstacleId);
    el.style.left = `${px}px`;
    el.style.top = `${py}px`;
    el.classList.remove("obstacle-tag--hidden");
  }

  step(dt: number): void {
    const capped = Math.min(Math.max(dt, 1 / 240), 0.05);
    this.updatePlayer(capped);

    this.syncPlatform();
    this.syncWeldedBodiesToAnchor();

    if (!this.gameOver && !this.gameWon) {
      this.advanceKinematicFall(capped);
      this.settleSpawnLogic(capped);
    }

    /* 단일 인자 step: 매 프레임 확실히 적분 (누적기+고정dt 혼용 버그 방지) */
    this.world.step(capped);
    this.syncWeldedBodiesToAnchor();
    this.syncMeshes();
    this.applyPuddingJiggle(capped);

    if (!this.gameOver && !this.gameWon) {
      this.checkGameOver();
      this.checkWin();
    }

    this.updateFallingObstacleTag();
  }
}
