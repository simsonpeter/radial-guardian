/**
 * Rewarded ads for extra-life continues.
 * Uses Google H5 Games Ad Placement when ADS.client is set,
 * otherwise a local preview overlay so the continue flow works offline.
 */

import { ADS } from "./config.js";

export class AdService {
  constructor() {
    this._adBreak = null;
    this._adConfig = null;
    this._overlay = null;
    this._status = null;
    this._fill = null;
    this._simRaf = 0;
    this._busy = false;
  }

  init({ muted = false } = {}) {
    this._overlay = document.getElementById("screen-ad");
    this._status = document.getElementById("ad-status");
    this._fill = document.getElementById("ad-progress-fill");
    if (ADS.client) this._loadPlacementApi(muted);
  }

  setSound(on) {
    this._adConfig?.({ sound: on ? "on" : "off" });
  }

  /**
   * @returns {Promise<boolean>} true when the player earned the reward
   */
  showRewarded() {
    if (this._busy) return Promise.resolve(false);
    this._busy = true;
    const finish = (ok) => {
      this._busy = false;
      this._hideOverlay();
      return ok;
    };

    if (ADS.client && this._adBreak) {
      return this._showPlacementReward().then(finish);
    }
    return this._showPreview().then(finish);
  }

  _loadPlacementApi(muted) {
    window.adsbygoogle = window.adsbygoogle || [];
    const push = (o) => {
      window.adsbygoogle.push(o);
    };
    this._adBreak = (o) => push(o);
    this._adConfig = (o) => push(o);

    const script = document.createElement("script");
    script.async = true;
    script.crossOrigin = "anonymous";
    script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(ADS.client)}`;
    script.dataset.adFrequencyHint = "30s";
    script.onload = () => {
      this._adConfig({
        preloadAdBreaks: "on",
        sound: muted ? "off" : "on",
      });
    };
    document.head.appendChild(script);
  }

  _showPlacementReward() {
    return new Promise((resolve) => {
      let settled = false;
      let started = false;
      const done = (ok) => {
        if (settled) return;
        settled = true;
        resolve(ok);
      };

      this._showOverlay();
      if (this._status) this._status.textContent = "Finding a sponsored message…";
      if (this._fill) this._fill.style.width = "12%";

      this._adBreak({
        type: "reward",
        name: "restore-core",
        beforeAd: () => {
          started = true;
          this._hideOverlay();
        },
        beforeReward: (showAdFn) => showAdFn(),
        adViewed: () => done(true),
        adDismissed: () => done(false),
        adBreakDone: (info) => {
          done(info?.breakStatus === "viewed");
        },
      });

      window.setTimeout(() => {
        if (!started) done(false);
      }, 8000);
    });
  }

  _showPreview() {
    return new Promise((resolve) => {
      this._showOverlay();
      const duration = Math.max(1.5, ADS.previewDuration) * 1000;
      const started = performance.now();

      const tick = (now) => {
        const t = Math.min(1, (now - started) / duration);
        if (this._fill) this._fill.style.width = `${t * 100}%`;
        if (this._status) {
          const left = Math.max(0, Math.ceil((duration - (now - started)) / 1000));
          this._status.textContent =
            t >= 1 ? "Reward unlocked" : `Sponsored message · ${left}s`;
        }
        if (t >= 1) {
          this._simRaf = 0;
          resolve(true);
          return;
        }
        this._simRaf = requestAnimationFrame(tick);
      };
      this._simRaf = requestAnimationFrame(tick);
    });
  }

  _showOverlay() {
    if (this._fill) this._fill.style.width = "0%";
    if (this._status) this._status.textContent = "Preparing sponsored message…";
    this._overlay?.classList.remove("hidden");
  }

  _hideOverlay() {
    if (this._simRaf) {
      cancelAnimationFrame(this._simRaf);
      this._simRaf = 0;
    }
    this._overlay?.classList.add("hidden");
  }
}
