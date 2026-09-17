/**
 * Branded boot splash: logo, Jayathasoft credit, 5s themed load bar.
 */

export const SPLASH_DURATION_MS = 5000;

export function runSplash() {
  const screen = document.getElementById("screen-splash");
  const fill = document.getElementById("splash-fill");
  const pct = document.getElementById("splash-pct");
  if (!screen || !fill || !pct) return Promise.resolve();

  return new Promise((resolve) => {
    const started = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - started) / SPLASH_DURATION_MS);
      fill.style.width = `${t * 100}%`;
      pct.textContent = `${Math.round(t * 100)}%`;
      if (t < 1) {
        requestAnimationFrame(tick);
        return;
      }
      screen.classList.add("is-done");
      window.setTimeout(() => {
        screen.classList.add("hidden");
        document.body.classList.remove("is-booting");
        resolve();
      }, 420);
    };
    requestAnimationFrame(tick);
  });
}
