import { useCallback, useEffect, useState } from 'react';
import type { DialogueLine } from '../types';
import { Portrait } from './Portrait';
import { play } from '../audio/sfx';
import { speaker } from '../lab/Characters';

const NAMES = { schrodinger: 'Schrödinger', heisenberg: 'Heisenberg', narrator: 'A note, in cramped handwriting' } as const;
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Typewriter dialogue. Space/Enter/click advances; the first press finishes the line. */
export function Dialogue({ lines, onDone }: { lines: DialogueLine[]; onDone: () => void }) {
  const [i, setI] = useState(0);
  const [shown, setShown] = useState(0);
  const line = lines[i];
  const full = line?.text.length ?? 0;
  useEffect(() => { speaker.who = line?.who ?? null; return () => { speaker.who = null; }; }, [line]); // lights the speaker's face in the hub

  useEffect(() => {
    setShown(reduced() ? full : 0);
    if (reduced() || !line) return;
    const id = setInterval(() => setShown((s) => (s >= full ? s : s + 1)), 18);
    return () => clearInterval(id);
  }, [i, full, line]);

  const next = useCallback(() => {
    if (shown < full) return setShown(full);
    play('click');
    if (i + 1 >= lines.length) onDone(); else setI(i + 1);
  }, [shown, full, i, lines.length, onDone]);

  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); next(); } };
    addEventListener('keydown', k);
    return () => removeEventListener('keydown', k);
  }, [next]);

  if (!line) return null;
  return (
    <div className="dlg panel fade-in" role="dialog" aria-label="Dialogue" onClick={next}>
      <Portrait who={line.who} mood={line.mood} speaking={shown < full} size={96} />
      <div>
        <div className="who">{NAMES[line.who]}</div>
        <div className={`txt${line.who === 'narrator' ? ' note' : ''}`} aria-live="polite">{line.text.slice(0, shown)}</div>
      </div>
      <div className="acts muted">
        <span>{i + 1} / {lines.length}</span>
        <span>
          <button className="btn small ghost" onClick={(e) => { e.stopPropagation(); onDone(); }}>Skip</button>{' '}
          <kbd>Space</kbd> to continue
        </span>
      </div>
    </div>
  );
}
