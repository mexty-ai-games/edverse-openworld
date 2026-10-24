// Skyharbor's props sub-tree (props key `skyharbor`). Every learner-facing word is a LocalizedText,
// every model / texture / sound is a URL prop, and the courier levels and planets are data.
import type { LocalizedText } from "../../block";

export type { LocalizedText };

export interface SkyharborModels {
  /** Brass-and-glass observatory tower (origin at the base, door facing +Z). */
  observatory: string;
  /** Wooden airship: nodes prop_0 / prop_1 spin, meshes named sails* flutter. */
  airship: string;
  /** Geodesic greenhouse: glass material sh_glass is drawn see-through, plants glow inside. */
  greenhouse: string;
  /** Robot workshop: nodes gear_0..gear_5 spin about their own axis. */
  workshop: string;
  /** The friendly courier robot: robot_body, robot_head, arm_l, arm_r (pivots at the joints). */
  robot: string;
  /** Props pack: rail, lamp, dock, crate, bench (one mesh each, at the origin). */
  harbor: string;
  /** Cliff pack: rim_a/rim_b (cliff face, top at 0), spire_a/spire_b (distant pillars), rock_a/rock_b. */
  cliff: string;
  /** Glowing plants: plant_fern, plant_bell, plant_blades, plant_caps, plant_crystal. */
  glowPlants: string;
  /** Exit gate back to the Idea Grove: node "portal" swirls. */
  gate: string;
  /** Shared OpenWorld assets of the Idea Grove (reused, they are OpenWorld's own). */
  fern: string;
  grassTuft: string;
  forestTree: string;
}

export interface SkyharborTextures {
  /** Tiling flagstones of the plaza and paths. */
  paving: string;
  /** Tiling night moss of the plateau. */
  moss: string;
}

export interface SkyharborSounds {
  ambience: string;
  beep: string;
  bump: string;
  whirr: string;
}

/**
 * One Robot Courier puzzle. `rows` is the grid, top row first, one character per cell:
 * `.` free, `#` crate (blocked), `S` robot start, `P` the part to pick up, `G` the airship (deliver here).
 */
export interface CourierLevel {
  id: string;
  /** "main" (code blocks, ages 7–12) or "simple" (arrows, ages 4–6). */
  mode: string;
  /** "sequence" | "turns" | "loops" (loops shows the repeat block and a memory limit). */
  stage: string;
  rows: string[];
  /** Where the robot looks at the start: N | E | S | W (N is up). */
  facing: string;
  /** The robot's memory: at most this many blocks (0 = no limit). */
  maxBlocks: number;
  /** A gentle tip shown under the grid. */
  tip: LocalizedText;
}

/** A planet of the Solar System, for Planet Parade (order them from the Sun). */
export interface Planet {
  id: string;
  name: LocalizedText;
  /** 1 = closest to the Sun. */
  order: number;
  /** A true fact, shown once placed. */
  fact: LocalizedText;
  /** A hint toward this planet when it is the one to find. */
  hint: LocalizedText;
  /** Drawing: main colour, second colour (bands / land), relative size, rings. */
  color: string;
  color2: string;
  size: number;
  rings: boolean;
}

/** A place in Skyharbor that shows a short true fact when the explorer looks at it. */
export interface InfoSpot {
  id: string;
  icon: string;
  title: LocalizedText;
  text: LocalizedText;
}

export interface SkyharborUi {
  name: LocalizedText;
  backToGrove: LocalizedText;
  close: LocalizedText;
  // targets (action button / labels)
  talkRobot: LocalizedText;
  usePlanets: LocalizedText;
  look: LocalizedText;
  // Robot Courier
  courierTitle: LocalizedText;
  courierIntro: LocalizedText;
  chooseMode: LocalizedText;
  modeSimple: LocalizedText;
  modeSimpleHint: LocalizedText;
  modeMain: LocalizedText;
  modeMainHint: LocalizedText;
  level: LocalizedText;
  goal: LocalizedText;
  goalSimple: LocalizedText;
  blockForward: LocalizedText;
  blockLeft: LocalizedText;
  blockRight: LocalizedText;
  blockRepeat: LocalizedText;
  arrowUp: LocalizedText;
  arrowDown: LocalizedText;
  arrowLeft: LocalizedText;
  arrowRight: LocalizedText;
  times: LocalizedText;
  loopDone: LocalizedText;
  loopInside: LocalizedText;
  program: LocalizedText;
  programEmpty: LocalizedText;
  programEmptySimple: LocalizedText;
  dragHint: LocalizedText;
  memory: LocalizedText;
  run: LocalizedText;
  reset: LocalizedText;
  clear: LocalizedText;
  undo: LocalizedText;
  showMe: LocalizedText;
  shownSolution: LocalizedText;
  msgEmpty: LocalizedText;
  msgTooLong: LocalizedText;
  msgBump: LocalizedText;
  msgEdge: LocalizedText;
  msgNoPart: LocalizedText;
  msgNotThere: LocalizedText;
  msgPicked: LocalizedText;
  msgDelivered: LocalizedText;
  msgFirstTry: LocalizedText;
  next: LocalizedText;
  roundDone: LocalizedText;
  roundScore: LocalizedText;
  playAgain: LocalizedText;
  changeMode: LocalizedText;
  questionCourier: LocalizedText;
  // Planet Parade
  planetsTitle: LocalizedText;
  planetsIntro: LocalizedText;
  planetsFind: LocalizedText;
  planetsNotYet: LocalizedText;
  planetsGood: LocalizedText;
  planetsDone: LocalizedText;
  planetsHint: LocalizedText;
  sun: LocalizedText;
  questionPlanet: LocalizedText;
}

export interface SkyharborProps {
  ui: SkyharborUi;
  /** Robot Courier puzzles (both modes); a round picks from them by stage. */
  levels: CourierLevel[];
  /** How many puzzles a round has: main mode (7–12) and simple mode (4–6). */
  roundMain: number;
  roundSimple: number;
  planets: Planet[];
  /** Fact cards: "greenhouse", "airship". */
  spots: InfoSpot[];
  models: SkyharborModels;
  textures: SkyharborTextures;
  sounds: SkyharborSounds;
}

/** What the scene asks the hub to open (the hub passes it to <Activity open=… />). */
export interface SkyharborOpen {
  /** "skyharbor:robot" | "skyharbor:planets" | "skyharbor:info" */
  kind: string;
  /** For "skyharbor:info": the InfoSpot id. */
  ref?: string;
}

export const KIND_ROBOT = "skyharbor:robot";
export const KIND_PLANETS = "skyharbor:planets";
export const KIND_INFO = "skyharbor:info";
