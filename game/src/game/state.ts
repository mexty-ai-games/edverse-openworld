// The live state of the grove, shared by the 3D scene (read every frame) and the HUD (read a few
// times a second). Plain mutable data: no React re-render per frame.
import { SPAWN } from "./layout";

export type TargetKind = "lantern" | "stall" | "telescope";

export interface Target {
  key: string;
  kind: TargetKind;
  /** Lantern index or stall district id. */
  ref: string | number;
  x: number;
  z: number;
  /** How close the explorer must stand for the action button. */
  reach: number;
}

export interface Peer {
  id: string;
  nick: string;
  avatar: number;
  x: number;
  z: number;
  ry: number;
  tx: number;
  tz: number;
  tr: number;
  moving: boolean;
  emote: string;
  emoteAt: number;
  phrase: string | null;
  phraseAt: number;
  seen: number;
}

export interface Me {
  x: number;
  y: number;
  z: number;
  ry: number;
  moving: boolean;
  emote: string;
  emoteAt: number;
  phrase: string | null;
  phraseAt: number;
}

export interface Game {
  mode: "start" | "play";
  paused: boolean;
  avatar: number;
  nickname: string;
  me: Me;
  /** Movement wish from keys or the stick, screen-relative: x right, z down. */
  input: { x: number; z: number };
  peers: Map<string, Peer>;
  hidden: Set<string>;
  targets: Target[];
  focus: Target | null;
  /** A point on the ground the explorer was tapped toward (cleared by the stick or keys). */
  walkTo: { x: number; z: number } | null;
  /** Bumped when peers join or leave, so the scene re-renders its list. */
  peerVersion: number;
  emote(kind: string): void;
  say(phraseId: string, anim: string): void;
  /** Set by the presence layer to broadcast what the explorer says. */
  onSay: ((phraseId: string, anim: string) => void) | null;
}

export const PHRASE_SECONDS = 4.5;

export function createGame(): Game {
  const g: Game = {
    mode: "start",
    paused: false,
    avatar: 0,
    nickname: "",
    me: { x: SPAWN.x, y: SPAWN.y, z: SPAWN.z, ry: SPAWN.ry, moving: false, emote: "", emoteAt: 0, phrase: null, phraseAt: 0 },
    input: { x: 0, z: 0 },
    peers: new Map(),
    hidden: new Set(),
    targets: [],
    focus: null,
    walkTo: null,
    peerVersion: 0,
    onSay: null,
    emote(kind: string) {
      g.me.emote = kind;
      g.me.emoteAt = performance.now();
    },
    say(phraseId: string, anim: string) {
      g.me.phrase = phraseId;
      g.me.phraseAt = performance.now();
      if (anim && anim !== "none") g.emote(anim);
      if (g.onSay) g.onSay(phraseId, anim);
    },
  };
  return g;
}
