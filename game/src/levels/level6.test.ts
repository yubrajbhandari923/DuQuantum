import { describe, expect, it } from 'vitest';
import { alphaUnderLoss } from '../physics/quantum';
import { alphaSqUnderPairLoss } from '../physics/errors';

describe('level 6 loss physics', () => {
  it('coherent amplitude decays as alpha0 exp(-t/2)', () => {
    expect(alphaUnderLoss(2, 1, 1.5)).toBeCloseTo(2 * Math.exp(-0.75), 10);
  });
  it('pair loss drives alpha^2 to zero', () => {
    expect(alphaSqUnderPairLoss(4, 0.5, 3)).toBeCloseTo(4 / 13, 10); // algebraic: a2/(1 + 2 k a2 t)
    // matches a direct Euler integration of d(a2)/dt = -2 k a2^2
    let a2 = 4; for (let i = 0; i < 30000; i++) a2 += -2 * 0.5 * a2 * a2 * 1e-4;
    expect(a2).toBeCloseTo(4 / 13, 3);
  });
});
