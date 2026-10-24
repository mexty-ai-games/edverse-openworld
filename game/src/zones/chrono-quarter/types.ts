// Props of the Chrono Quarter district (the `chronoQuarter` sub-tree of the game's props).
// Every learner-facing word is a LocalizedText {en, fr}; every model / texture / sound is a URL prop.
import type { LocalizedText } from "../../block";

/** One of the three era neighbourhoods. */
export interface CqEra {
  /** rome | edo | maya (the layout places each era's stand by this id). */
  id: string;
  name: LocalizedText;
  /** When it was, e.g. "around 100 CE". */
  period: LocalizedText;
  /** A year inside the era, used to check the timeline order (smaller = longer ago). */
  sortYear: number;
  /** Emoji shown on its sign, cards and buttons (icon mode for 4-6). */
  icon: string;
  /** Colour of its sign and buttons (CSS colour). */
  color: string;
  /** A true fact about the era, shown at its display stand. */
  intro: LocalizedText;
}

/** A lost artifact to bring back to its era. */
export interface CqArtifact {
  id: string;
  /** Era id it belongs to. */
  era: string;
  name: LocalizedText;
  /** What it looks like / what it is for (shown when picked up, before the era is known). */
  clue: LocalizedText;
  /** A true fact, shown when it reaches the right era (ages 7-12). */
  fact: LocalizedText;
  /** The same fact in one short sentence (little detectives, 4-6). */
  factSimple: LocalizedText;
  icon: string;
  /** Mesh name inside models.artifacts. */
  mesh: string;
  /** Scale in the world (the meshes are real size; 2-4 makes them easy to spot). */
  scale: number;
}

export interface CqUi {
  title: LocalizedText;
  intro: LocalizedText;
  introYoung: LocalizedText;
  start: LocalizedText;
  caseFile: LocalizedText;
  returned: LocalizedText;
  lostHere: LocalizedText;
  pickUp: LocalizedText;
  carryHint: LocalizedText;
  carrying: LocalizedText;
  putBack: LocalizedText;
  question: LocalizedText;
  correct: LocalizedText;
  wrong: LocalizedText;
  hint: LocalizedText;
  standOf: LocalizedText;
  standEmpty: LocalizedText;
  standHas: LocalizedText;
  allReturned: LocalizedText;
  dialTitle: LocalizedText;
  dialAsk: LocalizedText;
  dialAskYoung: LocalizedText;
  dialWrong: LocalizedText;
  dialNotYet: LocalizedText;
  dialRight: LocalizedText;
  oldest: LocalizedText;
  newest: LocalizedText;
  done: LocalizedText;
  score: LocalizedText;
  again: LocalizedText;
  close: LocalizedText;
  next: LocalizedText;
  young: LocalizedText;
  big: LocalizedText;
  gate: LocalizedText;
  dial: LocalizedText;
}

export interface CqModels {
  temple: string;
  columns: string;
  fountain: string;
  pavilion: string;
  bridge: string;
  stoneLantern: string;
  pyramid: string;
  stela: string;
  cherry: string;
  streetLamp: string;
  gate: string;
  plinths: string;
  dial: string;
  jungle: string;
  pondLife: string;
  artifacts: string;
  /** Idea Grove (OpenWorld) models reused here. */
  boulders: string;
  forestTree: string;
  fern: string;
  flowers: string;
  grassTuft: string;
}

export interface CqTextures {
  grass: string;
  dirt: string;
  cobbles: string;
  paving: string;
  /** Hazy far-off skyline (PNG with alpha), wraps around the horizon. */
  skyline: string;
}

export interface CqSounds {
  ambience: string;
}

export interface ChronoQuarterProps {
  ui: CqUi;
  eras: CqEra[];
  artifacts: CqArtifact[];
  /** Artifacts per round, ages 7+ (6-10). */
  roundSize: number;
  /** Artifacts per round in little-detective mode (ages 4-6). */
  roundSizeYoung: number;
  /** Wrong tries before the right stand starts to glow (ages 7+). */
  hintAfter: number;
  /** Shown when the timeline is ordered. */
  timelineFact: LocalizedText;
  timelineFactSimple: LocalizedText;
  models: CqModels;
  textures: CqTextures;
  sounds: CqSounds;
}
