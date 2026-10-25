import type { ReactNode } from 'react';
import { C } from '../styles/colors';

const BLACK = '#0c0d13';

/** Amber eyes with a soft glow and vertical slit pupils. */
function Eyes({ points, r }: { points: [number, number][]; r: number }) {
  return (
    <>
      {points.map(([x, y]) => (
        <g key={`${x}-${y}`}>
          <circle cx={x} cy={y} r={r * 2.4} fill={C.amber} opacity={0.18} />
          <circle cx={x} cy={y} r={r} fill={C.amber} />
          <rect x={x - r * 0.18} y={y - r * 0.8} width={r * 0.36} height={r * 1.6} rx={r * 0.18} fill={BLACK} />
        </g>
      ))}
    </>
  );
}

/**
 * Stylized black cat with amber eyes. 'boxed' shows only the eyes in a cut-out,
 * 'sitting' and 'walking' are full bodies. Scales via viewBox.
 */
export function CatSprite({ state, size = 160 }: { state: 'boxed' | 'walking' | 'sitting'; size?: number }) {
  const label = state === 'boxed' ? 'Cat peeking from a box' : state === 'walking' ? 'Cat walking' : 'Cat sitting';

  let art: ReactNode;
  if (state === 'boxed') {
    art = (
      <>
        <rect x={34} y={44} width={132} height={120} rx={6} fill={C.surface2} stroke={C.edge} strokeWidth={2} />
        <path d="M34 70 L166 70" stroke={C.edge} strokeWidth={2} />
        <rect x={66} y={96} width={68} height={44} rx={10} fill="#04050a" />
        <Eyes points={[[86, 118], [114, 118]]} r={4.5} />
      </>
    );
  } else if (state === 'sitting') {
    art = (
      <>
        <ellipse cx={100} cy={186} rx={54} ry={6} fill="#000" opacity={0.35} />
        <path d="M134 176 C178 182 184 142 172 112" stroke={BLACK} strokeWidth={9} strokeLinecap="round" fill="none" />
        <path d="M66 178 C50 140 62 102 86 94 L114 94 C138 102 150 140 134 178 Z" fill={BLACK} />
        <path d="M77 62 L74 26 L98 46 Z" fill={BLACK} />
        <path d="M123 62 L126 26 L102 46 Z" fill={BLACK} />
        <circle cx={100} cy={72} r={28} fill={BLACK} />
        <ellipse cx={88} cy={176} rx={10} ry={6} fill={BLACK} />
        <ellipse cx={112} cy={176} rx={10} ry={6} fill={BLACK} />
        <Eyes points={[[90, 70], [110, 70]]} r={4.2} />
      </>
    );
  } else {
    art = (
      <>
        <ellipse cx={100} cy={182} rx={72} ry={5} fill="#000" opacity={0.35} />
        {/* tail held up */}
        <path d="M56 106 C36 102 26 84 28 56" stroke={BLACK} strokeWidth={8} strokeLinecap="round" fill="none" />
        {/* legs mid-stride, drawn under the body */}
        <g stroke={BLACK} strokeWidth={10} strokeLinecap="round" fill="none">
          <path d="M62 118 L48 150 L40 170" />
          <path d="M80 120 L86 156 L78 176" />
          <path d="M124 120 L142 150 L154 172" />
          <path d="M108 120 L100 156 L108 176" />
        </g>
        <path d="M50 108 C50 92 70 84 100 86 C124 88 140 94 146 108 C148 122 138 128 118 128 L64 128 C54 128 50 120 50 108 Z" fill={BLACK} />
        <path d="M142 72 L141 48 L160 64 Z" fill={BLACK} />
        <path d="M158 64 L172 48 L172 72 Z" fill={BLACK} />
        <circle cx={158} cy={82} r={18} fill={BLACK} />
        <Eyes points={[[164, 80]]} r={3.4} />
      </>
    );
  }

  return (
    <svg
      role="img"
      aria-label={label}
      width={size}
      height={size}
      viewBox="0 0 200 200"
      xmlns="http://www.w3.org/2000/svg"
    >
      {art}
    </svg>
  );
}
