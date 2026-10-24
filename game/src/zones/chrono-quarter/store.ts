// The Time Detective round, shared by the 3D scene (reads it every frame) and the Activity overlay
// (changes it). A tiny external store: plain data + listeners, read with useCase() in React.
import { useSyncExternalStore } from "react";
import type { CqArtifact } from "./types";
import { ARTIFACT_SPOTS } from "./layout";

export type Phase = "intro" | "hunt" | "timeline" | "done";

export interface CaseState {
  /** Bumped on every change (the scene re-reads when it differs). */
  version: number;
  phase: Phase;
  young: boolean;
  /** Artifact ids of this round, and the spot index each one lies at. */
  items: string[];
  spots: Record<string, number>;
  delivered: string[];
  carrying: string | null;
  /** Wrong stands tried per artifact. */
  misses: Record<string, number>;
  /** Era id whose stand glows to help (after enough misses), or null. */
  hintEra: string | null;
  firstTry: number;
  timelineFirstTry: boolean | null;
  startedAt: number;
}

const listeners = new Set<() => void>();
let state: CaseState = {
  version: 0,
  phase: "intro",
  young: false,
  items: [],
  spots: {},
  delivered: [],
  carrying: null,
  misses: {},
  hintEra: null,
  firstTry: 0,
  timelineFirstTry: null,
  startedAt: Date.now(),
};

export function getCase(): CaseState {
  return state;
}

export function setCase(patch: Partial<CaseState>) {
  state = { ...state, ...patch, version: state.version + 1 };
  listeners.forEach((l) => l());
}

export function useCase(): CaseState {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => {
        listeners.delete(l);
      };
    },
    getCase,
    getCase,
  );
}

function shuffle<T>(a: T[]): T[] {
  const b = a.slice();
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
}

/**
 * A new round: `size` artifacts balanced across the eras (round-robin), each lying at a spot outside
 * its own era's neighbourhood when possible, so the detective has to carry it home.
 */
export function newRound(all: CqArtifact[], eraIds: string[], size: number, young: boolean) {
  const byEra = eraIds.map((e) => shuffle(all.filter((a) => a.era === e)));
  const picked: CqArtifact[] = [];
  let k = 0;
  const n = Math.max(1, Math.min(size, all.length));
  while (picked.length < n && byEra.some((l) => l.length)) {
    const l = byEra[k % byEra.length];
    const a = l.shift();
    if (a) picked.push(a);
    k++;
  }
  const free = shuffle(ARTIFACT_SPOTS.map((_, i) => i));
  const spots: Record<string, number> = {};
  for (const a of picked) {
    let idx = free.findIndex((i) => ARTIFACT_SPOTS[i].zone !== a.era);
    if (idx < 0) idx = 0;
    spots[a.id] = free[idx];
    free.splice(idx, 1);
  }
  setCase({
    phase: "hunt",
    young,
    items: shuffle(picked.map((a) => a.id)),
    spots,
    delivered: [],
    carrying: null,
    misses: {},
    hintEra: null,
    firstTry: 0,
    timelineFirstTry: null,
    startedAt: Date.now(),
  });
}
