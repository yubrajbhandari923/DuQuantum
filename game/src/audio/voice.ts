// Character voices. speak() plays the recorded line for this exact text if one exists (public/voice), otherwise stays silent.
// One voice at a time: a new line, playUrl() (the tutor's live replies) or stopSpeaking() cuts the previous one.
import { voiceLevel } from './sfx';
import { voiceKey } from './voiceKey';
import { asset } from '../asset';

export type Voice = 'schrodinger' | 'heisenberg' | 'narrator';
let have: Promise<Set<string>> | null = null;
let cur: HTMLAudioElement | null = null;
let seq = 0;
let held = false; // a tutor reply is playing: barks wait instead of cutting it off

const recorded = () => (have ??= fetch(asset('voice/manifest.json')).then((r) => (r.ok ? r.json() : [])).then((k: string[]) => new Set(k)).catch(() => new Set<string>()));

export function playUrl(url: string, hold = false): HTMLAudioElement | null {
  stopSpeaking(); held = hold;
  if (!voiceLevel()) return null;
  cur = new Audio(url); cur.volume = voiceLevel();
  cur.play().catch(() => {});
  return cur;
}

export function speak(who: Voice, text: string): void {
  if (held && cur && !cur.paused && !cur.ended) return;
  const n = ++seq, k = voiceKey(who, text);
  void recorded().then((s) => { if (n === seq && s.has(k)) playUrl(asset(`voice/${k}.mp3`)); });
}

export function stopSpeaking(): void {
  seq++;
  if (cur) { cur.pause(); cur = null; }
}
