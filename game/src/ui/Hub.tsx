import { useEffect } from 'react';
import { LEVELS } from '../story/content';
import { LEVEL_COUNT, isUnlocked, useGame } from '../store';
import { useAim } from '../lab/Lab';

export function Hub() {
  const { completed, openPanel, panel, go } = useGame();
  const aimed = useAim((s) => s.aimed);
  const l = aimed ? LEVELS.find((x) => x.id === aimed) : null;
  const open = aimed ? isUnlocked(completed, aimed) : false;

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
        <div className="hud-row">
          <span className="chip num">{completed.length} / {LEVEL_COUNT} experiments</span>
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
      {l && (
        <div className="prompt panel fade-in" key={l.id}>
          {open
            ? <><b>{l.id}. {l.title}</b><div className="muted">Press <kbd>E</kbd> or click to begin</div></>
            : <><b>Locked</b><div className="muted">Finish experiment {l.id - 1} first</div></>}
        </div>
      )}
      {!aimed && !panel && <div className="prompt muted" style={{ fontSize: 14 }}>Click to look around · <kbd>WASD</kbd> to walk · face a glowing console</div>}
    </>
  );
}
