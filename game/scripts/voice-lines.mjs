// Records every scripted line once with ElevenLabs into public/voice/<key>.mp3 and writes public/voice/manifest.json.
// node scripts/voice-lines.mjs [--count]   (reads ELEVENLABS_API_KEY from .env.local; skips lines already recorded)
import fs from 'node:fs';
import { INTRO, ENDING, LEVELS } from '../src/story/content.ts';
import { TAUNTS, BARKS, SCHRO_HINTS, ARRIVAL } from '../src/story/barks.ts';
import { INTRO_BEATS } from '../src/story/intro.ts';
import { voiceKey } from '../src/audio/voiceKey.ts';
import { VOICES } from '../server/handlers.ts';

const DIR = new URL('../public/voice/', import.meta.url).pathname;
const env = Object.fromEntries(fs.readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]));

// same rule as Intro3D: extra lines of a character's beat that read as narration go to the narrator
const narration = (s) => /^(The|A|An|He|She|It|Heisenberg|Schrödinger|Werner|Erwin)\b/.test(s);
const lines = [];
const add = (who, text) => { if (text && who !== 'player') lines.push({ who, text }); };
for (const b of INTRO_BEATS) [b.text, ...(b.lines ?? [])].forEach((t, i) => add(i > 0 && b.who !== 'narrator' && b.who !== 'player' && narration(t) ? 'narrator' : b.who, t));
for (const l of [...INTRO, ...LEVELS.flatMap((v) => [...v.intro, ...v.outro]), ...ENDING]) add(l.who, l.text);
for (const t of Object.values(ARRIVAL)) add('schrodinger', t);
for (const t of Object.values(SCHRO_HINTS).flat()) add('schrodinger', t);
for (const b of Object.values(BARKS).flat()) { add('heisenberg', b.wrong); add('schrodinger', b.fix); }
for (const t of TAUNTS) add('heisenberg', t);

const todo = [...new Map(lines.map((l) => [voiceKey(l.who, l.text), l])).entries()];
const chars = todo.reduce((s, [, l]) => s + l.text.length, 0);
console.log(`${todo.length} unique lines, ${chars} characters`);
if (process.argv.includes('--count')) process.exit(0);

fs.mkdirSync(DIR, { recursive: true });
const done = new Set(fs.readdirSync(DIR).filter((f) => f.endsWith('.mp3')).map((f) => f.slice(0, -4)));
const spoken = (t) => t.replace(/\s*—\s*E\. Schrödinger\s*$/, '').replace(/\|(\d)>/g, 'ket $1');
let failed = 0;
for (let i = 0; i < todo.length; i += 4) { // four requests at a time
  await Promise.all(todo.slice(i, i + 4).map(async ([k, l]) => {
    if (done.has(k)) return;
    const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICES[l.who]}?output_format=mp3_44100_64`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'xi-api-key': env.ELEVENLABS_API_KEY, 'User-Agent': 'game-build' },
      body: JSON.stringify({ text: spoken(l.text), model_id: 'eleven_flash_v2_5' }),
    });
    if (!r.ok) { failed++; console.log('FAIL', r.status, (await r.text()).slice(0, 160), l.text.slice(0, 40)); return; }
    fs.writeFileSync(`${DIR}${k}.mp3`, Buffer.from(await r.arrayBuffer())); done.add(k);
  }));
  console.log(`${Math.min(i + 4, todo.length)}/${todo.length}`);
  if (failed > 3) break; // quota or key trouble: stop and keep what was recorded
}
fs.writeFileSync(`${DIR}manifest.json`, JSON.stringify([...done].sort()));
console.log(`recorded ${done.size}/${todo.length}, failed ${failed}`);
