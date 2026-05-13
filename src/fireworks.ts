/** 폭죽 파티클 애니메이션 — 별도 캔버스 오버레이 */
export class Fireworks {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private particles: Particle[] = [];
  private animId: number | null = null;
  private launchTimer: ReturnType<typeof setInterval> | null = null;
  private running = false;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
  }

  start() {
    this.running = true;
    this.particles = [];
    this.resize();
    this.launch(); // 즉시 한 발
    this.launchTimer = setInterval(() => this.launch(), 600);
    this.loop();
  }

  stop() {
    this.running = false;
    if (this.animId !== null) cancelAnimationFrame(this.animId);
    if (this.launchTimer !== null) clearInterval(this.launchTimer);
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.particles = [];
  }

  resize() {
    const { innerWidth: w, innerHeight: h } = window;
    this.canvas.width = w * devicePixelRatio;
    this.canvas.height = h * devicePixelRatio;
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
  }

  private launch() {
    const W = this.canvas.width;
    const H = this.canvas.height;
    const cx = W * (0.15 + Math.random() * 0.7);
    const cy = H * (0.1 + Math.random() * 0.45);
    const hue = Math.random() * 360;
    const count = 52 + Math.floor(Math.random() * 28);
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const speed = 2.5 + Math.random() * 4.5;
      this.particles.push({
        x: cx, y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        alpha: 1,
        size: 2.5 + Math.random() * 3.5,
        color: `hsl(${hue + Math.random() * 40 - 20}, 90%, 65%)`,
        trail: [],
      });
    }
  }

  private loop() {
    if (!this.running) return;
    this.animId = requestAnimationFrame(() => this.loop());
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.trail.push({ x: p.x, y: p.y });
      if (p.trail.length > 5) p.trail.shift();

      p.vx *= 0.96;
      p.vy = p.vy * 0.96 + 0.18;
      p.x += p.vx;
      p.y += p.vy;
      p.alpha -= 0.018;

      if (p.alpha <= 0) { this.particles.splice(i, 1); continue; }

      // trail
      for (let t = 0; t < p.trail.length; t++) {
        const tr = p.trail[t];
        ctx.beginPath();
        ctx.arc(tr.x, tr.y, p.size * 0.5, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.alpha * (t / p.trail.length) * 0.4;
        ctx.fill();
      }
      // particle
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.alpha;
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}

interface Particle {
  x: number; y: number;
  vx: number; vy: number;
  alpha: number;
  size: number;
  color: string;
  trail: { x: number; y: number }[];
}
