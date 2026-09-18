/**
 * DOM screens and HUD. Gameplay pixels stay on the canvas.
 */

import { formatScore, formatTime } from "./utils.js";
import { COINS, packCost, STORAGE_KEYS } from "./config.js";

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
    this.burstLabel = this.burstBtn.querySelector("strong");
    this.burstCd = document.getElementById("burst-cd");
    this.combatDock = document.getElementById("combat-dock");
    this.steerPad = document.getElementById("steer-pad");
    this.speedBtn = document.getElementById("speed-btn");
    this.speedValue = document.getElementById("speed-value");
    this.toast = document.getElementById("toast");
    this.startScreen = document.getElementById("screen-start");
    this.pauseScreen = document.getElementById("screen-pause");
    this.overScreen = document.getElementById("screen-over");
    this.shopScreen = document.getElementById("screen-shop");
    this.shopPacks = document.getElementById("shop-packs");
    this.highScoreEls = document.querySelectorAll("[data-highscore]");
    this.coinEls = document.querySelectorAll("[data-coins]");
    this.hudCoins = document.getElementById("hud-coins");
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
    this.onOpenShop = null;
    this.onBuyPack = null;
    this.onShopAd = null;
    this.onShopBack = null;
    this.onMuteChange = null;
    this.reducedMotion = storageGet(STORAGE_KEYS.reducedMotion) === "1";

    this._bind();
    this.syncAudioControls();
    this.setHighScore(Number(storageGet(STORAGE_KEYS.highScore) || 0));
    this.setCoins(Number(storageGet(STORAGE_KEYS.coins) || 0));
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
    document.getElementById("btn-pause-shop").addEventListener("click", () => {
      this.audio.click();
      this.onOpenShop?.("pause");
    });
    document.getElementById("btn-over-shop").addEventListener("click", () => {
      this.audio.click();
      this.onOpenShop?.("over");
    });
    document.getElementById("btn-shop-back").addEventListener("click", () => {
      this.audio.click();
      this.onShopBack?.();
    });
    document.getElementById("btn-shop-ad").addEventListener("click", () => {
      this.audio.unlock();
      this.audio.click();
      this.onShopAd?.();
    });
    this.shopPacks.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-pack]");
      if (!btn || btn.disabled) return;
      this.audio.unlock();
      this.audio.click();
      this.onBuyPack?.(btn.dataset.pack);
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
      shop: this.shopScreen,
    };
    for (const [key, el] of Object.entries(map)) {
      el.classList.toggle("hidden", key !== name);
    }
    this.hud.classList.toggle("hidden", name !== null && name !== "pause");
    if (name === "pause") this.hud.classList.remove("hidden");
    if (name === "start" || name === "over") this.hud.classList.add("hidden");
    this._setCombatControls(name === null || name === "pause");
    if (name === null) {
      this.startScreen.classList.add("hidden");
      this.pauseScreen.classList.add("hidden");
      this.overScreen.classList.add("hidden");
      this.hud.classList.remove("hidden");
      this._setCombatControls(true);
    }
  }

  _setCombatControls(visible) {
    this.combatDock?.classList.toggle("hidden", !visible);
  }

  setSpeedLabel(label) {
    if (this.speedValue) this.speedValue.textContent = label;
    this.speedBtn?.setAttribute("aria-label", `Spin speed ${label}`);
    this.speedBtn?.classList.toggle("is-fast", label === "x2");
    this.speedBtn?.classList.toggle("is-max", label === "x3");
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
    const powerId = stats.powerId || "burst";
    const powerLabel = stats.powerLabel || "BURST";
    this.burstBtn.classList.toggle("is-ready", cd <= 0);
    this.burstBtn.classList.toggle("is-grow", powerId === "grow");
    this.burstBtn.classList.toggle("is-shot", powerId === "shot");
    this.burstBtn.classList.toggle("is-spin", powerId === "spin");
    this.burstCd.style.setProperty("--cd", String(cd));
    this.burstBtn.setAttribute("aria-disabled", cd > 0 ? "true" : "false");
    this.burstBtn.setAttribute("aria-label", `Shield ${powerLabel}`);
    if (this.burstLabel) this.burstLabel.textContent = powerLabel;
    if (stats.coins != null) this.setCoins(stats.coins);
  }

  setCoins(value) {
    const n = Math.max(0, Math.floor(value));
    const text = String(n);
    this.coinEls.forEach((el) => {
      el.textContent = text;
    });
    if (this.hudCoins) this.hudCoins.textContent = `◎ ${text}`;
    const shopCoins = document.getElementById("shop-coins");
    if (shopCoins) shopCoins.textContent = text;
  }

  showGameOver(stats) {
    document.getElementById("over-score").textContent = formatScore(stats.score);
    document.getElementById("over-best").textContent = formatScore(stats.best);
    document.getElementById("over-time").textContent = formatTime(stats.time);
    document.getElementById("over-deflects").textContent = String(stats.deflections);
    document.getElementById("over-chains").textContent = String(stats.chains);
    this.setHighScore(stats.best);
    this.setCoins(stats.coins ?? 0);
    const canContinue = Boolean(stats.canContinue);
    const energy = Math.round(stats.energyRestore || 0);
    this._continueEnergy = energy;
    const continueBtn = document.getElementById("btn-continue-ad");
    const againBtn = document.getElementById("btn-again");
    const hint = document.getElementById("ad-hint");
    const subtitle = document.querySelector("#screen-over .subtitle");
    continueBtn.classList.toggle("hidden", !canContinue);
    hint.classList.toggle("hidden", !canContinue);
    againBtn.classList.toggle("primary-btn", !canContinue);
    againBtn.classList.toggle("secondary-btn", canContinue);
    if (canContinue) {
      subtitle.textContent = "The core destabilized. Repair with coins or watch an ad to keep this run.";
      if (energy <= 10) {
        hint.textContent = `Last ad continue — restores ${energy}%. After this you must restart.`;
      } else if (stats.continuesUsed) {
        hint.textContent = `Optional — next ad restores ${energy}%. Each later ad is 10% less.`;
      } else {
        hint.textContent = `Optional — first ad restores ${energy}%, then 80%, 70%… down to 10%.`;
      }
    } else {
      subtitle.textContent = "Ad continues are spent. Repair with coins, or restart.";
    }
    this.setContinueBusy(false);
    this.showScreen("over");
  }

  showShop(stats) {
    this.renderShop(stats);
    this.showScreen("shop");
  }

  renderShop(stats) {
    const energy = Math.max(0, Math.round(stats.energy || 0));
    const coins = Math.max(0, Math.floor(stats.coins || 0));
    const repairs = stats.repairsUsed || 0;
    const adsLeft = Math.max(0, COINS.adMaxPerRun - (stats.adHealsUsed || 0));
    const full = energy >= 100;
    const wiped = Boolean(stats.wiped);
    document.getElementById("shop-energy").textContent = `${energy}%`;
    this.setCoins(coins);

    this.shopPacks.innerHTML = "";
    for (const pack of COINS.packs) {
      const cost = packCost(pack, repairs);
      const canPay = coins >= cost;
      const useful = wiped || energy + 5 < 100;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "shop-pack";
      btn.dataset.pack = pack.id;
      btn.disabled = !canPay || !useful;
      btn.innerHTML = `<span class="shop-pack-name">${pack.label}</span><span class="shop-pack-energy">+${pack.energy}% ENERGY</span><span class="shop-pack-cost">${canPay ? `${cost} ◎` : useful ? `NEED ${cost} ◎` : "SHIELD FULL"}</span>`;
      this.shopPacks.appendChild(btn);
    }

    const adBtn = document.getElementById("btn-shop-ad");
    const hint = document.getElementById("shop-ad-hint");
    const adUseful = wiped || energy + 5 < 100;
    adBtn.disabled = adsLeft <= 0 || !adUseful;
    adBtn.textContent = adsLeft <= 0 ? "NO AD REPAIRS LEFT" : `WATCH AD · +${COINS.adEnergy}% ENERGY`;
    hint.textContent = adsLeft <= 0
      ? "Ad repairs are spent for this run. Use coins or the game-over continue ad."
      : `${adsLeft} ad repair${adsLeft === 1 ? "" : "s"} left this run. Ads do not spend coins.`;
  }

  setShopBusy(busy) {
    document.getElementById("btn-shop-ad").disabled = busy;
    this.shopPacks.querySelectorAll("button").forEach((btn) => {
      btn.disabled = busy || btn.disabled;
    });
    if (busy) document.getElementById("btn-shop-ad").textContent = "LOADING AD…";
  }

  dimForAd() {
    this.startScreen.classList.add("hidden");
    this.pauseScreen.classList.add("hidden");
    this.overScreen.classList.add("hidden");
    this.shopScreen?.classList.add("hidden");
    this.hud.classList.add("hidden");
    this._setCombatControls(false);
  }

  setContinueBusy(busy) {
    const btn = document.getElementById("btn-continue-ad");
    btn.disabled = busy;
    const pct = Math.round(this._continueEnergy || 90);
    btn.textContent = busy ? "LOADING AD…" : `WATCH AD · +${pct}% ENERGY`;
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
