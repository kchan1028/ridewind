import { describe, expect, it } from 'vitest';
import {
  airDensity,
  DEFAULT_RIDER,
  DRIVETRAIN_EFFICIENCY,
  G,
  MIN_SPEED_KMH,
  powerRequired,
  solveSpeed,
  validRiderParams,
  windHeightFactor,
  type Conditions,
  type RiderParams,
} from '../src/lib/physics';

const rider: RiderParams = { riderKg: 75, bikeKg: 9, powerW: 200, cda: 0.32, crr: 0.005, maxDescentKmh: 80 };
const flat: Conditions = { gradient: 0, headwindMs: 0, rho: 1.2 };
const kmh = (ms: number) => ms * 3.6;

describe('air density', () => {
  it('matches the ISA sea-level value at 15 °C', () => {
    expect(airDensity(15, 0)).toBeCloseTo(1.225, 3);
  });
  it('falls with temperature and altitude', () => {
    expect(airDensity(30, 0)).toBeLessThan(airDensity(0, 0));
    expect(airDensity(2, 2000)).toBeCloseTo(1.007, 2); // ISA at 2000 m is 2 °C
  });
});

describe('powerRequired (Martin et al. 1998)', () => {
  it('matches a hand calculation on the flat with no wind', () => {
    const v = 9;
    const m = 84;
    const expected = (0.5 * 1.2 * 0.32 * v ** 3 + 0.005 * m * G * v + v * (91 + 8.7 * v) * 1e-3) / DRIVETRAIN_EFFICIENCY;
    expect(powerRequired(v, flat, rider)).toBeCloseTo(expected, 9);
  });
  it('adds the climbing term: ~5 % for 84 kg at 3 m/s costs ~120 W more than flat', () => {
    const extra = powerRequired(3, { ...flat, gradient: 0.05 }, rider) - powerRequired(3, flat, rider);
    const th = Math.atan(0.05);
    expect(extra).toBeCloseTo((84 * G * Math.sin(th) * 3 + 0.005 * 84 * G * (Math.cos(th) - 1) * 3) / DRIVETRAIN_EFFICIENCY, 6);
    expect(extra).toBeGreaterThan(115);
    expect(extra).toBeLessThan(130);
  });
  it('a tailwind faster than the rider pushes (negative aero power)', () => {
    const still = powerRequired(5, flat, rider);
    const pushed = powerRequired(5, { ...flat, headwindMs: -8 }, rider);
    expect(pushed).toBeLessThan(still);
  });
});

describe('solveSpeed', () => {
  it('inverts powerRequired', () => {
    for (const c of [flat, { ...flat, gradient: 0.04 }, { ...flat, headwindMs: 4 }, { ...flat, headwindMs: -4 }]) {
      const v = solveSpeed(c, rider);
      expect(powerRequired(v, c, rider)).toBeCloseTo(rider.powerW, 3);
    }
  });
  it('gives a plausible ~33 km/h for 200 W on the flat (CdA 0.32, Crr 0.005, 84 kg)', () => {
    expect(kmh(solveSpeed(flat, rider))).toBeGreaterThan(32.5);
    expect(kmh(solveSpeed(flat, rider))).toBeLessThan(34.5);
  });
  it('behaves monotonically', () => {
    const base = solveSpeed(flat, rider);
    expect(solveSpeed(flat, { ...rider, powerW: 250 })).toBeGreaterThan(base);
    expect(solveSpeed({ ...flat, headwindMs: 5 }, rider)).toBeLessThan(base);
    expect(solveSpeed({ ...flat, headwindMs: -5 }, rider)).toBeGreaterThan(base);
    expect(solveSpeed({ ...flat, gradient: 0.06 }, rider)).toBeLessThan(base);
    expect(solveSpeed(flat, { ...rider, cda: 0.25 })).toBeGreaterThan(base);
    expect(solveSpeed(flat, { ...rider, crr: 0.008 })).toBeLessThan(base);
  });
  it('mass matters much more uphill than on the flat', () => {
    const climb = { ...flat, gradient: 0.08 };
    const heavy = { ...rider, riderKg: 85 };
    const flatLoss = 1 - solveSpeed(flat, heavy) / solveSpeed(flat, rider);
    const climbLoss = 1 - solveSpeed(climb, heavy) / solveSpeed(climb, rider);
    expect(climbLoss).toBeGreaterThan(flatLoss * 5);
  });
  it('caps descents at the max descent speed', () => {
    expect(kmh(solveSpeed({ ...flat, gradient: -0.1 }, { ...rider, maxDescentKmh: 50 }))).toBeCloseTo(50, 6);
  });
  it('floors very steep climbs at walking pace', () => {
    expect(kmh(solveSpeed({ ...flat, gradient: 0.25 }, { ...rider, powerW: 30 }))).toBeCloseTo(MIN_SPEED_KMH, 6);
  });
});

describe('wind height factor (Hellmann power law to 1.2 m)', () => {
  it('reduces 10 m wind more in sheltered terrain', () => {
    expect(windHeightFactor('open')).toBeCloseTo(0.743, 2);
    expect(windHeightFactor('open')).toBeGreaterThan(windHeightFactor('mixed'));
    expect(windHeightFactor('mixed')).toBeGreaterThan(windHeightFactor('sheltered'));
  });
});

it('validRiderParams keeps in-range values and replaces the rest with defaults', () => {
  expect(validRiderParams({ powerW: 250, cda: 5, riderKg: 'x' })).toEqual({ ...DEFAULT_RIDER, powerW: 250 });
});
