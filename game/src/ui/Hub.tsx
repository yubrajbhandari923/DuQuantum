import { useEffect, useState } from 'react';
import { LEVELS } from '../story/content';
import { FETCH } from '../story/barks';
import { LEVEL_COUNT, hasSet, nextLevel, useGame } from '../store';
import { useAim } from '../lab/Lab';
import { roman, useToast } from '../lab/Pickups';

/** Collection notice, then (when a set completes) Heisenberg's arrival line. */
function Toast() {
  const { msg, sub, key } = useToast();
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (!key) return;
    setShown(key);
    const id = setTimeout(() => setShown(0), sub ? 7000 : 3500);
    return () => clearTimeout(id);
  }, [key, sub]);
  if (!shown || shown !== key) return null;
  return (
    <div className="toast panel fade-in" key={key} role="status">
      <b>{msg}</b>
      {sub && <div className="toast-sub">{sub}</div>}
    </div>
  );
}

export function Hub() {
  const { completed, collected, openPanel, panel, go } = useGame();
  const aimed = useAim((s) => s.aimed);
  const cur = nextLevel(completed), lv = LEVELS.find((x) => x.id === cur)!;
  const set = FETCH[cur] ?? [], ready = hasSet(collected, completed, cur), allDone = completed.length >= LEVEL_COUNT;
  const part = aimed && aimed !== 'monitor' && aimed !== 'desk' ? Object.values(FETCH).flat().find((f) => f.id === aimed) : null;

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (panel) return;
      if (e.code === 'Tab') { e.preventDefault(); document.exitPointerLock(); openPanel('select'); }
      if (e.code === 'KeyN') { document.exitPointerLock(); openPanel('notebook'); }
    };
    addEventListener('keydown', k);
    return () => removeEventListener('keydown', k);
  }, [panel, openPanel]);

  return (
    <>
      <div className="hud-top">
        <div className="hud-col">
          <span className="chip num">{completed.length} / {LEVEL_COUNT} experiments</span>
          {!allDone && (
            <div className="checklist panel">
              <div className="cl-head">Experiment {roman(cur)} · {lv.title}</div>
              <ul>
                {set.map((f) => {
                  const have = ready || collected.includes(f.id);
                  return <li key={f.id} className={have ? 'have' : ''}><span aria-hidden>{have ? '✓' : '○'}</span><div>{f.name}{!have && <small>{f.hint}</small>}</div></li>;
                })}
              </ul>
              {ready && <div className="cl-foot">All parts on the desk. Power on the monitor.</div>}
            </div>
          )}
        </div>
        <div className="hud-row">
          <button className="btn small" onClick={() => openPanel('select')}>Blueprint <kbd>Tab</kbd></button>
          <button className="btn small" onClick={() => openPanel('notebook')}>Notebook <kbd>N</kbd></button>
          {completed.includes(1) && <button className="btn small" onClick={() => go('sandbox')}>Free lab</button>}
          <button className="btn small" onClick={() => openPanel('settings')}>Settings</button>
          <button className="btn small" onClick={() => go('menu')}>Menu</button>
        </div>
      </div>
      <div className={`reticle${aimed ? ' on' : ''}`} />
      {part && (
        <div className="prompt panel fade-in" key={part.id}>
          <b>{part.name}</b><div className="muted">Press <kbd>E</kbd> or click to take it to the desk</div>
        </div>
      )}
      {(aimed === 'monitor' || aimed === 'desk') && (
        <div className="prompt panel fade-in" key="monitor">
          {ready
            ? <><b>{cur}. {lv.title}</b><div className="muted">Press <kbd>E</kbd> or click to power on the bench</div></>
            : <><b>Components missing</b><div className="muted">{set.filter((f) => !collected.includes(f.id)).length} of {set.length} still somewhere in the study</div></>}
        </div>
      )}
      {!aimed && !panel && <div className="prompt muted" style={{ fontSize: 14 }}>Click to look around · <kbd>WASD</kbd> to walk · {ready ? 'the desk monitor is ready' : 'collect the glowing parts'}</div>}
      <Toast />
    </>
  );
}
