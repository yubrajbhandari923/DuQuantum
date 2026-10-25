import { useEffect, useState } from 'react';
import { LINES, intro, useIntro } from '../lab/Intro3D';
import { speaker } from '../lab/Characters';
import { Portrait } from './Portrait';
import { play } from '../audio/sfx';

const NAMES = { heisenberg: 'Heisenberg', schrodinger: 'Schrödinger', player: 'You', narrator: '' } as const;
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Overlay for the opening cutscene: letterbox, captions (typewriter), panic vignette, Skip. */
export function Cutscene() {
  const { line, panic } = useIntro();
  const l = line >= 0 ? LINES[line] : null;
  const [shown, setShown] = useState(0);
  useEffect(() => {
    speaker.who = l && (l.who === 'heisenberg' || l.who === 'schrodinger') ? l.who : null;
    const full = l?.text.length ?? 0;
    setShown(reduced() ? full : 0);
    if (!l || reduced()) return;
    const id = setInterval(() => setShown((s) => (s >= full ? s : s + 1)), 22);
    return () => clearInterval(id);
  }, [l]);
  useEffect(() => () => { speaker.who = null; }, []);

  const skip = () => { play('click'); intro.skip = true; };
  const next = () => { // jump to the next caption (or the end)
    if (l && shown < l.text.length) return setShown(l.text.length);
    const n = LINES[line + 1];
    if (n) intro.t = n.t0; else intro.skip = true;
  };
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'Escape') { e.preventDefault(); skip(); }
      if (e.code === 'Enter') { e.preventDefault(); next(); }
    };
    addEventListener('keydown', k);
    return () => removeEventListener('keydown', k);
  });

  return (
    <div className="cut" role="region" aria-label="Opening scene">
      <div className="cut-bars" />
      <div className={`cut-panic${panic ? ' on' : ''}`} />
      <div className="cut-fade" />
      <button className="btn small ghost cut-skip" onClick={skip}>Skip <kbd>Space</kbd></button>
      {l && (
        <div className={`dlg panel cut-cap${l.who === 'narrator' ? ' narr' : ''}`} key={line} onClick={next} role="dialog" aria-label="Caption">
          {(l.who === 'heisenberg' || l.who === 'schrodinger') ? <Portrait who={l.who} speaking={shown < l.text.length} size={84} /> : <span />}
          <div>
            {NAMES[l.who] && <div className="who">{NAMES[l.who]}</div>}
            <div className={`txt${l.who === 'narrator' ? ' note' : ''}`} aria-live="polite">{l.text.slice(0, shown)}</div>
          </div>
          <div className="acts muted"><span /><span><kbd>Enter</kbd> next line</span></div>
        </div>
      )}
    </div>
  );
}
