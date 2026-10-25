import { Suspense, useCallback, useEffect, useState } from 'react';
import { LEVELS } from '../story/content';
import { LEVEL_COUNT, hasSet, useGame } from '../store';
import { LEVEL_SCREENS } from '../levels';
import { Dialogue } from './Dialogue';
import { play } from '../audio/sfx';
import { tutorLive } from '../tutor/Tutor';

/** Wraps one level: intro dialogue, the bench, hint tiers, reset, and the completion sheet. */
export function LevelFrame() {
  const { level, complete, go, openLevel, openPanel, collected, completed } = useGame();
  const content = LEVELS.find((l) => l.id === level)!;
  const Screen = LEVEL_SCREENS[level];
  const [phase, setPhase] = useState<'intro' | 'play' | 'won'>('intro');
  const [outro, setOutro] = useState(false);
  const [run, setRun] = useState(0);
  const [tier, setTier] = useState(0);
  const [objective, setObjective] = useState('');
  const [detail, setDetail] = useState('');
  useEffect(() => { tutorLive.objective = objective; tutorLive.hints = tier; }, [objective, tier]); // what the tutor is told about this screen

  const onComplete = useCallback((r: { score: number; detail: string }) => {
    complete(level, r.score); setDetail(r.detail); setPhase('won'); setOutro(true); play(level === LEVEL_COUNT ? 'rescue' : 'complete');
  }, [complete, level]);

  const showHint = () => { play('click'); setTier((t) => Math.min(3, t + 1)); };
  const reset = () => { play('click'); setRun((r) => r + 1); setTier(0); setPhase('play'); };

  return (
    <div className="sle lvl">
      <header className="lvl-head panel">
        <button className="btn small" onClick={() => go('hub')}>Back to lab</button>
        <h2>{level}. {content.title}</h2>
        <div className="obj"><b>Objective.</b> {objective || content.subtitle}</div>
        <button className="btn small" onClick={showHint} disabled={tier >= 3}>Hint {tier ? `(${tier}/3)` : ''}</button>
        <button className="btn small" onClick={reset}>Reset experiment</button>
        <button className="btn small" onClick={() => openPanel('notebook')}>Notebook</button>
      </header>
      <main className="lvl-body panel" style={{ paddingBottom: phase === 'intro' || (phase === 'won' && outro) ? 230 : undefined }}>
        {tier > 0 && <p className="hint" role="status">{content.hints[tier - 1]}</p>}
        <Suspense fallback={<p className="muted">Warming up the instruments…</p>}>
          {phase !== 'intro' && <Screen key={run} onComplete={onComplete} onReport={setObjective} />}
        </Suspense>
      </main>
      {phase === 'intro' && <Dialogue lines={content.intro} onDone={() => setPhase('play')} />}
      {phase === 'won' && outro && <Dialogue lines={content.outro} onDone={() => setOutro(false)} />}
      {phase === 'won' && !outro && (
        <div className="scrim"><div className="win panel fade-in" role="dialog" aria-label="Experiment complete">
          <h2>{content.completion}</h2>
          <p>{content.takeaway}</p>
          {detail && <p className="muted num">{detail}</p>}
          <p style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button className="btn" onClick={() => go('hub')}>Back to lab</button>
            <button className="btn" onClick={() => setPhase('play')}>Keep experimenting</button>
            {level < LEVEL_COUNT
              ? hasSet(collected, completed, level + 1)
                ? <button className="btn primary" onClick={() => openLevel(level + 1)}>Next experiment</button>
                : <button className="btn primary" onClick={() => go('hub')}>Fetch the next components</button>
              : <button className="btn primary" onClick={() => go('ending')}>Open the box</button>}
          </p>
        </div></div>
      )}
    </div>
  );
}
