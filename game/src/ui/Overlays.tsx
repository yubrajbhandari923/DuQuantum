import { useState } from 'react';
import { LEVELS } from '../story/content';
import { LEVEL_COUNT, hasSet, isUnlocked, nextLevel, useGame } from '../store';
import { FETCH } from '../story/barks';
import { play } from '../audio/sfx';

const Close = ({ label = 'Close' }: { label?: string }) => {
  const openPanel = useGame((s) => s.openPanel);
  return <button className="btn" onClick={() => { play('click'); openPanel(null); }}>{label}</button>;
};

export function Blueprint() {
  const { completed, collected, openLevel, openPanel } = useGame();
  return (
    <div className="scrim" onClick={() => openPanel(null)}><div className="sheet panel" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Laboratory blueprint">
      <h2>Laboratory blueprint</h2>
      <p className="muted">{completed.length} of {LEVEL_COUNT} experiments complete. Locked experiments open in order.</p>
      <div className="blueprint">
        {LEVELS.map((l) => {
          const open = isUnlocked(completed, l.id), parts = hasSet(collected, completed, l.id);
          return (
            <button key={l.id} className={`bp${completed.includes(l.id) ? ' done' : ''}`} disabled={!open || !parts} onClick={() => { play('connect'); openLevel(l.id); }}>
              <span className="n">{l.id}</span>
              <b>{open ? l.title : 'Locked'}</b>
              <small>{completed.includes(l.id) ? 'Complete' : open && !parts ? 'Components missing' : l.subtitle}</small>
            </button>
          );
        })}
      </div>
      <p><Close /></p>
    </div></div>
  );
}

export function Notebook() {
  const notes = useGame((s) => s.notes);
  const [sel, setSel] = useState(notes.length ? Math.max(...notes) : 1);
  const l = LEVELS.find((x) => x.id === sel);
  return (
    <div className="scrim" onClick={() => useGame.getState().openPanel(null)}><div className="sheet panel" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Schrödinger's notebook">
      <h2>Schrödinger’s notebook</h2>
      <div className="nb" style={{ marginTop: 14 }}>
        <ul>{LEVELS.map((x) => (
          <li key={x.id}><button aria-current={sel === x.id} disabled={!notes.includes(x.id)} onClick={() => { play('reveal'); setSel(x.id); }}>{x.id}. {notes.includes(x.id) ? x.title : 'Not yet found'}</button></li>
        ))}</ul>
        {l && notes.includes(l.id)
          ? <article className="page fade-in" key={l.id}>
              <h3>{l.title}</h3>
              <div className="clue">“{l.note.clue}”</div>
              <p>{l.note.concept}</p>
              {l.note.equations.map((e) => <div className="eq" key={e}>{e}</div>)}
              <p><b>What you should have seen.</b> {l.note.observation}</p>
              <p><b>Equipment.</b> {l.note.hardware}</p>
            </article>
          : <p className="muted">Finish an experiment to find its page.</p>}
      </div>
      <p><Close /></p>
    </div></div>
  );
}

export function Settings() {
  const { settings, setSettings, resetAll, completed, collected, collect } = useGame();
  const missing = (FETCH[nextLevel(completed)] ?? []).filter((f) => !collected.includes(f.id)).map((f) => f.id);
  return (
    <div className="scrim" onClick={() => useGame.getState().openPanel(null)}><div className="sheet panel" style={{ maxWidth: 480 }} onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Settings">
      <h2>Settings</h2>
      <label className="toggle">Sound <input type="checkbox" checked={!settings.muted} onChange={(e) => setSettings({ muted: !e.target.checked })} /></label>
      <label className="toggle">Volume <input type="range" min={0} max={1} step={0.05} value={settings.master} onChange={(e) => setSettings({ master: +e.target.value })} /></label>
      <label className="toggle">Graphics
        <select value={settings.quality} onChange={(e) => setSettings({ quality: e.target.value as 'low' | 'high' })}>
          <option value="high">High</option><option value="low">Low (faster)</option>
        </select>
      </label>
      <div className="toggle"><span>Stuck searching the study?</span>
        <button className="btn small" disabled={!missing.length} onClick={() => { play('success'); collect(missing); }}>Fetch them for me</button>
      </div>
      <div className="toggle"><span>Opening scene</span>
        <button className="btn small" onClick={() => useGame.getState().go('cutscene')}>Replay intro</button>
      </div>
      <div className="toggle"><span>Erase all progress</span>
        <button className="btn small" onClick={() => window.confirm('Erase every completed experiment and notebook page?') && resetAll()}>Reset campaign</button>
      </div>
      <p><Close label="Done" /></p>
    </div></div>
  );
}
