import { useEffect, useState } from 'react';
import { ENDING } from '../story/content';
import { useGame } from '../store';
import { Dialogue } from './Dialogue';
import { CatSprite } from './CatSprite';
import { play } from '../audio/sfx';

const CHAIN = ['LC oscillator', 'Josephson anharmonicity', 'Coherent states', 'Cat superposition', 'Engineered two-photon loss', 'Memory and buffer circuit', 'Logical readout'];
const CSS = `
@keyframes end-lid{to{transform:translateY(-30px) rotate(-18deg);opacity:0}}
@keyframes end-glow{from{opacity:0}to{opacity:1}}
@keyframes end-walk{from{transform:translateX(-60px) scale(.7);opacity:0}to{transform:none;opacity:1}}
@media (prefers-reduced-motion:reduce){.end-a{animation-duration:.01s!important;animation-delay:0s!important}}`;

/** Staged reveal: sealed box during the dialogue, then the lid lifts, the cat walks out, then the title and summary. */
export function Ending() {
  const go = useGame((s) => s.go);
  const [done, setDone] = useState(false);
  const [title, setTitle] = useState(false);
  useEffect(() => { play('rescue'); }, []);
  useEffect(() => { if (!done) return; const t = setTimeout(() => setTitle(true), 2200); return () => clearTimeout(t); }, [done]);
  const a = (name: string, dur: string, delay = '0s') => ({ animation: `${name} ${dur} ${delay} both ease-out` });
  return (
    <div className="sle" style={{ display: 'grid', placeItems: 'center', overflow: 'auto', background: 'radial-gradient(ellipse at 50% 60%, rgba(244,184,96,.16), transparent 60%), rgba(11,16,32,.55)' }}>
      <style>{CSS}</style>
      <div className="fade-in" style={{ textAlign: 'center', padding: 16 }}>
        <div style={{ position: 'relative', height: 200, width: 'min(320px, 80vw)', margin: '0 auto' }}>
          {done && <div className="end-a" style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 50% 60%, rgba(244,184,96,.35), transparent 65%)', ...a('end-glow', '1.2s', '.5s') }} />}
          <svg viewBox="0 0 120 70" width="100%" height="100%" aria-hidden style={{ position: 'absolute', inset: 0, opacity: done ? 0.5 : 1, transition: 'opacity 1s 1.5s' }}>
            <rect x="26" y="34" width="68" height="30" rx="3" fill="#161e36" stroke="#8aa0c8" strokeWidth="1.5" />
            <g className="end-a" style={{ transformOrigin: '26px 34px', ...(done ? a('end-lid', '.9s') : {}) }}>
              <rect x="22" y="24" width="76" height="12" rx="3" fill="#1d2748" stroke="#f4b860" strokeWidth="1.5" />
            </g>
          </svg>
          {done && <div className="end-a" style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', ...a('end-walk', '1.4s', '1s') }}><CatSprite state="walking" size={170} /></div>}
        </div>
        {title && (
          <>
            <h1 className="fade-in" style={{ fontFamily: 'var(--font-title)', fontWeight: 400, fontSize: 'clamp(2rem,6vw,4rem)', margin: '10px 0 0' }}>Experiment complete</h1>
            <p className="fade-in" style={{ fontFamily: 'var(--font-title)', fontStyle: 'italic', color: 'var(--amber)', fontSize: '1.5rem' }}>You built a cat qubit.</p>
            <ol className="muted" style={{ listStyle: 'none', padding: 0, lineHeight: 1.9 }}>
              {CHAIN.map((c, i) => <li key={c} className="fade-in" style={{ animationDelay: `${i * 0.25}s` }}>{c}</li>)}
            </ol>
            <button className="btn primary fade-in" style={{ animationDelay: `${CHAIN.length * 0.25}s` }} onClick={() => go('hub')}>Revisit the lab</button>
          </>
        )}
      </div>
      {!done && <Dialogue lines={ENDING} onDone={() => setDone(true)} />}
    </div>
  );
}
