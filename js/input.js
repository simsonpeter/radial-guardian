/**
 * Unified pointer / keyboard / touch input.
 * Desktop: mouse aims. Mobile: ◀ ▶ to spin, hold SPEED harder / slide up to go faster.
 */

import { SHIELD } from "./config.js";
import { clamp, wrapAngle } from "./utils.js";

export class Input {
  constructor(canvas, getCenter) {
    this.canvas = canvas;
    this.getCenter = getCenter;
    this.keys = new Set();
    this.pointerActive = false;
    this.pointerAngle = 0;
    this.pointerStamp = 0;
    this.burstQueued = false;
    this.pauseQueued = false;
    this.confirmQueued = false;
    this.steerHold = 0;
    this.steerYaw = 0;
    this.speedForce = 0;
    this.steerForce = 0;
    this._lastPointerId = null;
    this._touchId = null;
    this._lastTouchX = 0;
    this._steerIds = new Map();
    this._speedId = null;
    this._speedOriginY = 0;
    this._forceBtn = null;

    this._onKeyDown = this._onKeyDown.bind(this);
    this._onKeyUp = this._onKeyUp.bind(this);
    this._onPointerDown = this._onPointerDown.bind(this);
    this._onPointerMove = this._onPointerMove.bind(this);
    this._onPointerUp = this._onPointerUp.bind(this);
    this._onContext = (e) => e.preventDefault();
    this._onTouchMove = this._onTouchMove.bind(this);
    this._onSteerDown = this._onSteerDown.bind(this);
    this._onSteerUp = this._onSteerUp.bind(this);
    this._onSpeedDown = this._onSpeedDown.bind(this);
    this._onSpeedUp = this._onSpeedUp.bind(this);
  }

  attach() {
    window.addEventListener("keydown", this._onKeyDown);
    window.addEventListener("keyup", this._onKeyUp);
    this.canvas.addEventListener("pointerdown", this._onPointerDown);
    window.addEventListener("pointermove", this._onPointerMove);
    window.addEventListener("pointerup", this._onPointerUp);
    window.addEventListener("pointercancel", this._onPointerUp);
    this.canvas.addEventListener("contextmenu", this._onContext);
    this.canvas.addEventListener("touchmove", this._onTouchMove, { passive: false });
    this.canvas.addEventListener("touchstart", this._onTouchMove, { passive: false });
    document.body.addEventListener("touchmove", this._preventScroll, { passive: false });

    this._leftBtn = document.getElementById("steer-left");
    this._rightBtn = document.getElementById("steer-right");
    this._speedBtn = document.getElementById("speed-btn");
    this._speedValue = document.getElementById("speed-value");
    for (const btn of [this._leftBtn, this._rightBtn]) {
      if (!btn) continue;
      btn.addEventListener("pointerdown", this._onSteerDown);
      btn.addEventListener("pointerup", this._onSteerUp);
      btn.addEventListener("pointercancel", this._onSteerUp);
      btn.addEventListener("lostpointercapture", this._onSteerUp);
    }
    if (this._speedBtn) {
      this._speedBtn.addEventListener("pointerdown", this._onSpeedDown);
      this._speedBtn.addEventListener("pointerup", this._onSpeedUp);
      this._speedBtn.addEventListener("pointercancel", this._onSpeedUp);
      this._speedBtn.addEventListener("lostpointercapture", this._onSpeedUp);
    }
    this._paintSpeed();
  }

  detach() {
    window.removeEventListener("keydown", this._onKeyDown);
    window.removeEventListener("keyup", this._onKeyUp);
    this.canvas.removeEventListener("pointerdown", this._onPointerDown);
    window.removeEventListener("pointermove", this._onPointerMove);
    window.removeEventListener("pointerup", this._onPointerUp);
    window.removeEventListener("pointercancel", this._onPointerUp);
    this.canvas.removeEventListener("contextmenu", this._onContext);
    this.canvas.removeEventListener("touchmove", this._onTouchMove);
    this.canvas.removeEventListener("touchstart", this._onTouchMove);
    document.body.removeEventListener("touchmove", this._preventScroll);
    for (const btn of [this._leftBtn, this._rightBtn]) {
      if (!btn) continue;
      btn.removeEventListener("pointerdown", this._onSteerDown);
      btn.removeEventListener("pointerup", this._onSteerUp);
      btn.removeEventListener("pointercancel", this._onSteerUp);
      btn.removeEventListener("lostpointercapture", this._onSteerUp);
    }
    if (this._speedBtn) {
      this._speedBtn.removeEventListener("pointerdown", this._onSpeedDown);
      this._speedBtn.removeEventListener("pointerup", this._onSpeedUp);
      this._speedBtn.removeEventListener("pointercancel", this._onSpeedUp);
      this._speedBtn.removeEventListener("lostpointercapture", this._onSpeedUp);
    }
  }

  consumeBurst() {
    const v = this.burstQueued;
    this.burstQueued = false;
    return v;
  }

  consumePause() {
    const v = this.pauseQueued;
    this.pauseQueued = false;
    return v;
  }

  consumeConfirm() {
    const v = this.confirmQueued;
    this.confirmQueued = false;
    return v;
  }

  consumeSteerYaw() {
    const yaw = this.steerYaw;
    this.steerYaw = 0;
    return yaw;
  }

  get speedMul() {
    const force = Math.max(this.speedForce, this.steerForce);
    return 1 + force * (SHIELD.steerMaxMul - 1);
  }

  get speedLabel() {
    return `x${this.speedMul.toFixed(1)}`;
  }

  get aimingWithPointer() {
    return this.pointerActive && performance.now() - this.pointerStamp < 280;
  }

  rotateIntent() {
    let dir = 0;
    if (this.keys.has("arrowleft") || this.keys.has("a")) dir -= 1;
    if (this.keys.has("arrowright") || this.keys.has("d")) dir += 1;
    dir += this.steerHold;
    return clamp(dir, -1, 1);
  }

  _syncSteerHold() {
    let dir = 0;
    for (const v of this._steerIds.values()) dir += v;
    this.steerHold = clamp(dir, -1, 1);
    this._leftBtn?.classList.toggle("is-held", this.steerHold < 0);
    this._rightBtn?.classList.toggle("is-held", this.steerHold > 0);
    if (this._steerIds.size === 0) {
      this.steerForce = 0;
      this._paintSpeed();
    }
  }

  _pressForce(e, btn) {
    let force = 0.22;
    const size = Math.max(e.width || 0, e.height || 0);
    if (size > 18) force = Math.max(force, clamp((size - 16) / 52, 0, 1));
    const p = e.pressure;
    if (typeof p === "number" && p > 0 && (p < 0.42 || p > 0.58)) {
      force = Math.max(force, p);
    } else if (p >= 0.95) {
      force = Math.max(force, 1);
    }
    if (this._speedId != null && this._speedOriginY) {
      const lift = clamp((this._speedOriginY - e.clientY) / 56, 0, 1);
      force = Math.max(force, 0.22 + lift * 0.78);
    } else if (btn) {
      const r = btn.getBoundingClientRect();
      if (r.height > 0) {
        const fromBottom = clamp((r.bottom - e.clientY) / r.height, 0, 1);
        force = Math.max(force, fromBottom * 0.85);
      }
    }
    return clamp(force, 0, 1);
  }

  _paintSpeed() {
    const mul = this.speedMul;
    const force = Math.max(this.speedForce, this.steerForce);
    if (this._speedBtn) {
      this._speedBtn.style.setProperty("--force", String(force));
      this._speedBtn.classList.toggle("is-held", this._speedId != null);
      this._speedBtn.classList.toggle("is-fast", mul >= 4 && mul < 7.5);
      this._speedBtn.classList.toggle("is-max", mul >= 7.5);
    }
    if (this._speedValue) this._speedValue.textContent = `x${mul.toFixed(1)}`;
  }

  _onSteerDown(e) {
    if (e.button != null && e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const dir = e.currentTarget.id === "steer-left" ? -1 : 1;
    this._steerIds.set(e.pointerId, dir);
    this._forceBtn = e.currentTarget;
    this.steerForce = this._pressForce(e, e.currentTarget);
    this._syncSteerHold();
    this._paintSpeed();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  }

  _onSteerUp(e) {
    if (!this._steerIds.has(e.pointerId)) return;
    this._steerIds.delete(e.pointerId);
    if (this._forceBtn && e.currentTarget === this._forceBtn) this._forceBtn = null;
    this._syncSteerHold();
  }

  _onSpeedDown(e) {
    if (e.button != null && e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    this._speedId = e.pointerId;
    this._speedOriginY = e.clientY;
    this.speedForce = this._pressForce(e, this._speedBtn);
    this._paintSpeed();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  }

  _onSpeedUp(e) {
    if (this._speedId !== e.pointerId) return;
    this._speedId = null;
    this._speedOriginY = 0;
    this.speedForce = 0;
    this._paintSpeed();
  }

  _preventScroll(e) {
    if (e.target.closest && e.target.closest("input, button, .screen")) return;
    e.preventDefault();
  }

  _onTouchMove(e) {
    e.preventDefault();
  }

  _onKeyDown(e) {
    const key = e.key.toLowerCase();
    if (["arrowleft", "arrowright", " ", "spacebar"].includes(key) || key === "a" || key === "d") {
      e.preventDefault();
    }
    this.keys.add(key);
    const tag = (e.target && e.target.tagName) || "";
    if ((key === " " || key === "spacebar") && tag !== "BUTTON") this.burstQueued = true;
    if (key === "escape" || key === "p") this.pauseQueued = true;
    if (key === "enter" && tag !== "BUTTON" && tag !== "INPUT") this.confirmQueued = true;
    if (key === "shift") {
      this.speedForce = Math.max(this.speedForce, 0.85);
      this._paintSpeed();
    }
  }

  _onKeyUp(e) {
    const key = e.key.toLowerCase();
    this.keys.delete(key);
    if (key === "shift" && this._speedId == null) {
      this.speedForce = 0;
      this._paintSpeed();
    }
  }

  _setAngleFromEvent(e) {
    const center = this.getCenter();
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    this.pointerAngle = wrapAngle(Math.atan2(y - center.cy, x - center.cx));
    this.pointerActive = true;
    this.pointerStamp = performance.now();
  }

  _onPointerDown(e) {
    if (e.target.closest && e.target.closest("button, input, .screen, .steer-pad, .combat-dock")) return;
    this._lastPointerId = e.pointerId;
    if (e.pointerType === "mouse") {
      this._setAngleFromEvent(e);
      try {
        this.canvas.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      return;
    }
    this._touchId = e.pointerId;
    this._lastTouchX = e.clientX;
    this.pointerActive = false;
    try {
      this.canvas.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  }

  _onPointerMove(e) {
    if (this._speedId === e.pointerId) {
      this.speedForce = this._pressForce(e, this._speedBtn);
      this._paintSpeed();
      return;
    }
    if (this._steerIds.has(e.pointerId)) {
      this.steerForce = this._pressForce(e, this._forceBtn);
      this._paintSpeed();
      return;
    }
    if (e.pointerType === "mouse") {
      this._setAngleFromEvent(e);
      return;
    }
    if (this._touchId !== e.pointerId) return;
    this.steerYaw += (e.clientX - this._lastTouchX) * SHIELD.touchSteerPerPx;
    this._lastTouchX = e.clientX;
  }

  _onPointerUp(e) {
    if (this._lastPointerId === e.pointerId) this._lastPointerId = null;
    if (this._touchId === e.pointerId) this._touchId = null;
    if (this._speedId === e.pointerId) this._onSpeedUp(e);
    if (this._steerIds.has(e.pointerId)) this._onSteerUp(e);
  }
}
