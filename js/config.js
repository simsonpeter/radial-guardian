/**
 * Radial Defense — tunables and shared constants.
 * Keep gameplay numbers here so systems stay easy to extend.
 */

export const STORAGE_KEYS = {
  highScore: "radialDefense.highScore",
  muted: "radialDefense.muted",
  volume: "radialDefense.volume",
  reducedMotion: "radialDefense.reducedMotion",
};

export const ENERGY_COLORS = {
  cyan: { id: "cyan", hex: "#00f3ff", rgb: [0, 243, 255] },
  magenta: { id: "magenta", hex: "#ff2bd6", rgb: [255, 43, 214] },
  yellow: { id: "yellow", hex: "#ffe14a", rgb: [255, 225, 74] },
  green: { id: "green", hex: "#39ff88", rgb: [57, 255, 136] },
  red: { id: "red", hex: "#ff3b4e", rgb: [255, 59, 78] },
};

export const COLOR_ORDER = ["cyan", "magenta", "yellow", "green", "red"];

export const GAME = {
  /** Logical target frame time used only as a clamp ceiling. */
  maxDt: 1 / 30,
  hitStopDuration: 0.045,
  comboDecayDelay: 3.2,
  comboDecayPerSecond: 1.15,
  stageInterval: 15,
  maxStage: 9,
};

export const SCORE = {
  deflection: 10,
  chainBase: 25,
  eliteBonus: 40,
};

export const SHIELD = {
  energyMax: 100,
  energyMinGameOver: 0,
  /** Fraction of arena radius. */
  radiusMaxFrac: 0.33,
  radiusMinFrac: 0.155,
  baseArc: 0.72,
  minArc: 0.38,
  thicknessFrac: 0.028,
  rotateSpeed: 3.35,
  pointerLerp: 18,
  coreHitDamage: 9,
  eliteHitDamage: 16,
  mismatchDamage: 6,
  chainHeal: 1.6,
  burstDuration: 0.42,
  burstCooldown: 7.4,
  burstArcScale: 2.15,
  burstRadiusBoostFrac: 0.045,
  burstDeflectPaddingFrac: 0.06,
};

export const CORE = {
  radiusFrac: 0.086,
  hitRadiusPad: 1.15,
};

export const PROJECTILE = {
  radiusFrac: 0.0185,
  eliteRadiusFrac: 0.028,
  spawnPadFrac: 0.1,
  trailMax: 10,
  deflectBoost: 1.38,
  deflectSpread: 0.2,
  maxAlive: 48,
  chainHitRadiusScale: 1.08,
};

export const PARTICLES = {
  poolSize: 520,
  floatTextPool: 48,
};

export const DIFFICULTY = {
  /** Stage 1 baseline. Speeds are arena-radii per second. */
  baseSpeed: 0.28,
  maxSpeed: 0.78,
  baseSpawn: 1.35,
  minSpawn: 0.42,
  stageSpeedStep: 0.055,
  stageSpawnStep: 0.11,
};

/**
 * Compute layout from the current viewport so the circular arena
 * never stretches and remains playable on phones and ultrawides.
 */
export function computeLayout(width, height) {
  const cx = width * 0.5;
  const cy = height * 0.5;
  const shortest = Math.min(width, height);
  const arena = shortest * 0.44;
  return {
    width,
    height,
    cx,
    cy,
    arena,
    coreRadius: arena * CORE.radiusFrac,
    shieldRadiusMax: arena * SHIELD.radiusMaxFrac,
    shieldRadiusMin: arena * SHIELD.radiusMinFrac,
    shieldThickness: Math.max(8, arena * SHIELD.thicknessFrac),
    projectileRadius: Math.max(5.5, arena * PROJECTILE.radiusFrac),
    eliteRadius: Math.max(8, arena * PROJECTILE.eliteRadiusFrac),
    spawnRadius: arena * (1 + PROJECTILE.spawnPadFrac),
    burstPadding: arena * SHIELD.burstDeflectPaddingFrac,
    burstRadiusBoost: arena * SHIELD.burstRadiusBoostFrac,
  };
}

export function colorsForStage(stage) {
  if (stage <= 1) return [ENERGY_COLORS.cyan];
  if (stage === 2) return [ENERGY_COLORS.cyan, ENERGY_COLORS.magenta];
  if (stage === 3) {
    return [ENERGY_COLORS.cyan, ENERGY_COLORS.magenta, ENERGY_COLORS.yellow];
  }
  if (stage === 4) {
    return [
      ENERGY_COLORS.cyan,
      ENERGY_COLORS.magenta,
      ENERGY_COLORS.yellow,
      ENERGY_COLORS.green,
    ];
  }
  return COLOR_ORDER.map((id) => ENERGY_COLORS[id]);
}

export function stageLabel(stage) {
  return `STAGE ${stage}`;
}
