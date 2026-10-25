import { describe, expect, it } from 'vitest';
import { GROUND, drive, p1 } from '../physics/twoLevel';
import { ramseySweep } from './Level2';

describe('level 2 physics', () => {
  it('pi pulse reaches |1>', () => expect(p1(drive(GROUND, 2, 0, 0, Math.PI / 2))).toBeGreaterThan(0.98));
  it('pi/2 at phi=pi/2 gives +x; phi=0 gives -y', () => {
    expect(drive(GROUND, 2, 0, Math.PI / 2, Math.PI / 4)[0]).toBeGreaterThan(0.98);
    expect(drive(GROUND, 2, 0, 0, Math.PI / 4)[1]).toBeLessThan(-0.98);
  });
  it('Ramsey fringe visibility > 0.9', () => {
    expect(ramseySweep({ omega: 2, t: Math.PI / 4, delta: 0 }, 0.5).visibility).toBeGreaterThan(0.9);
  });
});
