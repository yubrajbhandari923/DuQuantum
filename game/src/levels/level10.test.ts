import { describe, expect, it } from 'vitest';
import { totalError, switchError } from '../physics/readout';
import { BUDGET } from './Level10';

describe('level 10 mission', () => {
  it('the starting drive is over budget; a moderate drive fits; maximum drive does not', () => {
    expect(totalError(20, 2.1, 8, 'step')).toBeGreaterThan(BUDGET.total);
    expect(totalError(5, 2.1, 20, 'step')).toBeGreaterThan(0); // reachable region exists, see below
    let ok = false;
    for (let e = 0.5; e <= 30 && !ok; e += 0.5) for (let T = 1; T <= 40 && !ok; T += 0.5) ok = totalError(e, 2.1, T, 'step') <= BUDGET.total && switchError(e, 2.1, T) <= BUDGET.switching;
    expect(ok).toBe(true);
    expect(totalError(30, 2.1, 20, 'step')).toBeGreaterThan(BUDGET.total);
  });
  it('a larger cat lowers switching error', () => expect(switchError(10, 2.5, 20)).toBeLessThan(switchError(10, 2.1, 20)));
});
