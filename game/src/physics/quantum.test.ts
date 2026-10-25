import { describe, expect, it } from 'vitest';
import {
  alphaUnderLoss, catPn, coherentPn, fockEnergy, lcFrequency, oppositeOverlap,
  rk4, stabilizerRate, wignerCat, wignerMixture,
} from './quantum';

const sum = (f: (n: number) => number, N = 80) => Array.from({ length: N }, (_, n) => f(n)).reduce((a, b) => a + b, 0);

describe('oscillator', () => {
  it('has equal level spacing', () => {
    expect(fockEnergy(5, 3) - fockEnergy(4, 3)).toBeCloseTo(fockEnergy(1, 3) - fockEnergy(0, 3));
  });
  it('LC frequency scales as 1/sqrt(LC)', () => {
    expect(lcFrequency(1, 1)).toBeCloseTo(1);
    expect(lcFrequency(4, 1)).toBeCloseTo(0.5);
  });
});

describe('coherent and cat states', () => {
  it('is normalized with <n> = |alpha|^2', () => {
    const a2 = 4.41;
    expect(sum((n) => coherentPn(n, a2))).toBeCloseTo(1, 10);
    expect(sum((n) => n * coherentPn(n, a2))).toBeCloseTo(a2, 8);
  });
  it('opposite overlap is exp(-2 alpha^2)', () => {
    expect(oppositeOverlap(1)).toBeCloseTo(Math.exp(-2));
  });
  it('even/odd cats are normalized with matching-parity support', () => {
    for (const a of [0.5, 2.1]) {
      expect(sum((n) => catPn(n, a, 'even'))).toBeCloseTo(1, 10);
      expect(sum((n) => catPn(n, a, 'odd'))).toBeCloseTo(1, 10);
      expect(catPn(3, a, 'even')).toBe(0);
      expect(catPn(2, a, 'odd')).toBe(0);
    }
    expect(catPn(1, 0, 'odd')).toBe(1);
  });
  it('cat Wigner has a negative fringe where the mixture stays positive', () => {
    expect(wignerCat(0, Math.PI / 8, 2, 'even')).toBeLessThan(0); // cos(4*2*pi/8) = -1
    expect(wignerMixture(0, Math.PI / 8, 2)).toBeGreaterThan(0);
  });
  it('cat Wigner integrates to 1', () => {
    let s = 0;
    const h = 0.05;
    for (let x = -6; x <= 6; x += h) for (let y = -6; y <= 6; y += h) s += wignerCat(x, y, 1.5, 'even') * h * h;
    expect(s).toBeCloseTo(1, 2);
  });
});

describe('dissipation', () => {
  it('alpha decays as exp(-kappa t/2)', () => {
    expect(alphaUnderLoss(2, 1, 2)).toBeCloseTo(2 * Math.exp(-1));
  });
  it('mean-field stabilizer relaxes to +/-alpha', () => {
    const f = stabilizerRate(1, 2.1);
    expect(rk4(f, 0.3, 0.01, 2000)).toBeCloseTo(2.1, 4);
    expect(rk4(f, 3.5, 0.01, 2000)).toBeCloseTo(2.1, 4);
    expect(rk4(f, -0.3, 0.01, 2000)).toBeCloseTo(-2.1, 4);
  });
});
