export type CharacterId = 'schrodinger' | 'heisenberg' | 'narrator';
export type Mood = 'neutral' | 'smug' | 'amused' | 'worried' | 'shocked';

export interface DialogueLine {
  who: CharacterId;
  text: string;
  mood?: Mood;
  audio?: string; // optional voice file path; text-only when absent
}

export interface NotebookPage {
  clue: string; // Schrödinger's handwritten clue, 1-2 sentences
  concept: string; // plain-language concept, 2-3 sentences
  equations: string[]; // plain-text equations, 1-3
  observation: string; // what the player should have seen
  hardware: string; // component or technique introduced
}

export interface LevelContent {
  id: number; // 1..10
  title: string;
  subtitle: string; // theme shown on the locked blueprint
  intro: DialogueLine[]; // before play, 2-4 lines
  outro: DialogueLine[]; // after completion, 1-3 lines
  takeaway: string; // one-sentence scientific takeaway
  hints: [string, string, string]; // conceptual, specific, explicit
  note: NotebookPage;
  completion: string; // short physics-specific completion message, e.g. "Resonance established."
}

/** Props every level screen receives. A level calls onComplete(score) exactly once when its physics objective is met. */
export interface LevelProps {
  onComplete: (result: { score: number; detail: string }) => void;
  onReport: (objective: string) => void; // live one-line objective/status shown in the HUD
}
