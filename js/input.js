/**
 * Unified pointer / keyboard / touch input.
 * Touch drags around the arena center set the shield angle.
 */

import { wrapAngle } from "./utils.js";

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
    this._lastPointerId = null;

    this._onKeyDown = this._onKeyDown.bind(this);
    this._onKeyUp = this._onKeyUp.bind(this);
    this._onPointerDown = this._onPointerDown.bind(this);
    this._onPointerMove = this._onPointerMove.bind(this);
    this._onPointerUp = this._onPointerUp.bind(this);
    this._onContext = (e) => e.preventDefault();
    this._onTouchMove = this._onTouchMove.bind(this);
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

  get aimingWithPointer() {
    return this.pointerActive && performance.now() - this.pointerStamp < 280;
  }

  rotateIntent() {
    let dir = 0;
    if (this.keys.has("arrowleft") || this.keys.has("a")) dir -= 1;
    if (this.keys.has("arrowright") || this.keys.has("d")) dir += 1;
    return dir;
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
  }

  _onKeyUp(e) {
    this.keys.delete(e.key.toLowerCase());
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
    if (e.target.closest && e.target.closest("button, input, .screen")) return;
    this._lastPointerId = e.pointerId;
    this._setAngleFromEvent(e);
    try {
      this.canvas.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  }

  _onPointerMove(e) {
    if (e.pointerType === "mouse") {
      this._setAngleFromEvent(e);
      return;
    }
    if (this._lastPointerId === e.pointerId) {
      this._setAngleFromEvent(e);
    }
  }

  _onPointerUp(e) {
    if (this._lastPointerId === e.pointerId) this._lastPointerId = null;
  }
}
