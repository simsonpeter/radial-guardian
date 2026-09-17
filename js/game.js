/**
 * Game orchestrator: loop, spawning, collisions, scoring, difficulty, rendering.
 */

import {
  ADS,
  computeLayout,
  colorsForStage,
  DIFFICULTY,
  ENERGY_COLORS,
  GAME,
  PROJECTILE,
  SCORE,
  SHIELD,
  STORAGE_KEYS,
  stageLabel,
} from "./config.js";
import { ParticleSystem } from "./particles.js";
import { ProjectilePool } from "./projectile.js";
import { Shield } from "./player.js";
import { formatScore, hypot2, rand, randChoice } from "./utils.js";

export const STATES = {
  START: "start",
  PLAYING: "playing",
  PAUSED: "paused",
  OVER: "over",
  AD: "ad",
};

export class Game {
  constructor(canvas, { audio, ui, input, ads }) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d", { alpha: false });
    this.audio = audio;
    this.ui = ui;
    this.input = input;
    this.ads = ads;
    this.layout = computeLayout(window.innerWidth, window.innerHeight);
    this.shield = new Shield();
    this.projectiles = new ProjectilePool(PROJECTILE.maxAlive);
    this.particles = new ParticleSystem();
    this.state = STATES.START;
    this.lastTs = 0;
    this.raf = 0;
    this.hitStop = 0;
    this.shake = 0;
    this.flash = 0;
    this.corePulse = 0;
    this.coreUnstable = 0;
    this.spawnTimer = 0;
    this.time = 0;
    this.score = 0;
    this.combo = 1;
    this.comboTimer = 0;
    this.deflections = 0;
    this.chains = 0;
    this.stage = 1;
    this.best = Number(safeStorageGet(STORAGE_KEYS.highScore) || 0);
    this.stars = [];
    this.dust = [];
    this.sweep = 0;
    this.comboAnim = 0;
    this._warnLatch = false;
    this._adPending = false;
    this.continuesUsed = 0;
    this.dpr = 1;
    this._buildBackdrop();
  }

  init() {
    this.resize();
    window.addEventListener("resize", () => this.resize());
    this.ui.onPlay = () => this.startRun();
    this.ui.onResume = () => this.resume();
    this.ui.onRestart = () => this.startRun();
    this.ui.onMenu = () => this.toMenu();
    this.ui.onBurst = () => {
      if (this.state === STATES.PLAYING) this.tryBurst();
    };
    this.ui.onContinueAd = () => this.watchAdForContinue();
    this.ui.setHighScore(this.best);
    this.ui.showScreen("start");
    this.lastTs = performance.now();
    this.loop(this.lastTs);
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(1, window.innerWidth);
    const h = Math.max(1, window.innerHeight);
    this.dpr = dpr;
    this.canvas.width = Math.floor(w * dpr);
    this.canvas.height = Math.floor(h * dpr);
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.layout = computeLayout(w, h);
    this._buildBackdrop();
  }

  _buildBackdrop() {
    const { width, height } = this.layout;
    this.stars = Array.from({ length: 90 }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      z: rand(0.3, 1.2),
      tw: Math.random() * Math.PI * 2,
    }));
    this.dust = Array.from({ length: 36 }, () => ({
      a: Math.random() * Math.PI * 2,
      r: rand(0.2, 1.05),
      s: rand(0.04, 0.14),
      size: rand(0.8, 2.2),
    }));
  }

  toMenu() {
    this.state = STATES.START;
    this.projectiles.reset();
    this.particles.reset();
    this.ui.showScreen("start");
    this.ui.setHighScore(this.best);
  }

  startRun() {
    this.projectiles.reset();
    this.particles.reset();
    this.shield.reset();
    this.time = 0;
    this.score = 0;
    this.combo = 1;
    this.comboTimer = 0;
    this.deflections = 0;
    this.chains = 0;
    this.stage = 1;
    this.spawnTimer = 0.6;
    this.hitStop = 0;
    this.shake = 0;
    this.flash = 0;
    this.corePulse = 1;
    this.coreUnstable = 0;
    this._warnLatch = false;
    this._adPending = false;
    this.continuesUsed = 0;
    this.state = STATES.PLAYING;
    this.audio.unlock();
    this.ui.showPlaying();
    this.ui.toastMessage("STAGE 1 — HOLD THE CORE");
  }

  pause() {
    if (this.state !== STATES.PLAYING) return;
    this.state = STATES.PAUSED;
    this.ui.showScreen("pause");
  }

  resume() {
    if (this.state !== STATES.PAUSED) return;
    this.state = STATES.PLAYING;
    this.ui.showPlaying();
    this.lastTs = performance.now();
  }

  gameOver() {
    this.state = STATES.OVER;
    this.audio.gameOver();
    if (this.score > this.best) {
      this.best = Math.floor(this.score);
      safeStorageSet(STORAGE_KEYS.highScore, String(this.best));
    }
    this.ui.showGameOver({
      score: this.score,
      best: this.best,
      time: this.time,
      deflections: this.deflections,
      chains: this.chains,
      canContinue: this.continuesUsed < ADS.continuePerRun,
    });
  }

  async watchAdForContinue() {
    if (this.state !== STATES.OVER || this._adPending) return;
    if (this.continuesUsed >= ADS.continuePerRun) return;
    this._adPending = true;
    this.state = STATES.AD;
    this.ui.setContinueBusy(true);
    this.ui.dimForAd();
    const rewarded = await this.ads.showRewarded();
    this._adPending = false;
    this.ui.setContinueBusy(false);
    if (rewarded) {
      this.continueRun();
      return;
    }
    this.state = STATES.OVER;
    this.ui.showGameOver({
      score: this.score,
      best: this.best,
      time: this.time,
      deflections: this.deflections,
      chains: this.chains,
      canContinue: this.continuesUsed < ADS.continuePerRun,
    });
    this.ui.toastMessage("NO REWARD — AD NOT COMPLETED");
  }

  continueRun() {
    this.continuesUsed += 1;
    this.shield.energy = ADS.energyRestore;
    this.shield.warnFlash = 0;
    this.shield.burstCooldown = 0;
    this._warnLatch = false;
    this.combo = 1;
    this.comboTimer = 0;
    this.shake = 0;
    this.flash = 0.35;
    this.corePulse = 1;
    this.hitStop = 0;
    for (const p of this.projectiles.items) {
      if (p.alive && !p.deflected) p.kill();
    }
    this.state = STATES.PLAYING;
    this.lastTs = performance.now();
    this.audio.restore();
    this.ui.showPlaying();
    this.ui.updateHud({
      score: this.score,
      time: this.time,
      combo: this.combo,
      energy: this.shield.energy,
      stageLabel: stageLabel(this.stage),
      burstCooldownNorm: this.shield.burstCooldown / SHIELD.burstCooldown,
      comboPop: false,
    });
    this.ui.toastMessage("CORE RESTORED — HOLD THE LINE");
  }

  loop = (ts) => {
    this.raf = requestAnimationFrame(this.loop);
    let dt = (ts - this.lastTs) / 1000;
    this.lastTs = ts;
    dt = Math.min(GAME.maxDt, Math.max(0, dt));

    if (this.state === STATES.PLAYING) {
      if (this.input.consumePause()) this.pause();
      else if (this.input.consumeBurst()) this.tryBurst();
      this.update(dt);
    } else {
      if (this.state === STATES.AD) {
        this.input.consumeConfirm();
        this.input.consumeBurst();
        this.input.consumePause();
      } else if (this.input.consumeConfirm()) {
        if (this.state === STATES.START || this.state === STATES.OVER) this.startRun();
        else if (this.state === STATES.PAUSED) this.resume();
      }
      this.input.consumeBurst();
      if (this.state === STATES.PAUSED && this.input.consumePause()) this.resume();
      else this.input.consumePause();
      this.shield.pulse += dt;
      this.sweep += dt;
    }
    this.draw();
  };

  tryBurst() {
    if (this.shield.tryBurst()) {
      this.audio.burst();
      this.flash = Math.max(this.flash, 0.28);
      this.corePulse = 1;
      const { cx, cy } = this.layout;
      const r = this.shield.radius(this.layout) + this.layout.burstPadding;
      for (const p of this.projectiles.items) {
        if (!p.alive || p.deflected) continue;
        const dist = Math.hypot(p.x - cx, p.y - cy);
        if (dist <= r + p.radius) {
          const ang = Math.atan2(p.y - cy, p.x - cx);
          this._deflectProjectile(p, Math.cos(ang), Math.sin(ang), p.x, p.y);
        }
      }
      this.particles.burst(cx, cy, ENERGY_COLORS.cyan, 1.4);
    }
  }

  currentSpeed() {
    const extra = (this.stage - 1) * DIFFICULTY.stageSpeedStep;
    return Math.min(DIFFICULTY.maxSpeed, DIFFICULTY.baseSpeed + extra);
  }

  currentSpawn() {
    const extra = (this.stage - 1) * DIFFICULTY.stageSpawnStep;
    return Math.max(DIFFICULTY.minSpawn, DIFFICULTY.baseSpawn - extra);
  }

  update(dt) {
    if (this.hitStop > 0 && !this.ui.reducedMotion) {
      this.hitStop -= dt;
      dt *= 0.18;
    }

    this.time += dt;
    this.sweep += dt;
    this.shake = Math.max(0, this.shake - dt * 4.5);
    this.flash = Math.max(0, this.flash - dt * 2.8);
    this.corePulse = Math.max(0, this.corePulse - dt * 2.2);
    this.comboAnim = Math.max(0, this.comboAnim - dt * 2.5);
    this.coreUnstable = 1 - this.shield.energyNorm;

    const nextStage = Math.min(GAME.maxStage, 1 + Math.floor(this.time / GAME.stageInterval));
    if (nextStage !== this.stage) {
      this.stage = nextStage;
      this.ui.toastMessage(`${stageLabel(this.stage)} — INBOUND DENSITY UP`);
      this.audio.stageUp();
    }

    this.comboTimer += dt;
    if (this.comboTimer > GAME.comboDecayDelay && this.combo > 1) {
      this.combo = Math.max(1, this.combo - GAME.comboDecayPerSecond * dt);
    }

    this.shield.update(dt, this.input, this.layout);
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this._spawnWave();
      this.spawnTimer = this.currentSpawn() * rand(0.78, 1.12);
    }

    this._updateProjectiles(dt);
    this.particles.update(dt);

    if (this.shield.energy <= SHIELD.energyMinGameOver) {
      this.gameOver();
      return;
    }

    if (this.shield.energyNorm < 0.34) {
      if (!this._warnLatch) {
        this.audio.warning();
        this._warnLatch = true;
      }
    } else {
      this._warnLatch = false;
    }

    this.ui.updateHud({
      score: this.score,
      time: this.time,
      combo: this.combo,
      energy: this.shield.energy,
      stageLabel: stageLabel(this.stage),
      burstCooldownNorm: this.shield.burstCooldown / SHIELD.burstCooldown,
      comboPop: this.comboAnim > 0.2,
    });
  }

  _spawnWave() {
    const colors = colorsForStage(this.stage);
    const count = this._spawnCount();
    const pattern = this._pickPattern();
    if (pattern === "ring") {
      const n = 6 + (this.stage >= 6 ? 2 : 0);
      const offset = rand(0, Math.PI * 2);
      for (let i = 0; i < n; i++) this._spawnOne(colors, "straight", offset + (i / n) * Math.PI * 2);
      this.audio.spawn();
      return;
    }
    if (pattern === "volley") {
      const base = rand(0, Math.PI * 2);
      for (let i = 0; i < count; i++) {
        this._spawnOne(colors, "straight", base + (i - (count - 1) / 2) * 0.22);
      }
      this.audio.spawn();
      return;
    }
    for (let i = 0; i < count; i++) {
      this._spawnOne(colors, pattern, null);
    }
    this.audio.spawn();
  }

  _spawnCount() {
    if (this.stage <= 1) return 1;
    if (this.stage === 2) return Math.random() < 0.25 ? 2 : 1;
    if (this.stage === 3) return Math.random() < 0.45 ? 2 : 1;
    if (this.stage === 4) return Math.random() < 0.4 ? 3 : 2;
    return Math.random() < 0.35 ? 4 : 3;
  }

  _pickPattern() {
    if (this.stage <= 1) return "straight";
    if (this.stage === 2) return Math.random() < 0.12 ? "volley" : "straight";
    if (this.stage === 3) return Math.random() < 0.22 ? "volley" : "straight";
    if (this.stage === 4) {
      const r = Math.random();
      if (r < 0.28) return "spiral";
      if (r < 0.48) return "volley";
      return "straight";
    }
    const r = Math.random();
    if (r < 0.12) return "ring";
    if (r < 0.34) return "spiral";
    if (r < 0.55) return "volley";
    return "straight";
  }

  _spawnOne(colors, pattern, forcedAngle) {
    const { cx, cy, spawnRadius, projectileRadius, eliteRadius, arena } = this.layout;
    const elite = this.stage >= 5 && Math.random() < 0.08;
    const ang = forcedAngle != null ? forcedAngle : rand(0, Math.PI * 2);
    const x = cx + Math.cos(ang) * spawnRadius;
    const y = cy + Math.sin(ang) * spawnRadius;
    const speed = this.currentSpeed() * arena * (elite ? 1.18 : 1) * rand(0.94, 1.06);
    const dirx = cx - x;
    const diry = cy - y;
    const len = Math.hypot(dirx, diry) || 1;
    const jitter = rand(-0.05, 0.05);
    const vx = (dirx / len) * speed * Math.cos(jitter) - (diry / len) * speed * Math.sin(jitter);
    const vy = (diry / len) * speed * Math.cos(jitter) + (dirx / len) * speed * Math.sin(jitter);
    this.projectiles.spawn({
      x,
      y,
      vx,
      vy,
      color: randChoice(colors),
      radius: elite ? eliteRadius : projectileRadius,
      elite,
      pattern,
      angularVel: pattern === "spiral" ? randChoice([-1, 1]) * rand(0.55, 1.1) : 0,
    });
  }

  _updateProjectiles(dt) {
    const { cx, cy, spawnRadius, coreRadius } = this.layout;
    const items = this.projectiles.items;

    for (const p of items) {
      if (!p.alive) continue;
      p.update(dt, cx, cy);

      if (!p.deflected && p.hitLock <= 0) {
        const hit = this.shield.intersectSegment(
          p.px,
          p.py,
          p.x,
          p.y,
          cx,
          cy,
          this.layout,
          p.radius
        );
        if (hit) {
          this._deflectProjectile(p, hit.nx, hit.ny, hit.ix, hit.iy);
          continue;
        }
      }

      const dist = Math.hypot(p.x - cx, p.y - cy);
      if (!p.deflected && dist <= coreRadius * 1.05 + p.radius) {
        this._coreHit(p);
        continue;
      }

      if (p.deflected && dist > spawnRadius + 40) {
        p.kill();
      }
    }

    this._resolveChains();
  }

  _deflectProjectile(p, nx, ny, ix, iy) {
    p.deflect(nx, ny, PROJECTILE.deflectBoost, PROJECTILE.deflectSpread);
    this.deflections += 1;
    this.score += SCORE.deflection;
    this.shield.impactFlash = 1;
    this.corePulse = 0.7;
    this.audio.deflect();
    this.particles.spawn(ix, iy, 14, p.color, 260, {
      angle: Math.atan2(ny, nx),
      spread: 0.9,
      spark: true,
      size: 2.4,
    });
    this.particles.floatText(ix, iy, `+${SCORE.deflection}`, p.color.hex, 0.95);
  }

  _coreHit(p) {
    const dmg = p.elite ? SHIELD.eliteHitDamage : SHIELD.coreHitDamage;
    this.shield.damage(dmg);
    this.combo = 1;
    this.comboTimer = GAME.comboDecayDelay;
    this.shake = this.ui.reducedMotion ? 0 : 0.35;
    this.flash = 0.4;
    this.corePulse = 1;
    this.audio.coreHit();
    this.particles.burst(p.x, p.y, p.color, p.elite ? 1.3 : 0.9);
    p.kill();
  }

  _resolveChains() {
    const items = this.projectiles.items;
    for (let i = 0; i < items.length; i++) {
      const a = items[i];
      if (!a.alive || !a.deflected || a.hitLock > 0) continue;
      for (let j = 0; j < items.length; j++) {
        if (i === j) continue;
        const b = items[j];
        if (!b.alive) continue;
        const rad = (a.radius + b.radius) * PROJECTILE.chainHitRadiusScale;
        if (hypot2(a.x - b.x, a.y - b.y) > rad * rad) continue;

        if (a.color.id === b.color.id) {
          this._chainHit(a, b);
        } else {
          this._mismatch(a, b);
        }
        break;
      }
    }
  }

  _chainHit(a, b) {
    const mx = (a.x + b.x) * 0.5;
    const my = (a.y + b.y) * 0.5;
    this.chains += 1;
    const mul = Math.max(1, Math.floor(this.combo));
    let pts = SCORE.chainBase * mul;
    if (a.elite || b.elite) pts += SCORE.eliteBonus * mul;
    this.score += pts;
    this.combo += 1;
    this.comboTimer = 0;
    this.comboAnim = 1;
    this.shield.heal(SHIELD.chainHeal);
    this.flash = Math.min(0.45, 0.16 + mul * 0.03);
    if (!this.ui.reducedMotion) {
      this.shake = Math.min(0.28, 0.08 + mul * 0.02);
      if (mul >= 3) this.hitStop = GAME.hitStopDuration;
    }
    this.corePulse = 1;
    this.audio.chain(mul);
    if (mul >= 2) this.audio.comboUp(mul);
    this.particles.burst(mx, my, a.color, 1.15 + Math.min(1.2, mul * 0.12));
    this.particles.floatText(mx, my, `+${formatScore(pts)}`, a.color.hex, 1.15 + Math.min(0.6, mul * 0.08));
    b.kill();
    // Keep the deflected bolt alive so it can continue a chain reaction.
    a.hitLock = 0.05;
    if (b.elite) a.kill();
  }

  _mismatch(a, b) {
    const mx = (a.x + b.x) * 0.5;
    const my = (a.y + b.y) * 0.5;
    this.shield.damage(SHIELD.mismatchDamage);
    this.combo = 1;
    this.comboTimer = GAME.comboDecayDelay;
    this.shake = this.ui.reducedMotion ? 0 : 0.22;
    this.flash = 0.32;
    this.audio.mismatch();
    this.particles.burst(mx, my, ENERGY_COLORS.red, 1.05);
    this.particles.floatText(mx, my, "MISMATCH", "#ff8a4a", 1.1);
    a.kill();
    b.kill();
  }

  draw() {
    const ctx = this.ctx;
    const { width, height, cx, cy } = this.layout;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    let ox = 0;
    let oy = 0;
    if (this.shake > 0 && !this.ui.reducedMotion) {
      ox = (Math.random() - 0.5) * 10 * this.shake;
      oy = (Math.random() - 0.5) * 10 * this.shake;
    }
    ctx.translate(ox, oy);

    this._drawBackground(ctx);
    this._drawArena(ctx);
    this._drawCore(ctx);
    this.shield.draw(ctx, this.layout, cx, cy, this.ui.reducedMotion);

    for (const p of this.projectiles.items) {
      p.draw(ctx, this.ui.reducedMotion);
    }
    this.particles.draw(ctx, this.ui.reducedMotion);

    if (this.flash > 0) {
      ctx.fillStyle = this.shield.warnFlash > 0.2
        ? `rgba(255, 60, 40, ${this.flash * 0.16})`
        : `rgba(140, 230, 255, ${this.flash * 0.12})`;
      ctx.fillRect(-ox, -oy, width, height);
    }

    if (this.shield.energyNorm < 0.34 && this.state === STATES.PLAYING) {
      const pulse = 0.08 + Math.abs(Math.sin(this.sweep * 6)) * 0.1;
      ctx.strokeStyle = `rgba(255, 70, 50, ${pulse})`;
      ctx.lineWidth = 8;
      ctx.strokeRect(4, 4, width - 8, height - 8);
    }

    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }

  _drawBackground(ctx) {
    const { width, height, cx, cy, arena } = this.layout;
    const bg = ctx.createRadialGradient(cx, cy, 20, cx, cy, Math.max(width, height) * 0.75);
    bg.addColorStop(0, "#0a1630");
    bg.addColorStop(0.45, "#060b18");
    bg.addColorStop(1, "#020308");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    for (const s of this.stars) {
      const tw = this.ui.reducedMotion ? 0.5 : 0.35 + Math.sin(this.sweep * s.z + s.tw) * 0.35;
      ctx.fillStyle = `rgba(210, 230, 255, ${tw * 0.7})`;
      ctx.fillRect(s.x, s.y, s.z, s.z);
    }

    ctx.save();
    ctx.globalAlpha = 0.14;
    ctx.strokeStyle = "#3d6d9a";
    ctx.lineWidth = 1;
    const step = 48;
    const gx = ((cx % step) + step) % step;
    const gy = ((cy % step) + step) % step;
    ctx.beginPath();
    for (let x = gx; x < width; x += step) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
    }
    for (let y = gy; y < height; y += step) {
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
    }
    ctx.stroke();
    ctx.restore();

    for (const d of this.dust) {
      d.a += d.s * 0.25 * (this.ui.reducedMotion ? 0.2 : 1);
      const x = cx + Math.cos(d.a) * arena * d.r;
      const y = cy + Math.sin(d.a) * arena * d.r;
      ctx.fillStyle = "rgba(80, 180, 255, 0.22)";
      ctx.beginPath();
      ctx.arc(x, y, d.size, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  _drawArena(ctx) {
    const { cx, cy, arena } = this.layout;
    ctx.save();
    const ambient = ctx.createRadialGradient(cx, cy, arena * 0.1, cx, cy, arena);
    ambient.addColorStop(0, "rgba(0, 180, 255, 0.12)");
    ambient.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = ambient;
    ctx.beginPath();
    ctx.arc(cx, cy, arena, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "rgba(70, 170, 255, 0.22)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy, arena, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = "rgba(70, 170, 255, 0.1)";
    for (let i = 1; i <= 4; i++) {
      ctx.beginPath();
      ctx.arc(cx, cy, (arena * i) / 4, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.beginPath();
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      ctx.moveTo(cx + Math.cos(a) * arena * 0.12, cy + Math.sin(a) * arena * 0.12);
      ctx.lineTo(cx + Math.cos(a) * arena, cy + Math.sin(a) * arena);
    }
    ctx.stroke();

    if (!this.ui.reducedMotion) {
      ctx.strokeStyle = "rgba(0, 243, 255, 0.12)";
      ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.arc(cx, cy, arena * 0.98, this.sweep * 0.4, this.sweep * 0.4 + 0.5);
      ctx.stroke();
    }
    ctx.restore();
  }

  _drawCore(ctx) {
    const { cx, cy, coreRadius } = this.layout;
    const unstable = this.coreUnstable;
    const pulse = 1 + Math.sin(this.sweep * (2.4 + unstable * 6)) * (0.06 + unstable * 0.08) + this.corePulse * 0.12;
    const r = coreRadius * pulse;

    const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 4.2);
    glow.addColorStop(0, `rgba(180, 255, 255, ${0.55 + this.corePulse * 0.3})`);
    glow.addColorStop(0.25, `rgba(0, 180, 255, ${0.28 + unstable * 0.15})`);
    glow.addColorStop(0.7, `rgba(80, 0, 140, ${0.12 + unstable * 0.12})`);
    glow.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 4.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.translate(cx, cy);
    for (let i = 0; i < 3; i++) {
      const rot = this.sweep * (0.5 + i * 0.35) * (i % 2 ? -1 : 1);
      ctx.rotate(rot);
      ctx.strokeStyle = `rgba(${unstable > 0.5 ? 255 : 80}, ${180 - unstable * 80}, 255, ${0.35 - i * 0.06})`;
      ctx.lineWidth = 2 - i * 0.3;
      ctx.beginPath();
      ctx.arc(0, 0, r * (1.45 + i * 0.38), 0.2, Math.PI * 1.3);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, r * (1.45 + i * 0.38), Math.PI * 1.5, Math.PI * 1.9);
      ctx.stroke();
    }
    ctx.restore();

    const inner = ctx.createRadialGradient(cx - r * 0.2, cy - r * 0.25, r * 0.1, cx, cy, r);
    inner.addColorStop(0, "#ffffff");
    inner.addColorStop(0.35, unstable > 0.55 ? "#ffb0d0" : "#7afcff");
    inner.addColorStop(1, unstable > 0.55 ? "#ff3b6b" : "#1a4dff");
    ctx.fillStyle = inner;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "rgba(255,255,255,0.7)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.62, 0, Math.PI * 2);
    ctx.stroke();

    if (!this.ui.reducedMotion) {
      for (let i = 0; i < 8; i++) {
        const a = this.sweep * 1.4 + (i / 8) * Math.PI * 2;
        const rr = r * (1.7 + 0.25 * Math.sin(this.sweep * 3 + i));
        ctx.fillStyle = "rgba(180, 255, 255, 0.55)";
        ctx.beginPath();
        ctx.arc(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, 1.6, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}

function safeStorageGet(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeStorageSet(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* private mode */
  }
}
