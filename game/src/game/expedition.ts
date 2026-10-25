// The first expedition's live state, shared by the 3D scenes (sparks, keeper, creatures) and the DOM
// (tracker, speech bubble, camera, guide, lens). The saved part (`save`) is mirrored to one cloud-save key
// by the controller in ui/Expedition.tsx; everything else lasts for the visit.
import { create } from "zustand";
import type { KeeperLine, Quest } from "../block";
import { EMPTY_EXP, ExpSave, PhotoRecord, QuestEvent } from "./quests";

export type ToolMode = null | "camera" | "lens" | "guide" | "net";

/** The creature in the catch-and-release jar (this visit only: it can never be kept). */
export interface JarState {
  /** LiveCreature key (the creature hides in the world while it is in the jar). */
  key: string;
  species: string;
  zone: string;
  /** Where it was caught: it must be let go here. */
  x: number;
  z: number;
  /** Looked at closely (counted legs and body parts) / measured / weighed this time. */
  looked: boolean;
  measured: boolean;
  weighed: boolean;
}

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
  jar: JarState | null;
  /** The jar card is open, on this tab. */
  jarTab: null | "look" | "measure" | "weigh";
  /** The net's last sweep (performance.now()), for its swing in the world. */
  sweepAt: number;
  /** The net sweep's progress while the explorer drags or holds the key (0..1), -1 = at rest. */
  sweepK: number;
  /** A creature was just let go (its key): it comes back into the world. */
  releasedAt: number;
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
  jar: null,
  jarTab: null,
  sweepAt: 0,
  sweepK: -1,
  releasedAt: 0,
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
  setMode: (m) => set({ mode: m, lensOn: m === "lens" ? get().lensOn : null, photo: null, page: m === "guide" ? get().page : null, sweepK: -1 }),
  emit: () => undefined,
  seen: () => undefined,
  tapCreature: () => undefined,
  showToast: (icon, text) => set({ toast: { icon, text, at: Date.now() } }),
}));
