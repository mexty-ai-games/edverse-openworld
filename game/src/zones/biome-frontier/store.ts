// The Biome Frontier's live state, shared by the 3D scene and the DOM activity: what is open, picture
// mode, and the fossil dig's answers. (Creatures, photos and the Field Guide live in game/expedition.ts.)
import { create } from "zustand";

export type View = { kind: "dig" } | { kind: "station" } | { kind: "sign"; biome: string } | null;

export interface Dig {
  id: number;
  /** Fossil dig: answers given (0, 1 or 2) and how many were right first time. */
  digAnswers: number;
  digFirstTry: number;
}

export interface SurveyState {
  round: Dig;
  view: View;
  /** Picture mode for ages 4-6 (icons first, short facts). */
  easy: boolean;
  easyChosen: boolean;
  open: (v: View) => void;
  close: () => void;
  setEasy: (on: boolean, chosen?: boolean) => void;
  digAnswer: (firstTry: boolean) => void;
  newDig: () => void;
}

let digId = 1;

export const useSurvey = create<SurveyState>((set, get) => ({
  round: { id: digId, digAnswers: 0, digFirstTry: 0 },
  view: null,
  easy: false,
  easyChosen: false,
  open: (v) => set({ view: v }),
  close: () => set({ view: null }),
  setEasy: (on, chosen = true) => set({ easy: on, easyChosen: chosen || get().easyChosen }),
  digAnswer: (firstTry) => {
    const r = get().round;
    if (r.digAnswers >= 2) return;
    set({ round: { ...r, digAnswers: r.digAnswers + 1, digFirstTry: r.digFirstTry + (firstTry ? 1 : 0) } });
  },
  newDig: () => set({ round: { id: ++digId, digAnswers: 0, digFirstTry: 0 } }),
}));
