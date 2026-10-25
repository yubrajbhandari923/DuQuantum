import type { CharacterId, Mood } from '../types';
import { C } from '../styles/colors';
import { asset } from '../asset';

const NAMES: Record<CharacterId, string> = {
  schrodinger: 'Schrödinger',
  heisenberg: 'Heisenberg',
  narrator: 'Narrator',
};

const PHOTO: Partial<Record<CharacterId, string>> = {
  schrodinger: asset('tex/schrodinger_face.jpg'),
  heisenberg: asset('tex/heisenberg_face.jpg'),
};

/** Non-photo emblem: a note with a quill. */
function Emblem() {
  return (
    <svg viewBox="0 0 200 200" width="100%" height="100%" aria-hidden>
      <rect x={56} y={44} width={88} height={112} rx={4} fill="#EFE6D2" stroke="#8a7f68" strokeWidth={1.5} />
      <path d="M122 44 L144 66 L122 66 Z" fill="#cbbfa3" />
      <g stroke="#8a7f68" strokeWidth={1.6} fill="none" strokeLinecap="round">
        <path d="M70 90 q6 -5 12 0 t12 0 t12 0 t14 0" />
        <path d="M70 108 q6 -5 12 0 t12 0 t12 0 t16 0" />
        <path d="M70 126 q6 -5 12 0 t12 0 t10 0" />
      </g>
      <path d="M128 116 C136 98 158 84 178 74 C170 96 152 114 128 116 Z" fill="#f4efe3" stroke="#8a7f68" strokeWidth={1.2} />
      <path d="M168 178 L128 116" stroke="#C9A66B" strokeWidth={2.2} strokeLinecap="round" />
    </svg>
  );
}

/**
 * Framed vintage-lab portrait: graded photo in a brass/walnut oval frame.
 * Narrator shows a note-and-quill emblem instead of a photo.
 */
export function Portrait({
  who,
  mood = 'neutral',
  speaking = false,
  size = 160,
}: {
  who: CharacterId;
  mood?: Mood;
  speaking?: boolean;
  size?: number;
}) {
  const src = PHOTO[who];
  return (
    <div className={`portrait portrait-${who}${speaking ? ' speaking' : ''}`} role="img" aria-label={`${NAMES[who]}, ${mood}`} style={{ width: size, height: size }}>
      <div className="portrait-in">
        {src ? <img src={src} alt="" draggable={false} /> : <Emblem />}
      </div>
      {speaking && <span className="portrait-pulse" style={{ background: C.amber }} />}
    </div>
  );
}
