// Homodyne readout model. Units: epsilon in MHz, time in us, rates in 1/us. All constants are game calibrations.
import { gammaX } from './errors';

export type Pulse = 'step' | 'shaped';

const SIGMA0 = 1; // noise amplitude density
const G2 = 0.763;
const C0 = 2.2e-5; // switching coefficient at alpha = 2.1, per MHz^2 per us
const RING = { step: 1.5, shaped: 0.4 }; // us of dead time lost to transient ringing

/** Re<b>_+- = -+ eps / (2 alpha g2); separation between the two logical outputs. */
export const contrast = (epsZ: number, alpha: number) => epsZ / (alpha * G2);

/** c(alpha): measurement-induced switching falls as the cat gets bigger. */
export const switchCoeff = (alpha: number) => C0 * Math.exp(-2 * (alpha * alpha - 4.41));

/** Gamma_X(eps) = Gamma_X(0) + c(alpha) eps^2, in 1/us (Gamma_X(0) converted from 1/s). */
export const gammaXReadout = (epsZ: number, alpha: number) => gammaX(alpha) * 1e-6 + switchCoeff(alpha) * epsZ * epsZ;

const Q = (z: number) => 0.5 * erfc(z / Math.SQRT2);
function erfc(x: number) { // Numerical Recipes erfcc, |err| < 1.2e-7
  const z = Math.abs(x), t = 1 / (1 + 0.5 * z);
  const r = t * Math.exp(-z * z - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 + t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277)))))))));
  return x >= 0 ? r : 2 - r;
}

/** Standard deviation of the integrated signal. */
export const noiseSigma = (T: number, pulse: Pulse) => SIGMA0 / Math.sqrt(Math.max(effectiveTime(T, pulse), 1e-3));
export const effectiveTime = (T: number, pulse: Pulse) => Math.max(0, T - RING[pulse]);
export const assignmentError = (epsZ: number, alpha: number, T: number, pulse: Pulse) => {
  const Te = effectiveTime(T, pulse);
  return Te === 0 ? 0.5 : Q((contrast(epsZ, alpha) * Math.sqrt(Te)) / (2 * SIGMA0));
};
export const switchError = (epsZ: number, alpha: number, T: number) => Math.min(0.5, (gammaXReadout(epsZ, alpha) * T) / 2);
export const totalError = (epsZ: number, alpha: number, T: number, pulse: Pulse) =>
  Math.min(1, assignmentError(epsZ, alpha, T, pulse) + switchError(epsZ, alpha, T));

/** Deterministic PRNG (mulberry32). */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const gauss = (r: () => number) => Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r());

/** One shot: integrated signal for hidden logical bit (0 -> +, 1 -> -). The logical state may flip mid-window. */
export function shot(bit: 0 | 1, epsZ: number, alpha: number, T: number, pulse: Pulse, r: () => number) {
  const switched = r() < switchError(epsZ, alpha, T);
  const trueSign = (bit === 0 ? -1 : 1) * (switched ? -1 : 1); // Re<b>_+ < 0 for |+alpha>
  const mean = (trueSign * contrast(epsZ, alpha)) / 2;
  const sigma = noiseSigma(T, pulse);
  return { value: mean + sigma * gauss(r), sigma, switched };
}
