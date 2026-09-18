/**
 * Player-controlled energy arc that orbits the core.
 */

import { POWER_LABELS, POWERS, SHIELD } from "./config.js";
import { absAngleDelta, clamp, lerp, wrapAngle } from "./utils.js";

export class Shield {
  constructor() {
    this.angle = -Math.PI / 2;
    this.energy = SHIELD.energyMax;
    this.burstTimer = 0;
    this.burstCooldown = 0;
    this.growTimer = 0;
    this.spinTimer = 0;
    this.powerIndex = 0;
    this.impactFlash = 0;
    this.warnFlash = 0;
    this.pulse = 0;
    this.particles = [];
    for (let i = 0; i < 18; i++) {
      this.particles.push({ t: i / 18, speed: 0.25 + Math.random() * 0.4 });
    }
  }

  reset() {
    this.angle = -Math.PI / 2;
    this.energy = SHIELD.energyMax;
    this.burstTimer = 0;
    this.burstCooldown = 0;
    this.growTimer = 0;
    this.spinTimer = 0;
    this.powerIndex = 0;
    this.impactFlash = 0;
    this.warnFlash = 0;
    this.pulse = 0;
  }

  get energyNorm() {
    return clamp(this.energy / SHIELD.energyMax, 0, 1);
  }

  radius(layout) {
    let r = lerp(layout.shieldRadiusMin, layout.shieldRadiusMax, this.energyNorm);
    if (this.burstTimer > 0) r += layout.burstRadiusBoost;
    if (this.growTimer > 0) r *= SHIELD.growRadiusScale;
    return r;
  }

  arcWidth() {
    const base = lerp(SHIELD.minArc, SHIELD.baseArc, this.energyNorm);
    if (this.burstTimer > 0) return base * SHIELD.burstArcScale;
    if (this.growTimer > 0) return base * SHIELD.growArcScale;
    return base;
  }

  get nextPower() {
    return POWERS[this.powerIndex % POWERS.length];
  }

  get nextPowerLabel() {
    return POWER_LABELS[this.nextPower];
  }

  canPower() {
    return this.burstCooldown <= 0 && this.burstTimer <= 0;
  }

  tryPower() {
    if (!this.canPower()) return null;
    const power = this.nextPower;
    this.powerIndex = (this.powerIndex + 1) % POWERS.length;
    this.burstCooldown = SHIELD.burstCooldown;
    this.impactFlash = 1;
    if (power === "burst") this.burstTimer = SHIELD.burstDuration;
    if (power === "grow") this.growTimer = SHIELD.growDuration;
    if (power === "spin") this.spinTimer = SHIELD.spinDuration;
    return power;
  }

  damage(amount) {
    this.energy = Math.max(0, this.energy - amount);
    this.warnFlash = 1;
  }

  heal(amount) {
    this.energy = Math.min(SHIELD.energyMax, this.energy + amount);
  }

  /**
   * True when a world-space point sits on the shield arc (radius + angle).
   */
  containsPoint(x, y, cx, cy, layout, extraRadius = 0) {
    const dx = x - cx;
    const dy = y - cy;
    const dist = Math.hypot(dx, dy);
    const r = this.radius(layout);
    const thick = layout.shieldThickness * 0.55 + extraRadius;
    if (Math.abs(dist - r) > thick) return false;
    const ang = Math.atan2(dy, dx);
    return absAngleDelta(ang, this.angle) <= this.arcWidth() * 0.5;
  }

  /**
   * Continuous collision: did the segment from (px,py) to (x,y) cross the arc?
   * Returns impact normal (outward) or null.
   */
  intersectSegment(px, py, x, y, cx, cy, layout, bodyRadius) {
    const prevDist = Math.hypot(px - cx, py - cy);
    const dist = Math.hypot(x - cx, y - cy);
    const r = this.radius(layout);
    const pad = layout.shieldThickness * 0.5 + bodyRadius;

    const crossedIn = prevDist > r - pad && dist <= r + pad && dist < prevDist;
    const near = Math.abs(dist - r) <= pad;
    if (!crossedIn && !near) return null;

    let ix = x;
    let iy = y;
    if (crossedIn && prevDist !== dist) {
      const t = clamp((prevDist - r) / (prevDist - dist), 0, 1);
      ix = lerp(px, x, t);
      iy = lerp(py, y, t);
    }
    const ang = Math.atan2(iy - cy, ix - cx);
    if (absAngleDelta(ang, this.angle) > this.arcWidth() * 0.5) return null;
    return { nx: Math.cos(ang), ny: Math.sin(ang), ix, iy, ang };
  }

  update(dt, input, layout) {
    this.pulse += dt;
    if (this.burstTimer > 0) this.burstTimer = Math.max(0, this.burstTimer - dt);
    if (this.burstCooldown > 0) this.burstCooldown = Math.max(0, this.burstCooldown - dt);
    if (this.growTimer > 0) this.growTimer = Math.max(0, this.growTimer - dt);
    if (this.spinTimer > 0) this.spinTimer = Math.max(0, this.spinTimer - dt);
    this.impactFlash = Math.max(0, this.impactFlash - dt * 3.4);
    this.warnFlash = Math.max(0, this.warnFlash - dt * 2.2);

    if (this.spinTimer > 0) {
      this.angle = wrapAngle(this.angle + SHIELD.spinSpeed * dt);
    } else {
      const rotate = input.rotateIntent();
      if (rotate !== 0) {
        this.angle = wrapAngle(this.angle + rotate * SHIELD.rotateSpeed * dt);
      }
      const yaw = input.consumeSteerYaw();
      if (yaw) this.angle = wrapAngle(this.angle + yaw);
      if (input.aimingWithPointer) {
        const k = 1 - Math.exp(-SHIELD.pointerLerp * dt);
        this.angle = wrapAngle(this.angle + wrapAngle(input.pointerAngle - this.angle) * k);
      }
    }

    const arc = this.arcWidth();
    for (const p of this.particles) {
      p.t += p.speed * dt;
      if (p.t > 1) p.t -= 1;
      p.angle = this.angle - arc * 0.5 + p.t * arc;
    }
  }

  draw(ctx, layout, cx, cy, reducedMotion) {
    const r = this.radius(layout);
    const arc = this.arcWidth();
    const a0 = this.angle - arc * 0.5;
    const a1 = this.angle + arc * 0.5;
    const thick = layout.shieldThickness;
    const warn = this.warnFlash;
    const flash = this.impactFlash;
    const growing = this.growTimer > 0;
    const spinning = this.spinTimer > 0;
    const energyHue = this.energyNorm < 0.34
      ? `rgba(255, 90, 60,`
      : growing
        ? `rgba(57, 255, 136,`
        : spinning
          ? `rgba(255, 43, 214,`
          : `rgba(0, 243, 255,`;

    ctx.save();
    if (!reducedMotion) {
      ctx.shadowColor = warn > 0.05
        ? `rgba(255,80,40,${0.55 + warn * 0.4})`
        : growing
          ? `rgba(57,255,136,${0.5 + flash * 0.4})`
          : spinning
            ? `rgba(255,43,214,${0.55 + flash * 0.4})`
            : `rgba(0,243,255,${0.45 + flash * 0.5})`;
      ctx.shadowBlur = 18 + flash * 24 + (growing ? 10 : 0) + (spinning ? 8 : 0);
    }

    ctx.lineCap = "round";
    ctx.strokeStyle = warn > 0.2 ? `rgba(255,90,50,${0.35 + warn * 0.4})` : `${energyHue}${0.22 + flash * 0.35})`;
    ctx.lineWidth = thick * 1.8;
    ctx.beginPath();
    ctx.arc(cx, cy, r, a0, a1);
    ctx.stroke();

    ctx.strokeStyle = warn > 0.25 ? "#ff8a4a" : growing ? "#39ff88" : spinning ? "#ff2bd6" : "#7afcff";
    ctx.lineWidth = thick * 0.7;
    ctx.beginPath();
    ctx.arc(cx, cy, r, a0, a1);
    ctx.stroke();

    ctx.strokeStyle = "#ffffff";
    ctx.globalAlpha = 0.65 + flash * 0.35;
    ctx.lineWidth = thick * 0.22;
    ctx.beginPath();
    ctx.arc(cx, cy, r, a0, a1);
    ctx.stroke();
    ctx.globalAlpha = 1;

    // Animated energy texture along the arc.
    const ripple = reducedMotion ? 0 : Math.sin(this.pulse * 10) * 0.015;
    ctx.strokeStyle = `rgba(180, 255, 255, ${0.35 + flash * 0.4})`;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 10]);
    ctx.lineDashOffset = reducedMotion ? 0 : -this.pulse * (spinning ? 220 : 80);
    ctx.beginPath();
    ctx.arc(cx, cy, r + ripple * r, a0, a1);
    ctx.stroke();
    ctx.setLineDash([]);

    for (const p of this.particles) {
      const px = cx + Math.cos(p.angle) * r;
      const py = cy + Math.sin(p.angle) * r;
      ctx.fillStyle = `rgba(200, 255, 255, ${0.45 + flash * 0.4})`;
      ctx.beginPath();
      ctx.arc(px, py, 1.7, 0, Math.PI * 2);
      ctx.fill();
    }

    // End caps
    for (const a of [a0, a1]) {
      const ex = cx + Math.cos(a) * r;
      const ey = cy + Math.sin(a) * r;
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(ex, ey, 3.2 + flash * 2, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }
}
