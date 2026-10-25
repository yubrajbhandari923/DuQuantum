/** Palette for canvas/SVG drawing (CSS vars are not readable by canvas). Mirrors theme.css. */
export const C = {
  bg: '#0B1020', surface: '#172033', surface2: '#1f2a42', edge: '#2c3a58',
  cyan: '#4DE0DC', violet: '#A78BFA', amber: '#F4B860', red: '#F06B73',
  text: '#E8ECF4', muted: '#98A4B8',
} as const;
export type Tone = 'cyan' | 'violet' | 'amber' | 'red';
