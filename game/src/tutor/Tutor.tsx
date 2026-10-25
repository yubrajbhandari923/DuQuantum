import { useEffect, useRef, useState } from 'react';
import { nextLevel, useGame } from '../store';
import { LEVELS } from '../story/content';
import { BARKS, FETCH } from '../story/barks';
import { Portrait } from '../ui/Portrait';
import { playUrl, stopSpeaking } from '../audio/voice';
import { play } from '../audio/sfx';

type Turn = { role: 'user' | 'model'; text: string };
/** What the open level screen reports (LevelFrame writes it): the live objective line and how many hints are shown. */
export const tutorLive = { objective: '', hints: 0 };
const canMic = typeof MediaRecorder !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;

/** The game state Schrödinger is told about with every question. */
function context(): string {
  const g = useGame.getState(), inLevel = g.screen === 'level';
  const id = inLevel ? g.level : nextLevel(g.completed), L = LEVELS.find((l) => l.id === id), parts = FETCH[id] ?? [];
  const missing = parts.filter((p) => !g.collected.includes(p.id) && !g.completed.includes(id));
  return [
    `Screen: ${inLevel ? `inside experiment ${id}, at the desk monitor` : 'walking around the study (the hub), looking for parts or heading to the desk'}.`,
    `Finished experiments: ${g.completed.length ? g.completed.join(', ') : 'none'} of 10.`,
    L && `Current experiment ${id}: "${L.title}", ${L.subtitle}.`,
    inLevel && tutorLive.objective && `Status line on the player's screen: ${tutorLive.objective}`,
    inLevel && `Game hints already revealed to the player: ${tutorLive.hints} of 3.`,
    !inLevel && parts.length && (missing.length ? `Parts still to find for it: ${missing.map((p) => `${p.name} (${p.hint})`).join('; ')}.` : 'All its parts are on the desk; the player can power on the monitor.'),
    L && `What the experiment teaches: ${L.takeaway}`,
    L && `Notebook page: clue: ${L.note.clue} Concept: ${L.note.concept} Equations: ${L.note.equations.join('; ')}. What the player should see: ${L.note.observation} Hardware: ${L.note.hardware}`,
    L && `The game's three hints, nudge to answer: 1) ${L.hints[0]} 2) ${L.hints[1]} 3) ${L.hints[2]}`,
    BARKS[id] && `Heisenberg's wrong claims here, with corrections: ${BARKS[id].map((b) => `"${b.wrong}" -> "${b.fix}"`).join(' ')}`,
  ].filter(Boolean).join('\n');
}

async function post(path: string, body: BodyInit, type = 'application/json') {
  const api = (import.meta.env.VITE_TUTOR_API_URL || '').replace(/\/$/, '');
  const r = await fetch(`${api}/api/tutor/${path}`, { method: 'POST', headers: { 'Content-Type': type }, body });
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? (r.status === 404 ? 'The live tutor needs a connected API server.' : 'The tutor could not answer just now.'));
  return r;
}

/** "Ask Schrödinger": text or voice chat with the tutor (Gemini), his replies spoken (ElevenLabs). T toggles it. */
export function Tutor() {
  const screen = useGame((s) => s.screen);
  const where = screen === 'hub' || screen === 'level';
  const [open, setOpen] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState<'' | 'think' | 'listen' | 'hear'>('');
  const [voice, setVoice] = useState(true);
  const [talking, setTalking] = useState(false);
  const [err, setErr] = useState('');
  const rec = useRef<MediaRecorder | null>(null);
  const log = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.code !== 'KeyT' || !where || e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      e.preventDefault(); setOpen((o) => !o);
    };
    addEventListener('keydown', k); return () => removeEventListener('keydown', k);
  }, [where]);
  useEffect(() => { if (open) { document.exitPointerLock?.(); setTimeout(() => input.current?.focus(), 0); } else rec.current?.stop(); }, [open]);
  useEffect(() => { log.current?.scrollTo(0, log.current.scrollHeight); }, [turns, busy, err]);
  useEffect(() => { if (!where) setOpen(false); }, [where]);

  const say = async (reply: string) => {
    try {
      const url = URL.createObjectURL(await (await post('tts', JSON.stringify({ text: reply, who: 'schrodinger' }))).blob());
      const a = playUrl(url, true);
      if (a) { setTalking(true); a.onended = a.onpause = () => { setTalking(false); URL.revokeObjectURL(url); }; }
    } catch { /* the text reply is already on screen */ }
  };

  const ask = async (msg: string) => {
    msg = msg.trim();
    if (!msg) return;
    const history = turns.slice(-10);
    setTurns((t) => [...t, { role: 'user', text: msg }]); setText(''); setBusy('think'); setErr('');
    try {
      const { reply } = await (await post('chat', JSON.stringify({ message: msg, history, context: context() }))).json();
      setTurns((t) => [...t, { role: 'model', text: reply }]); play('click');
      if (voice) void say(reply);
    } catch (e) { setErr((e as Error).message); }
    setBusy('');
  };

  const mic = async () => {
    if (rec.current) return rec.current.stop();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const m = new MediaRecorder(stream), chunks: Blob[] = [];
      m.ondataavailable = (e) => chunks.push(e.data);
      m.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop()); rec.current = null; setBusy('hear');
        try {
          const type = m.mimeType || 'audio/webm';
          const { text: heard } = await (await post('stt', new Blob(chunks, { type }), type)).json();
          setBusy('');
          if (heard) await ask(heard); else setErr('I did not catch that. Once more?');
        } catch (e) { setBusy(''); setErr((e as Error).message); }
      };
      stopSpeaking(); rec.current = m; m.start(); setBusy('listen'); setErr('');
    } catch { setErr('No microphone available. Type instead.'); }
  };

  if (!where) return null;
  if (!open) return <button className="btn small tutor-open" onClick={() => setOpen(true)}>Ask Schrödinger <kbd>T</kbd></button>;
  return (
    <aside className="tutor panel fade-in" aria-label="Ask Schrödinger" onKeyDown={(e) => e.stopPropagation()} onKeyUp={(e) => e.stopPropagation()}>
      <header>
        <Portrait who="schrodinger" speaking={talking || busy === 'think'} size={56} />
        <div><div className="who">Schrödinger</div><div className="muted tutor-sub">Your tutor. Ask about the experiment, or say hello.</div></div>
        <button className="btn small ghost" onClick={() => { setVoice((v) => !v); stopSpeaking(); }} aria-pressed={voice} title="His voice">{voice ? 'Voice on' : 'Voice off'}</button>
        <button className="btn small ghost" onClick={() => { setOpen(false); stopSpeaking(); }} aria-label="Close">×</button>
      </header>
      <div className="tutor-log" ref={log} aria-live="polite">
        {!turns.length && <p className="muted">"Stuck on a lock? Tell me what you see on the monitor, and we will reason it out together."</p>}
        {turns.map((t, i) => <p key={i} className={t.role === 'user' ? 'me' : 'him'}>{t.text}</p>)}
        {busy && <p className="muted">{busy === 'think' ? 'Schrödinger is thinking…' : busy === 'listen' ? 'Listening… click Stop when done.' : 'Writing down what you said…'}</p>}
        {err && <p className="tutor-err">{err}</p>}
      </div>
      <form onSubmit={(e) => { e.preventDefault(); if (!busy) void ask(text); }}>
        <input ref={input} value={text} onChange={(e) => setText(e.target.value)} maxLength={500} placeholder="Ask a question…" aria-label="Your question"
          onKeyDown={(e) => { if (e.key === 'Escape') setOpen(false); }} />
        {canMic && <button type="button" className={`btn small${busy === 'listen' ? ' primary' : ''}`} onClick={mic} disabled={busy === 'think' || busy === 'hear'}>{busy === 'listen' ? 'Stop' : 'Speak'}</button>}
        <button className="btn small primary" disabled={!!busy || !text.trim()}>Send</button>
      </form>
    </aside>
  );
}
