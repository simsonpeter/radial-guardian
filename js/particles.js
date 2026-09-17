/**
 * Pooled particle and floating-text systems.
 * No DOM nodes are created during gameplay.
 */

import { PARTICLES } from "./config.js";
import { rand } from "./utils.js";

function makeParticle() {
  return {
    alive: false,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    life: 0,
    maxLife: 1,
    size: 2,
    r: 255,
    g: 255,
    b: 255,
    drag: 0.96,
    gravity: 0,
    spark: false,
  };
}

function makeFloat() {
  return {
    alive: false,
    x: 0,
    y: 0,
    vy: -40,
    life: 0,
    maxLife: 0.8,
    text: "",
    color: "#ffffff",
    scale: 1,
  };
}

export class ParticleSystem {
  constructor() {
    this.particles = Array.from({ length: PARTICLES.poolSize }, makeParticle);
    this.floats = Array.from({ length: PARTICLES.floatTextPool }, makeFloat);
  }

  reset() {
    for (const p of this.particles) p.alive = false;
    for (const f of this.floats) f.alive = false;
  }

  spawn(x, y, count, color, speed, options = {}) {
    const { rgb } = color;
    let spawned = 0;
    for (let i = 0; i < this.particles.length && spawned < count; i++) {
      const p = this.particles[i];
      if (p.alive) continue;
      const ang = options.angle != null ? options.angle + rand(-options.spread || 0, options.spread || 0) : rand(0, Math.PI * 2);
      const spd = speed * rand(0.35, 1.15);
      p.alive = true;
      p.x = x;
      p.y = y;
      p.vx = Math.cos(ang) * spd;
      p.vy = Math.sin(ang) * spd;
      p.life = 0;
      p.maxLife = options.life || rand(0.28, 0.7);
      p.size = options.size || rand(1.4, 3.6);
      p.r = rgb[0];
      p.g = rgb[1];
      p.b = rgb[2];
      p.drag = options.drag || 0.96;
      p.gravity = options.gravity || 0;
      p.spark = Boolean(options.spark);
      spawned++;
    }
  }

  burst(x, y, color, power = 1) {
    this.spawn(x, y, Math.floor(18 * power), color, 220 * power, {
      life: 0.55,
      size: 2.8 * power,
      spark: true,
    });
    this.spawn(x, y, Math.floor(10 * power), color, 80 * power, {
      life: 0.4,
      size: 4.5 * power,
      drag: 0.9,
    });
  }

  trail(x, y, color, vx, vy) {
    this.spawn(x, y, 1, color, 8, {
      angle: Math.atan2(vy, vx) + Math.PI,
      spread: 0.4,
      life: 0.22,
      size: 2.2,
      drag: 0.88,
    });
  }

  floatText(x, y, text, color, scale = 1) {
    for (const f of this.floats) {
      if (f.alive) continue;
      f.alive = true;
      f.x = x;
      f.y = y;
      f.vy = -46;
      f.life = 0;
      f.maxLife = 0.85;
      f.text = text;
      f.color = color;
      f.scale = scale;
      return;
    }
  }

  update(dt) {
    for (const p of this.particles) {
      if (!p.alive) continue;
      p.life += dt;
      if (p.life >= p.maxLife) {
        p.alive = false;
        continue;
      }
      p.vx *= p.drag;
      p.vy *= p.drag;
      p.vy += p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    for (const f of this.floats) {
      if (!f.alive) continue;
      f.life += dt;
      if (f.life >= f.maxLife) {
        f.alive = false;
        continue;
      }
      f.y += f.vy * dt;
    }
  }

  draw(ctx, reducedMotion) {
    for (const p of this.particles) {
      if (!p.alive) continue;
      const t = 1 - p.life / p.maxLife;
      ctx.fillStyle = `rgba(${p.r}, ${p.g}, ${p.b}, ${t * (p.spark ? 0.95 : 0.7)})`;
      const s = p.size * (p.spark ? t : 0.6 + t * 0.4);
      ctx.beginPath();
      ctx.arc(p.x, p.y, s, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (const f of this.floats) {
      if (!f.alive) continue;
      const t = 1 - f.life / f.maxLife;
      ctx.globalAlpha = t;
      ctx.fillStyle = f.color;
      ctx.font = `700 ${Math.round(16 * f.scale)}px Rajdhani, Segoe UI, sans-serif`;
      if (!reducedMotion) {
        ctx.shadowColor = f.color;
        ctx.shadowBlur = 12;
      }
      ctx.fillText(f.text, f.x, f.y);
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
    }
  }
}
