/**
 * Steady-state road cycling power model after Martin, Milliken, Cobb, McFadden
 * and Coggan (1998), "Validation of a mathematical model for road cycling
 * power", Journal of Applied Biomechanics 14(3):276–291.
 *
 *   P_pedals = (P_aero + P_rolling + P_gravity + P_bearings) / η
 *   P_aero     = ½ · ρ · CdA · v_air · |v_air| · v        (v_air = v + headwind)
 *   P_rolling  = Crr · m · g · cos(atan G) · v
 *   P_gravity  = m · g · sin(atan G) · v
 *   P_bearings = v · (91 + 8.7·v) · 10⁻³
 *
 * Simplifications, documented in the README: the kinetic-energy term is
 * omitted (each short step is treated as steady state), only the wind
 * component along the direction of travel is used (no yaw effects on CdA),
 * and wheel rotational inertia is ignored.
 */

export const G = 9.80665;
/** Drivetrain efficiency used by Martin et al. (1998) for a clean, lubricated chain. */
export const DRIVETRAIN_EFFICIENCY = 0.976;

export interface RiderParams {
  /** Rider mass, kg. */
  riderKg: number;
  /** Bicycle plus kit, kg. */
  bikeKg: number;
  /** Sustained power at the pedals, W. */
  powerW: number;
  /** Drag area, m². */
  cda: number;
  /** Rolling resistance coefficient. */
  crr: number;
  /** Speed the rider is assumed to brake to on descents, km/h. */
  maxDescentKmh: number;
}

export const DEFAULT_RIDER: RiderParams = {
  riderKg: 75,
  bikeKg: 9,
  powerW: 180,
  cda: 0.32,
  crr: 0.005,
  maxDescentKmh: 55,
};

/** Bounds used to validate settings; outside these the model is not meaningful. */
export const RIDER_LIMITS: Record<keyof RiderParams, [number, number]> = {
  riderKg: [30, 200],
  bikeKg: [3, 50],
  powerW: [30, 600],
  cda: [0.15, 0.8],
  crr: [0.002, 0.02],
  maxDescentKmh: [20, 90],
};

/** Below this speed the rider is assumed to walk or crawl; prevents unbounded step times. */
export const MIN_SPEED_KMH = 4;
/** Gradients are clamped to ±25 % to limit the effect of elevation noise. */
export const MAX_GRADIENT = 0.25;

export type Exposure = 'open' | 'mixed' | 'sheltered';

/**
 * Hellmann power-law exponents used to scale 10 m forecast wind down to about
 * 1.2 m (rider height): v_h = v_10 · (h/10)^α. α≈0.14 for open terrain,
 * ≈0.25 for mixed countryside or suburbs, ≈0.33 for towns and woodland.
 */
export const EXPOSURE_ALPHA: Record<Exposure, number> = { open: 0.14, mixed: 0.25, sheltered: 0.33 };
export const RIDER_HEIGHT_M = 1.2;

export function windHeightFactor(exposure: Exposure): number {
  return (RIDER_HEIGHT_M / 10) ** EXPOSURE_ALPHA[exposure];
}

/**
 * Air density (kg/m³) from temperature and elevation, using the standard
 * atmosphere for pressure and the dry-air ideal gas law. Humidity is ignored
 * (it changes density by under 1 %).
 */
export function airDensity(tempC: number, elevationM: number): number {
  const pressurePa = 101325 * (1 - 2.25577e-5 * elevationM) ** 5.25588;
  return pressurePa / (287.05 * (tempC + 273.15));
}

export interface Conditions {
  /** Rise over run (0.05 = 5 %). */
  gradient: number;
  /** Wind component against the rider at rider height, m/s (negative = tailwind). */
  headwindMs: number;
  /** Air density, kg/m³. */
  rho: number;
}

/** Power at the pedals (W) needed to hold ground speed v (m/s). */
export function powerRequired(v: number, c: Conditions, p: RiderParams): number {
  const m = p.riderKg + p.bikeKg;
  const theta = Math.atan(c.gradient);
  const vAir = v + c.headwindMs;
  const aero = 0.5 * c.rho * p.cda * vAir * Math.abs(vAir) * v;
  const rolling = p.crr * m * G * Math.cos(theta) * v;
  const gravity = m * G * Math.sin(theta) * v;
  const bearings = v * (91 + 8.7 * v) * 1e-3;
  return (aero + rolling + gravity + bearings) / DRIVETRAIN_EFFICIENCY;
}

/**
 * Ground speed (m/s) at which the rider's power balances the resistive forces,
 * found by bisection, then limited to [MIN_SPEED_KMH, maxDescentKmh].
 */
export function solveSpeed(c: Conditions, p: RiderParams): number {
  const vMin = MIN_SPEED_KMH / 3.6;
  const vMax = p.maxDescentKmh / 3.6;
  if (powerRequired(vMax, c, p) <= p.powerW) return vMax;
  if (powerRequired(vMin, c, p) >= p.powerW) return vMin;
  let lo = vMin;
  let hi = vMax;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (powerRequired(mid, c, p) < p.powerW) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

export function clampGradient(g: number): number {
  return Math.max(-MAX_GRADIENT, Math.min(MAX_GRADIENT, g));
}

export function validRiderParams(v: unknown): RiderParams {
  const o = (v ?? {}) as Partial<RiderParams>;
  const out = { ...DEFAULT_RIDER };
  for (const k of Object.keys(RIDER_LIMITS) as Array<keyof RiderParams>) {
    const x = o[k];
    const [lo, hi] = RIDER_LIMITS[k];
    if (typeof x === 'number' && Number.isFinite(x) && x >= lo && x <= hi) out[k] = x;
  }
  return out;
}
