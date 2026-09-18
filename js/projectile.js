/**
 * Enemy energy bolts that travel toward the core, then bounce outward after a hit.
 */

import { PROJECTILE } from "./config.js";
import { rand, wrapAngle } from "./utils.js";

let nextId = 1;

export class Projectile {
  constructor() {
    this.id = 0;
    this.alive = false;
    this.x = 0;
    this.y = 0;
    this.px = 0;
    this.py = 0;
    this.vx = 0;
    this.vy = 0;
    this.color = null;
    this.radius = 6;
    this.deflected = false;
    this.elite = false;
    this.pattern = "straight";
    this.angularVel = 0;
    this.hitLock = 0;
    this.trail = [];
    this.spin = 0;
    this.playerShot = false;
  }

  spawn(opts) {
    this.id = nextId++;
    this.alive = true;
    this.x = opts.x;
    this.y = opts.y;
    this.px = opts.x;
    this.py = opts.y;
    this.vx = opts.vx;
    this.vy = opts.vy;
    this.color = opts.color;
    this.radius = opts.radius;
    this.deflected = false;
    this.elite = Boolean(opts.elite);
    this.pattern = opts.pattern || "straight";
    this.angularVel = opts.angularVel || 0;
    this.hitLock = 0;
    this.trail.length = 0;
    this.spin = rand(0, Math.PI * 2);
    this.playerShot = Boolean(opts.playerShot);
    if (this.playerShot) this.deflected = true;
  }

  kill() {
    this.alive = false;
  }

  /**
   * Reflect velocity across the radial shield normal at the impact point.
   * The normal points outward from the core.
   */
  deflect(nx, ny, boost, spread) {
    const dot = this.vx * nx + this.vy * ny;
    let vx = this.vx - 2 * dot * nx;
    let vy = this.vy - 2 * dot * ny;
    let speed = Math.hypot(vx, vy) * boost;
    if (speed < 40) speed = 180;
    let ang = Math.atan2(vy, vx) + rand(-spread, spread);
    vx = Math.cos(ang) * speed;
    vy = Math.sin(ang) * speed;
    // Guarantee the bolt leaves the arena rather than tunneling back in.
    if (vx * nx + vy * ny < 0) {
      const out = wrapAngle(Math.atan2(ny, nx) + rand(-spread * 0.5, spread * 0.5));
      vx = Math.cos(out) * speed;
      vy = Math.sin(out) * speed;
    }
    this.vx = vx;
    this.vy = vy;
    this.deflected = true;
    this.hitLock = 0.08;
    this.angularVel = 0;
  }

  update(dt, cx, cy) {
    this.px = this.x;
    this.py = this.y;
    if (this.hitLock > 0) this.hitLock -= dt;

    if (!this.deflected && this.pattern === "spiral" && this.angularVel) {
      // Curve inward by rotating around the core while closing distance.
      const dx = this.x - cx;
      const dy = this.y - cy;
      const dist = Math.hypot(dx, dy) || 1;
      const speed = Math.hypot(this.vx, this.vy);
      const ang = Math.atan2(dy, dx) + this.angularVel * dt;
      const radial = Math.max(0, dist - speed * dt);
      this.x = cx + Math.cos(ang) * radial;
      this.y = cy + Math.sin(ang) * radial;
      if (dt > 0) {
        this.vx = (this.x - this.px) / dt;
        this.vy = (this.y - this.py) / dt;
      }
    } else {
      this.x += this.vx * dt;
      this.y += this.vy * dt;
    }

    this.spin += dt * (this.elite ? 6 : 4);
    this.trail.push({ x: this.x, y: this.y });
    if (this.trail.length > PROJECTILE.trailMax) this.trail.shift();
  }

  draw(ctx, reducedMotion) {
    if (!this.alive) return;
    const { rgb, hex } = this.color;
    if (!reducedMotion) {
      ctx.strokeStyle = `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 0.28)`;
      ctx.lineWidth = this.radius * 1.2;
      ctx.lineCap = "round";
      ctx.beginPath();
      for (let i = 0; i < this.trail.length; i++) {
        const p = this.trail[i];
        if (i === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
    }

    const glow = this.elite ? this.radius * 3.2 : this.radius * 2.4;
    const g = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, glow);
    g.addColorStop(0, `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 0.95)`);
    g.addColorStop(0.35, `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 0.45)`);
    g.addColorStop(1, `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 0)`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(this.x, this.y, glow, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius * 0.45, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = hex;
    ctx.lineWidth = this.elite ? 2.4 : 1.5;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, this.spin, this.spin + Math.PI * 1.4);
    ctx.stroke();
  }
}

export class ProjectilePool {
  constructor(size) {
    this.items = Array.from({ length: size }, () => new Projectile());
  }

  reset() {
    for (const p of this.items) p.alive = false;
  }

  spawn(opts) {
    for (const p of this.items) {
      if (!p.alive) {
        p.spawn(opts);
        return p;
      }
    }
    return null;
  }

  get alive() {
    return this.items.filter((p) => p.alive);
  }
}
