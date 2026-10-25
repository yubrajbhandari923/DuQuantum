// Schrödinger tutor backend: POST /api/tutor/chat (Gemini), /tts and /stt (ElevenLabs). Used by the vite plugin (server/tutor.ts)
// and by the Vercel function (api/tutor/[action].ts). Keys come from the environment and never reach the browser.
import type { IncomingMessage, ServerResponse } from 'node:http';

export const VOICES = { schrodinger: 'JBFqnCBsd6RMkjVDRZzb', heisenberg: 'N2lVS1w4EtoT3dr4eOWO', narrator: 'onwK4e9ZLuTAKqWW03F9' } as const; // George, Callum, Daniel (ElevenLabs premade)
type Env = Record<string, string | undefined>;

const SYSTEM = `You are Erwin Schrödinger in the game "Schrödinger's Last Experiment". Werner Heisenberg has locked the player's cat in a glass chamber behind a bomb with ten quantum locks; each lock opens when the player finishes one experiment that builds part of a superconducting cat-qubit computer. You are the player's teacher and ally.
How you answer:
- Two to four short sentences, plain text only (no markdown, no lists, no LaTeX); your words are read aloud. Write symbols in words where you can ("alpha squared", "h bar omega").
- Teach like a kind, slightly theatrical Viennese professor: ask a guiding question or give a nudge first. Give a more specific step if the player is stuck or asks again, and the full solution only when they ask for it plainly or have used all three hints.
- Use the game state you are given (screen, current experiment, objective, hints, notes, Heisenberg's wrong claims) to make the help concrete: name the instrument, the slider or the part to look at.
- The physics must be correct. If you are not sure, say so and suggest what to measure. Heisenberg's claims in the state are deliberately wrong; correct them when relevant.
- If the player drifts off topic, answer in one line and bring them back to the experiment and the cat.`;

const json = (res: ServerResponse, code: number, body: unknown) => { res.statusCode = code; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(body)); };
const body = (req: IncomingMessage, max: number) => new Promise<Buffer>((ok, fail) => {
  const parts: Buffer[] = []; let n = 0;
  req.on('data', (c: Buffer) => { n += c.length; if (n > max) { fail(new Error('too large')); req.destroy(); } else parts.push(c); });
  req.on('end', () => ok(Buffer.concat(parts))); req.on('error', fail);
});
const clip = (s: unknown, n: number) => String(s ?? '').slice(0, n);

export type Turn = { role: 'user' | 'model'; text: string };
export async function chat(env: Env, req: { message: string; history?: Turn[]; context?: string }) {
  const contents = [
    ...(req.history ?? []).slice(-10).map((t) => ({ role: t.role === 'model' ? 'model' : 'user', parts: [{ text: clip(t.text, 800) }] })),
    { role: 'user', parts: [{ text: `Game state:\n${clip(req.context, 6000)}\n\nPlayer: ${clip(req.message, 600)}` }] },
  ];
  const model = env.GEMINI_MODEL || 'gemini-3.5-flash';
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST', signal: AbortSignal.timeout(30000),
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY!, 'User-Agent': 'game-server' },
    body: JSON.stringify({ system_instruction: { parts: [{ text: SYSTEM }] }, contents, generationConfig: { maxOutputTokens: 600, temperature: 0.7, thinkingConfig: { thinkingLevel: 'low' } } }),
  });
  const d = await r.json() as { error?: { message: string }; candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] } }[] };
  if (!r.ok) throw new Error(d.error?.message ?? `gemini ${r.status}`);
  const text = (d.candidates?.[0]?.content?.parts ?? []).filter((p) => !p.thought).map((p) => p.text ?? '').join('').trim();
  return { reply: text || 'Hmm. Ask me that once more, my friend; the thought slipped away.' };
}

export async function tts(env: Env, text: string, who: keyof typeof VOICES = 'schrodinger', model = 'eleven_flash_v2_5') {
  const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICES[who] ?? VOICES.schrodinger}?output_format=mp3_44100_64`, {
    method: 'POST', signal: AbortSignal.timeout(30000),
    headers: { 'Content-Type': 'application/json', 'xi-api-key': env.ELEVENLABS_API_KEY!, 'User-Agent': 'game-server' },
    body: JSON.stringify({ text: clip(text, 1200), model_id: model }),
  });
  if (!r.ok) throw new Error(`elevenlabs tts ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return Buffer.from(await r.arrayBuffer());
}

export async function stt(env: Env, audio: Buffer, type: string) {
  const form = new FormData();
  form.append('model_id', 'scribe_v1');
  form.append('file', new Blob([new Uint8Array(audio)], { type }), 'speech.webm');
  const r = await fetch('https://api.elevenlabs.io/v1/speech-to-text', { method: 'POST', body: form, signal: AbortSignal.timeout(30000), headers: { 'xi-api-key': env.ELEVENLABS_API_KEY!, 'User-Agent': 'game-server' } });
  const d = await r.json() as { text?: string; detail?: unknown };
  if (!r.ok) throw new Error(`elevenlabs stt ${r.status}`);
  return { text: (d.text ?? '').trim() };
}

/** Express-style middleware for /api/tutor/*; `env` is read once at server start. */
export function tutorMiddleware(env: Env) {
  return async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const path = req.url?.split('?')[0];
    if (!path?.startsWith('/api/tutor/')) return next();
    if (req.method !== 'POST') return json(res, 405, { error: 'POST only' });
    try {
      if (path === '/api/tutor/chat') {
        if (!env.GEMINI_API_KEY) return json(res, 503, { error: 'The tutor is offline (no GEMINI_API_KEY).' });
        return json(res, 200, await chat(env, JSON.parse((await body(req, 64000)).toString())));
      }
      if (!env.ELEVENLABS_API_KEY) return json(res, 503, { error: 'Voices are offline (no ELEVENLABS_API_KEY).' });
      if (path === '/api/tutor/tts') {
        const { text, who } = JSON.parse((await body(req, 8000)).toString());
        const mp3 = await tts(env, text, who);
        res.setHeader('Content-Type', 'audio/mpeg'); return res.end(mp3);
      }
      if (path === '/api/tutor/stt') return json(res, 200, await stt(env, await body(req, 5_000_000), req.headers['content-type'] ?? 'audio/webm'));
      json(res, 404, { error: 'unknown endpoint' });
    } catch (e) {
      console.error('[tutor]', (e as Error).message);
      json(res, 502, { error: 'The tutor could not answer just now.' });
    }
  };
}

