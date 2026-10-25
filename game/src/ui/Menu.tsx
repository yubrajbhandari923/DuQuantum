import { useGame } from '../store';
import { play } from '../audio/sfx';
import { CatSprite } from './CatSprite';

export function Menu() {
  const { started, completed, go, newGame, openPanel } = useGame();
  const resume = started || completed.length > 0;
  return (
    <div className="sle menu">
      <div className="fade-in">
        <h1 data-t="Schrödinger’s Last Experiment"><span>Schrödinger’s</span><span>Last Experiment</span></h1>
        <p className="sub">Your cat is trapped. Your quantum computer is not yet built.</p>
        <nav>
          <button className="btn primary" onClick={() => { play('connect'); resume ? (window.confirm('Start over? Your saved progress will be erased.') && newGame()) : newGame(); }}>Begin experiment</button>
          <button className="btn" disabled={!resume} onClick={() => { play('click'); go('hub'); }}>Continue experiment</button>
          <button className="btn" disabled={!completed.includes(1)} title={completed.includes(1) ? undefined : 'Finish experiment 1 first'} onClick={() => { play('click'); go('sandbox'); }}>Free laboratory</button>
          <button className="btn" onClick={() => { play('click'); go('manual'); }}>Laboratory manual</button>
          <button className="btn" onClick={() => { play('click'); openPanel('settings'); }}>Settings</button>
        </nav>
      </div>
      <button className="cat" aria-label="The box. Something inside is meowing." onClick={() => play('meow')} style={{ background: 'none', border: 0 }}>
        <CatSprite state="boxed" size={120} />
      </button>
    </div>
  );
}

export function Manual() {
  const go = useGame((s) => s.go);
  return (
    <div className="scrim"><div className="sheet panel">
      <h2>Laboratory manual</h2>
      <p className="muted">Walk the lab, step up to a console, and run the experiment. Each success unlocks the next console.</p>
      <ul style={{ lineHeight: 1.9 }}>
        <li><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> move, mouse looks (click the scene to capture it, <kbd>Esc</kbd> releases)</li>
        <li><kbd>E</kbd> or click opens the console you are facing</li>
        <li><kbd>Tab</kbd> opens the blueprint, to jump to any unlocked experiment without walking</li>
        <li><kbd>N</kbd> opens Schrödinger’s notebook</li>
        <li>In a bench: drag parts and sliders. The instruments respond to the physics, not to a script.</li>
        <li>Stuck? The hint button gives three tiers: a nudge, specific advice, and the answer.</li>
      </ul>
      <button className="btn primary" onClick={() => go('menu')}>Back</button>
    </div></div>
  );
}
