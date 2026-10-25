// The Bug Games' live state, shared by the arena in 3D (athletes, the sled, the night box, the scoreboard,
// the podium) and the DOM panel (choosing the athlete and the time of day). Nothing here is saved: the
// round's result goes to the expedition save (rounds played, best score) and the learning record.
import { create } from "zustand";

export interface GamesPlay {
  event: string;
  species: string;
  time: string;
  /** The right athlete at the right time: the full talent shows. */
  ok: boolean;
  /** performance.now() when it started. */
  at: number;
}

export interface BoardText {
  title: string;
  line1: string;
  line2: string;
  /** Picture of the athlete (drawn when it loads). */
  iconUrl: string;
  /** 0-3 stars, or -1 for none. */
  stars: number;
  at: number;
}

export interface GamesState {
  play: GamesPlay | null;
  board: BoardText | null;
  /** The round's medal for the explorer's team (the podium celebrates). */
  podium: { medal: "gold" | "silver" | "bronze"; at: number; team: string[] } | null;
  setPlay: (p: GamesPlay | null) => void;
  setBoard: (b: Omit<BoardText, "at">) => void;
}

export const useGames = create<GamesState>((set) => ({
  play: null,
  board: null,
  podium: null,
  setPlay: (p) => set({ play: p }),
  setBoard: (b) => set({ board: { ...b, at: performance.now() } }),
}));

/** How long an event's show lasts (seconds). */
export const PLAY_SECONDS = 3.6;
