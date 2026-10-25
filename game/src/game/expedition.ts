// The first expedition's live state, shared by the 3D scenes (sparks, keeper, creatures) and the DOM
// (tracker, speech bubble, camera, guide, lens). The saved part (`save`) is mirrored to one cloud-save key
// by the controller in ui/Expedition.tsx; everything else lasts for the visit.
import { create } from "zustand";
import type { KeeperLine, Quest } from "../block";
import { EMPTY_EXP, ExpSave, PhotoRecord, QuestEvent } from "./quests";

export type ToolMode = null | "camera" | "lens" | "guide";

export interface DialogueState {
  lines: KeeperLine[];
  index: number;
  /** Runs when the last line is closed. */
  onDone?: () => void;
}

export interface PhotoResult {
  photo: PhotoRecord | null;
  /** Why there are fewer stars (a kind tip), or why there is no photo. */
  tip: string;
  best: boolean;
  /** Stage bits newly filled by this photo. */
  newStages: number;
}

export interface ExpState {
  loaded: boolean;
  /** The quests in play (props), set by the controller. */
  quests: Quest[] | null;
  save: ExpSave;
  dialogue: DialogueState | null;
  /** Dialogues waiting their turn. */
  queue: DialogueState[];
  mode: ToolMode;
  /** The hand lens is open on this creature (LiveCreature key + species). */
  lensOn: { key: string; species: string } | null;
  photo: PhotoResult | null;
  /** Field Guide page open (species id) or the index. */
  page: string | null;
  toast: { icon: string; text: string; at: number } | null;
  /** The keeper is talking (his animation). */
  talking: boolean;
  setSave: (s: ExpSave) => void;
  say: (d: DialogueState) => void;
  nextLine: () => void;
  setMode: (m: ToolMode) => void;
  /** Filled in by the controller: a thing happened in the world. */
  emit: (ev: QuestEvent) => void;
  /** Filled in by the controller: a creature came into view / was tapped. */
  seen: (species: string) => void;
  /** Filled in by the controller: a creature was tapped in the world. */
  tapCreature: (key: string, species: string) => void;
  showToast: (icon: string, text: string) => void;
}

export const useExp = create<ExpState>((set, get) => ({
  loaded: false,
  quests: null,
  save: EMPTY_EXP,
  dialogue: null,
  queue: [],
  mode: null,
  lensOn: null,
  photo: null,
  page: null,
  toast: null,
  talking: false,
  setSave: (s) => set({ save: s }),
  say: (d) => {
    if (!d.lines.length) {
      if (d.onDone) d.onDone();
      return;
    }
    if (get().dialogue) set({ queue: get().queue.concat(d) });
    else set({ dialogue: { ...d, index: 0 }, talking: true });
  },
  nextLine: () => {
    const d = get().dialogue;
    if (!d) return;
    if (d.index + 1 < d.lines.length) {
      set({ dialogue: { ...d, index: d.index + 1 } });
      return;
    }
    const [next, ...rest] = get().queue;
    set({ dialogue: next ? { ...next, index: 0 } : null, queue: rest, talking: !!next });
    if (d.onDone) d.onDone();
  },
  setMode: (m) => set({ mode: m, lensOn: m === "lens" ? get().lensOn : null, photo: null, page: m === "guide" ? get().page : null }),
  emit: () => undefined,
  seen: () => undefined,
  tapCreature: () => undefined,
  showToast: (icon, text) => set({ toast: { icon, text, at: Date.now() } }),
}));
