// The field survey's live state, shared by the 3D scene (which cards still glow) and the DOM activity
// (what is open, the score). A small zustand store: one per page, reset by newRound().
import { create } from "zustand";
import type { Species } from "./types";
import { CARD_SPOTS } from "./layout";

export type View =
  | { kind: "card"; spot: number }
  | { kind: "dig" }
  | { kind: "station" }
  | { kind: "sign"; biome: string }
  | null;

export interface CardResult {
  firstTry: boolean;
}

export interface Round {
  id: number;
  /** Species id lying at each card spot. */
  picks: string[];
  cards: Record<number, CardResult>;
  /** Fossil dig: answers given (0, 1 or 2) and how many were right first time. */
  digAnswers: number;
  digFirstTry: number;
  startedAt: number;
  reported: boolean;
}

export interface SurveyState {
  round: Round | null;
  view: View;
  /** Picture mode for ages 4-6 (icons first, short facts). */
  easy: boolean;
  easyChosen: boolean;
  open: (v: View) => void;
  close: () => void;
  setEasy: (on: boolean, chosen?: boolean) => void;
  ensureRound: (species: Species[], size: number) => void;
  newRound: (species: Species[], size: number) => void;
  cardDone: (spot: number, firstTry: boolean) => void;
  digAnswer: (firstTry: boolean) => void;
  markReported: () => void;
}

function shuffle<T>(a: T[]): T[] {
  const b = a.slice();
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
}

/** `size` species (at least 2 from each biome when the pool allows), in random spots. */
export function drawPicks(species: Species[], size: number): string[] {
  const n = Math.max(1, Math.min(size, CARD_SPOTS.length, species.length));
  const byBiome = new Map<string, Species[]>();
  for (const s of shuffle(species)) byBiome.set(s.biome, (byBiome.get(s.biome) || []).concat(s));
  const picks: string[] = [];
  byBiome.forEach((list) => list.slice(0, 2).forEach((s) => picks.length < n && picks.push(s.id)));
  for (const s of shuffle(species)) if (picks.length < n && picks.indexOf(s.id) < 0) picks.push(s.id);
  return shuffle(picks);
}

let roundId = 0;

export const useSurvey = create<SurveyState>((set, get) => ({
  round: null,
  view: null,
  easy: false,
  easyChosen: false,
  open: (v) => set({ view: v }),
  close: () => set({ view: null }),
  setEasy: (on, chosen = true) => set({ easy: on, easyChosen: chosen || get().easyChosen }),
  ensureRound: (species, size) => {
    if (!get().round && species.length) get().newRound(species, size);
  },
  newRound: (species, size) =>
    set({ round: { id: ++roundId, picks: drawPicks(species, size), cards: {}, digAnswers: 0, digFirstTry: 0, startedAt: Date.now(), reported: false } }),
  cardDone: (spot, firstTry) => {
    const r = get().round;
    if (!r || r.cards[spot]) return;
    set({ round: { ...r, cards: { ...r.cards, [spot]: { firstTry } } } });
  },
  digAnswer: (firstTry) => {
    const r = get().round;
    if (!r || r.digAnswers >= 2) return;
    set({ round: { ...r, digAnswers: r.digAnswers + 1, digFirstTry: r.digFirstTry + (firstTry ? 1 : 0) } });
  },
  markReported: () => {
    const r = get().round;
    if (r) set({ round: { ...r, reported: true } });
  },
}));

/** Answers in a round: one per card + 2 for the dig. */
export function roundTotals(r: Round | null) {
  if (!r) return { done: 0, total: 0, firstTry: 0, complete: false, cardsDone: 0 };
  const cardsDone = Object.keys(r.cards).length;
  const done = cardsDone + r.digAnswers;
  const total = r.picks.length + 2;
  const firstTry = Object.values(r.cards).filter((c) => c.firstTry).length + r.digFirstTry;
  return { done, total, firstTry, complete: done >= total, cardsDone };
}
