// The Biome Frontier's props sub-tree (key `biomeFrontier` in the game's props). Every learner-facing
// word is a LocalizedText {en, fr}; every model / texture / sound is a URL prop.
import type { LocalizedText } from "../../block";

/** One of the three linked areas. id: rainforest | canyon | coast */
export interface Biome {
  id: string;
  name: LocalizedText;
  /** Big icon for the picture-only mode (ages 4-6). */
  icon: string;
  /** Button / badge colour (hex). Colour is never the only cue: icon + name always shown. */
  color: string;
  /** Shown on the area's sign board: what this biome is like (true, short). */
  about: LocalizedText;
}

/** A living thing to sort into its biome during the field survey. */
export interface Species {
  id: string;
  /** Biome id where it lives. */
  biome: string;
  name: LocalizedText;
  icon: string;
  /** Optional picture (a render of its model); empty = show the icon. */
  imageUrl: string;
  /** One true fact for ages 7-12, shown once it is sorted. */
  fact: LocalizedText;
  /** The same idea in a few easy words, for ages 4-6. */
  factEasy: LocalizedText;
  /** A kind clue after a wrong guess (never the answer itself). */
  hint: LocalizedText;
}

/** A fossil in the dig face. layer 0 = the deepest (oldest) rock layer. */
export interface Fossil {
  id: string;
  layer: number;
  name: LocalizedText;
  icon: string;
  /** Roughly how old, in words ("about 500 million years old"). */
  age: LocalizedText;
}

export interface BiomeUi {
  title: LocalizedText;
  surveyChip: LocalizedText;
  digChip: LocalizedText;
  findCards: LocalizedText;
  cardTitle: LocalizedText;
  whereLives: LocalizedText;
  whereLivesEasy: LocalizedText;
  rightBiome: LocalizedText;
  tryAgain: LocalizedText;
  showMe: LocalizedText;
  next: LocalizedText;
  close: LocalizedText;
  digTitle: LocalizedText;
  digIntro: LocalizedText;
  digOldest: LocalizedText;
  digOldestEasy: LocalizedText;
  digOldestRight: LocalizedText;
  digOldestWrong: LocalizedText;
  digOrder: LocalizedText;
  digOrderWrong: LocalizedText;
  digOrderRight: LocalizedText;
  digDone: LocalizedText;
  layerLabel: LocalizedText;
  stationTitle: LocalizedText;
  stationIntro: LocalizedText;
  stationProgress: LocalizedText;
  roundDone: LocalizedText;
  roundScore: LocalizedText;
  playAgain: LocalizedText;
  easyMode: LocalizedText;
  explorerMode: LocalizedText;
  modeLabel: LocalizedText;
  backToGrove: LocalizedText;
  look: LocalizedText;
  notFoundYet: LocalizedText;
  digWaiting: LocalizedText;
}

export interface BiomeModels {
  jungleTree: string;
  palm: string;
  /** Nodes: bigleaf_banana, bigleaf_ear, bigleaf_sprout */
  giantLeaves: string;
  /** Node water_lip marks where the waterfall pours. */
  waterfallCliff: string;
  /** Nodes: wall_a (fossil insets), wall_b, mesa, rock_a..c */
  canyonRocks: string;
  /** Nodes: layer_0..3, fossil_trilobite, fossil_fern, fossil_ammonite, fossil_tooth */
  digSite: string;
  /** Nodes: coral_brain, coral_branch, coral_fan, coral_tubes */
  corals: string;
  pier: string;
  fieldStation: string;
  ropeBridge: string;
  /** Nodes: signpost, board_forest, board_canyon, board_coast, board_grove, camera_trap */
  signposts: string;
  trailGate: string;
  toucan: string;
  treeFrog: string;
  morpho: string;
  tortoise: string;
  hornedLizard: string;
  saguaro: string;
  seaTurtle: string;
  clownfish: string;
  seaStar: string;
  /** Shared with the Idea Grove (OpenWorld's own assets). */
  fern: string;
  grassTuft: string;
}

export interface BiomeTextures {
  jungleFloor: string;
  sand: string;
  canyonFloor: string;
  waterNormal: string;
}

export interface BiomeSounds {
  /** Waterfall, waves and birds (loop). */
  ambience: string;
}

export interface BiomeFrontierProps {
  ui: BiomeUi;
  biomes: Biome[];
  /** The pool of species; each round draws `roundSize` of them (at least 2 per biome). */
  species: Species[];
  /** 6-8; the fossil dig adds 2 more answers to the round. */
  roundSize: number;
  fossils: Fossil[];
  /** Why deeper layers are older (shown after the dig). */
  layersFact: LocalizedText;
  layersFactEasy: LocalizedText;
  models: BiomeModels;
  textures: BiomeTextures;
  sounds: BiomeSounds;
}
