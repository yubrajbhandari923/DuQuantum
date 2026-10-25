import { create } from 'zustand';
import { setMuted, setVolume } from './audio/sfx';

export type Screen = 'menu' | 'intro' | 'hub' | 'level' | 'ending' | 'manual' | 'sandbox';
export const LEVEL_COUNT = 10;
const KEY = 'sle-save-v1';

interface Save {
  completed: number[];
  notes: number[]; // notebook pages discovered
  best: Record<number, number>;
  started: boolean;
  settings: { muted: boolean; master: number; quality: 'low' | 'high' };
}

const fresh = (): Save => ({ completed: [], notes: [], best: {}, started: false, settings: { muted: false, master: 0.7, quality: 'high' } });

function load(): Save {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...fresh(), ...JSON.parse(raw) } : fresh();
  } catch { return fresh(); }
}

interface Game extends Save {
  screen: Screen;
  level: number; // active level id (1..10)
  panel: null | 'notebook' | 'select' | 'settings';
  go: (s: Screen) => void;
  openLevel: (id: number) => void;
  complete: (id: number, score: number) => void;
  openPanel: (p: Game['panel']) => void;
  setSettings: (p: Partial<Save['settings']>) => void;
  newGame: () => void;
  resetAll: () => void;
}

export const useGame = create<Game>((set, get) => {
  const persist = () => {
    const { completed, notes, best, started, settings } = get();
    try { localStorage.setItem(KEY, JSON.stringify({ completed, notes, best, started, settings })); } catch { /* storage unavailable */ }
  };
  const init = load();
  setMuted(init.settings.muted); setVolume('master', init.settings.master);
  return {
    ...init,
    screen: 'menu', level: 1, panel: null,
    go: (screen) => set({ screen, panel: null }),
    openLevel: (id) => { if (isUnlocked(get().completed, id)) set({ screen: 'level', level: id, panel: null }); },
    complete: (id, score) => {
      const s = get();
      set({
        completed: s.completed.includes(id) ? s.completed : [...s.completed, id],
        notes: s.notes.includes(id) ? s.notes : [...s.notes, id],
        best: { ...s.best, [id]: Math.max(s.best[id] ?? 0, score) },
      });
      persist();
    },
    openPanel: (panel) => set({ panel }),
    setSettings: (p) => {
      const settings = { ...get().settings, ...p };
      setMuted(settings.muted); setVolume('master', settings.master);
      set({ settings }); persist();
    },
    newGame: () => { set({ ...fresh(), settings: get().settings, started: true, screen: 'intro' }); persist(); },
    resetAll: () => { set({ ...fresh(), screen: 'menu' }); persist(); },
  };
});

export const isUnlocked = (completed: number[], id: number) => id === 1 || completed.includes(id - 1);
export const nextLevel = (completed: number[]) => Math.min(LEVEL_COUNT, completed.length ? Math.max(...completed) + 1 : 1);
