/**
 * Procedural SFX via the Web Audio API — no audio files required.
 */

import { STORAGE_KEYS } from "./config.js";

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.sfx = null;
    this.unlocked = false;
    this.muted = storageGet(STORAGE_KEYS.muted) === "1";
    const storedVolume = parseFloat(storageGet(STORAGE_KEYS.volume));
    this.volume = Number.isFinite(storedVolume) ? storedVolume : 0.5;
    this._warnLoop = 0;
  }

  unlock() {
    if (!this.ctx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.sfx = this.ctx.createGain();
      this.sfx.connect(this.master);
      this.master.connect(this.ctx.destination);
      this._applyGain();
    }
    if (this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {});
    }
    this.unlocked = true;
  }

  setMuted(muted) {
    this.muted = muted;
    storageSet(STORAGE_KEYS.muted, muted ? "1" : "0");
    this._applyGain();
  }

  toggleMute() {
    this.setMuted(!this.muted);
    return this.muted;
  }

  setVolume(volume) {
    this.volume = Math.max(0, Math.min(1, volume));
    storageSet(STORAGE_KEYS.volume, String(this.volume));
    this._applyGain();
  }

  _applyGain() {
    if (!this.master) return;
    this.master.gain.value = this.muted ? 0 : this.volume;
  }

  _env(duration, peak = 0.2, attack = 0.006) {
    if (!this.ctx) return null;
    const gain = this.ctx.createGain();
    const t = this.ctx.currentTime;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(peak, t + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    gain.connect(this.sfx);
    return { gain, t };
  }

  _osc(type, freq, duration, peak, attack) {
    if (!this.unlocked || !this.ctx) return;
    const env = this._env(duration, peak, attack);
    if (!env) return;
    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, env.t);
    osc.connect(env.gain);
    osc.start(env.t);
    osc.stop(env.t + duration + 0.02);
  }

  _noise(duration, peak, filterFreq) {
    if (!this.unlocked || !this.ctx) return;
    const length = Math.max(1, Math.floor(this.ctx.sampleRate * duration));
    const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = filterFreq;
    filter.Q.value = 0.8;
    const env = this._env(duration, peak, 0.004);
    if (!env) return;
    src.connect(filter);
    filter.connect(env.gain);
    src.start(env.t);
    src.stop(env.t + duration + 0.02);
  }

  click() {
    this._osc("square", 880, 0.05, 0.07, 0.002);
    this._osc("sine", 1320, 0.04, 0.04, 0.002);
  }

  spawn() {
    this._osc("sine", 640 + Math.random() * 80, 0.06, 0.04, 0.002);
  }

  deflect() {
    this._noise(0.07, 0.1, 1800);
    this._osc("triangle", 420, 0.09, 0.12, 0.002);
    this._osc("sine", 880, 0.07, 0.06, 0.002);
  }

  chain(combo) {
    const base = 380 + Math.min(8, combo) * 36;
    this._osc("sawtooth", base, 0.14, 0.1, 0.004);
    this._osc("sine", base * 2, 0.16, 0.08, 0.004);
    this._osc("triangle", base * 3, 0.12, 0.05, 0.004);
    this._noise(0.1, 0.08, 2400);
  }

  comboUp(combo) {
    this._osc("square", 520 + combo * 40, 0.1, 0.08, 0.003);
    this._osc("sine", 780 + combo * 55, 0.12, 0.07, 0.003);
  }

  mismatch() {
    this._osc("sawtooth", 180, 0.18, 0.12, 0.004);
    this._osc("square", 110, 0.16, 0.08, 0.004);
    this._noise(0.14, 0.1, 400);
  }

  coreHit() {
    this._osc("triangle", 90, 0.28, 0.16, 0.006);
    this._noise(0.2, 0.12, 280);
  }

  warning() {
    this._osc("square", 240, 0.12, 0.08, 0.003);
    this._osc("square", 180, 0.16, 0.06, 0.003);
  }

  burst() {
    this._noise(0.18, 0.14, 900);
    this._osc("sine", 160, 0.22, 0.12, 0.006);
    this._osc("triangle", 480, 0.16, 0.08, 0.004);
  }

  gameOver() {
    if (!this.unlocked || !this.ctx) return;
    const notes = [330, 247, 196, 147, 110];
    notes.forEach((freq, i) => {
      const env = this._env(0.28, 0.1, 0.01);
      if (!env) return;
      const osc = this.ctx.createOscillator();
      osc.type = "sawtooth";
      const t = env.t + i * 0.16;
      osc.frequency.setValueAtTime(freq, t);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.12, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.32);
      osc.connect(g);
      g.connect(this.sfx);
      osc.start(t);
      osc.stop(t + 0.34);
    });
  }

  stageUp() {
    this._osc("sine", 520, 0.12, 0.08, 0.004);
    this._osc("sine", 780, 0.14, 0.07, 0.004);
    this._osc("sine", 1040, 0.16, 0.06, 0.004);
  }
}

function storageGet(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function storageSet(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}
