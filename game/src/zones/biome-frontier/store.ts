// The Biome Frontier's live state, shared by the 3D scene and the DOM activity: what is open, picture
// mode, and the real dig on the dig block (layers scraped away with the trowel, fossils brushed clean).
// (Creatures, photos and the Field Guide live in game/expedition.ts.)
import { create } from "zustand";
import type { Fossil } from "../../block";

export type View = { kind: "dig" } | { kind: "station" } | { kind: "sign"; biome: string } | null;

export type DigTool = "trowel" | "brush";
export type DigMsg = "" | "useBrush" | "useTrowel" | "brushFirst" | "layerGone" | "found";

/** Number of soil layers of the dig block (dig_layer0 .. dig_layer3, top to deepest). */
export const DIG_LAYERS = 4;

export interface DigState {
  id: number;
  /** Layers scraped away (0..4); the next one to scrape is `removed`. */
  removed: number;
  /** Progress on the current layer (0..1). */
  scrape: number;
  /** Brushing progress per fossil id (0..1, 1 = clean and found). */
  brushed: Record<string, number>;
  /** Fossil ids found, in the order they were found. */
  found: string[];
  /** Wrong-tool moments per fossil (first-try record). */
  slips: Record<string, number>;
  tool: DigTool;
  msg: DigMsg;
  msgAt: number;
  /** The fossil card on screen (just found). */
  card: string | null;
}

export interface SurveyState {
  dig: DigState;
  view: View;
  /** Picture mode for ages 4-6 (icons first, short facts). */
  easy: boolean;
  easyChosen: boolean;
  open: (v: View) => void;
  close: () => void;
  setEasy: (on: boolean, chosen?: boolean) => void;
  setDig: (d: Partial<DigState>) => void;
  newDig: () => void;
}

let digId = 1;
const freshDig = (): DigState => ({ id: digId++, removed: 0, scrape: 0, brushed: {}, found: [], slips: {}, tool: "trowel", msg: "", msgAt: 0, card: null });

export const useSurvey = create<SurveyState>((set, get) => ({
  dig: freshDig(),
  view: null,
  easy: false,
  easyChosen: false,
  open: (v) => set({ view: v }),
  close: () => set({ view: null }),
  setEasy: (on, chosen = true) => set({ easy: on, easyChosen: chosen || get().easyChosen }),
  setDig: (d) => set({ dig: { ...get().dig, ...d } }),
  newDig: () => set({ dig: freshDig() }),
}));

/** Fossils in the order they lie, top (youngest) to deepest (oldest). */
export function digOrder(fossils: Fossil[]): Fossil[] {
  return fossils.slice().sort((a, b) => a.layer - b.layer || a.ageMyr - b.ageMyr);
}

/** The fossil waiting to be brushed (uncovered but not clean yet), if any. */
export function exposedFossil(d: DigState, fossils: Fossil[]): Fossil | null {
  for (const f of digOrder(fossils)) {
    if (d.found.indexOf(f.id) >= 0) continue;
    // uncovered: every layer over it is gone; the deepest ones lie in the bedrock under the last layer
    return d.removed > Math.min(f.layer, DIG_LAYERS - 1) ? f : null;
  }
  return null;
}

/** All fossils found. */
export function digDone(d: DigState, fossils: Fossil[]): boolean {
  return fossils.length > 0 && fossils.every((f) => d.found.indexOf(f.id) >= 0);
}
