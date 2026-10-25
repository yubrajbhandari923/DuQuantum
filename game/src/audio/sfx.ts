// Procedural Web Audio: every sound is synthesized at runtime, no audio files.
// All public functions swallow errors so the game runs silently without Web Audio.

export type Sfx =
  | 'click' | 'hover' | 'connect' | 'pulse' | 'fail' | 'success' | 'reveal'
  | 'complete' | 'meow' | 'photon' | 'measure' | 'stabilize' | 'rescue'
  | 'tick' | 'heartbeat' | 'thud';

type Kind = 'master' | 'sfx' | 'ambience';

const MAX_VOICES = 32;
let voices = 0;
let ctx: AudioContext | null = null;
let bus: { master: GainNode; sfx: GainNode; amb: GainNode } | null = null;
let muted = false;
let lastHover = 0;
const vol: Record<Kind, number> = { master: 0.8, sfx: 0.7, ambience: 0.35 };
let amb: { gain: GainNode; srcs: AudioScheduledSourceNode[]; nodes: AudioNode[] } | null = null;

// Lazily creates the context (and resumes it, since browsers need a user gesture first).
function audio(): AudioContext | null {
  try {
    if (!ctx) {
      const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      ctx = new Ctor();
      const master = ctx.createGain();
      master.connect(ctx.destination);
      const sfx = ctx.createGain();
      sfx.connect(master);
      const amb = ctx.createGain();
      amb.connect(master);
      bus = { master, sfx, amb };
      applyVolumes();
    }
    if (ctx.state === 'suspended') void ctx.resume().catch(() => {});
    return ctx;
  } catch {
    return null;
  }
}

function applyVolumes(): void {
  if (!ctx || !bus) return;
  const t = ctx.currentTime;
  bus.master.gain.setTargetAtTime(muted ? 0 : vol.master, t, 0.02);
  bus.sfx.gain.setTargetAtTime(vol.sfx, t, 0.02);
  bus.amb.gain.setTargetAtTime(vol.ambience, t, 0.02);
}

// Frequency/filter envelope: exponential ramp through the given values across dur.
function sweep(p: AudioParam, vals: number[], t: number, dur: number): void {
  p.setValueAtTime(vals[0], t);
  vals.slice(1).forEach((v, i) => p.exponentialRampToValueAtTime(v, t + (dur * (i + 1)) / (vals.length - 1)));
}

// Disconnects a finished voice so nothing leaks, and keeps the live voice count honest.
function track(src: AudioScheduledSourceNode, nodes: AudioNode[]): void {
  voices++;
  src.onended = () => {
    voices--;
    src.disconnect();
    nodes.forEach((n) => n.disconnect());
  };
}

interface ToneOpts {
  type?: OscillatorType;
  freqs: number[];
  dur: number;
  peak: number;
  attack?: number;
  detune?: number;
  filter?: { type: BiquadFilterType; freqs: number[]; q?: number };
}

function tone(c: AudioContext, d: AudioNode, t: number, o: ToneOpts): void {
  if (voices >= MAX_VOICES) return;
  const osc = c.createOscillator();
  const env = c.createGain();
  const nodes: AudioNode[] = [env];
  osc.type = o.type ?? 'sine';
  sweep(osc.frequency, o.freqs, t, o.dur);
  if (o.detune) osc.detune.value = o.detune;
  env.gain.setValueAtTime(0.0001, t);
  env.gain.exponentialRampToValueAtTime(o.peak, t + (o.attack ?? 0.005));
  env.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
  let last: AudioNode = osc;
  if (o.filter) {
    const f = c.createBiquadFilter();
    f.type = o.filter.type;
    f.Q.value = o.filter.q ?? 1;
    sweep(f.frequency, o.filter.freqs, t, o.dur);
    osc.connect(f);
    last = f;
    nodes.push(f);
  }
  last.connect(env);
  env.connect(d);
  track(osc, nodes);
  osc.start(t);
  osc.stop(t + o.dur + 0.05);
}

function noise(c: AudioContext, d: AudioNode, t: number, dur: number, peak: number, filter: { type: BiquadFilterType; freq: number; q: number }): void {
  if (voices >= MAX_VOICES) return;
  const len = Math.ceil(c.sampleRate * dur);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = filter.type;
  f.frequency.value = filter.freq;
  f.Q.value = filter.q;
  const env = c.createGain();
  env.gain.setValueAtTime(0.0001, t);
  env.gain.exponentialRampToValueAtTime(peak, t + dur * 0.3);
  env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f);
  f.connect(env);
  env.connect(d);
  track(src, [f, env]);
  src.start(t);
  src.stop(t + dur + 0.05);
}

function arp(c: AudioContext, d: AudioNode, t: number, notes: number[], step: number, o: Omit<ToneOpts, 'freqs'>): void {
  notes.forEach((f, i) => tone(c, d, t + i * step, { ...o, freqs: [f] }));
}

function meow(c: AudioContext, d: AudioNode, t: number): void {
  tone(c, d, t, {
    type: 'sawtooth', freqs: [380, 760, 420], dur: 0.5, peak: 0.12, attack: 0.05,
    filter: { type: 'bandpass', freqs: [700, 1500, 800], q: 4 },
  });
}

type Snd = (c: AudioContext, d: AudioNode, t: number) => void;
const SOUNDS: Record<Sfx, Snd> = {
  click: (c, d, t) => tone(c, d, t, { type: 'triangle', freqs: [1600, 800], dur: 0.035, peak: 0.12, filter: { type: 'lowpass', freqs: [3000] } }),
  hover: (c, d, t) => tone(c, d, t, { freqs: [1200, 1400], dur: 0.03, peak: 0.03 }),
  connect: (c, d, t) => {
    tone(c, d, t, { freqs: [660], dur: 0.14, peak: 0.15 });
    tone(c, d, t + 0.08, { freqs: [990], dur: 0.2, peak: 0.15 });
  },
  pulse: (c, d, t) => tone(c, d, t, { freqs: [300, 1200], dur: 0.25, peak: 0.2, attack: 0.03 }),
  fail: (c, d, t) => {
    for (const detune of [0, -22]) {
      tone(c, d, t, { type: 'sawtooth', freqs: [190, 70], dur: 0.45, peak: 0.1, detune, filter: { type: 'lowpass', freqs: [700] } });
    }
  },
  success: (c, d, t) => arp(c, d, t, [523, 659, 784, 1047], 0.07, { type: 'triangle', dur: 0.3, peak: 0.15 }),
  reveal: (c, d, t) => {
    noise(c, d, t, 0.3, 0.08, { type: 'bandpass', freq: 3000, q: 0.7 });
    tone(c, d, t + 0.1, { freqs: [1319], dur: 0.45, peak: 0.08, attack: 0.02 });
  },
  complete: (c, d, t) => arp(c, d, t, [523, 659, 784, 988, 1319], 0.09, { dur: 0.5, peak: 0.14 }),
  meow: (c, d, t) => meow(c, d, t),
  photon: (c, d, t) => tone(c, d, t, { freqs: [2400, 1800], dur: 0.08, peak: 0.1 }),
  measure: (c, d, t) => tone(c, d, t, { type: 'triangle', freqs: [900], dur: 0.02, peak: 0.08, filter: { type: 'lowpass', freqs: [1500] } }),
  stabilize: (c, d, t) => {
    for (const f of [220, 233, 330]) {
      tone(c, d, t, { freqs: [f], dur: 1.4, peak: 0.06, attack: 0.6, filter: { type: 'lowpass', freqs: [900] } });
    }
  },
  rescue: (c, d, t) => {
    arp(c, d, t, [523, 659, 784, 1047], 0.09, { type: 'triangle', dur: 0.35, peak: 0.15 });
    meow(c, d, t + 0.35);
  },
  tick: (c, d, t) => { // clockwork escapement
    noise(c, d, t, 0.025, 0.12, { type: 'bandpass', freq: 4200, q: 6 });
    tone(c, d, t, { type: 'square', freqs: [2100, 1900], dur: 0.015, peak: 0.03, filter: { type: 'bandpass', freqs: [2500], q: 3 } });
  },
  heartbeat: (c, d, t) => { // lub-dub
    tone(c, d, t, { freqs: [62, 40], dur: 0.16, peak: 0.45, attack: 0.01, filter: { type: 'lowpass', freqs: [180] } });
    tone(c, d, t + 0.2, { freqs: [55, 36], dur: 0.14, peak: 0.3, attack: 0.01, filter: { type: 'lowpass', freqs: [160] } });
  },
  thud: (c, d, t) => { // a door or the bell jar landing
    tone(c, d, t, { freqs: [110, 45], dur: 0.35, peak: 0.35, attack: 0.004, filter: { type: 'lowpass', freqs: [400] } });
    noise(c, d, t, 0.12, 0.08, { type: 'lowpass', freq: 900, q: 0.7 });
  },
};

export function play(name: Sfx): void {
  try {
    if (name === 'hover') {
      const now = performance.now();
      if (now - lastHover < 60) return;
      lastHover = now;
    }
    const c = audio();
    if (!c || !bus) return;
    SOUNDS[name](c, bus.sfx, c.currentTime);
  } catch {
    /* audio is optional */
  }
}

export function startAmbience(): void {
  try {
    const c = audio();
    if (!c || !bus || amb) return;
    const t = c.currentTime;
    const gain = c.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(1, t + 2);
    gain.connect(bus.amb);

    // Brown noise bed, low-passed into a quiet hum.
    const len = c.sampleRate * 2;
    const buf = c.createBuffer(1, len, c.sampleRate);
    const data = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
      data[i] = last * 3.5;
    }
    const noiseSrc = c.createBufferSource();
    noiseSrc.buffer = buf;
    noiseSrc.loop = true;
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 240;
    const noiseGain = c.createGain();
    noiseGain.gain.value = 0.5;
    noiseSrc.connect(lp);
    lp.connect(noiseGain);
    noiseGain.connect(gain);

    // 50 Hz drone whose level breathes slowly via an LFO.
    const drone = c.createOscillator();
    drone.frequency.value = 50;
    const droneGain = c.createGain();
    droneGain.gain.value = 0.12;
    const lfo = c.createOscillator();
    lfo.frequency.value = 0.08;
    const lfoGain = c.createGain();
    lfoGain.gain.value = 0.04;
    lfo.connect(lfoGain);
    lfoGain.connect(droneGain.gain);
    drone.connect(droneGain);
    droneGain.connect(gain);

    const srcs: AudioScheduledSourceNode[] = [noiseSrc, drone, lfo];
    srcs.forEach((s) => s.start(t));
    amb = { gain, srcs, nodes: [lp, noiseGain, droneGain, lfoGain] };
  } catch {
    /* audio is optional */
  }
}

export function stopAmbience(): void {
  try {
    if (!amb || !ctx) return;
    const { gain, srcs, nodes } = amb;
    amb = null;
    const t = ctx.currentTime;
    gain.gain.cancelScheduledValues(t);
    gain.gain.setValueAtTime(gain.gain.value, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 1.5);
    srcs.forEach((s) => s.stop(t + 1.6));
    setTimeout(() => {
      [...srcs, gain, ...nodes].forEach((n) => n.disconnect());
    }, 1800);
  } catch {
    /* audio is optional */
  }
}

export function setVolume(kind: Kind, v: number): void {
  try {
    vol[kind] = Math.min(1, Math.max(0, v)) || 0;
    applyVolumes();
  } catch {
    /* audio is optional */
  }
}

export function setMuted(m: boolean): void {
  try {
    muted = m;
    applyVolumes();
  } catch {
    /* audio is optional */
  }
}

export function getAudioSettings(): { master: number; sfx: number; ambience: number; muted: boolean } {
  return { master: vol.master, sfx: vol.sfx, ambience: vol.ambience, muted };
}
