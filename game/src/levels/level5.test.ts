import { describe, expect, it } from 'vitest';
import { evenCatFidelity, parityOf, wignerState } from './Level5';
import { wignerCat } from '../physics/quantum';

describe('level 5 state builder', () => {
  it('w=1/2, phi=0, c=1 reproduces the analytic even cat', () => {
    for (const [x, y] of [[0, 0], [0.3, 0.7], [1.5, -0.4]]) expect(wignerState(x, y, 2, 0.5, 0, 1)).toBeCloseTo(wignerCat(x, y, 2, 'even'), 10);
  });
  it('even cat: parity +1 and fidelity 1; odd: parity -1', () => {
    expect(parityOf(2, 0.5, 0, 1)).toBeCloseTo(1, 6);
    expect(evenCatFidelity(2, 0.5, 0, 1)).toBeCloseTo(1, 6);
    expect(parityOf(2, 0.5, Math.PI, 1)).toBeCloseTo(-1, 6);
    expect(evenCatFidelity(2, 0.5, Math.PI, 1)).toBeLessThan(0.01);
  });
  it('mixture has ~zero parity and cannot exceed 50% fidelity', () => {
    expect(Math.abs(parityOf(2, 0.5, 0, 0))).toBeLessThan(1e-3);
    expect(evenCatFidelity(2, 0.5, 0, 0)).toBeLessThan(0.55);
  });
});
