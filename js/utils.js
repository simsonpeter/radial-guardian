/** Angle and numeric helpers used by collision and movement math. */

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function rand(min, max) {
  return min + Math.random() * (max - min);
}

export function randChoice(list) {
  return list[(Math.random() * list.length) | 0];
}

/** Wrap an angle into (-PI, PI]. */
export function wrapAngle(angle) {
  let a = angle;
  while (a > Math.PI) a -= Math.PI * 2;
  while (a <= -Math.PI) a += Math.PI * 2;
  return a;
}

/** Signed shortest angular distance from a to b. */
export function angleDelta(from, to) {
  return wrapAngle(to - from);
}

export function absAngleDelta(a, b) {
  return Math.abs(angleDelta(a, b));
}

export function hypot2(x, y) {
  return x * x + y * y;
}

export function formatTime(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}

export function formatScore(n) {
  return Math.floor(n).toLocaleString("en-US");
}

export function rgb(color, alpha = 1) {
  return `rgba(${color.rgb[0]}, ${color.rgb[1]}, ${color.rgb[2]}, ${alpha})`;
}

export function nowMs() {
  return performance.now();
}
