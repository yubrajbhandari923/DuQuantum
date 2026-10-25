// File key of a recorded line: FNV-1a of "who|text", shared by speak() and scripts/voice-lines.mjs.
export function voiceKey(who: string, text: string): string {
  let h = 0x811c9dc5;
  for (const ch of `${who}|${text}`) { h ^= ch.codePointAt(0)!; h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16).padStart(8, '0');
}
