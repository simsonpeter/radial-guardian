/**
 * DOM screens and HUD. Gameplay pixels stay on the canvas.
 */

import { formatScore, formatTime } from "./utils.js";
import { ADS, STORAGE_KEYS } from "./config.js";

export class UI {
  constructor(audio) {
    this.audio = audio;
    this.root = document.getElementById("app");
    this.hud = document.getElementById("hud");
    this.scoreEl = document.getElementById("hud-score");
    this.comboEl = document.getElementById("hud-combo");
    this.timeEl = document.getElementById("hud-time");
    this.energyFill = document.getElementById("hud-energy-fill");
    this.energyLabel = document.getElementById("hud-energy-value");
    this.stageEl = document.getElementById("hud-stage");
    this.burstBtn = document.getElementById("burst-btn");
    this.burstCd = document.getElementById("burst-cd");
    this.toast = document.getElementById("toast");
    this.startScreen = document.getElementById("screen-start");
    this.pauseScreen = document.getElementById("screen-pause");
    this.overScreen = document.getElementById("screen-over");
    this.highScoreEls = document.querySelectorAll("[data-highscore]");
    this.muteBtn = document.getElementById("mute-btn");
    this.volume = document.getElementById("volume");
    this.motion = document.getElementById("reduced-motion");
    this.comboPop = 0;
    this._toastTimer = 0;
    this.onPlay = null;
    this.onResume = null;
    this.onRestart = null;
    this.onMenu = null;
    this.onBurst = null;
    this.onContinueAd = null;
    this.onMuteChange = null;
    this.reducedMotion = storageGet(STORAGE_KEYS.reducedMotion) === "1";

    this._bind();
    this.syncAudioControls();
    this.setHighScore(Number(storageGet(STORAGE_KEYS.highScore) || 0));
  }

  _bind() {
    document.getElementById("btn-play").addEventListener("click", () => {
      this.audio.unlock();
      this.audio.click();
      this.onPlay?.();
    });
    document.getElementById("btn-continue").addEventListener("click", () => {
      this.audio.click();
      this.onResume?.();
    });
    document.getElementById("btn-restart").addEventListener("click", () => {
      this.audio.click();
      this.onRestart?.();
    });
    document.getElementById("btn-pause-menu").addEventListener("click", () => {
      this.audio.click();
      this.onMenu?.();
    });
    document.getElementById("btn-again").addEventListener("click", () => {
      this.audio.click();
      this.onRestart?.();
    });
    document.getElementById("btn-over-menu").addEventListener("click", () => {
      this.audio.click();
      this.onMenu?.();
    });
    document.getElementById("btn-continue-ad").addEventListener("click", () => {
      this.audio.unlock();
      this.audio.click();
      this.onContinueAd?.();
    });
    this.burstBtn.addEventListener("click", (e) => {
      e.preventDefault();
      this.audio.unlock();
      this.onBurst?.();
    });
    this.muteBtn.addEventListener("click", () => {
      this.audio.unlock();
      const muted = this.audio.toggleMute();
      this.audio.click();
      this.syncAudioControls();
      this.muteBtn.setAttribute("aria-pressed", muted ? "true" : "false");
      this.onMuteChange?.(muted);
    });
    this.volume.addEventListener("input", () => {
      this.audio.unlock();
      this.audio.setVolume(parseFloat(this.volume.value));
    });
    this.motion.addEventListener("change", () => {
      this.reducedMotion = this.motion.checked;
      storageSet(STORAGE_KEYS.reducedMotion, this.reducedMotion ? "1" : "0");
    });
    this.motion.checked = this.reducedMotion;
  }

  syncAudioControls() {
    this.muteBtn.textContent = this.audio.muted ? "SOUND OFF" : "SOUND ON";
    this.muteBtn.classList.toggle("is-muted", this.audio.muted);
    this.volume.value = String(this.audio.volume);
  }

  setHighScore(value) {
    const text = formatScore(value);
    this.highScoreEls.forEach((el) => {
      el.textContent = text;
    });
  }

  showScreen(name) {
    const map = {
      start: this.startScreen,
      pause: this.pauseScreen,
      over: this.overScreen,
    };
    for (const [key, el] of Object.entries(map)) {
      el.classList.toggle("hidden", key !== name);
    }
    this.hud.classList.toggle("hidden", name !== null && name !== "pause");
    if (name === "pause") this.hud.classList.remove("hidden");
    if (name === "start" || name === "over") this.hud.classList.add("hidden");
    this.burstBtn.classList.toggle("hidden", name !== null && name !== "pause");
    if (name === "start" || name === "over") this.burstBtn.classList.add("hidden");
    if (name === null) {
      this.startScreen.classList.add("hidden");
      this.pauseScreen.classList.add("hidden");
      this.overScreen.classList.add("hidden");
      this.hud.classList.remove("hidden");
      this.burstBtn.classList.remove("hidden");
    }
  }

  showPlaying() {
    this.showScreen(null);
  }

  updateHud(stats) {
    this.scoreEl.textContent = formatScore(stats.score);
    this.timeEl.textContent = formatTime(stats.time);
    this.stageEl.textContent = stats.stageLabel;
    this.energyFill.style.width = `${Math.max(0, stats.energy)}%`;
    this.energyFill.classList.toggle("is-low", stats.energy < 34);
    this.energyLabel.textContent = `${Math.round(stats.energy)}%`;
    const combo = Math.max(1, Math.floor(stats.combo));
    this.comboEl.textContent = `COMBO ×${combo}`;
    this.comboEl.classList.toggle("is-hot", combo >= 3);
    this.comboEl.classList.toggle("is-max", combo >= 6);
    this.comboEl.classList.toggle("is-pop", Boolean(stats.comboPop));
    const cd = stats.burstCooldownNorm;
    this.burstBtn.classList.toggle("is-ready", cd <= 0);
    this.burstCd.style.setProperty("--cd", String(cd));
    this.burstBtn.setAttribute("aria-disabled", cd > 0 ? "true" : "false");
  }

  showGameOver(stats) {
    document.getElementById("over-score").textContent = formatScore(stats.score);
    document.getElementById("over-best").textContent = formatScore(stats.best);
    document.getElementById("over-time").textContent = formatTime(stats.time);
    document.getElementById("over-deflects").textContent = String(stats.deflections);
    document.getElementById("over-chains").textContent = String(stats.chains);
    this.setHighScore(stats.best);
    const canContinue = Boolean(stats.canContinue);
    const continueBtn = document.getElementById("btn-continue-ad");
    const againBtn = document.getElementById("btn-again");
    const hint = document.getElementById("ad-hint");
    continueBtn.classList.toggle("hidden", !canContinue);
    hint.classList.toggle("hidden", !canContinue);
    hint.textContent = `Restore ${Math.round(ADS.energyRestore)}% shield energy and keep this run.`;
    againBtn.classList.toggle("primary-btn", !canContinue);
    againBtn.classList.toggle("secondary-btn", canContinue);
    this.setContinueBusy(false);
    this.showScreen("over");
  }

  dimForAd() {
    this.startScreen.classList.add("hidden");
    this.pauseScreen.classList.add("hidden");
    this.overScreen.classList.add("hidden");
    this.hud.classList.add("hidden");
    this.burstBtn.classList.add("hidden");
  }

  setContinueBusy(busy) {
    const btn = document.getElementById("btn-continue-ad");
    btn.disabled = busy;
    btn.textContent = busy ? "LOADING AD…" : "WATCH AD · RESTORE CORE";
  }

  toastMessage(text) {
    this.toast.textContent = text;
    this.toast.classList.add("show");
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => this.toast.classList.remove("show"), 1600);
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
