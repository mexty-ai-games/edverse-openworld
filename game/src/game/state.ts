// The live state of the grove, shared by the 3D scene (read every frame) and the HUD (read a few
// times a second). Plain mutable data: no React re-render per frame.
import type * as THREE from "three";
import { SPAWN } from "./layout";

/** Hub kinds ("lantern" | "stall" | "telescope") or a district's own, "<district>:<what>" (handled by its Activity). */
export type TargetKind = string;

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
  /** Phase 3: the tool held out for a team-up find (lantern | jar | ""), and that find's id. */
  hold?: string;
  holdC?: string;
  /** A beginner (few Field Guide pages): others may show them a creature. */
  nb?: boolean;
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
  /** Phase 3: the tool held out for a team-up find (lantern | jar | ""), and that find's id. */
  hold: string;
  holdC: string;
}

/** A preset action message between explorers (never text): BioBlitz state, team-up thanks, show a beginner. */
export type ActMsg = { t: string; [k: string]: unknown };

/** A living creature in the active zone, as the Field Camera and the hand lens see it (written by its scene every frame). */
export interface LiveCreature {
  key: string;
  /** Field Guide species id. */
  species: string;
  /** The creature's group in the scene: its world position is the centre of its bounding sphere. */
  obj: THREE.Object3D;
  /** Centre offset (local, metres) and radius of its bounding sphere. */
  cy: number;
  radius: number;
  /** What it is doing now: idle | move | feed | special | flee | hide */
  behaviour: string;
  /** In the explorer's jar: not in the world for now. */
  hidden?: boolean;
  /** The net can catch it. */
  catchable?: boolean;
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
  /**
   * The follow camera, orbiting the explorer: yaw turns around them (0 = looking north, -Z),
   * pitch tilts between low (0) and high (1), zoom scales the distance. Dragging the scene sets them.
   */
  cam: {
    yaw: number;
    pitch: number;
    zoom: number;
    /** Field of view (degrees): the camera's zoom slider narrows it. */
    fov: number;
    /** Field Camera viewfinder: over-the-shoulder view, the explorer tiptoes. */
    aim: boolean;
    /** Hand lens close-up: the camera looks at this point from near the explorer. */
    focus: { x: number; y: number; z: number; d: number } | null;
  };
  /** The 3D view, for the Field Camera (projection of creatures) — set by the explorer's camera rig. */
  view: { camera: THREE.PerspectiveCamera | null; width: number; height: number };
  /** Creatures of the active zone (the scenes register and remove theirs). */
  creatures: LiveCreature[];
  /** The explorer's speed over the last frames (m/s), for shy creatures. */
  speed: number;
  /** The explorer walks slowly (the butterfly net is out): creatures stay calm. */
  tiptoe: boolean;
  /** Bumped when peers join or leave, so the scene re-renders its list. */
  peerVersion: number;
  emote(kind: string): void;
  say(phraseId: string, anim: string): void;
  /** Set by the presence layer to broadcast what the explorer says. */
  onSay: ((phraseId: string, anim: string) => void) | null;
  /** This explorer is a beginner (sent with the presence state). */
  newbie: boolean;
  /** Set by the presence layer: sends a preset action message to the room / sends the state now. */
  act: ((m: ActMsg) => void) | null;
  pushState: (() => void) | null;
  /** Receivers of the room's action messages (validated by the presence layer). */
  onAct: ((m: ActMsg, from: Peer) => void)[];
}

export const PHRASE_SECONDS = 4.5;

export function createGame(): Game {
  const g: Game = {
    mode: "start",
    paused: false,
    avatar: 0,
    nickname: "",
    me: { x: SPAWN.x, y: SPAWN.y, z: SPAWN.z, ry: SPAWN.ry, moving: false, emote: "", emoteAt: 0, phrase: null, phraseAt: 0, hold: "", holdC: "" },
    input: { x: 0, z: 0 },
    peers: new Map(),
    hidden: new Set(),
    targets: [],
    focus: null,
    walkTo: null,
    cam: { yaw: 0, pitch: 0.5, zoom: 1, fov: 50, aim: false, focus: null },
    view: { camera: null, width: 1, height: 1 },
    creatures: [],
    speed: 0,
    tiptoe: false,
    peerVersion: 0,
    onSay: null,
    newbie: false,
    act: null,
    pushState: null,
    onAct: [],
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
