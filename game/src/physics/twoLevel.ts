// Two-level (qubit) dynamics on the Bloch sphere. |0> = north pole (z = +1), |1> = south pole.
export type Vec3 = [number, number, number];

/** Rotate v about unit axis k by angle theta (Rodrigues). */
function rotate(v: Vec3, k: Vec3, theta: number): Vec3 {
  const c = Math.cos(theta), s = Math.sin(theta);
  const d = k[0] * v[0] + k[1] * v[1] + k[2] * v[2];
  const x: Vec3 = [k[1] * v[2] - k[2] * v[1], k[2] * v[0] - k[0] * v[2], k[0] * v[1] - k[1] * v[0]];
  return [0, 1, 2].map((i) => v[i] * c + x[i] * s + k[i] * d * (1 - c)) as Vec3;
}

/**
 * Evolve the Bloch vector under a drive of Rabi rate `omega` (rad/s), detuning `delta` (rad/s)
 * and drive phase `phi` for time `t`: rotation about (omega cos phi, omega sin phi, delta)
 * by angle sqrt(omega^2 + delta^2) t.
 */
export function drive(v: Vec3, omega: number, delta: number, phi: number, t: number): Vec3 {
  const W = Math.hypot(omega, delta);
  if (W === 0 || t === 0) return v;
  return rotate(v, [(omega * Math.cos(phi)) / W, (omega * Math.sin(phi)) / W, delta / W], W * t);
}

export const GROUND: Vec3 = [0, 0, 1];
export const p1 = (v: Vec3) => (1 - v[2]) / 2;

/** Ramsey: two pi/2 pulses (resonant, instant) separated by free precession; returns P(|1>) vs second-pulse phase. */
export function ramseyP1(secondPhase: number, delta = 0, wait = 0): number {
  const half = (phi: number, v: Vec3) => drive(v, 1, 0, phi, Math.PI / 2);
  let v = half(0, GROUND);
  v = drive(v, 0, delta, 0, wait); // free precession about z
  return p1(half(secondPhase, v));
}

/** Transition frequency between |n> and |n+1> for a Kerr oscillator with anharmonicity `A` (A = 0: harmonic). */
export const transitionFreq = (n: number, omega: number, A: number) => omega - A * n;

/** Peak population in the target transition for a resonant-enough drive; used for "weak/off-resonance" feedback. */
export const rabiPeak = (omega: number, delta: number) => (omega * omega) / (omega * omega + delta * delta);
