import { useId, type ReactNode } from 'react';
import type { CharacterId, Mood } from '../types';
import { C } from '../styles/colors';

const SKIN = '#D9B08C';
const SKIN_DARK = '#C4906E';
const INK = '#23222b';
const PAPER = '#EFE6D2';

const NAMES: Record<CharacterId, string> = {
  schrodinger: 'Schrödinger',
  heisenberg: 'Heisenberg',
  narrator: 'Narrator',
};

/** Brows, eyes and mouth for the two face characters. Eyes sit at x=82 and x=118. */
function face(mood: Mood, eyeY: number, mouthY: number): ReactNode {
  const b = eyeY - 16; // brow baseline
  const m = mouthY;
  const brows: Record<Mood, [string, string]> = {
    neutral: [`M70 ${b} Q82 ${b - 3} 94 ${b}`, `M106 ${b} Q118 ${b - 3} 130 ${b}`],
    smug: [`M70 ${b + 1} L94 ${b}`, `M106 ${b - 9} Q118 ${b - 14} 130 ${b - 8}`],
    amused: [`M70 ${b - 3} Q82 ${b - 7} 94 ${b - 3}`, `M106 ${b - 3} Q118 ${b - 7} 130 ${b - 3}`],
    worried: [`M70 ${b + 2} L94 ${b - 6}`, `M106 ${b - 6} L130 ${b + 2}`],
    shocked: [`M70 ${b - 6} Q82 ${b - 14} 94 ${b - 6}`, `M106 ${b - 6} Q118 ${b - 14} 130 ${b - 6}`],
  };
  const [bl, br] = brows[mood];
  const browStroke = { stroke: INK, strokeWidth: 3, strokeLinecap: 'round' as const, fill: 'none' };

  const mouths: Record<Mood, ReactNode> = {
    neutral: <path d={`M88 ${m} L112 ${m}`} stroke={INK} strokeWidth={2.6} strokeLinecap="round" />,
    smug: <path d={`M88 ${m + 1} Q100 ${m + 2} 112 ${m - 5}`} stroke={INK} strokeWidth={2.6} strokeLinecap="round" fill="none" />,
    amused: <path d={`M80 ${m - 3} Q100 ${m + 24} 120 ${m - 3} Z`} fill="#3a1d24" stroke={INK} strokeWidth={2} />,
    worried: <path d={`M90 ${m + 3} Q100 ${m - 3} 110 ${m + 3}`} stroke={INK} strokeWidth={2.6} strokeLinecap="round" fill="none" />,
    shocked: <ellipse cx={100} cy={m + 2} rx={6} ry={8} fill="#3a1d24" stroke={INK} strokeWidth={2} />,
  };

  const shocked = mood === 'shocked';
  const eyes = [82, 118].map((cx) =>
    shocked ? (
      <g key={cx}>
        <circle cx={cx} cy={eyeY} r={6} fill="#fff" stroke={INK} strokeWidth={1.5} />
        <circle cx={cx} cy={eyeY} r={2.6} fill={INK} />
      </g>
    ) : (
      <circle key={cx} cx={cx} cy={eyeY} r={2.8} fill={INK} />
    ),
  );

  return (
    <>
      {eyes}
      <path d={bl} {...browStroke} />
      <path d={br} {...browStroke} />
      {mouths[mood]}
    </>
  );
}

function Schrodinger({ mood, uid }: { mood: Mood; uid: string }) {
  const tweed = `tw${uid}`;
  const hair = [
    [64, 74, 13], [70, 52, 15], [88, 38, 16], [112, 38, 16], [130, 52, 15], [136, 74, 13], [60, 96, 9], [140, 96, 9],
  ];
  return (
    <>
      <defs>
        <pattern id={tweed} width={7} height={7} patternUnits="userSpaceOnUse">
          <rect width={7} height={7} fill="#3d3f4f" />
          <path d="M0 0 L7 7 M7 0 L0 7" stroke="#55586d" strokeWidth={0.8} />
        </pattern>
      </defs>
      {/* jacket and neck */}
      <path d="M28 200 C30 158 56 140 84 136 L100 152 L116 136 C144 140 170 158 172 200 Z" fill={`url(#${tweed})`} />
      <rect x={88} y={128} width={24} height={20} fill={SKIN} />
      <path d="M90 136 L100 156 L110 136 Z" fill="#E4E6EC" />
      <path d="M100 156 L90 150 L90 162 Z M100 156 L110 150 L110 162 Z" fill={C.violet} />
      {/* wild white hair */}
      {hair.map(([x, y, r]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r={r} fill="#ECEEF4" />
      ))}
      {/* head */}
      <ellipse cx={100} cy={96} rx={40} ry={46} fill={SKIN} />
      <path d="M84 64 Q100 60 116 64 M86 70 Q100 67 114 70" stroke="#B0805E" strokeWidth={1.2} fill="none" />
      <path d="M100 100 q-3 8 2 10" stroke="#B0805E" strokeWidth={1.2} fill="none" />
      {face(mood, 96, 130)}
      {/* round wire glasses */}
      <g stroke="#B8C0CE" strokeWidth={1.8} fill="none">
        <circle cx={82} cy={96} r={11} />
        <circle cx={118} cy={96} r={11} />
        <path d="M93 95 Q100 92 107 95 M71 94 L64 90 M129 94 L136 90" />
      </g>
    </>
  );
}

function Heisenberg({ mood, uid }: { mood: Mood; uid: string }) {
  return (
    <>
      {/* dark clothing */}
      <path d="M26 200 C30 160 54 144 84 140 L100 156 L116 140 C146 144 170 160 174 200 Z" fill="#1b1d2a" />
      <path d="M88 140 L100 160 L112 140 Z" fill="#D9DEE8" />
      <rect x={88} y={134} width={24} height={18} fill={SKIN_DARK} />
      {/* flat-brimmed hat resting beside the shoulder, not on the head */}
      <ellipse cx={164} cy={172} rx={22} ry={5} fill="#101118" />
      <path d="M150 172 C150 152 158 150 164 150 C172 150 180 152 180 172 Z" fill="#15161f" />
      <rect x={150} y={164} width={30} height={4} fill="#3a3d4e" />
      {/* bald head */}
      <ellipse cx={62} cy={98} rx={6} ry={9} fill={SKIN_DARK} />
      <ellipse cx={138} cy={98} rx={6} ry={9} fill={SKIN_DARK} />
      <ellipse cx={100} cy={96} rx={38} ry={44} fill={SKIN_DARK} />
      <path d="M74 68 Q84 56 98 56" stroke="#fff" strokeOpacity={0.18} strokeWidth={4} strokeLinecap="round" fill="none" />
      <path d="M100 96 L98 108 L103 109" stroke="#A8775A" strokeWidth={1.4} fill="none" />
      {face(mood, 93, 128)}
      {/* neat goatee and moustache */}
      <path d="M88 122 Q94 118 100 121 Q106 118 112 122 Q106 124 100 123 Q94 124 88 122 Z" fill="#6B5A4E" />
      <path d="M94 130 Q100 134 106 130 L108 142 Q104 158 100 158 Q96 158 92 142 Z" fill="#6B5A4E" />
      {/* rectangular glasses */}
      <g stroke="#E8ECF4" strokeWidth={2.2} fill="none">
        <rect x={70} y={84} width={24} height={18} rx={2} />
        <rect x={106} y={84} width={24} height={18} rx={2} />
        <path d="M94 90 L106 90 M70 90 L64 88 M130 90 L136 88" />
      </g>
    </>
  );
}

function Narrator({ mood }: { mood: Mood }) {
  return (
    <>
      {/* handwritten note */}
      <rect x={56} y={48} width={88} height={112} rx={4} fill={PAPER} stroke="#8a7f68" strokeWidth={1.5} />
      <path d="M122 48 L144 70 L122 70 Z" fill="#cbbfa3" />
      {face(mood, 92, 112)}
      <g stroke="#8a7f68" strokeWidth={1.6} fill="none" strokeLinecap="round">
        <path d="M70 130 q6 -5 12 0 t12 0 t12 0 t14 0" />
        <path d="M70 142 q6 -5 12 0 t12 0 t12 0 t16 0" />
        <path d="M70 154 q6 -5 12 0 t12 0 t10 0" />
      </g>
      {/* quill */}
      <path d="M128 116 C136 98 158 84 178 74 C170 96 152 114 128 116 Z" fill="#f4efe3" stroke="#8a7f68" strokeWidth={1.2} />
      <path d="M168 178 L128 116" stroke="#C9A66B" strokeWidth={2.2} strokeLinecap="round" />
      <circle cx={128} cy={116} r={1.8} fill={INK} />
    </>
  );
}

/**
 * Framed vintage-lab portrait. Hand-authored vector art, scales via viewBox.
 * Narrator is a note with a quill; its face shows the mood.
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
  const uid = useId().replace(/:/g, '');
  const clipId = `pc${uid}`;
  const label = `${NAMES[who]}, ${mood}`;

  let figure: ReactNode;
  if (who === 'schrodinger') figure = <Schrodinger mood={mood} uid={uid} />;
  else if (who === 'heisenberg') figure = <Heisenberg mood={mood} uid={uid} />;
  else figure = <Narrator mood={mood} />;

  return (
    <svg
      role="img"
      aria-label={label}
      width={size}
      height={size}
      viewBox="0 0 200 200"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <clipPath id={clipId}>
          <rect x={12} y={12} width={176} height={176} rx={6} />
        </clipPath>
      </defs>
      {/* thin amber frame around a dark inner panel */}
      <rect x={4} y={4} width={192} height={192} rx={10} fill="none" stroke={C.amber} strokeWidth={3} />
      <rect x={12} y={12} width={176} height={176} rx={6} fill={C.bg} stroke={C.edge} strokeWidth={1} />
      <g clipPath={`url(#${clipId})`}>
        <circle cx={100} cy={100} r={74} fill={C.surface} />
        {figure}
      </g>
      {speaking && (
        <>
          <style>{`
            @keyframes portrait-pulse { 0%, 100% { opacity: 0.35; transform: scale(0.8); } 50% { opacity: 1; transform: scale(1.25); } }
            .portrait-pulse { transform-box: fill-box; transform-origin: center; animation: portrait-pulse 1.2s ease-in-out infinite; }
            @media (prefers-reduced-motion: reduce) { .portrait-pulse { animation: none; } }
          `}</style>
          <circle className="portrait-pulse" cx={184} cy={16} r={4.5} fill={C.amber} />
        </>
      )}
    </svg>
  );
}
