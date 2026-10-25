import { describe, expect, it } from 'vitest';
import { drive, GROUND, p1, ramseyP1 } from './twoLevel';
import { BASE, gammaX, gammaZ, parityDecay } from './errors';
import { DEFAULTS, alphaSq, kappa2, overshoot, reduced, settlingTime, simulate } from './coupled';
import { assignmentError, switchError, totalError, rng, shot, contrast } from './readout';
import { darkResidual, recoveryTime } from './stabilizer';

describe('two-level', () => {
  it('a pi pulse flips |0> to |1>', () => expect(p1(drive(GROUND, 1, 0, 0, Math.PI))).toBeCloseTo(1));
  it('detuning reduces the peak population', () => expect(p1(drive(GROUND, 1, 1, 0, Math.PI / Math.SQRT2 * 1))).toBeLessThan(0.51));
  it('Ramsey fringes follow (1 - cos phi)/2... interference, not just 50/50', () => {
    expect(ramseyP1(0)).toBeCloseTo(1, 6);
    expect(ramseyP1(Math.PI)).toBeCloseTo(0, 6);
    expect(ramseyP1(Math.PI / 2)).toBeCloseTo(0.5, 6);
  });
});

describe('errors', () => {
  it('benchmark Gamma_Z gives ~1.94 us', () => expect(1 / gammaZ(BASE.kappaA, 2.1) * 1e6).toBeCloseTo(1.94, 1));
  it('benchmark bit flip ~2.6 s, suppressed with alpha', () => {
    expect(1 / gammaX(2.1)).toBeCloseTo(2.6, 5);
    expect(gammaX(2.5)).toBeLessThan(gammaX(2.1));
  });
  it('phase flips grow as alpha^2', () => expect(gammaZ(1, 3) / gammaZ(1, 1.5)).toBeCloseTo(4));
  it('parity decays monotonically', () => expect(parityDecay(1, 2, 0.1)).toBeLessThan(parityDecay(1, 2, 0.01)));
});

describe('coupled modes', () => {
  it('kappa2 = 4 g2^2 / kappa_b scales inversely with buffer loss', () => {
    const slow = { ...DEFAULTS, kappaB: DEFAULTS.kappaB * 2 };
    expect(kappa2(slow)).toBeCloseTo(kappa2(DEFAULTS) / 2);
  });
  it('converges to |a|^2 ~ eps/g2 and stays finite', () => {
    const r = simulate(DEFAULTS, 0.3, 4);
    const f = r.n[r.n.length - 1];
    expect(Number.isFinite(f)).toBe(true);
    expect(f / alphaSq(DEFAULTS)).toBeGreaterThan(0.93);
    expect(f / alphaSq(DEFAULTS)).toBeLessThan(1.02);
    expect(Number.isFinite(settlingTime(r.t, r.n))).toBe(true);
  });
  it('detuned pump kills the conversion', () => {
    const r = simulate(DEFAULTS, 0.3, 2, 0.002, 25, 5 * DEFAULTS.kappaB);
    expect(r.n[r.n.length - 1]).toBeLessThan(0.5 * alphaSq(DEFAULTS));
  });
  it('reduced model is well behaved', () => expect(overshoot(reduced(DEFAULTS, 0.3, 4).n)).toBeLessThan(0.01));
});

describe('stabilizer', () => {
  it('cats are dark states of a^2 - alpha^2', () => {
    expect(darkResidual(2, 'even')).toBeLessThan(1e-6);
    expect(darkResidual(2, 'odd')).toBeLessThan(1e-6);
  });
  it('recovery time falls as kappa2 rises', () => expect(recoveryTime(2, 2, 0.5)).toBeLessThan(recoveryTime(1, 2, 0.5)));
});

describe('readout', () => {
  const T = 10;
  it('contrast scales with drive', () => expect(contrast(2, 2.1)).toBeGreaterThan(contrast(1, 2.1)));
  it('assignment error falls with T, switching grows with T', () => {
    expect(assignmentError(2, 2.1, 20, 'shaped')).toBeLessThan(assignmentError(2, 2.1, 5, 'shaped'));
    expect(switchError(2, 2.1, 20)).toBeGreaterThan(switchError(2, 2.1, 5));
  });
  it('total error has an interior optimum in drive', () => {
    const e = [0.2, 0.5, 1, 2, 3, 5, 8, 12, 20, 40].map((x) => totalError(x, 2.1, T, 'shaped'));
    const i = e.indexOf(Math.min(...e));
    expect(i).toBeGreaterThan(0);
    expect(i).toBeLessThan(e.length - 1);
  });
  it('a larger cat lowers switching; shaped pulse beats step', () => {
    expect(switchError(3, 2.5, T)).toBeLessThan(switchError(3, 2.1, T));
    expect(assignmentError(2, 2.1, 3, 'shaped')).toBeLessThan(assignmentError(2, 2.1, 3, 'step'));
  });
  it('shots are deterministic for a seed', () => {
    expect(shot(0, 2, 2.1, T, 'shaped', rng(7)).value).toBe(shot(0, 2, 2.1, T, 'shaped', rng(7)).value);
  });
});
