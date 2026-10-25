import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useCloudSave, useLanguage, useMexty, pickLanguage } from "@mexty/sdk";
import { useGLTF, useProgress } from "@react-three/drei";
import { useLoader } from "@react-three/fiber";
import * as THREE from "three";
import { GameCanvas, GROVE_ZONE, ActiveZone } from "./scene/GameCanvas";
import { GROVE_LAYOUT } from "./scene/Players";
import { Start } from "./ui/Start";
import { Hud } from "./ui/Hud";
import { Sky } from "./ui/Sky";
import { InfoCard, CardState } from "./ui/Cards";
import { ReportNote, ReportSheet, ReportStatus, ReportTarget, sendReport } from "./ui/Report";
import { createGame, Game, Peer, Target } from "./game/state";
import { STALLS, stallPoint } from "./game/layout";
import { sound } from "./audio";
import { useSettings } from "./settings";
import { makeNickname } from "./game/nickname";
import { openPresence, Presence, roomForAge } from "./game/net";
import { GROVE, PROPS_KEY, isDistrict, loadZone } from "./zones/registry";
import { Expedition } from "./ui/Expedition";
import { defaultExpedition, defaultQuests } from "./expedition/content";
import { defaultBugGames } from "./expedition/bugGames";
import { BugGames } from "./ui/BugGames";
import "./game.css";
import "./ui/hub.css";

/** Only the languages this game ships. */
export interface LocalizedText {
  en?: string;
  fr?: string;
}

/** A shipped idea, hung as a lantern on the Idea Tree. Credited by generated nickname only. */
export interface Lantern {
  /** The family's generated nickname (ignored when `by` is "team"). */
  nickname: string;
  /** Who shared the idea: kid (a family, through the EdVerse idea queue) | team (the MEXTY team). Defaults to kid. */
  by?: string;
  title: LocalizedText;
  /** District id: idea-grove | biome-frontier | chrono-quarter | skyharbor | anywhere */
  where: string;
  /** ISO date the idea was built into the world. */
  shippedAt: string;
}

/** A small 3D model shown on a plinth in front of a district's stall: a taste of what is there. */
export interface DistrictPreview {
  /** Public .glb URL (MEXTY Asset Catalogue). */
  modelUrl: string;
  label: LocalizedText;
  /** Author credit shown under the label (third-party assets), e.g. "Quaternius (CC0)". */
  credit?: string;
}

/** A district of the world: its stall in the Grove shows its concept art and the door into it. */
export interface District {
  id: string;
  name: LocalizedText;
  teaser: LocalizedText;
  /** What players will learn there. */
  learns: LocalizedText;
  imageUrl: string;
  imageAlt: LocalizedText;
  /** Up to 3 models shown in front of the stall. */
  previews?: DistrictPreview[];
}

export interface DistrictName {
  id: string;
  name: LocalizedText;
}

export interface Star {
  /** Position in the telescope view, 0..100 both ways. */
  x: number;
  y: number;
  /** Drawn size (brighter stars are bigger). */
  size: number;
}

/** A real constellation to find through the telescope. */
export interface Constellation {
  id: string;
  name: LocalizedText;
  /** How to spot its shape, for a child. */
  hint: LocalizedText;
  /** A true fact shown once it is found. */
  fact: LocalizedText;
  stars: Star[];
  /** Pairs of star indexes joined by a line once found. */
  lines: number[][];
}

/** A preset phrase or emote of the phrase wheel (no free text between players). */
export interface Phrase {
  id: string;
  icon: string;
  text: LocalizedText;
  /** Avatar animation played with it: none | wave | cheer */
  anim: string;
}

/** An avatar preset: colours applied to the one rigged base model. */
export interface AvatarPreset {
  id: string;
  skin: string;
  hair: string;
  shirt: string;
  pants: string;
  shoes: string;
  bag: string;
}

export interface Models {
  tree: string;
  forestTree: string;
  lantern: string;
  plaza: string;
  stallBiome: string;
  stallChrono: string;
  stallSky: string;
  telescope: string;
  boulders: string;
  fern: string;
  flowers: string;
  grassTuft: string;
  avatar: string;
}

export interface Textures {
  grass: string;
  dirt: string;
}

export interface Sounds {
  ambience: string;
  chime: string;
  pop: string;
  success: string;
}

/** Short voice-over lines (audio URLs per language), played for ages 4-6 and by the speaker button. */
export interface VoiceLines {
  welcome?: LocalizedText;
  move?: LocalizedText;
  tapGlow?: LocalizedText;
  biomeFrontier?: LocalizedText;
  chronoQuarter?: LocalizedText;
  skyharbor?: LocalizedText;
  wellDone?: LocalizedText;
  tryAgain?: LocalizedText;
  backGate?: LocalizedText;
  thanks?: LocalizedText;
}

export interface UiText {
  title: LocalizedText;
  tagline: LocalizedText;
  loading: LocalizedText;
  chooseLook: LocalizedText;
  yourName: LocalizedText;
  newName: LocalizedText;
  enter: LocalizedText;
  howToKeys: LocalizedText;
  howToTouch: LocalizedText;
  ideaBy: LocalizedText;
  /** Kicker of a lantern whose idea came from the MEXTY team. */
  ideaByTeam?: LocalizedText;
  /** Heading of the preview list on a stall card. */
  youWillSee?: LocalizedText;
  livesIn: LocalizedText;
  builtOn: LocalizedText;
  lanternCount: LocalizedText;
  noLanterns: LocalizedText;
  readLantern: LocalizedText;
  look: LocalizedText;
  comingSoon: LocalizedText;
  comingSoonText: LocalizedText;
  youWillLearn: LocalizedText;
  close: LocalizedText;
  telescope: LocalizedText;
  useTelescope: LocalizedText;
  skyTitle: LocalizedText;
  skyFind: LocalizedText;
  skyTapHint: LocalizedText;
  skyTryAgain: LocalizedText;
  skyFound: LocalizedText;
  skyNext: LocalizedText;
  skyShowMe: LocalizedText;
  skyDone: LocalizedText;
  skyAgain: LocalizedText;
  skyProgress: LocalizedText;
  say: LocalizedText;
  settings: LocalizedText;
  quality: LocalizedText;
  qualityAuto: LocalizedText;
  qualityLow: LocalizedText;
  qualityMedium: LocalizedText;
  qualityHigh: LocalizedText;
  sound: LocalizedText;
  on: LocalizedText;
  off: LocalizedText;
  changeExplorer: LocalizedText;
  explorersHere: LocalizedText;
  aloneHere: LocalizedText;
  roomNote: LocalizedText;
  hidePlayer: LocalizedText;
  showPlayer: LocalizedText;
  paused: LocalizedText;
  lookLabel: LocalizedText;
  loadError: LocalizedText;
  retry: LocalizedText;
  /** Badge of an open district's stall. */
  nowOpen?: LocalizedText;
  /** Stall card button, {place} = the district's name. */
  enterDistrict?: LocalizedText;
  /** Shown while the next place loads, {place}. */
  entering?: LocalizedText;
  /** HUD button inside a district. */
  backToGrove?: LocalizedText;
  /** Start button of a returning explorer, {place}. */
  resume?: LocalizedText;
  /** Speaker button (voice lines). */
  listen?: LocalizedText;
  /** One-tap report. */
  report?: LocalizedText;
  reportTitle?: LocalizedText;
  reportUnkind?: LocalizedText;
  reportScary?: LocalizedText;
  reportPersonal?: LocalizedText;
  reportBroken?: LocalizedText;
  reportOther?: LocalizedText;
  reportThanks?: LocalizedText;
  reportGuest?: LocalizedText;
  reportError?: LocalizedText;
}

// ---- Biome Frontier (props key `biomeFrontier`), defined here so the props schema parser sees it; zones/biome-frontier/types.ts re-exports it ----

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

/** A fossil of the dig block. layer 0 = the top (youngest) soil layer, 3 = the deepest; it lies on the layer under `layer`. */
export interface Fossil {
  id: string;
  /** The dig layer (0 top .. 3 deepest) that covers it: digging that layer away uncovers it. */
  layer: number;
  name: LocalizedText;
  icon: string;
  /** Roughly how old, in words ("about 500 million years old"). */
  age: LocalizedText;
  /** Age in millions of years (the timeline places it). */
  ageMyr: number;
  /** The period it comes from ("Cambrian"). */
  period: LocalizedText;
  /** One true fact, shown when it is brushed clean. */
  fact: LocalizedText;
  factEasy: LocalizedText;
  /** Where the fact and the age can be checked. */
  source: string;
  /** Its 3D model (lies at `spot` in the dig block) and picture. */
  modelUrl: string;
  iconUrl: string;
  /** Position in the dig block (block-local metres x, y, z; y = the top of the layer below). */
  spot: number[];
}

export interface BiomeUi {
  title: LocalizedText;
  showMe: LocalizedText;
  next: LocalizedText;
  close: LocalizedText;
  digTitle: LocalizedText;
  digIntro: LocalizedText;
  digDone: LocalizedText;
  layerLabel: LocalizedText;
  stationTitle: LocalizedText;
  playAgain: LocalizedText;
  easyMode: LocalizedText;
  explorerMode: LocalizedText;
  modeLabel: LocalizedText;
  backToGrove: LocalizedText;
  look: LocalizedText;
  digWaiting: LocalizedText;
  // the real dig (trowel and brush on the dig block)
  digNeedTools: LocalizedText;
  trowel: LocalizedText;
  brush: LocalizedText;
  trowelHint: LocalizedText;
  brushHint: LocalizedText;
  useBrush: LocalizedText;
  useTrowel: LocalizedText;
  brushFirst: LocalizedText;
  layerGone: LocalizedText;
  fossilFound: LocalizedText;
  timeline: LocalizedText;
  timelineNow: LocalizedText;
  deeperOlder: LocalizedText;
  mya: LocalizedText;
  digAgain: LocalizedText;
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
  /** Nodes: layer_0..3, fossil_trilobite, fossil_fern, fossil_ammonite, fossil_tooth (the canyon's fossil face, scenery) */
  digSite: string;
  /** The dig block: nodes dig_layer0..3 (top to deepest, pivot at their base), dig_bedrock, dig_frame. */
  digBlock: string;
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
  /** The fossils of the dig block, from the top layer down. */
  fossils: Fossil[];
  /** Why deeper layers are older (shown after the dig). */
  layersFact: LocalizedText;
  layersFactEasy: LocalizedText;
  models: BiomeModels;
  textures: BiomeTextures;
  sounds: BiomeSounds;
}

// ---- Chrono Quarter (props key `chronoQuarter`), defined here so the props schema parser sees it; zones/chrono-quarter/types.ts re-exports it ----

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

// ---- Skyharbor (props key `skyharbor`), defined here so the props schema parser sees it; zones/skyharbor/types.ts re-exports it ----

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

// ---- The first expedition (props keys `quests` and `expedition`): the Grove Keeper, quests, tools, the Field Guide ----

/** One step of a quest. Steps run in order; a step is done when `count` different things matched it. */
export interface QuestStep {
  id: string;
  /** talk (walk up to / tap the Grove Keeper) | find (glowing seeds) | tool (own a tool) | visit (enter a zone) | photo | identify (hand lens) | observe (photo of a behaviour) | release (caught, looked at and let go where found) | measure (tape) | weigh (scale) | dig (all fossils of the dig block) | games (a full Bug Games round) */
  kind: string;
  /** What matches: "keeper", "spark", a tool id, a zone id, a species id, or "any". */
  target: string;
  /** How many different matches finish the step (e.g. 3 different species). */
  count: number;
  /** Only counts in this zone (idea-grove or a district id); empty = anywhere. */
  zone?: string;
  /** Icon of the quest tracker chip. */
  icon: string;
  /** Tracker text ({n} done of {count}). */
  text: LocalizedText;
  /** The keeper line that says this step out loud (tracker speaker button, start of the step). */
  line?: string;
  /** talk steps: the dialogue the keeper says when the explorer reaches him. */
  dialogue?: string;
}

export interface Quest {
  id: string;
  icon: string;
  title: LocalizedText;
  /** Dialogue the keeper says when the quest starts. */
  intro?: string;
  /** Dialogue when it is finished (before the next quest starts). */
  done?: string;
  /** Tool ids given when the quest starts. */
  giveAtStart: string[];
  /** Tool ids given when the quest is finished. */
  reward: string[];
  steps: QuestStep[];
  /** When this quest is done, the learning record gets complete(Field Guide stages, total). */
  report?: boolean;
}

/** A line the Grove Keeper says (speech bubble, next button only), with its voice-over. */
export interface KeeperLine {
  id: string;
  text: LocalizedText;
  /** Voice-over audio URL per language. */
  audio?: LocalizedText;
  /** Keeper animation while saying it: talk | wave */
  anim?: string;
}

export interface Dialogue {
  id: string;
  /** Keeper line ids, in order. */
  lines: string[];
}

export interface KeeperProps {
  name: LocalizedText;
  /** Rigged model (clips idle / wave / talk); empty = the explorer base model in a naturalist's colours. */
  modelUrl: string;
  /** Portrait in the speech bubble (image URL); empty = the icon. */
  portraitUrl: string;
  icon: string;
  lines: KeeperLine[];
  dialogues: Dialogue[];
}

/** A tool of the field kit (earned by quests). id: camera | guide | lens | net | jar | tape | scale | trowel | brush */
export interface Tool {
  id: string;
  icon: string;
  /** Picture of the tool (HUD button, reward card); empty = the icon. */
  iconUrl: string;
  /** 3D model shown on the reward card / in the world; optional. */
  modelUrl: string;
  name: LocalizedText;
  about: LocalizedText;
}

/** A true fact of a Field Guide page, with where it can be checked. */
export interface GuideFact {
  text: LocalizedText;
  /** The same idea in a few easy words (ages 4-6). */
  easy: LocalizedText;
  /** Where the fact can be checked (shown small under it). */
  source: string;
}

/** What the explorer checks with the hand lens: a count (legs, arms...) or yes / no (shell, fur...). */
export interface LensFeature {
  id: string;
  /** count | yesno */
  kind: string;
  icon: string;
  question: LocalizedText;
  /** A kind tip after a wrong observation (never the answer). */
  tip: LocalizedText;
  /** count: the highest number offered. */
  max: number;
}

export interface LensCheck {
  /** LensFeature id. */
  feature: string;
  /** The true count, or 1 = yes / 0 = no. */
  value: number;
}

/** A creature (or plant) with a page in the Field Guide. Stages: seen → photographed → identified → behaviour observed; each reveals one fact. */
/** Real size and weight of a creature (the tape and the scale snap to these numbers). */
export interface Measure {
  /** Typical length in millimetres (the tape's reading). */
  lengthMm: number;
  /** How it is said, e.g. "about 1.3 cm long (12 to 15 mm)". */
  lengthText: LocalizedText;
  /** What the tape measures ("its body, head to tail, not the feelers"). */
  what: LocalizedText;
  /** Typical mass in grams (the scale's reading); 0 = not weighed. */
  massG: number;
  massText: LocalizedText;
  /** Where the numbers can be checked. */
  source: string;
}

export interface GuideSpecies {
  id: string;
  /** rainforest | canyon | coast | meadow | arena */
  biome: string;
  icon: string;
  name: LocalizedText;
  /** What the hand lens shows it is, e.g. "a bird", "an insect". */
  group: LocalizedText;
  /** Picture once photographed (render of its model); empty = the icon. */
  iconUrl: string;
  /** Silhouette shown before it is seen; empty = the icon drawn dark. */
  silhouetteUrl: string;
  /** Its 3D model in the world. */
  modelUrl: string;
  /** Size in the world (the models are about real size for small animals; 1-2 makes them easy to see). */
  scale: number;
  /** What its 'feed' behaviour looks like ("pecking fruit"); empty = it has none. */
  feed: LocalizedText;
  /** What its 'special' behaviour looks like ("basking in the sun"). */
  special: LocalizedText;
  /** 4 facts: seen, photographed, identified, behaviour observed. */
  facts: GuideFact[];
  /** What the hand lens asks the explorer to check. */
  lens: LensCheck[];
  /** Voice-over of the first fact (speaker button of its page). */
  factAudio?: LocalizedText;
  /** The page's stages (bits: 1 seen, 2 photographed, 4 identified, 8 behaviour observed, 16 caught and released, 32 measured), one fact each, in this order; empty = 1, 2, 4, 8. */
  stages?: number[];
  /** It can be caught with the net (and must be released where it was found). */
  catchable?: boolean;
  /** Real size and weight. */
  measure?: Measure;
  /** Where its body runs in its picture, tail to head (x0, y0, x1, y1 as 0..1 of the picture): the tape is laid along it. */
  iconAxis?: number[];
  /** Its camouflaged look in the wild (same rig); empty = modelUrl. */
  camoModelUrl?: string;
  /** Where to look for it (Field Guide hint). */
  habitat?: LocalizedText;
}

export interface ExpeditionUi {
  next: LocalizedText;
  close: LocalizedText;
  listen: LocalizedText;
  talk: LocalizedText;
  pickUp: LocalizedText;
  sparkName: LocalizedText;
  sparkFound: LocalizedText;
  questDone: LocalizedText;
  newTool: LocalizedText;
  allDone: LocalizedText;
  // field camera
  camera: LocalizedText;
  cameraHint: LocalizedText;
  zoom: LocalizedText;
  shutter: LocalizedText;
  noCreature: LocalizedText;
  tipCentre: LocalizedText;
  tipCloser: LocalizedText;
  tipFill: LocalizedText;
  tipBehaviour: LocalizedText;
  perfect: LocalizedText;
  starsLabel: LocalizedText;
  photoBest: LocalizedText;
  photoKept: LocalizedText;
  newPage: LocalizedText;
  tooShy: LocalizedText;
  // field guide
  guide: LocalizedText;
  guideProgress: LocalizedText;
  guideChip: LocalizedText;
  unknown: LocalizedText;
  stageSeen: LocalizedText;
  stagePhoto: LocalizedText;
  stageId: LocalizedText;
  stageBehaviour: LocalizedText;
  lockedSeen: LocalizedText;
  lockedPhoto: LocalizedText;
  lockedId: LocalizedText;
  lockedBehaviour: LocalizedText;
  source: LocalizedText;
  bestPhoto: LocalizedText;
  noPhoto: LocalizedText;
  back: LocalizedText;
  // hand lens
  lens: LocalizedText;
  lensHint: LocalizedText;
  lensFar: LocalizedText;
  lensNone: LocalizedText;
  lensTitle: LocalizedText;
  lensCompare: LocalizedText;
  lensCheck: LocalizedText;
  lensRight: LocalizedText;
  lensWrong: LocalizedText;
  lensCountHint: LocalizedText;
  yes: LocalizedText;
  no: LocalizedText;
  undo: LocalizedText;
  // behaviours
  doingIdle: LocalizedText;
  doingMove: LocalizedText;
  doingHide: LocalizedText;
  /** Biome Frontier field station board. */
  stationIntro: LocalizedText;
  // catch and release (net and jar)
  net: LocalizedText;
  netHint: LocalizedText;
  sweep: LocalizedText;
  sweepHint: LocalizedText;
  sweepKeys: LocalizedText;
  sweepFast: LocalizedText;
  sweepMiss: LocalizedText;
  sweepNone: LocalizedText;
  caught: LocalizedText;
  jarFull: LocalizedText;
  jar: LocalizedText;
  jarLook: LocalizedText;
  jarCount: LocalizedText;
  isInsect: LocalizedText;
  notInsect: LocalizedText;
  release: LocalizedText;
  releaseHere: LocalizedText;
  releaseFar: LocalizedText;
  released: LocalizedText;
  releaseFirst: LocalizedText;
  wentHome: LocalizedText;
  lookFirst: LocalizedText;
  // tape and scale
  measureTitle: LocalizedText;
  measureHint: LocalizedText;
  measureShort: LocalizedText;
  measureLong: LocalizedText;
  measureRight: LocalizedText;
  magnified: LocalizedText;
  weighTitle: LocalizedText;
  weighHint: LocalizedText;
  weighHeavy: LocalizedText;
  weighLight: LocalizedText;
  weighRight: LocalizedText;
  weighNone: LocalizedText;
  weighClear: LocalizedText;
  needTape: LocalizedText;
  // the Field Guide grows
  stageReleased: LocalizedText;
  stageMeasured: LocalizedText;
  lockedReleased: LocalizedText;
  lockedMeasured: LocalizedText;
  where: LocalizedText;
  sizes: LocalizedText;
  sizesHint: LocalizedText;
  weights: LocalizedText;
  measuredValue: LocalizedText;
  weighedValue: LocalizedText;
  guideAnimals: LocalizedText;
  guideInsects: LocalizedText;
}

export interface ExpeditionModels {
  /** A glowing seed of the "Three sparks" quest. */
  spark: string;
  /** Plants where meadow insects live (OpenWorld garden kit: node milkweed_flowering / lavender_flowering). */
  milkweed: string;
  lavender: string;
}

export interface ExpeditionSounds {
  /** Field Camera shutter; empty = a soft click made by the game. */
  shutter: string;
}

export interface ExpeditionProps {
  ui: ExpeditionUi;
  keeper: KeeperProps;
  tools: Tool[];
  species: GuideSpecies[];
  lensFeatures: LensFeature[];
  models: ExpeditionModels;
  sounds: ExpeditionSounds;
}

// ---- The Bug Games (props key `bugGames`): gentle competition of real insect talents in the Idea Grove ----

/** A time of day the explorer picks for an event (insects are cold-blooded: warmth and light matter). */
export interface GamesTime {
  id: string;
  icon: string;
  name: LocalizedText;
  /** Light colour over the arena (hex) and its brightness (0..1.5). */
  light: string;
  intensity: number;
}

/** One event: a real talent, the creature that has it, and the time it shows best. */
export interface GamesEvent {
  id: string;
  icon: string;
  name: LocalizedText;
  /** What the event compares, in a few words. */
  goal: LocalizedText;
  /** Arena piece: long_jump | weight_pull | race_lane | hide_board | night_box | dance */
  piece: string;
  /** The species id that wins it. */
  winner: string;
  /** Time ids when it shows its talent best. */
  times: string[];
  /** Scoreboard line when it wins (big, short). */
  score: LocalizedText;
  /** The true fact behind it (shown on the result card), with its source. */
  fact: LocalizedText;
  factEasy: LocalizedText;
  source: string;
  /** Kind words when the time does not suit it. */
  wrongTime: LocalizedText;
  /** What the event needs ("a jumper"): "{a} is {talent}, not {needs}". */
  needs: LocalizedText;
  /** Creatures that share the talent but are not the champion (a locust jumps too), and what to say then. */
  almostSpecies: string[];
  almost: LocalizedText;
}

/** What each creature is good at, for kind feedback ("A flea is a jumper, not a puller"). */
export interface GamesTalent {
  species: string;
  /** Its name with an article, starting a sentence ("A flea"). */
  a: LocalizedText;
  talent: LocalizedText;
}

export interface BugGamesUi {
  title: LocalizedText;
  intro: LocalizedText;
  introEasy: LocalizedText;
  start: LocalizedText;
  again: LocalizedText;
  event: LocalizedText;
  pickAthlete: LocalizedText;
  pickTime: LocalizedText;
  go: LocalizedText;
  team: LocalizedText;
  guest: LocalizedText;
  notYet: LocalizedText;
  skip: LocalizedText;
  wrongCreature: LocalizedText;
  rightCreature: LocalizedText;
  won: LocalizedText;
  roundDone: LocalizedText;
  score: LocalizedText;
  medalGold: LocalizedText;
  medalSilver: LocalizedText;
  medalBronze: LocalizedText;
  fleaGuest: LocalizedText;
  needGuide: LocalizedText;
  next: LocalizedText;
  close: LocalizedText;
  watch: LocalizedText;
  board: LocalizedText;
  enter: LocalizedText;
}

export interface BugGamesModels {
  grandstand: string;
  longJump: string;
  weightPull: string;
  raceLane: string;
  hideBoard: string;
  nightBox: string;
  podium: string;
  /** Node scoreboard_screen (material scoreboard_screen, 2:1 UV) shows the results. */
  scoreboard: string;
}

export interface BugGamesProps {
  ui: BugGamesUi;
  events: GamesEvent[];
  times: GamesTime[];
  talents: GamesTalent[];
  models: BugGamesModels;
}

export interface BlockProps {
  ui: UiText;
  /** Shipped ideas: one lantern each on the Idea Tree. */
  lanterns: Lantern[];
  /** The three districts (stalls in the grove). */
  districts: District[];
  /** Names of every district id (for lantern cards). */
  districtNames: DistrictName[];
  constellations: Constellation[];
  phrases: Phrase[];
  avatars: AvatarPreset[];
  /** English words for generated nicknames "<Adjective> <Animal> <NN>". */
  nicknameAdjectives: string[];
  nicknameAnimals: string[];
  models: Models;
  textures: Textures;
  sounds: Sounds;
  /** Biome Frontier district (science, geography). */
  biomeFrontier?: BiomeFrontierProps;
  /** Chrono Quarter district (history). */
  chronoQuarter?: ChronoQuarterProps;
  /** Skyharbor district (coding, space, engineering). */
  skyharbor?: SkyharborProps;
  voice?: VoiceLines;
  /** The first expedition: quests, in order (the quest engine runs them one after another). */
  quests?: Quest[];
  /** The Grove Keeper, the field kit and the Field Guide. */
  expedition?: ExpeditionProps;
  /** The Bug Games arena in the Idea Grove. */
  bugGames?: BugGamesProps;
}

/** Catches a model or texture that could not load, so the child sees a kind message and a retry button. */
class LoadGuard extends React.Component<{ onError: () => void; children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onError();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

export type T = (x: LocalizedText | string | undefined, vars?: Record<string, string | number>) => string;

interface ExplorerSave {
  avatar: number;
  nickname: string;
  /** Constellation ids found at least once. */
  found: string[];
  /** The zone the explorer was last in (idea-grove or a district id), to resume there. */
  zone?: string;
}

const EMPTY_SAVE: ExplorerSave = { avatar: 0, nickname: "", found: [] };
const LOCAL = typeof window !== "undefined" && /^(localhost|127\.0\.0\.1)$/.test(window.location.hostname);

type VoiceId = keyof VoiceLines;

function apiOrigin(models: Partial<Models> | undefined): string {
  for (const u of Object.values(models || {})) {
    try {
      const o = new URL(String(u)).origin;
      if (o !== window.location.origin) return o;
    } catch {
      /* relative URL (local test) */
    }
  }
  return "";
}

export const Block: React.FC<Partial<BlockProps>> = (raw) => {
  const props = raw as BlockProps;
  const ready = !!(props.ui && props.models && props.textures);
  const mexty = useMexty();
  const lang = useLanguage();
  const settings = useSettings();
  const t: T = useCallback(
    (x, vars) => {
      let s = x == null ? "" : typeof x === "string" ? x : pickLanguage(x, lang.language, lang.defaultLanguage || "en");
      if (vars) for (const k of Object.keys(vars)) s = s.split("{" + k + "}").join(String(vars[k]));
      return s;
    },
    [lang.language, lang.defaultLanguage],
  );
  const save = useCloudSave<ExplorerSave>("explorer", EMPTY_SAVE);
  const saved = save.value || EMPTY_SAVE;
  const savedRef = useRef(saved);
  savedRef.current = saved;
  const avatars = props.avatars || [];
  const [avatar, setAvatar] = useState(0);
  const [nickname, setNickname] = useState("");
  const [phase, setPhase] = useState<"start" | "play">("start");
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [card, setCard] = useState<CardState | null>(null);
  const [skyOpen, setSkyOpen] = useState(false);
  const [presence, setPresence] = useState<Presence | null>(null);
  const [roomInfo, setRoomInfo] = useState<{ online: boolean; reason: string }>({ online: false, reason: "" });
  const [zone, setZone] = useState<ActiveZone>(GROVE_ZONE);
  const [fade, setFade] = useState<string | null>(null);
  const [districtBusy, setDistrictBusy] = useState(false);
  const [shOpen, setShOpen] = useState<{ kind: string; ref?: string } | null>(null);
  const [report, setReport] = useState<{ target: ReportTarget; peerId?: string } | null>(null);
  const [reportHidden, setReportHidden] = useState(false);
  const [note, setNote] = useState<ReportStatus | null>(null);
  const [flagTarget, setFlagTarget] = useState<ReportTarget | null>(null);
  const [young, setYoung] = useState(false);
  const [expBusy, setExpBusy] = useState(false);
  const [gamesBusy, setGamesBusy] = useState(false);
  const exp = props.expedition || defaultExpedition;
  const quests = props.quests && props.quests.length ? props.quests : defaultQuests;
  /** Local screenshots only: stop drawing frames (headless software rendering is slow). */
  const [frozen, setFrozen] = useState(false);
  const game = useMemo<Game>(() => createGame(), []);
  // local testing hook (never on the store's domains)
  if (LOCAL) (window as unknown as { __owGame: Game }).__owGame = game;
  const { progress } = useProgress();
  const shown = useRef(0);
  shown.current = Math.max(shown.current, Math.min(99, Math.round(progress)));
  const words = { adj: props.nicknameAdjectives || [], animals: props.nicknameAnimals || [] };
  const switching = useRef(false);
  const lastObj = useRef<{ id: string; at: number } | null>(null);
  /** The zone whose voice lines play once its first picture is on screen. */
  const pendingVoice = useRef<string | null>(null);

  // the props of the district the explorer is in (its saved sub-tree, else the module's own defaults)
  const zoneProps = useMemo(() => {
    if (!zone.mod) return null;
    const key = PROPS_KEY[zone.id];
    return (key && (props as unknown as Record<string, unknown>)[key]) || zone.mod.defaultProps;
  }, [zone, props]);
  const activeZone = useMemo<ActiveZone>(() => ({ ...zone, props: zoneProps }), [zone, zoneProps]);
  const districtName = useMemo(() => {
    if (!zone.mod) return "";
    const d = (props.districts || []).find((x) => x.id === zone.id) || (props.districtNames || []).find((x) => x.id === zone.id);
    return d ? t(d.name) : "";
  }, [zone, props.districts, props.districtNames, t]);

  // the first screen is our own loader: the store's can go
  useEffect(() => {
    mexty.ready();
  }, [mexty]);

  // the saved explorer (or a fresh name) once the save has loaded
  const took = useRef(false);
  useEffect(() => {
    if (save.loading || took.current) return;
    took.current = true;
    setAvatar(Math.min(Math.max(0, saved.avatar || 0), Math.max(0, avatars.length - 1)));
    setNickname(saved.nickname || makeNickname(words.adj, words.animals));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [save.loading]);
  useEffect(() => {
    if (!nickname && words.adj.length && words.animals.length && took.current) setNickname(makeNickname(words.adj, words.animals));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [words.adj.length, words.animals.length]);

  game.avatar = avatar;
  game.nickname = nickname;

  // sound: the store's mute and pause win; sounds come from props
  useEffect(() => {
    if (props.sounds) sound.configure(props.sounds);
  }, [props.sounds]);
  useEffect(() => sound.setMuted(!settings.sound || !!mexty.muted), [settings.sound, mexty.muted]);
  useEffect(() => sound.suspend(!!mexty.paused), [mexty.paused]);
  useEffect(() => {
    game.paused = !!mexty.paused;
  }, [mexty.paused, game]);
  // a district plays its own ambience loop while the explorer is inside it
  useEffect(() => {
    const s = zoneProps && (zoneProps as { sounds?: { ambience?: string } }).sounds;
    sound.setAmbience((s && s.ambience) || "");
  }, [zoneProps]);

  // ages 4-6 hear the short voice lines on their own (everyone has the speaker button)
  useEffect(() => {
    let alive = true;
    mexty
      .getPlayer()
      .then((p) => {
        let max = p.ageMax;
        if (max == null && LOCAL) {
          const q = Number(new URLSearchParams(window.location.search).get("age"));
          if (q) max = q;
        }
        if (alive) setYoung(max != null && max <= 6);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [mexty]);
  const voiceUrl = useCallback((id: VoiceId) => t((props.voice || {})[id]), [props.voice, t]);
  const speak = useCallback((ids: VoiceId[]) => sound.voice(ids.map(voiceUrl)), [voiceUrl]);
  const linesFor = useCallback((zid: string): VoiceId[] => (isDistrict(zid) ? [PROPS_KEY[zid] as VoiceId, "backGate"] : ["welcome", "move", "tapGlow"]), []);
  // kind words after each answer and at the end of a round, for the youngest (every activity reports through mexty.progress)
  const cue = useRef<(id: VoiceId) => void>(() => undefined);
  const lastCue = useRef<{ id: string; at: number }>({ id: "", at: 0 });
  cue.current = (id: VoiceId) => {
    if (!young || phase !== "play") return;
    const now = performance.now();
    if (now - lastCue.current.at < 2200) return;
    lastCue.current = { id, at: now };
    sound.voice([voiceUrl(id)]);
  };
  useEffect(() => {
    const pr = mexty.progress as unknown as {
      answer: (a: { correct: boolean }) => void;
      complete: (...a: unknown[]) => void;
      __owVoice?: boolean;
    };
    if (!pr || pr.__owVoice) return;
    pr.__owVoice = true;
    const answer = pr.answer;
    const complete = pr.complete;
    // local testing record of the learning events (never on the store's domains)
    const rec = (x: unknown) => {
      if (!LOCAL) return;
      const w = window as unknown as { __owProgress?: unknown[] };
      (w.__owProgress = w.__owProgress || []).push(x);
    };
    pr.answer = (a) => {
      rec({ answer: a });
      answer(a);
      cue.current(a && a.correct ? "wellDone" : "tryAgain");
    };
    pr.complete = (...a) => {
      rec({ complete: a });
      complete(...a);
      lastCue.current.at = 0;
      cue.current("wellDone");
    };
  }, [mexty]);

  // presence: one room per zone and EdVerse age tile, opened once the player is in the world
  const api = useMemo(() => apiOrigin(props.models), [props.models]);
  useEffect(() => {
    if (phase !== "play") return;
    let alive = true;
    let pr: Presence | null = null;
    mexty
      .getPlayer()
      .then((p) => {
        const room = roomForAge(p.ageMin, p.ageMax, zone.id);
        if (!room) {
          if (alive) setRoomInfo({ online: false, reason: "age" });
          return null;
        }
        return openPresence(room, api, game);
      })
      .then((x) => {
        if (!x) return;
        if (!alive) {
          x.close();
          return;
        }
        pr = x;
        setPresence(x);
        setRoomInfo({ online: true, reason: "" });
      })
      .catch(() => alive && setRoomInfo({ online: false, reason: "offline" }));
    return () => {
      alive = false;
      if (pr) pr.close();
      setPresence(null);
    };
  }, [phase, api, game, mexty, zone.id]);

  /** Fades out, loads the district (its own chunk), puts the explorer at its spawn (or back at the stall) and fades in. */
  const goZone = useCallback(
    (id: string, fromDistrict?: string) => {
      if (switching.current || id === zone.id) return;
      switching.current = true;
      setCard(null);
      setSkyOpen(false);
      setShOpen(null);
      setReport(null);
      setDistrictBusy(false);
      sound.stopVoice();
      const placeName = (() => {
        const d = (props.districtNames || []).find((x) => x.id === id);
        return d ? t(d.name) : t(props.ui.title);
      })();
      setFade(props.ui.entering ? t(props.ui.entering, { place: placeName }) : placeName);
      const wait = new Promise((r) => window.setTimeout(r, 450));
      const load = isDistrict(id) ? loadZone(id) : Promise.resolve(null);
      Promise.all([load, wait])
        .then(([mod]) => {
          game.targets = [];
          game.focus = null;
          game.walkTo = null;
          game.input.x = game.input.z = 0;
          const layout = mod ? { id, SPAWN: mod.SPAWN, colliders: mod.colliders, groundY: mod.groundY, WORLD_R: mod.WORLD_R } : GROVE_LAYOUT;
          const st = !mod && fromDistrict ? STALLS.find((s) => s.district === fromDistrict) : undefined;
          if (st) {
            // back in front of the stall the explorer left from, facing the plaza
            const p = stallPoint(st, 0, 3.4);
            game.me.x = p.x;
            game.me.z = p.z;
            game.me.ry = st.ry;
          } else {
            game.me.x = layout.SPAWN.x;
            game.me.z = layout.SPAWN.z;
            game.me.ry = layout.SPAWN.ry;
          }
          game.me.y = layout.groundY(game.me.x, game.me.z);
          setZone({ id, mod, props: null, layout });
          pendingVoice.current = id;
          save.save({ ...savedRef.current, avatar: game.avatar, nickname: game.nickname, zone: id });
          switching.current = false;
        })
        .catch(() => {
          // the district could not download: stay where we are
          switching.current = false;
          setFade(null);
        });
    },
    [zone.id, game, props.districtNames, props.ui, t, save],
  );

  const onZoneReady = useCallback(() => {
    setLoaded(true);
    setFade(null);
    const z = pendingVoice.current;
    pendingVoice.current = null;
    if (z && young && game.mode === "play") speak(linesFor(z));
  }, [young, game, speak, linesFor]);

  const enter = () => {
    sound.unlock();
    sound.startAmbience();
    save.save({ ...saved, avatar, nickname });
    game.mode = "play";
    setPhase("play");
    try {
      mexty.gameplayStart();
    } catch {
      /* outside EdVerse */
    }
    if (isDistrict(saved.zone)) goZone(saved.zone);
    else if (young) speak(linesFor(GROVE));
  };
  const backToStart = () => {
    game.mode = "start";
    setPhase("start");
    setCard(null);
    setSkyOpen(false);
    setShOpen(null);
    setReport(null);
    sound.stopVoice();
    if (zone.mod) {
      game.targets = [];
      setZone(GROVE_ZONE);
      save.save({ ...saved, avatar, nickname, zone: GROVE });
    }
  };

  const open = useCallback(
    (c: CardState) => {
      if (game.mode !== "play") return;
      if (c.kind === "telescope") {
        setSkyOpen(true);
        sound.sfx("chime", 0.7);
      } else {
        setCard(c);
        sound.sfx(c.kind === "lantern" ? "chime" : "pop", 0.8);
      }
    },
    [game],
  );
  const openDistrict = useCallback((o: { kind: string; ref?: string }) => {
    lastObj.current = { id: o.kind + (o.ref ? ":" + o.ref : ""), at: performance.now() };
    if (String(o.kind).indexOf("skyharbor:") === 0) setShOpen({ kind: o.kind, ref: o.ref });
  }, []);
  // the HUD's action button opens the nearest thing (same as tapping it in the world); district kinds
  // ("<district>:<what>") belong to that district's Activity, which listens to the same event
  useEffect(() => {
    const h = (e: Event) => {
      const f = (e as CustomEvent<Target>).detail;
      if (!f) return;
      const k = String(f.kind);
      if (k === "lantern") open({ kind: "lantern", index: f.ref as number, empty: (f.ref as number) >= (props.lanterns || []).length });
      else if (k === "stall") open({ kind: "stall", district: String(f.ref) });
      else if (k === "telescope") open({ kind: "telescope" });
      else if (k.indexOf(":") > 0) openDistrict({ kind: k, ref: f.ref != null ? String(f.ref) : undefined });
    };
    window.addEventListener("ow-open", h);
    return () => window.removeEventListener("ow-open", h);
  }, [open, openDistrict, props.lanterns]);

  // a district card or activity is open: it gets a small flag button (report what it shows)
  const busy = districtBusy || !!shOpen;
  useEffect(() => {
    if (!busy || !zone.mod) {
      setFlagTarget(null);
      return;
    }
    const lo = lastObj.current;
    const id = lo && performance.now() - lo.at < 3000 ? lo.id : zone.id + ":activity";
    setFlagTarget({ kind: "object", id, label: districtName });
  }, [busy, zone, districtName]);

  const onFound = (id: string) => {
    if (saved.found.indexOf(id) < 0) save.save({ ...saved, avatar, nickname, found: saved.found.concat(id) });
  };

  const onPeerTap = useCallback(
    (p: Peer) => {
      if (game.mode !== "play") return;
      setReportHidden(game.hidden.has(p.id));
      setReport({ target: { kind: "player", id: p.id, label: p.nick }, peerId: p.id });
      sound.sfx("pop", 0.6);
    },
    [game],
  );
  const doReport = (reason: Parameters<typeof sendReport>[1]) => {
    const r = report;
    if (!r) return;
    // a reported explorer disappears for me at once
    if (r.peerId) game.hidden.add(r.peerId);
    setReport(null);
    sendReport(r.target, reason).then((s) => {
      setNote(s);
      if ((s === "sent" || s === "limit") && young) speak(["thanks"]);
    });
  };
  useEffect(() => {
    if (!note) return;
    const id = window.setTimeout(() => setNote(null), 5000);
    return () => window.clearTimeout(id);
  }, [note]);

  // local testing hooks (never on the store's domains)
  if (LOCAL) (window as unknown as Record<string, unknown>).__ow = { goZone, zone: zone.id, openReport: onPeerTap, freeze: setFrozen };

  const labelFor = useCallback(
    (tg: Target): [string, string] | null => {
      if (tg.kind === "keeper") return [exp.keeper.icon || "🧓", t(exp.ui.talk)];
      if (tg.kind === "spark") return ["✨", t(exp.ui.pickUp)];
      if (tg.kind === "games") return ["🏅", t((props.bugGames || defaultBugGames).ui.enter)];
      if (zone.id === "skyharbor" && zoneProps) {
        const ui = (zoneProps as SkyharborProps).ui;
        if (tg.kind === "skyharbor:robot") return ["🤖", t(ui.talkRobot)];
        if (tg.kind === "skyharbor:planets") return ["🪐", t(ui.usePlanets)];
      }
      return null;
    },
    [zone.id, zoneProps, t, exp],
  );

  if (!ready) return <div className="ow-root ow-empty">EdVerse OpenWorld</div>;

  const paused = !!mexty.paused;
  const Activity = zone.mod ? zone.mod.Activity : null;
  const resumeName = isDistrict(saved.zone) ? (props.districtNames || []).find((d) => d.id === saved.zone) : undefined;

  return (
    <div className="ow-root" onPointerDown={() => sound.unlock()}>
      <LoadGuard key={attempt} onError={() => setFailed(true)}>
        <GameCanvas
          props={props}
          game={game}
          settings={settings}
          paused={paused || frozen}
          zone={activeZone}
          onZoneReady={onZoneReady}
          onZoneError={() => {
            // a district that fails to load: back home
            switching.current = false;
            game.targets = [];
            setZone(GROVE_ZONE);
            setFade(null);
          }}
          onOpen={open}
          onDistrictOpen={openDistrict}
          onExit={() => goZone(GROVE, zone.id)}
          onPeerTap={onPeerTap}
          t={t}
        />
      </LoadGuard>
      {failed && (
        <div className="ow-loading">
          <div className="ow-loading-title">{t(props.ui.title)}</div>
          <div>{t(props.ui.loadError)}</div>
          <button
            className="ow-btn"
            onClick={() => {
              // forget the failed downloads, then build the grove again
              Object.values(props.models).forEach((u) => useGLTF.clear(u));
              try {
                useLoader.clear(THREE.TextureLoader, [props.textures.grass, props.textures.dirt]);
              } catch {
                /* not cached */
              }
              setFailed(false);
              setLoaded(false);
              setAttempt((a) => a + 1);
            }}
          >
            🔁 {t(props.ui.retry)}
          </button>
        </div>
      )}
      {!loaded && !failed && (
        <div className="ow-loading">
          <div className="ow-lantern-spin" />
          <div className="ow-loading-title">{t(props.ui.title)}</div>
          <div>
            {t(props.ui.loading)} {shown.current}%
          </div>
          <div className="ow-bar">
            <i style={{ width: shown.current + "%" }} />
          </div>
        </div>
      )}
      {loaded && phase === "start" && (
        <Start
          ui={props.ui}
          t={t}
          avatars={avatars}
          avatar={avatar}
          nickname={nickname}
          onAvatar={(i) => {
            setAvatar(i);
            game.emote("cheer");
            sound.unlock();
            sound.sfx("pop", 0.6);
          }}
          onReroll={() => {
            setNickname(makeNickname(words.adj, words.animals, nickname));
            sound.unlock();
            sound.sfx("pop", 0.5);
          }}
          onEnter={enter}
          enterLabel={resumeName && props.ui.resume ? t(props.ui.resume, { place: t(resumeName.name) }) : undefined}
        />
      )}
      {loaded && phase === "play" && (
        <Hud
          props={props}
          t={t}
          game={game}
          presence={presence}
          roomInfo={roomInfo}
          blocked={!!card || skyOpen || busy || expBusy || gamesBusy || !!report || !!fade || paused}
          onBack={backToStart}
          found={saved.found.length}
          zoneName={zone.mod ? districtName : undefined}
          onHome={zone.mod ? () => goZone(GROVE, zone.id) : undefined}
          onSpeak={props.voice ? () => speak(linesFor(zone.id)) : undefined}
          labelFor={labelFor}
        />
      )}
      {loaded && (
        <Expedition
          exp={exp}
          quests={quests}
          t={t}
          game={game}
          zone={zone.id}
          phase={phase}
          young={young}
          blocked={!!card || skyOpen || busy || gamesBusy || !!report || !!fade || paused}
          onBusy={setExpBusy}
        />
      )}
      {loaded && phase === "play" && !zone.mod && (
        <BugGames
          games={props.bugGames || defaultBugGames}
          exp={exp}
          t={t}
          game={game}
          young={young}
          blocked={!!card || skyOpen || expBusy || !!report || !!fade || paused}
          onBusy={setGamesBusy}
        />
      )}
      {loaded && phase === "play" && Activity && zoneProps && (
        <React.Fragment key={zone.id}>
          {zone.id === "biome-frontier" && <Activity props={zoneProps} expedition={exp} t={t} paused={paused} onBusy={setDistrictBusy} game={game} />}
          {zone.id === "chrono-quarter" && <Activity props={zoneProps} game={game} t={t} paused={paused} onBlockingChange={setDistrictBusy} />}
          {zone.id === "skyharbor" && shOpen && <Activity props={zoneProps} open={shOpen} t={t} onClose={() => setShOpen(null)} paused={paused} />}
        </React.Fragment>
      )}
      {flagTarget && !report && (
        <button
          className="ow-flag ow-flag-float"
          aria-label={t(props.ui.report)}
          title={t(props.ui.report)}
          onClick={() => {
            setReport({ target: flagTarget });
            sound.sfx("pop", 0.6);
          }}
        >
          🚩
        </button>
      )}
      {card && (
        <InfoCard
          card={card}
          props={props}
          t={t}
          language={lang.language}
          onClose={() => setCard(null)}
          onEnter={(d) => isDistrict(d) && goZone(d)}
          onReport={(o) => setReport({ target: { kind: "object", id: o.id, label: o.label } })}
        />
      )}
      {skyOpen && (
        <Sky
          ui={props.ui}
          t={t}
          constellations={props.constellations || []}
          onFound={onFound}
          onClose={() => setSkyOpen(false)}
          paused={paused}
        />
      )}
      {report && (
        <ReportSheet
          target={report.target}
          ui={props.ui}
          t={t}
          hidden={reportHidden}
          onToggleHide={
            report.peerId
              ? () => {
                  const id = report.peerId!;
                  if (game.hidden.has(id)) game.hidden.delete(id);
                  else game.hidden.add(id);
                  setReportHidden(game.hidden.has(id));
                }
              : undefined
          }
          onReport={doReport}
          onClose={() => setReport(null)}
        />
      )}
      {note && <ReportNote status={note} ui={props.ui} t={t} onClose={() => setNote(null)} />}
      <div className={"ow-fade" + (fade ? " on" : "")} aria-hidden={!fade}>
        <div className="ow-lantern-spin" />
        <div>{fade || ""}</div>
      </div>
      {paused && loaded && <div className="ow-paused">{t(props.ui.paused)}</div>}
    </div>
  );
};
