import { lazy, type ComponentType } from 'react';
import type { LevelProps } from '../types';

/** One screen per level id. Add a level by creating levels/LevelN.tsx (default export) and listing it here. */
export const LEVEL_SCREENS: Record<number, ComponentType<LevelProps>> = Object.fromEntries(
  [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => [n, lazy(() => import(`./Level${n}.tsx`))]),
);
