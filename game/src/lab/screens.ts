import { coherentPn, rk4, stabilizerRate, wignerCat, wignerCoherent } from '../physics/quantum';
import { ramseyP1 } from '../physics/twoLevel';
import { alphaSqUnderPairLoss, gammaX, gammaZ, BASE } from '../physics/errors';
import { contrast, noiseSigma } from '../physics/readout';

/** Level-themed phosphor previews (one per level), all drawn from the real physics. Moved from the old console ring. */
export const GREEN = '#7dff9a', AMBER = '#ffb347', WARM = '#ffe9c4';
export const W = 256;
let H = 160; // set to the canvas height before each draw (screens have different aspect ratios)
const hm = typeof document !== 'undefined' ? document.createElement('canvas') : (null as unknown as HTMLCanvasElement);
if (hm) { hm.width = 48; hm.height = 30; }
type G2 = CanvasRenderingContext2D;
const HP = [110, 255, 140], HN = [255, 140, 60]; // heat-map colours: positive / negative Wigner lobes
function heat(g: G2, f: (x: number, y: number) => number, reveal = 1, x0 = 0, y0 = 14, w = W, h = H - 14) {
  const gh = hm.getContext('2d')!, img = gh.createImageData(48, 30);
  for (let j = 0; j < 30; j++) for (let k = 0; k < 48; k++) {
    if (k / 48 > reveal) continue;
    const v = f(((k + 0.5) / 48 - 0.5) * 6, ((j + 0.5) / 30 - 0.5) * 3.75) * Math.PI / 2; // normalised to peak 1
    const o = (j * 48 + k) * 4, a = Math.min(1, Math.abs(v));
    const c = v > 0 ? HP : HN; img.data[o] = c[0] * a; img.data[o + 1] = c[1] * a; img.data[o + 2] = c[2] * a; img.data[o + 3] = 255;
  }
  gh.putImageData(img, 0, 0);
  g.imageSmoothingEnabled = true; g.drawImage(hm, x0, y0, w, h);
}
function plot(g: G2, f: (u: number) => number, col: string, lo = -1, hi = 1, y0 = 18, h = H - 36, n = 96, w = W - 16) {
  g.strokeStyle = col; g.lineWidth = 2; g.beginPath();
  for (let k = 0; k <= n; k++) { const u = k / n, y = y0 + h * (1 - (f(u) - lo) / (hi - lo)); k ? g.lineTo(8 + u * w, y) : g.moveTo(8, y); }
  g.stroke();
}
function bars(g: G2, v: number[], col: string, y1 = H - 10, hh = 100) {
  const bw = (W - 16) / v.length;
  g.fillStyle = col; v.forEach((a, k) => g.fillRect(8 + k * bw + 1, y1 - a * hh, bw - 2, a * hh));
}
function grid(g: G2) {
  g.strokeStyle = 'rgba(77,224,220,0.12)'; g.lineWidth = 1;
  for (let x = 8; x < W; x += 30) { g.beginPath(); g.moveTo(x, 14); g.lineTo(x, H - 6); g.stroke(); }
  for (let y = 14; y < H; y += 24) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
}
const stabCurves = [0.15, 0.6, 3.2].map((x0) => Array.from({ length: 64 }, (_, k) => rk4(stabilizerRate(1.2, 1.8), x0, 0.05, k)));
const poisson = (a2: number, n = 14) => Array.from({ length: n }, (_, k) => coherentPn(k, a2) * 2.2);

const DRAW: ((g: G2, t: number, tint: string) => void)[] = [
  (g, t, c) => { grid(g); plot(g, (u) => Math.exp(-u * 1.6) * Math.cos(u * 26 - t * 6), c, -1.1, 1.1); plot(g, (u) => Math.exp(-u * 1.6), WARM, -1.1, 1.1); },
  (g, t, c) => { grid(g); const ph = (t * 1.1) % (4 * Math.PI); plot(g, (u) => ramseyP1(u * 4 * Math.PI), c, 0, 1); g.fillStyle = AMBER; g.beginPath(); g.arc(8 + (ph / (4 * Math.PI)) * (W - 16), 18 + (H - 36) * (1 - ramseyP1(ph)), 4, 0, 7); g.fill(); },
  (g, t) => heat(g, (x, y) => wignerCoherent(x, y - 1.5 * Math.sin(t * 1.3), 1.5 * Math.cos(t * 1.3))),
  (g, t) => heat(g, (x, y) => wignerCat(x, y, 1.8, 'even', 0.7 + 0.3 * Math.sin(t * 0.9))),
  (g, t) => { const r = (t * 0.35) % 1.2; heat(g, (x, y) => wignerCat(x, y, 1.2, 'odd'), Math.min(1, r)); g.fillStyle = GREEN; g.fillRect(Math.min(1, r) * W, 14, 2, H - 14); },
  (g, t, c) => { const tt = (t * 0.8) % 6, a2 = alphaSqUnderPairLoss(4.41, 0.25, tt); plot(g, (u) => alphaSqUnderPairLoss(4.41, 0.25, u * 6) / 4.41, c, 0, 1.05, 18, 60); g.fillStyle = AMBER; g.beginPath(); g.arc(8 + (tt / 6) * (W - 16), 18 + 60 * (1 - a2 / 4.41 / 1.05), 4, 0, 7); g.fill(); bars(g, poisson(a2), WARM, H - 8, 70); },
  (g, t, c) => { grid(g); [WARM, c, AMBER].forEach((col, k) => plot(g, (u) => stabCurves[k][Math.floor(u * 63)], col, 0, 3.4)); g.fillStyle = '#fff'; g.fillRect(8 + (((t * 0.35) % 1) * (W - 16)), 14, 1, H - 20); },
  (g, t, c) => { grid(g); plot(g, (u) => Math.cos(u * 12 + t * 2) ** 2, c, 0, 1); plot(g, (u) => Math.sin(u * 12 + t * 2) ** 2, AMBER, 0, 1); },
  (g, t, c) => { const a = 0.8 + ((t * 0.25) % 1) * 2.2; grid(g); plot(g, (u) => Math.log10(gammaX(0.8 + u * 2.2)), c, -3, 7); plot(g, (u) => Math.log10(gammaZ(BASE.kappaA, 0.8 + u * 2.2)), AMBER, -3, 7); g.fillStyle = '#fff'; g.fillRect(8 + ((a - 0.8) / 2.2) * (W - 16), 14, 1, H - 20); },
  (g, t, c) => { const s = noiseSigma(3, 'shaped'), m = contrast(2, 2.1) / 2; grid(g); const gz = (x: number, mu: number) => Math.exp(-((x - mu) ** 2) / (2 * s * s)); plot(g, (u) => gz(u * 8 - 4, -m) + 0.02 * Math.sin(u * 40 + t * 9), WARM, 0, 1.2); plot(g, (u) => gz(u * 8 - 4, m) + 0.02 * Math.sin(u * 40 - t * 9), c, 0, 1.2); },
];
const TAGS = ['LC  f(t)', 'RAMSEY  P1(phi)', 'W(b)  COHERENT', 'W(b)  CAT +', 'TOMOGRAPHY', 'PAIR LOSS  a^2(t)', 'x(t) -> alpha', 'MEMORY / BUFFER', 'log Gamma vs alpha', 'READOUT  I/Q'];

/** Draws level i's preview (0-based) into a W-wide canvas at time t, with a title bar and scanlines. */
export function drawPreview(g: G2, i: number, t: number) {
  H = g.canvas.height;
  g.fillStyle = '#031208'; g.fillRect(0, 0, W, H);
  g.font = '11px monospace'; g.textBaseline = 'top';
  DRAW[i](g, t, GREEN);
  g.fillStyle = 'rgba(3,18,8,0.7)'; g.fillRect(0, 0, W, 14); g.fillStyle = GREEN; g.fillText(TAGS[i], 6, 1);
  g.fillStyle = 'rgba(0,0,0,0.18)'; for (let y = 0; y < H; y += 3) g.fillRect(0, y, W, 1);
}
